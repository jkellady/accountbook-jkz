/**
 * Month-End Close Server Actions
 * JK Zentra Finance Cockpit — Sprint 1
 *
 * Core discipline: at month end, run the 8-check checklist, perform bank
 * reconciliation, and "close" the month — locking all transactions.
 * Once closed, transactions require explicit reopen to edit.
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  TransactionType,
  TransactionStatus,
  PeriodStatus,
  MonthCloseInsert,
  MonthCloseRow,
  AuditLogInsert,
} from '@/lib/supabase/database.types'
import { revalidatePath } from 'next/cache'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** Single result from one of the 8 pre-close checks. */
export interface CheckResult {
  /** Human-readable check name. */
  name: string
  /** Whether the check passed. */
  passed: boolean
  /** Detail message (count, description, etc.). */
  details: string
  /** Whether the user may waive this check and still proceed. */
  waivable: boolean
}

/** Return shape of {@link runCloseChecklist}. */
export interface ChecklistOutcome {
  checks: CheckResult[]
  allPassed: boolean
}

/** Parameters for {@link closeMonth}. */
export interface CloseMonthParams {
  year: number
  month: number
  entityId: string
  openingBalanceMinor?: number
  closingBalanceMinor?: number
  reconciliationNote?: string
  waivedChecks?: { checkName: string; reason: string }[]
  referencePrefix?: string
}

/** Return shape of {@link closeMonth}. */
export interface CloseMonthResult {
  closeId: string
  packFileId: string | null
}

/** Return shape of {@link getCloseStatus}. */
export interface CloseStatus {
  isClosed: boolean
  closedAt: string | null
  reopenedAt: string | null
  canClose: boolean
}

/** Return shape of {@link generateAccountantPack}. */
export interface AccountantPackResult {
  packFileId: string
  downloadUrl: string
}

/** Reference code prefixes assigned per transaction type during close. */
const REFERENCE_PREFIXES: Record<string, string> = {
  income: 'INC',
  expense: 'EXP',
  tax_prepayment: 'TAX',
  tax_payment_final: 'TXF',
  tax_reserve_transfer: 'TXR',
}

// Helper to get month date range
function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
  return { start, end }
}

// Helper to format minor units as RM
function formatRM(minor: number | null | undefined): string {
  if (minor == null) return 'RM —'
  const ringgit = (minor / 100).toFixed(2)
  return `RM ${ringgit}`
}

// ----------------------------------------------------------------------------
// 1. Run the 8-check pre-close checklist
// ----------------------------------------------------------------------------

/**
 * Run the 8-check pre-close checklist against a given month and entity.
 *
 * Validates that the bookkeeping period is ready to be closed:
 *  1. All income logged (or user confirms none)
 *  2. All active transactions have receipt files attached
 *  3. Review queue is empty (no pending_review transactions)
 *  4. Categories properly assigned (warn if >5% uncategorised)
 *  5. Entity assigned to every transaction
 *  6. Subscriptions reconciled (each active sub that should charge has a linked tx)
 *  7. Projects updated (delivered/fully-paid projects advanced)
 *  8. CP500 logged if an instalment was due
 *
 * @param year   — calendar year (e.g. 2026)
 * @param month  — calendar month (1–12)
 * @param entityId — UUID of the entity to check
 * @returns      — {@link ChecklistOutcome}
 */
