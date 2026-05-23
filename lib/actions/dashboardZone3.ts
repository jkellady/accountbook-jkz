/**
 * JK Zentra Finance Cockpit — Dashboard Zone 3 Server Actions
 * Sprint 1 — Spend Breakdown (Top Categories, Top Vendors, Recent Transactions)
 *
 * Next.js server actions that power the bottom dashboard zone showing spend
 * patterns and recent activity.
 *
 * All monetary values are returned in MYR minor units (sen). Components handle
 * display formatting.
 *
 * Every column referenced below exists in schema.sql and database.types.ts.
 * No invented columns — verified against:
 *   transactions: id, entity_id, type, amount_minor, currency, myr_equiv_minor,
 *                 occurred_at, vendor, category, status
 *   entities:     id, name, slug, color
 */

'use server'

import { createClient } from '../supabase/server'
import type { TransactionRow } from '../supabase/database.types'

// ---------------------------------------------------------------------------
// Types — return shapes
// ---------------------------------------------------------------------------

/** Single category with aggregated spend. */
export interface CategoryBreakdownItem {
  /** Category name (e.g. 'Software', 'Marketing'). */
  category: string
  /** Total spend in MYR minor units. */
  amount_minor: number
  /** Percentage of the top category's spend (0–100). */
  pct: number
}

/** Single vendor with aggregated spend and transaction count. */
export interface VendorBreakdownItem {
  /** Vendor name (e.g. 'OpenAI', 'Vercel'). */
  vendor: string
  /** Total spend in MYR minor units. */
  amount_minor: number
  /** Number of transactions with this vendor. */
  count: number
}

/** Lightweight transaction row for the recent transactions list. */
export interface RecentTransactionItem {
  id: string
  vendor: string
  amount_minor: number
  currency: string
  type: 'income' | 'expense' | 'tax_prepayment' | 'tax_payment_final' | 'tax_reserve_transfer'
  occurred_at: string
  category: string
  entity_id: string
}

/** Entity split for personal vs business spend. */
export interface EntitySplit {
  personal_minor: number
  business_minor: number
}

