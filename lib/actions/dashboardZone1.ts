/**
 * JK Zentra Finance Cockpit — Dashboard Zone 1 Server Actions
 * Sprint 1 — KPI Strip (Spend MTD, Income MTD, Net Cash Flow, Review Queue)
 *
 * Next.js server actions that power the four KPI cards in the top dashboard zone.
 * All monetary values are returned in MYR minor units (sen) for consistent
 * cross-currency aggregation. Components are responsible for formatting.
 *
 * Every column referenced below exists in schema.sql and database.types.ts.
 * No invented columns — verified against:
 *   transactions: id, entity_id, type, amount_minor, currency, myr_equiv_minor,
 *                 occurred_at, vendor, category, status
 *   entities:     id, name, slug, color
 *   subscriptions: id, entity_id, amount_minor, currency, billing_cycle,
 *                  status, next_payment_at
 */

'use server'

import { createClient } from '../supabase/server'
import type { TransactionRow } from '../supabase/database.types'

// ---------------------------------------------------------------------------
// Types — return shapes
// ---------------------------------------------------------------------------

/** Single KPI result bundle for the Zone 1 strip. */
export interface DashboardKPIResult {
  /** SUM of expense transactions MTD in MYR minor units. */
  spend_mtd_minor: number
  /** SUM of income transactions MTD in MYR minor units. */
  income_mtd_minor: number
  /** Net cash flow = income_mtd - spend_mtd in MYR minor units. */
  net_cash_flow_minor: number
  /** Number of transactions awaiting review. */
  pending_review_count: number
  /** Normalised monthly subscription burn in MYR minor units. */
  monthly_sub_burn_minor: number
  /** Annual subscription commitment = monthly_burn * 12. */
  annual_sub_commitment_minor: number
  /** Subscriptions renewing within the next 7 days. */
  subs_renewing_in_7d: number
  /** Alias for pending_review_count (semantic name for the Review Queue card). */
  review_queue_count: number
  /** Spend MTD split by entity: Personal vs JK Zentra. */
  spend_by_entity: { personal_minor: number; jk_zentra_minor: number }
  /** Income MTD split by entity: Personal vs JK Zentra. */
  income_by_entity: { personal_minor: number; jk_zentra_minor: number }
  /** Number of distinct income sources this month. */
  income_source_count: number
  /** Names of distinct income vendors this month. */
  income_source_names: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a subscription amount to its monthly equivalent.
 *
 * @param amount_minor - Subscription amount in minor units
 * @param billing_cycle - The billing cycle from the subscription
 * @returns Monthly equivalent in the same minor units
 */
function normaliseToMonthly(amount_minor: number, billing_cycle: string): number {
  switch (billing_cycle) {
    case 'monthly':
      return amount_minor
    case 'quarterly':
      return Math.round(amount_minor / 3)
    case 'yearly':
      return Math.round(amount_minor / 12)
    case 'one_time':
      return 0 // One-time purchases don't contribute to recurring burn
    case 'trial':
      return amount_minor // Trial amount counts as-is
    default:
      return amount_minor
  }
}

/**
 * Get the first day of the current month as an ISO date string.
 */
function getFirstOfMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

/**
 * Get today's date as an ISO date string.
 */
function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Get the date 7 days from now as an ISO date string.
 */
function getSevenDaysFromNow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// Main action — KPI bundle
// ---------------------------------------------------------------------------

/**
 * Fetch all KPI metrics for the Zone 1 strip in a single call.
 *
 * Aggregates spend, income, net cash flow, pending reviews, subscription burn,
 * and upcoming renewals. All monetary values are in MYR minor units.
 *
 * @returns DashboardKPIResult with all 8 KPI fields plus entity splits.
 *
 * @example
 * const kpis = await getDashboardKPIs()
 * // kpis.spend_mtd_minor       // 125000  = RM 1,250.00
 * // kpis.income_mtd_minor      // 250000  = RM 2,500.00
 * // kpis.net_cash_flow_minor   // 125000  = RM 1,250.00 (positive = green)
 * // kpis.pending_review_count  // 3
 * // kpis.monthly_sub_burn_minor // 48700 = RM 487.00
 * // kpis.review_queue_count    // 3
 */
export async function getDashboardKPIs(): Promise<DashboardKPIResult> {
  const supabase = await createClient()

  const firstOfMonth = getFirstOfMonth()
  const todayStr = getTodayStr()
  const sevenDaysFromNow = getSevenDaysFromNow()

  // ---- Fetch entity IDs for Personal and JK Zentra ----
  const { data: entities, error: entityError } = await supabase
    .from('entities')
    .select('id, name, slug')

  if (entityError) {
    console.error('getDashboardKPIs: entity fetch error:', entityError.message)
  }

  const entityMap = new Map<string, string>()
  for (const e of entities ?? []) {
    entityMap.set(e.slug, e.id)
  }
  const personalId = entityMap.get('personal') ?? ''
  const jkZentraId = entityMap.get('jk-zentra') ?? ''

  // ---- 1. Spend MTD (expenses this month, active, with MYR equiv) ----
  const { data: spendRows, error: spendError } = await supabase
    .from('transactions')
    .select('myr_equiv_minor, entity_id')
    .eq('type', 'expense')
    .eq('status', 'active')
    .gte('occurred_at', firstOfMonth)
    .lte('occurred_at', todayStr)
    .not('myr_equiv_minor', 'is', null)

  if (spendError) {
    console.error('getDashboardKPIs: spend fetch error:', spendError.message)
  }

  let spend_mtd_minor = 0
  let personal_spend_minor = 0
  let jk_zentra_spend_minor = 0
  for (const row of spendRows ?? []) {
    const amount = row.myr_equiv_minor ?? 0
    spend_mtd_minor += amount
    if (row.entity_id === personalId) {
      personal_spend_minor += amount
    } else if (row.entity_id === jkZentraId) {
      jk_zentra_spend_minor += amount
    }
  }

  // ---- 2. Income MTD (income this month, active, with MYR equiv) ----
  const { data: incomeRows, error: incomeError } = await supabase
    .from('transactions')
    .select('myr_equiv_minor, entity_id, vendor')
    .eq('type', 'income')
    .eq('status', 'active')
    .gte('occurred_at', firstOfMonth)
    .lte('occurred_at', todayStr)
    .not('myr_equiv_minor', 'is', null)

  if (incomeError) {
    console.error('getDashboardKPIs: income fetch error:', incomeError.message)
  }

  let income_mtd_minor = 0
  let personal_income_minor = 0
  let jk_zentra_income_minor = 0
  const incomeVendors = new Set<string>()
  for (const row of incomeRows ?? []) {
    const amount = row.myr_equiv_minor ?? 0
    income_mtd_minor += amount
    if (row.entity_id === personalId) {
      personal_income_minor += amount
    } else if (row.entity_id === jkZentraId) {
      jk_zentra_income_minor += amount
    }
    if (row.vendor) {
      incomeVendors.add(row.vendor)
    }
  }

  // ---- 3. Net cash flow ----
  const net_cash_flow_minor = income_mtd_minor - spend_mtd_minor

  // ---- 4. Pending review count ----
  const { count: pendingCount, error: pendingError } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending_review')

  if (pendingError) {
    console.error('getDashboardKPIs: pending review count error:', pendingError.message)
  }

  const pending_review_count = pendingCount ?? 0

  // ---- 5. Monthly subscription burn (normalised) ----
  const { data: subRows, error: subError } = await supabase
    .from('subscriptions')
    .select('amount_minor, currency, billing_cycle, status, next_payment_at')
    .in('status', ['active', 'trial'])

  if (subError) {
    console.error('getDashboardKPIs: subscription fetch error:', subError.message)
  }

  let monthly_sub_burn_minor = 0
  let subs_renewing_in_7d = 0

  for (const sub of subRows ?? []) {
    // Normalise to monthly MYR equivalent
    // Note: subscriptions table stores amounts in their native currency.
    // For accurate multi-currency burn we'd need FX rates; here we assume
    // MYR for the dashboard KPI approximation.
    const monthlyEquivalent = normaliseToMonthly(sub.amount_minor, sub.billing_cycle)
    monthly_sub_burn_minor += monthlyEquivalent

    // Count subscriptions renewing in the next 7 days
    if (
      sub.next_payment_at &&
      sub.next_payment_at >= todayStr &&
      sub.next_payment_at <= sevenDaysFromNow
    ) {
      subs_renewing_in_7d += 1
    }
  }

  // ---- 6. Annual subscription commitment ----
  const annual_sub_commitment_minor = monthly_sub_burn_minor * 12

  return {
    spend_mtd_minor,
    income_mtd_minor,
    net_cash_flow_minor,
    pending_review_count,
    monthly_sub_burn_minor,
    annual_sub_commitment_minor,
    subs_renewing_in_7d,
    review_queue_count: pending_review_count,
    spend_by_entity: {
      personal_minor: personal_spend_minor,
      jk_zentra_minor: jk_zentra_spend_minor,
    },
    income_by_entity: {
      personal_minor: personal_income_minor,
      jk_zentra_minor: jk_zentra_income_minor,
    },
    income_source_count: incomeVendors.size,
    income_source_names: Array.from(incomeVendors).slice(0, 3),
  }
}