export async function runCloseChecklist(
  year: number,
  month: number,
  entityId: string
): Promise<ChecklistOutcome> {
  const supabase = await createClient()
  const { start, end } = getMonthRange(year, month)

  // --- Base query: all transactions in the month for this entity ---
  const { data: allTxns, error: txnsError } = await supabase
    .from('transactions')
    .select('id, type, status, category, entity_id, file_id, subscription_id, project_id, amount_minor, myr_equiv_minor')
    .eq('entity_id', entityId)
    .gte('occurred_at', start)
    .lte('occurred_at', end)
    .neq('status', 'archived')

  if (txnsError) throw new Error(`Failed to load transactions: ${txnsError.message}`)
  const txns = allTxns ?? []

  const checks: CheckResult[] = []

  // Check 1: All income logged
  const incomeCount = txns.filter((t) => t.type === 'income').length
  checks.push({
    name: 'All income logged',
    passed: incomeCount > 0,
    details: incomeCount > 0 ? `${incomeCount} income transaction(s) found` : 'No income transactions recorded for this month',
    waivable: true,
  })

  // Check 2: All active transactions have receipts (file_id IS NOT NULL)
  const activeTxns = txns.filter((t) => t.status === 'active')
  const missingReceipts = activeTxns.filter((t) => t.file_id == null)
  checks.push({
    name: 'All transactions have receipts',
    passed: missingReceipts.length === 0,
    details: missingReceipts.length === 0
      ? 'All active transactions have attached receipts'
      : `${missingReceipts.length} active transaction(s) missing receipts`,
    waivable: true,
  })

  // Check 3: Review queue empty (no pending_review)
  const pendingCount = txns.filter((t) => t.status === 'pending_review').length
  checks.push({
    name: 'Review queue empty',
    passed: pendingCount === 0,
    details: pendingCount === 0
      ? 'No transactions pending review'
      : `${pendingCount} transaction(s) still pending review`,
    waivable: false,
  })

  // Check 4: Categories assigned (warn if >5% are null or 'Other')
  const categorisedTxns = txns.filter((t) => t.category != null && t.category !== 'Other')
  const uncategorisedCount = txns.length - categorisedTxns.length
  const uncategorisedPercent = txns.length > 0 ? (uncategorisedCount / txns.length) * 100 : 0
  checks.push({
    name: 'Categories assigned',
    passed: uncategorisedPercent <= 5,
    details: txns.length === 0
      ? 'No transactions to categorise'
      : `${uncategorisedPercent.toFixed(1)}% uncategorised (${uncategorisedCount} of ${txns.length})`,
    waivable: true,
  })

  // Check 5: Entity assigned (should always be true via FK, but belt-and-suspenders)
  const missingEntity = txns.filter((t) => t.entity_id == null).length
  checks.push({
    name: 'Entity assigned',
    passed: missingEntity === 0,
    details: missingEntity === 0 ? 'All transactions have an entity' : `${missingEntity} transaction(s) missing entity`,
    waivable: false,
  })

  // Check 6: Subscriptions reconciled
  // Each active subscription that should have charged this month has a linked transaction
  const { data: subs, error: subsError } = await supabase
    .from('subscriptions')
    .select('id, name, billing_cycle, last_paid_at, next_payment_at, status')
    .eq('entity_id', entityId)
    .in('status', ['active', 'trial'])

  if (subsError) throw new Error(`Failed to load subscriptions: ${subsError.message}`)

  let unreconciledSubs = 0
  for (const sub of subs ?? []) {
    // Determine if this sub should have charged this month
    const shouldCharge = subShouldHaveChargedThisMonth(sub, year, month)
    if (shouldCharge) {
      const hasLinkedTxn = txns.some((t) => t.subscription_id === sub.id)
      if (!hasLinkedTxn) unreconciledSubs++
    }
  }
  checks.push({
    name: 'Subscriptions reconciled',
    passed: unreconciledSubs === 0,
    details: unreconciledSubs === 0
      ? 'All expected subscription charges have linked transactions'
      : `${unreconciledSubs} subscription(s) expected a charge but have no linked transaction`,
    waivable: true,
  })

  // Check 7: Projects updated
  // Any delivered/fully-paid project should have been advanced
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('id, name, status, actual_delivery_date, closed_date')
    .eq('entity_id', entityId)
    .in('status', ['delivered', 'fully_paid'])

  if (projError) throw new Error(`Failed to load projects: ${projError.message}`)

  const staleProjects = (projects ?? []).filter((p) => {
    // delivered projects should have closed_date set
    // fully_paid projects should have closed_date set
    return p.closed_date == null
  }).length

  checks.push({
    name: 'Projects updated',
    passed: staleProjects === 0,
    details: staleProjects === 0
      ? 'All delivered/fully-paid projects are properly closed'
      : `${staleProjects} project(s) delivered/fully-paid but not closed`,
    waivable: true,
  })

  // Check 8: CP500 logged (if due)
  // Check user's CP500 schedule for this month
  const { data: userSettings } = await supabase
    .from('users')
    .select('settings')
    .single()

  const cp500Schedule = (userSettings?.settings as Record<string, unknown>)?.cp500_schedule as
    | Array<{ due_date: string; status?: string; amount_minor: number }>
    | undefined

  let cp500Due = false
  if (cp500Schedule && cp500Schedule.length > 0) {
    cp500Due = cp500Schedule.some((inst) => {
      const due = new Date(inst.due_date)
      return due.getFullYear() === year && due.getMonth() + 1 === month
    })
  }

  const cp500Txn = txns.some((t) => t.type === 'tax_prepayment')
  checks.push({
    name: 'CP500 logged (if due)',
    passed: !cp500Due || cp500Txn,
    details: !cp500Due
      ? 'No CP500 instalment due this month'
      : cp500Txn
        ? 'CP500 tax prepayment recorded'
        : 'CP500 instalment is due this month but no tax_prepayment transaction found',
    waivable: true,
  })

  const allPassed = checks.every((c) => c.passed)
  return { checks, allPassed }
}