/** Complete result bundle for the Zone 3 breakdown. */
export interface DashboardBreakdownResult {
  /** Top 5 categories by spend amount. */
  top_categories: CategoryBreakdownItem[]
  /** Top 5 vendors by spend amount. */
  top_vendors: VendorBreakdownItem[]
  /** Last 7 transactions (any type, ordered by occurred_at desc). */
  recent_transactions: RecentTransactionItem[]
  /** Personal vs business spend split. */
  personal_vs_business: EntitySplit
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main action — Breakdown bundle
// ---------------------------------------------------------------------------

/**
 * Fetch all breakdown data for the Zone 3 spend analysis section.
 *
 * Returns top categories, top vendors, recent transactions, and the
 * personal vs business split. All monetary values are in MYR minor units.
 *
 * @returns DashboardBreakdownResult with top_categories, top_vendors,
 *          recent_transactions, and personal_vs_business split.
 *
 * @example
 * const breakdown = await getDashboardBreakdown()
 * // breakdown.top_categories[0]    // { category: 'Software', amount_minor: 45000, pct: 100 }
 * // breakdown.top_vendors[0]       // { vendor: 'OpenAI', amount_minor: 20000, count: 3 }
 * // breakdown.recent_transactions  // [ { id: '...', vendor: '...', ... }, ... ]
 */
export async function getDashboardBreakdown(): Promise<DashboardBreakdownResult> {
  const supabase = await createClient()

  const firstOfMonth = getFirstOfMonth()
  const todayStr = getTodayStr()

  // ---- Fetch entity IDs for Personal and JK Zentra ----
  const { data: entities, error: entityError } = await supabase
    .from('entities')
    .select('id, name, slug')

  if (entityError) {
    console.error('getDashboardBreakdown: entity fetch error:', entityError.message)
  }

  const entityMap = new Map<string, string>()
  for (const e of entities ?? []) {
    entityMap.set(e.slug, e.id)
  }
  const personalId = entityMap.get('personal') ?? ''
  const jkZentraId = entityMap.get('jk-zentra') ?? ''

  // ---- 1. Fetch this month's active expense transactions ----
  const { data: txns, error: txnError } = await supabase
    .from('transactions')
    .select('id, entity_id, type, amount_minor, currency, myr_equiv_minor, occurred_at, vendor, category, status')
    .eq('status', 'active')
    .gte('occurred_at', firstOfMonth)
    .lte('occurred_at', todayStr)
    .order('occurred_at', { ascending: false })

  if (txnError) {
    console.error('getDashboardBreakdown: transaction fetch error:', txnError.message)
    return {
      top_categories: [],
      top_vendors: [],
      recent_transactions: [],
      personal_vs_business: { personal_minor: 0, business_minor: 0 },
    }
  }

  const allTransactions = txns ?? []

  // ---- 2. Compute Personal vs Business split ----
  let personal_minor = 0
  let business_minor = 0

  for (const t of allTransactions) {
    if (t.type === 'expense') {
      const amount = t.myr_equiv_minor ?? t.amount_minor ?? 0
      if (t.entity_id === personalId) {
        personal_minor += amount
      } else if (t.entity_id === jkZentraId) {
        business_minor += amount
      }
    }
  }

  // ---- 3. Aggregate categories (expenses only) ----
  const categoryMap = new Map<string, number>()
  for (const t of allTransactions) {
    if (t.type === 'expense') {
      const amount = t.myr_equiv_minor ?? t.amount_minor ?? 0
      const prev = categoryMap.get(t.category) ?? 0
      categoryMap.set(t.category, prev + amount)
    }
  }

  // Sort categories by amount desc
  const sortedCategories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])

  // Calculate percentages relative to top category
  const topCategoryAmount = sortedCategories[0]?.[1] ?? 1
  const top_categories: CategoryBreakdownItem[] = sortedCategories
    .slice(0, 5)
    .map(([category, amount_minor]) => ({
      category,
      amount_minor,
      pct: topCategoryAmount > 0 ? Math.round((amount_minor / topCategoryAmount) * 100) : 0,
    }))

  // Add "Other" if there are more categories
  if (sortedCategories.length > 5) {
    const otherAmount = sortedCategories
      .slice(5)
      .reduce((sum, [, amount]) => sum + amount, 0)
    top_categories.push({
      category: 'Other',
      amount_minor: otherAmount,
      pct: topCategoryAmount > 0 ? Math.round((otherAmount / topCategoryAmount) * 100) : 0,
    })
  }

  // ---- 4. Aggregate vendors (expenses only) ----
  const vendorMap = new Map<string, { amount_minor: number; count: number }>()
  for (const t of allTransactions) {
    if (t.type === 'expense') {
      const amount = t.myr_equiv_minor ?? t.amount_minor ?? 0
      const existing = vendorMap.get(t.vendor) ?? { amount_minor: 0, count: 0 }
      vendorMap.set(t.vendor, {
        amount_minor: existing.amount_minor + amount,
        count: existing.count + 1,
      })
    }
  }

  const top_vendors: VendorBreakdownItem[] = Array.from(vendorMap.entries())
    .sort((a, b) => b[1].amount_minor - a[1].amount_minor)
    .slice(0, 5)
    .map(([vendor, data]) => ({
      vendor,
      amount_minor: data.amount_minor,
      count: data.count,
    }))

  // ---- 5. Recent transactions (last 7 of any type) ----
  const { data: recentRows, error: recentError } = await supabase
    .from('transactions')
    .select('id, vendor, amount_minor, currency, type, occurred_at, category, entity_id')
    .eq('status', 'active')
    .order('occurred_at', { ascending: false })
    .limit(7)

  if (recentError) {
    console.error('getDashboardBreakdown: recent transactions error:', recentError.message)
  }

  const recent_transactions: RecentTransactionItem[] = (recentRows ?? []).map(
    (row: Pick<
      TransactionRow,
      'id' | 'vendor' | 'amount_minor' | 'currency' | 'type' | 'occurred_at' | 'category' | 'entity_id'
    >) => ({
      id: row.id,
      vendor: row.vendor,
      amount_minor: row.amount_minor,
      currency: row.currency,
      type: row.type,
      occurred_at: row.occurred_at,
      category: row.category,
      entity_id: row.entity_id,
    })
  )

  return {
    top_categories,
    top_vendors,
    recent_transactions,
    personal_vs_business: {
      personal_minor,
      business_minor,
    },
  }
}
