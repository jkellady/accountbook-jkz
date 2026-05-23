/**
 * ============================================================================
 * JK Zentra Finance Cockpit — Subscription Server Actions
 * ============================================================================
 *
 * Server-side CRUD operations for the subscriptions table plus business-logic
 * helpers: monthly burn, upcoming payments, AI-extraction auto-detection, and
 * transaction linking.
 *
 * Every column referenced below exists in schema.sql §3.3 and in
 * database.types.ts → Database['public']['Tables']['subscriptions'].
 */

'use server'

import { createActionClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Database,
  SubscriptionRow,
  SubscriptionInsert,
  BillingCycle,
  SubscriptionStatus,
} from '@/lib/supabase/database.types'

// ---------------------------------------------------------------------------
// FX rate cache (in-memory, per-request only)
// ---------------------------------------------------------------------------

/** Hard-coded fallback FX rates against MYR. Updated periodically. */
const FX_RATES: Record<string, number> = {
  MYR: 1,
  USD: 4.45,
  SGD: 3.35,
  EUR: 4.85,
  GBP: 5.65,
}

/**
 * Convert an amount in minor units from one currency to MYR minor units.
 *
 * @param amountMinor - Amount in source currency minor units
 * @param currency - Source currency code
 * @returns Equivalent in MYR minor units (rounded to nearest integer)
 */
function toMyrMinor(amountMinor: number, currency: string): number {
  if (currency === 'MYR') return amountMinor
  const rate = FX_RATES[currency] ?? 1
  return Math.round(amountMinor * rate)
}

/**
 * Normalise a subscription's amount to a monthly equivalent in MYR minor units.
 *
 * | billing_cycle | divisor |
 * |---------------|---------|
 * | monthly       | 1       |
 * | quarterly     | 3       |
 * | yearly        | 12      |
 * | trial         | 0       |
 * | one_time      | 0       |
 *
 * @param amountMinor - Subscription amount in minor units
 * @param currency - Subscription currency code
 * @param billingCycle - Subscription billing cycle
 * @returns Monthly MYR-equivalent minor units
 */
function normalizeMonthlyMinor(
  amountMinor: number,
  currency: string,
  billingCycle: BillingCycle
): number {
  if (billingCycle === 'trial' || billingCycle === 'one_time') return 0

  const myrAmount = toMyrMinor(amountMinor, currency)

  const divisor: Record<BillingCycle, number> = {
    monthly: 1,
    quarterly: 3,
    yearly: 12,
    trial: 0,
    one_time: 0,
  }

  return Math.round(myrAmount / divisor[billingCycle])
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a new subscription record.
 *
 * @param data - Insert payload matching the subscriptions table shape
 * @returns Object containing the new subscription's UUID
 * @throws Error if the insert fails
 */
export async function createSubscription(
  data: SubscriptionInsert
): Promise<{ subscriptionId: string }> {
  const supabase: SupabaseClient<Database> = await createActionClient()

  const { data: row, error } = await supabase
    .from('subscriptions')
    .insert(data)
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to create subscription: ${error.message}`)
  }

  if (!row) {
    throw new Error('Insert succeeded but no row was returned')
  }

  return { subscriptionId: row.id }
}

// ---------------------------------------------------------------------------
// Read (list + single)
// ---------------------------------------------------------------------------

/** Valid columns to sort the subscription list by. */
export type SubscriptionSortColumn =
  | 'next_payment_at'
  | 'amount_minor'
  | 'vendor'
  | 'name'
  | 'created_at'

/** Sort direction. */
export type SortDirection = 'asc' | 'desc'

/** Filters for the subscription list query. */
export interface SubscriptionFilters {
  /** Filter by status — comma-separated for multiple, or single value */
  status?: string
  /** Filter by entity UUID */
  entityId?: string
  /** Filter by category */
  category?: string
  /** Column to sort by */
  sortBy?: SubscriptionSortColumn
  /** Sort direction */
  sortDir?: SortDirection
}

/**
 * List subscriptions with optional filtering and sorting.
 *
 * Defaults: sort by next_payment_at ascending (closest payment first).
 * Excludes archived subscriptions unless explicitly requested.
 *
 * @param filters - Optional filters and sort configuration
 * @returns Array of subscription rows
 */
export async function listSubscriptions(
  filters: SubscriptionFilters = {}
): Promise<SubscriptionRow[]> {
  const supabase: SupabaseClient<Database> = await createActionClient()

  let query = supabase.from('subscriptions').select('*')

  // -- Exclude archived by default ------------------------------------------
  if (filters.status) {
    const statuses = filters.status.split(',').map((s) => s.trim())
    query = query.in('status', statuses as SubscriptionStatus[])
  } else {
    query = query.neq('status', 'archived')
  }

  // -- Entity filter --------------------------------------------------------
  if (filters.entityId) {
    query = query.eq('entity_id', filters.entityId)
  }

  // -- Category filter ------------------------------------------------------
  if (filters.category) {
    query = query.eq('category', filters.category)
  }

  // -- Sorting --------------------------------------------------------------
  const sortCol = filters.sortBy ?? 'next_payment_at'
  const sortDir = filters.sortDir ?? 'asc'

  // Handle nulls in next_payment_at: nulls last when ascending
  if (sortCol === 'next_payment_at' && sortDir === 'asc') {
    query = query.order(sortCol, { ascending: true, nullsFirst: false })
  } else {
    query = query.order(sortCol, { ascending: sortDir === 'asc' })
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to list subscriptions: ${error.message}`)
  }

  return data ?? []
}