/**
 * Determine whether an active subscription should have produced a charge
 * in the given calendar month.
 */
function subShouldHaveChargedThisMonth(
  sub: {
    billing_cycle: string
    last_paid_at: string | null
    next_payment_at: string | null
    status: string
  },
  year: number,
  month: number
): boolean {
  // If next_payment_at falls in this month, it should charge
  if (sub.next_payment_at) {
    const np = new Date(sub.next_payment_at)
    if (np.getFullYear() === year && np.getMonth() + 1 === month) return true
  }

  // If last_paid_at falls in this month, it's already charged
  if (sub.last_paid_at) {
    const lp = new Date(sub.last_paid_at)
    if (lp.getFullYear() === year && lp.getMonth() + 1 === month) return true
  }

  // For monthly subscriptions, if neither is set but it's active, assume it should charge
  if (sub.billing_cycle === 'monthly' && sub.status === 'active') {
    return true
  }

  return false
}

// ----------------------------------------------------------------------------
// 2. Close a month
// ----------------------------------------------------------------------------

/**
 * Close a bookkeeping month.
 *
 * Sequence:
 *  1. Validate all 8 checks pass (or user waives with note)
 *  2. Assign sequential reference codes per type (INC_001, EXP_001, …)
 *  3. Set period_status='closed' on ALL transactions in the month
 *  4. Create month_closes record with checklist results + reconciliation data
 *  5. (Stub) Generate Income Statement PDF → files table
 *  6. (Stub) Generate Accountant Pack ZIP → files table
 *  7. Link pack_file_id to month_closes record
 *  8. Log in audit_log
 *
 * @param params — {@link CloseMonthParams}
 * @returns      — {@link CloseMonthResult} with the new close record ID
 */
export async function closeMonth(params: CloseMonthParams): Promise<CloseMonthResult> {
  const supabase = await createClient()
  const { year, month, entityId } = params
  const { start, end } = getMonthRange(year, month)

  // 1. Re-run checklist (user may have waived some checks)
  const { checks, allPassed } = await runCloseChecklist(year, month, entityId)
  const waivedNames = new Set((params.waivedChecks ?? []).map((w) => w.checkName))
  const effectivelyPassed = checks.every((c) => c.passed || (c.waivable && waivedNames.has(c.name)))

  if (!effectivelyPassed) {
    const failed = checks.filter((c) => !c.passed && !(c.waivable && waivedNames.has(c.name)))
    throw new Error(`Cannot close: ${failed.length} check(s) failed and not waived: ${failed.map((f) => f.name).join(', ')}`)
  }

  // 2. Fetch transactions to assign reference codes
  const { data: txns, error: txnsError } = await supabase
    .from('transactions')
    .select('id, type, amount_minor, myr_equiv_minor, occurred_at, vendor, category, description')
    .eq('entity_id', entityId)
    .gte('occurred_at', start)
    .lte('occurred_at', end)
    .neq('status', 'archived')
    .order('occurred_at', { ascending: true })

  if (txnsError) throw new Error(`Failed to load transactions: ${txnsError.message}`)

  // 3. Assign reference codes — sequential per type per month per entity
  const prefix = params.referencePrefix ?? `${year}-${String(month).padStart(2, '0')}`
  const counters: Record<string, number> = {
    income: 0,
    expense: 0,
    tax_prepayment: 0,
    tax_payment_final: 0,
    tax_reserve_transfer: 0,
  }

  const referenceUpdates: { id: string; reference_code: string }[] = []

  for (const txn of txns ?? []) {
    const typePrefix = REFERENCE_PREFIXES[txn.type] ?? 'TXN'
    counters[txn.type] = (counters[txn.type] ?? 0) + 1
    const seq = String(counters[txn.type]).padStart(3, '0')
    referenceUpdates.push({
      id: txn.id,
      reference_code: `${typePrefix}_${prefix}_${seq}`,
    })
  }

  // Apply reference codes in batches
  for (const update of referenceUpdates) {
    const { error: refError } = await supabase
      .from('transactions')
      .update({ reference_code: update.reference_code })
      .eq('id', update.id)

    if (refError) throw new Error(`Failed to assign reference code: ${refError.message}`)
  }

  // 4. Set period_status='closed' on all transactions in month
  const { error: closeTxnError } = await supabase
    .from('transactions')
    .update({ period_status: 'closed' as PeriodStatus })
    .eq('entity_id', entityId)
    .gte('occurred_at', start)
    .lte('occurred_at', end)

  if (closeTxnError) throw new Error(`Failed to lock transactions: ${closeTxnError.message}`)

  // 5. Compute reconciliation figures
  const incomeMinor = (txns ?? [])
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (t.myr_equiv_minor ?? t.amount_minor), 0)

  const expenseMinor = (txns ?? [])
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (t.myr_equiv_minor ?? t.amount_minor), 0)

  const openingMinor = params.openingBalanceMinor ?? 0
  const closingMinor = params.closingBalanceMinor ?? null
  const computedMinor = openingMinor + incomeMinor - expenseMinor
  const varianceMinor = closingMinor != null ? closingMinor - computedMinor : null

  // 6. Build checklist results JSONB
  const checklistResults: Record<string, unknown> = {}
  for (const check of checks) {
    checklistResults[check.name] = {
      passed: check.passed,
      details: check.details,
      waived: !check.passed && waivedNames.has(check.name),
      waiverReason: waivedNames.has(check.name)
        ? params.waivedChecks?.find((w) => w.checkName === check.name)?.reason ?? null
        : null,
    }
  }

  // 7. Create month_closes record
  const monthCloseInsert: MonthCloseInsert = {
    entity_id: entityId,
    year,
    month,
    opening_balance_minor: openingMinor,
    closing_balance_minor: closingMinor,
    computed_closing_minor: computedMinor,
    reconciliation_variance_minor: varianceMinor,
    reconciliation_note: params.reconciliationNote ?? null,
    checklist_results: checklistResults,
    reference_prefix: prefix,
  }

  const { data: closeRecord, error: closeError } = await supabase
    .from('month_closes')
    .insert(monthCloseInsert)
    .select()
    .single()

  if (closeError) {
    // If unique constraint violation, this month is already closed
    if (closeError.code === '23505') {
      throw new Error(`Month ${month}/${year} is already closed for this entity`)
    }
    throw new Error(`Failed to create month close record: ${closeError.message}`)
  }

  const closeId = closeRecord.id

  // 8. (Stub) Generate Accountant Pack — creates a placeholder files record
  let packFileId: string | null = null
  try {
    const packResult = await generateAccountantPack(year, month, entityId)
    packFileId = packResult.packFileId

    // Link pack to month_close
    const { error: linkError } = await supabase
      .from('month_closes')
      .update({ pack_file_id: packFileId })
      .eq('id', closeId)

    if (linkError) {
      console.error('Failed to link pack file to month_close:', linkError)
    }
  } catch (err: unknown) {
    console.error('Accountant pack generation failed (non-fatal):', err)
  }

  // 9. Log in audit_log
  const auditEntry: AuditLogInsert = {
    entity_type: 'month_closes',
    entity_id: closeId,
    action: 'create',
    before: null,
    after: closeRecord as unknown as Record<string, unknown>,
    user_id: '00000000-0000-0000-0000-000000000000', // Will be filled by RLS/trigger context
  }

  const { error: auditError } = await supabase.from('audit_log').insert(auditEntry)
  if (auditError) {
    console.error('Audit log insert failed (non-fatal):', auditError)
  }

  revalidatePath('/month-end')
  return { closeId, packFileId }
}

// ----------------------------------------------------------------------------
// 3. Reopen a closed month
// ----------------------------------------------------------------------------

/**
 * Reopen a previously closed month.
 *
 * Sequence:
 *  1. Validate reason (required, min 10 chars)
 *  2. Set reopened_at = NOW(), reopen_reason = input
 *  3. Set period_status='open' on all transactions in month
 *  4. Clear reference codes (set to NULL)
 *  5. Log in audit_log with action 'month_reopen'
 *
 * @param year     — calendar year
 * @param month    — calendar month (1–12)
 * @param entityId — UUID of the entity
 * @param reason   — required reopen reason (min 10 characters)
 */