/**
 * Fetch a single subscription by ID, joined with its payment history
 * (linked transactions).
 *
 * @param id - Subscription UUID
 * @returns The subscription row with payment history, or null if not found
 */
export async function getSubscription(
  id: string
): Promise<(SubscriptionRow & { payments: Array<{ id: string; occurred_at: string; amount_minor: number; currency: string; vendor: string; description: string | null }> }) | null> {
  const supabase: SupabaseClient<Database> = await createActionClient()

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch subscription: ${error.message}`)
  }

  // Fetch linked transactions as payment history
  const { data: payments, error: paymentsError } = await supabase
    .from('transactions')
    .select('id, occurred_at, amount_minor, currency, vendor, description')
    .eq('subscription_id', id)
    .order('occurred_at', { ascending: false })

  if (paymentsError) {
    throw new Error(`Failed to fetch payment history: ${paymentsError.message}`)
  }

  return {
    ...subscription,
    payments: payments ?? [],
  }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * Update an existing subscription. Only the provided fields are changed;
 * omitted fields retain their current values.
 *
 * @param id - Subscription UUID
 * @param data - Partial update payload
 * @throws Error if the update fails
 */
export async function updateSubscription(
  id: string,
  data: Partial<SubscriptionRow>
): Promise<void> {
  const supabase: SupabaseClient<Database> = await createActionClient()

  const { error } = await supabase
    .from('subscriptions')
    .update(data)
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Soft delete (archive)
// ---------------------------------------------------------------------------

/**
 * Soft-delete a subscription by setting its status to 'archived'.
 * This preserves the audit trail and linked transactions.
 *
 * @param id - Subscription UUID
 * @throws Error if the archive operation fails
 */
export async function archiveSubscription(id: string): Promise<void> {
  const supabase: SupabaseClient<Database> = await createActionClient()

  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'archived' })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to archive subscription: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Monthly burn
// ---------------------------------------------------------------------------

/** Result shape for the monthly burn calculation. */
export interface MonthlyBurnResult {
  /** Sum of all active subscriptions normalised to monthly equivalent in MYR minor units */
  monthlyBurnMinor: number
  /** Annual commitment derived from monthly burn × 12 in MYR minor units */
  annualCommitmentMinor: number
  /** Currency code (always MYR for the normalised values) */
  currency: string
  /** Per-subscription breakdown */
  breakdown: Array<{
    id: string
    name: string
    vendor: string
    category: string
    billingCycle: BillingCycle
    amountMinor: number
    currency: string
    monthlyMyrMinor: number
  }>
  /** Breakdown by category */
  byCategory: Array<{ category: string; monthlyMyrMinor: number }>
}

/**
 * Calculate the monthly burn across all active subscriptions.
 *
 * Normalises each subscription to a monthly MYR equivalent:
 *   monthly = full amount, yearly = ÷12, quarterly = ÷3, trial/one_time = 0
 *
 * @returns Monthly burn data with per-subscription and per-category breakdowns
 */
export async function getMonthlyBurn(): Promise<MonthlyBurnResult> {
  const supabase: SupabaseClient<Database> = await createActionClient()

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('status', 'active')

  if (error) {
    throw new Error(`Failed to calculate burn: ${error.message}`)
  }

  const subscriptions = data ?? []

  const breakdown = subscriptions.map((sub) => {
    const monthlyMyrMinor = normalizeMonthlyMinor(
      sub.amount_minor,
      sub.currency,
      sub.billing_cycle
    )

    return {
      id: sub.id,
      name: sub.name,
      vendor: sub.vendor,
      category: sub.category,
      billingCycle: sub.billing_cycle,
      amountMinor: sub.amount_minor,
      currency: sub.currency,
      monthlyMyrMinor,
    }
  })

  const monthlyBurnMinor = breakdown.reduce(
    (sum, item) => sum + item.monthlyMyrMinor,
    0
  )

  // Aggregate by category
  const categoryMap = new Map<string, number>()
  for (const item of breakdown) {
    const current = categoryMap.get(item.category) ?? 0
    categoryMap.set(item.category, current + item.monthlyMyrMinor)
  }

  const byCategory = Array.from(categoryMap.entries())
    .map(([category, monthlyMyrMinor]) => ({ category, monthlyMyrMinor }))
    .sort((a, b) => b.monthlyMyrMinor - a.monthlyMyrMinor)

  return {
    monthlyBurnMinor,
    annualCommitmentMinor: monthlyBurnMinor * 12,
    currency: 'MYR',
    breakdown,
    byCategory,
  }
}

// ---------------------------------------------------------------------------
// Upcoming payments
// ---------------------------------------------------------------------------

/**
 * Get subscriptions with payments due within the next N days.
 *
 * Includes subscriptions where next_payment_at falls within the window,
 * or where the subscription is in trial and the trial ends within the window.
 *
 * @param days - Number of days to look ahead (default 30)
 * @returns Array of subscription rows sorted by next payment date
 */
export async function getUpcomingPayments(
  days: number = 30
): Promise<SubscriptionRow[]> {
  const supabase: SupabaseClient<Database> = await createActionClient()

  const today = new Date().toISOString().split('T')[0]
  const future = new Date(Date.now() + days * 86_400_000).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .in('status', ['active', 'trial'])
    .or(`next_payment_at.gte.${today},next_payment_at.lte.${future}`)
    .order('next_payment_at', { ascending: true, nullsFirst: false })

  if (error) {
    throw new Error(`Failed to fetch upcoming payments: ${error.message}`)
  }

  return data ?? []
}

// ---------------------------------------------------------------------------
// AI extraction auto-detection
// ---------------------------------------------------------------------------

/** Result of attempting to match an AI extraction to a known subscription. */
export interface DetectionResult {
  /** Matched subscription row, or null if no confident match */
  match: SubscriptionRow | null
  /** Confidence score 0–1 (1 = exact match on vendor + amount + cycle) */
  confidence: number
  /** Recommended action: link to existing, create new, or manual review */
  action: 'link' | 'create' | 'review'
}

/**
 * Auto-detect whether an AI-extracted subscription matches an existing one.
 *
 * Matching logic (in order of confidence):
 *   1. Exact vendor name match + same billing cycle + amount within 10%  → link (confidence ≥ 0.85)
 *   2. Vendor fuzzy match (case-insensitive contains) + same cycle       → review (confidence 0.5–0.84)
 *   3. No match                                                          → create (confidence 0)
 *
 * Handles vendor name variations ("Anthropic" vs "ANTHROPIC, INC.") by
 * normalising to lower-case and stripping common suffixes.
 *
 * @param vendor - Vendor name from AI extraction
 * @param amountMinor - Amount in minor units from AI extraction
 * @param billingCycle - Billing cycle from AI extraction
 * @returns Detection result with match, confidence, and recommended action
 */
export async function detectSubscriptionFromExtraction(
  vendor: string,
  amountMinor: number,
  billingCycle: string
): Promise<DetectionResult> {
  const supabase: SupabaseClient<Database> = await createActionClient()

  // Normalise vendor for comparison
  const normalisedVendor = vendor.toLowerCase().trim()

  // Fetch active subscriptions for comparison
  const { data: candidates, error } = await supabase
    .from('subscriptions')
    .select('*')
    .in('status', ['active', 'trial'])

  if (error) {
    throw new Error(`Detection query failed: ${error.message}`)
  }

  const subs = candidates ?? []

  // ── Score each candidate ─────────────────────────────────────────────────
  let bestMatch: SubscriptionRow | null = null
  let bestScore = 0

  for (const sub of subs) {
    let score = 0
    const subVendor = sub.vendor.toLowerCase().trim()

    // Vendor match: exact (0.5), contains (0.35), or no match (0)
    if (subVendor === normalisedVendor) {
      score += 0.5
    } else if (subVendor.includes(normalisedVendor) || normalisedVendor.includes(subVendor)) {
      score += 0.35
    }

    // Billing cycle match: exact (0.25)
    if (sub.billing_cycle === billingCycle) {
      score += 0.25
    }

    // Amount match: within 10% (0.25), within 25% (0.1)
    if (sub.amount_minor > 0) {
      const ratio = amountMinor / sub.amount_minor
      if (ratio >= 0.9 && ratio <= 1.1) {
        score += 0.25
      } else if (ratio >= 0.75 && ratio <= 1.25) {
        score += 0.1
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = sub
    }
  }

  // ── Determine action ─────────────────────────────────────────────────────
  if (bestScore >= 0.85) {
    return { match: bestMatch, confidence: bestScore, action: 'link' }
  }

  if (bestScore >= 0.5) {
    return { match: bestMatch, confidence: bestScore, action: 'review' }
  }

  return { match: null, confidence: 0, action: 'create' }
}

// ---------------------------------------------------------------------------
// Transaction linking
// ---------------------------------------------------------------------------

/**
 * Link a transaction to a subscription. Updates the transaction's
 * subscription_id FK and optionally refreshes the subscription's
 * last_paid_at / next_payment_at dates.
 *
 * @param subscriptionId - UUID of the subscription
 * @param transactionId - UUID of the transaction to link
 * @throws Error if the link operation fails
 */
export async function linkTransactionToSubscription(
  subscriptionId: string,
  transactionId: string
): Promise<void> {
  const supabase: SupabaseClient<Database> = await createActionClient()

  // Fetch the transaction to get its occurred_at date
  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .select('occurred_at')
    .eq('id', transactionId)
    .single()

  if (txError) {
    throw new Error(`Failed to fetch transaction: ${txError.message}`)
  }

  // Link the transaction
  const { error: updateError } = await supabase
    .from('transactions')
    .update({ subscription_id: subscriptionId })
    .eq('id', transactionId)

  if (updateError) {
    throw new Error(`Failed to link transaction: ${updateError.message}`)
  }

  // Update the subscription's last_paid_at if this is more recent
  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .select('last_paid_at')
    .eq('id', subscriptionId)
    .single()

  if (subError) return // Non-fatal: link succeeded

  const txDate = tx.occurred_at
  const lastPaid = sub.last_paid_at

  if (!lastPaid || txDate > lastPaid) {
    await supabase
      .from('subscriptions')
      .update({ last_paid_at: txDate })
      .eq('id', subscriptionId)
  }
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

/** A subscription flagged for cleanup review with computed metadata. */
export interface CleanupCandidate {
  subscription: SubscriptionRow
  /** ISO date of most recent linked transaction, or null */
  lastInvoiceDate: string | null
  /** Sum of linked transaction amounts YTD in minor units */
  totalSpentYtdMinor: number
  /** Days since the last linked charge (Infinity if never charged) */
  daysSinceLastCharge: number
  /** Whether this subscription has had NO linked transactions ever */
  neverCharged: boolean
}

/**
 * Find subscriptions that may be candidates for cleanup.
 *
 * Criteria:
 *   - Status is 'active' or 'paused'
 *   - No linked transaction in the last 60 days, OR never charged
 *   - Not already flagged as archived
 *
 * @returns Array of cleanup candidates with computed metadata
 */
export async function getCleanupCandidates(): Promise<CleanupCandidate[]> {
  const supabase: SupabaseClient<Database> = await createActionClient()

  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString().split('T')[0]
  const yearStart = `${new Date().getFullYear()}-01-01`

  // Fetch active/paused subscriptions
  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('*')
    .in('status', ['active', 'paused'])

  if (error) {
    throw new Error(`Failed to fetch cleanup candidates: ${error.message}`)
  }

  const candidates: CleanupCandidate[] = []

  for (const sub of subs ?? []) {
    // Get latest linked transaction
    const { data: latestTx } = await supabase
      .from('transactions')
      .select('occurred_at, amount_minor')
      .eq('subscription_id', sub.id')
      .order('occurred_at', { ascending: false })
      .limit(1)

    const lastInvoiceDate = latestTx?.[0]?.occurred_at ?? null

    // Get YTD spend
    const { data: ytdTxs } = await supabase
      .from('transactions')
      .select('amount_minor')
      .eq('subscription_id', sub.id)
      .gte('occurred_at', yearStart)

    const totalSpentYtdMinor = (ytdTxs ?? []).reduce(
      (sum, tx) => sum + (tx.amount_minor ?? 0),
      0
    )

    const daysSinceLastCharge = lastInvoiceDate
      ? Math.floor(
          (Date.now() - new Date(lastInvoiceDate).getTime()) / 86_400_000
        )
      : Infinity

    const neverCharged = lastInvoiceDate === null

    // Flag if no charge in 60+ days or never charged
    if (neverCharged || daysSinceLastCharge >= 60) {
      candidates.push({
        subscription: sub,
        lastInvoiceDate,
        totalSpentYtdMinor,
        daysSinceLastCharge,
        neverCharged,
      })
    }
  }

  // Sort: never charged first, then by days since last charge (desc)
  candidates.sort((a, b) => {
    if (a.neverCharged && !b.neverCharged) return -1
    if (!a.neverCharged && b.neverCharged) return 1
    return b.daysSinceLastCharge - a.daysSinceLastCharge
  })

  return candidates
}