export async function reopenMonth(
  year: number,
  month: number,
  entityId: string,
  reason: string
): Promise<void> {
  if (!reason || reason.trim().length < 10) {
    throw new Error('Reopen reason is required and must be at least 10 characters')
  }

  const supabase = await createClient()
  const { start, end } = getMonthRange(year, month)

  // Find the existing close record
  const { data: closeRecord, error: findError } = await supabase
    .from('month_closes')
    .select('id, reopened_at')
    .eq('entity_id', entityId)
    .eq('year', year)
    .eq('month', month)
    .single()

  if (findError) {
    throw new Error(`No close record found for ${month}/${year}: ${findError.message}`)
  }

  if (closeRecord.reopened_at) {
    throw new Error(`Month ${month}/${year} is already reopened`)
  }

  const closeId = closeRecord.id

  // 2. Set reopened fields
  const { error: reopenError } = await supabase
    .from('month_closes')
    .update({
      reopened_at: new Date().toISOString(),
      reopen_reason: reason.trim(),
    })
    .eq('id', closeId)

  if (reopenError) throw new Error(`Failed to reopen month: ${reopenError.message}`)

  // 3. Set period_status='open' on all transactions in month
  const { error: openTxnError } = await supabase
    .from('transactions')
    .update({ period_status: 'open' as PeriodStatus })
    .eq('entity_id', entityId)
    .gte('occurred_at', start)
    .lte('occurred_at', end)

  if (openTxnError) throw new Error(`Failed to unlock transactions: ${openTxnError.message}`)

  // 4. Clear reference codes
  const { error: clearRefError } = await supabase
    .from('transactions')
    .update({ reference_code: null })
    .eq('entity_id', entityId)
    .gte('occurred_at', start)
    .lte('occurred_at', end)

  if (clearRefError) throw new Error(`Failed to clear reference codes: ${clearRefError.message}`)

  // 5. Audit log — the month_close trigger will log the update, but we also
  //    insert a manual audit entry for the reopen action for clarity.
  const auditEntry: AuditLogInsert = {
    entity_type: 'month_closes',
    entity_id: closeId,
    action: 'month_reopen',
    before: { reopened_at: null, reopen_reason: null },
    after: { reopened_at: new Date().toISOString(), reopen_reason: reason.trim() },
    change_summary: { reopened_at: { from: null, to: new Date().toISOString() }, reopen_reason: { from: null, to: reason.trim() } },
    user_id: '00000000-0000-0000-0000-000000000000',
  }

  const { error: auditError } = await supabase.from('audit_log').insert(auditEntry)
  if (auditError) {
    console.error('Audit log insert failed (non-fatal):', auditError)
  }

  revalidatePath('/month-end')
}

// ----------------------------------------------------------------------------
// 4. Get close status for a month
// ----------------------------------------------------------------------------

/**
 * Check whether a month is closed and whether it is eligible to be closed.
 *
 * @param year     — calendar year
 * @param month    — calendar month (1–12)
 * @param entityId — UUID of the entity
 * @returns        — {@link CloseStatus}
 */
export async function getCloseStatus(
  year: number,
  month: number,
  entityId: string
): Promise<CloseStatus> {
  const supabase = await createClient()

  const { data: closeRecord, error } = await supabase
    .from('month_closes')
    .select('closed_at, reopened_at')
    .eq('entity_id', entityId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch close status: ${error.message}`)

  // Can close only months that are not the current or future month
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const isCurrentOrFuture = year > currentYear || (year === currentYear && month >= currentMonth)

  return {
    isClosed: closeRecord != null && closeRecord.reopened_at == null,
    closedAt: closeRecord?.closed_at ?? null,
    reopenedAt: closeRecord?.reopened_at ?? null,
    canClose: !isCurrentOrFuture,
  }
}

// ----------------------------------------------------------------------------
// 5. Generate Accountant Pack
// ----------------------------------------------------------------------------

/**
 * Generate an Accountant Pack ZIP for a closed month.
 *
 * **STUB — Phase 2 implementation:**
 * Currently creates a placeholder files record. In Phase 2 this will:
 *  - Generate an Income Statement PDF
 *  - Export transactions as CSV
 *  - Bundle into a ZIP
 *  - Upload to Supabase Storage
 *  - Create the files record
 *
 * @param year     — calendar year
 * @param month    — calendar month (1–12)
 * @param entityId — UUID of the entity
 * @returns        — {@link AccountantPackResult}
 */
export async function generateAccountantPack(
  year: number,
  month: number,
  entityId: string
): Promise<AccountantPackResult> {
  const supabase = await createClient()

  // Fetch entity name for the filename
  const { data: entity, error: entityError } = await supabase
    .from('entities')
    .select('name, slug')
    .eq('id', entityId)
    .single()

  if (entityError) throw new Error(`Failed to load entity: ${entityError.message}`)

  const entitySlug = entity.slug ?? 'entity'
  const monthPadded = String(month).padStart(2, '0')
  const filename = `accountant-pack_${entitySlug}_${year}-${monthPadded}.zip`

  // STUB: Create placeholder files record
  // Phase 2 will replace this with actual ZIP generation + storage upload
  const placeholderContent = ` Accountant Pack Placeholder\n Entity: ${entity.name}\n Period: ${monthPadded}/${year}\n\n Phase 2: This will contain Income Statement PDF + transaction CSV + receipt index.\n`

  const encoder = new TextEncoder()
  const bytes = encoder.encode(placeholderContent)

  // Compute a simple hash (SHA-256 would be done server-side in production)
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const sha256Hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  const storagePath = `packs/${entitySlug}/${year}/${monthPadded}/${filename}`

  const fileInsert = {
    storage_path: storagePath,
    original_filename: filename,
    display_filename: `Accountant Pack — ${entity.name} — ${monthPadded}/${year}`,
    mime_type: 'application/zip',
    size_bytes: bytes.length,
    sha256_hash: sha256Hash,
    source: 'web' as const,
    entity_id: entityId,
  }

  const { data: fileRecord, error: fileError } = await supabase
    .from('files')
    .insert(fileInsert)
    .select()
    .single()

  if (fileError) throw new Error(`Failed to create pack file record: ${fileError.message}`)

  // Build a download URL (placeholder — will be a signed Supabase Storage URL in production)
  const downloadUrl = `/api/files/download/${fileRecord.id}`

  return { packFileId: fileRecord.id, downloadUrl }
}

// ----------------------------------------------------------------------------
// 6. Get list of closed months for an entity
// ----------------------------------------------------------------------------

/**
 * Retrieve the close history for an entity.
 *
 * @param entityId — UUID of the entity
 * @returns        — Array of month close records, ordered by year desc, month desc
 */
export async function getCloseHistory(entityId: string): Promise<MonthCloseRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('month_closes')
    .select('*')
    .eq('entity_id', entityId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) throw new Error(`Failed to load close history: ${error.message}`)

  return data ?? []
}

// ----------------------------------------------------------------------------
// 7. Get transactions for a month (for reference code assignment display)
// ----------------------------------------------------------------------------

/**
 * Fetch all non-archived transactions for a given month and entity.
 *
 * @param year     — calendar year
 * @param month    — calendar month (1–12)
 * @param entityId — UUID of the entity
 * @returns        — Array of transaction rows
 */
export async function getMonthTransactions(
  year: number,
  month: number,
  entityId: string
) {
  const supabase = await createClient()
  const { start, end } = getMonthRange(year, month)

  const { data, error } = await supabase
    .from('transactions')
    .select('id, type, amount_minor, currency, myr_equiv_minor, occurred_at, vendor, category, subcategory, description, status, period_status, reference_code, file_id, subscription_id, project_id')
    .eq('entity_id', entityId)
    .gte('occurred_at', start)
    .lte('occurred_at', end)
    .neq('status', 'archived')
    .order('occurred_at', { ascending: true })

  if (error) throw new Error(`Failed to load transactions: ${error.message}`)

  return data ?? []
}

// ----------------------------------------------------------------------------
// 8. Formatting helpers (re-exported for components)
// ----------------------------------------------------------------------------

/**
 * Format a minor-unit amount as Malaysian Ringgit string.
 *
 * @param minor — amount in sen (minor units)
 * @returns     — formatted string e.g. "RM 1,234.56"
 */
export function formatRM(minor: number | null | undefined): string {
  if (minor == null) return 'RM —'
  const ringgit = (minor / 100).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `RM ${ringgit}`
}

/**
 * Format a year+month pair as a human-readable month name.
 *
 * @param year  — calendar year
 * @param month — calendar month (1–12)
 * @returns     — e.g. "May 2026"
 */
export function formatMonthYear(year: number, month: number): string {
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
}

/**
 * Get variance colour based on magnitude.
 *
 * @param varianceMinor — variance in sen
 * @returns             — CSS colour string: green for 0, amber for <500, red for >=500
 */
export function getVarianceColor(varianceMinor: number | null | undefined): string {
  if (varianceMinor == null) return '#6B6B6B'
  if (varianceMinor === 0) return '#1F8A4C'
  if (Math.abs(varianceMinor) < 500) return '#C77700'
  return '#B43A2D'
}
