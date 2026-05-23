/**
 * JK Zentra Finance Cockpit — Dashboard Zone 2 Server Actions
 * Sprint 1 — Radars (Upcoming Payments, Tax Position, Outstanding Receivables)
 *
 * Next.js server actions that power the three summary radar widgets on the
 * dashboard. Each action fetches precisely the data its widget needs — no
 * over-fetching, no under-fetching.
 *
 * All monetary values are returned in minor units (sen/cents). Components
 * are responsible for formatting them for display.
 */

'use server'

import { createClient } from '../supabase/server'
import type {
  SubscriptionRow,
  UserSettings,
  CP500ScheduleItem,
} from '../supabase/database.types'

// ---------------------------------------------------------------------------
// Types — return shapes
// ---------------------------------------------------------------------------

/** Upcoming payment item for the SubscriptionRadar widget. */
export interface UpcomingPaymentItem {
  id: string
  name: string
  vendor: string
  amount_minor: number
  currency: string
  next_payment_at: string | null
  status: string
}

/** Result of getUpcomingPaymentsForDashboard. */
export interface UpcomingPaymentsResult {
  subscriptions: UpcomingPaymentItem[]
  totalMinor: number
  count: number
}

/** Tax position verdict — drives the status pill colour. */
export type TaxVerdictStatus = 'overpaying' | 'underpaying' | 'on_track'

/** Result of getTaxPositionGlance. */
export interface TaxPositionResult {
  verdict: string
  nextCp500Date: string | null
  nextCp500AmountMinor: number | null
  taxReserveMinor: number
  status: TaxVerdictStatus
}

/** Single project receivable row for the OutstandingReceivables widget. */
export interface ReceivableProject {
  id: string
  name: string
  client: string
  outstandingMinor: number
  currency: string
}

/** Result of getOutstandingReceivables. */
export interface OutstandingReceivablesResult {
  totalMinor: number
  count: number
  topProjects: ReceivableProject[]
}

// ---------------------------------------------------------------------------
// 1. Upcoming Payments (SubscriptionRadar)
// ---------------------------------------------------------------------------

/**
 * Fetch upcoming subscription payments within the next N days.
 *
 * Returns active subscriptions whose `next_payment_at` falls between today
 * and today + `days`, ordered by date ascending. Only subscriptions with
 * a non-null `next_payment_at` are considered.
 *
 * @param days - Look-ahead window in days (default 14).
 * @returns Upcoming payments with aggregate count and total.
 *
 * @example
 * const { subscriptions, totalMinor, count } = await getUpcomingPaymentsForDashboard(14)
 */
export async function getUpcomingPaymentsForDashboard(
  days: number = 14
): Promise<UpcomingPaymentsResult> {
  const supabase = await createClient()

  // Compute date range
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() + days)

  const todayStr = today.toISOString().split('T')[0]
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, name, vendor, amount_minor, currency, next_payment_at, status')
    .not('next_payment_at', 'is', null)
    .gte('next_payment_at', todayStr)
    .lte('next_payment_at', cutoffStr)
    .in('status', ['active', 'trial'])
    .order('next_payment_at', { ascending: true })
    .limit(5)

  if (error) {
    console.error('getUpcomingPaymentsForDashboard:', error.message)
    return { subscriptions: [], totalMinor: 0, count: 0 }
  }

  const subscriptions: UpcomingPaymentItem[] = (data ?? []).map(
    (row: Pick<
      SubscriptionRow,
      'id' | 'name' | 'vendor' | 'amount_minor' | 'currency' | 'next_payment_at' | 'status'
    >) => ({
      id: row.id,
      name: row.name,
      vendor: row.vendor,
      amount_minor: row.amount_minor,
      currency: row.currency,
      next_payment_at: row.next_payment_at,
      status: row.status,
    })
  )

  const totalMinor = subscriptions.reduce(
    (sum: number, s: UpcomingPaymentItem) => sum + s.amount_minor,
    0
  )

  return { subscriptions, totalMinor, count: subscriptions.length }
}

// ---------------------------------------------------------------------------
// 2. Tax Position (TaxPositionGlance)
// ---------------------------------------------------------------------------

/**
 * Fetch a quick-glance summary of the user's tax position.
 *
 * Reads the CP500 schedule from `users.settings` and computes the tax
 * reserve balance by summing all `tax_reserve_transfer` transactions.
 * Returns a verdict that drives the UI pill colour.
 *
 * @returns Tax position glance data with next CP500, reserve balance, and verdict.
 *
 * @example
 * const { verdict, nextCp500Date, nextCp500AmountMinor, taxReserveMinor, status } =
 *   await getTaxPositionGlance()
 */
export async function getTaxPositionGlance(): Promise<TaxPositionResult> {
  const supabase = await createClient()

  // ---- 2a. Get current user and settings ----
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error('getTaxPositionGlance: no authenticated user')
    return {
      verdict: 'Sign in to view tax position.',
      nextCp500Date: null,
      nextCp500AmountMinor: null,
      taxReserveMinor: 0,
      status: 'on_track',
    }
  }

  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('settings')
    .eq('id', user.id)
    .single()

  if (userError) {
    console.error('getTaxPositionGlance: user fetch error:', userError.message)
    return {
      verdict: 'Unable to load tax settings.',
      nextCp500Date: null,
      nextCp500AmountMinor: null,
      taxReserveMinor: 0,
      status: 'on_track',
    }
  }

  const settings = (userRow?.settings ?? {}) as Partial<UserSettings>
  const schedule: CP500ScheduleItem[] = settings.cp500_schedule ?? []

  // ---- 2b. Find next pending CP500 instalment ----
  const todayStr = new Date().toISOString().split('T')[0]

  const nextPending = schedule
    .filter(
      (item: CP500ScheduleItem) =>
        item.due_date >= todayStr && item.status !== 'paid'
    )
    .sort(
      (a: CP500ScheduleItem, b: CP500ScheduleItem) =>
        a.due_date.localeCompare(b.due_date)
    )[0] ?? null

  // ---- 2c. Compute tax reserve balance (sum of tax_reserve_transfer) ----
  const { data: transfers, error: transferError } = await supabase
    .from('transactions')
    .select('amount_minor, currency')
    .eq('type', 'tax_reserve_transfer')
    .eq('status', 'active')

  if (transferError) {
    console.error(
      'getTaxPositionGlance: transfer fetch error:',
      transferError.message
    )
  }

  const taxReserveMinor: number =
    (transfers ?? []).reduce(
      (sum: number, row: { amount_minor: number }) => sum + row.amount_minor,
      0
    ) ?? 0

  // ---- 2d. Determine verdict ----
  let verdict: string
  let status: TaxVerdictStatus

  if (!nextPending) {
    verdict = 'All CP500 instalments paid for this tax year.'
    status = 'on_track'
  } else {
    const nextAmount = nextPending.amount_minor
    const reserveCovers = taxReserveMinor >= nextAmount

    if (reserveCovers) {
      verdict = 'On track. Reserve covers next CP500.'
      status = 'on_track'
    } else {
      const shortfall = nextAmount - taxReserveMinor
      verdict = `Short by RM ${(shortfall / 100).toFixed(2)} for next CP500.`
      status = 'underpaying'
    }
  }

  return {
    verdict,
    nextCp500Date: nextPending?.due_date ?? null,
    nextCp500AmountMinor: nextPending?.amount_minor ?? null,
    taxReserveMinor,
    status,
  }
}

// ---------------------------------------------------------------------------
// 3. Outstanding Receivables (OutstandingReceivables)
// ---------------------------------------------------------------------------

/**
 * Fetch outstanding receivables across active projects.
 *
 * For each non-terminal project (not fully_paid, not cancelled, not archived),
 * computes the outstanding balance as:
 *   `total_value_minor - SUM(income_transactions.amount_minor)`
 *
 * Returns the top 3 projects by outstanding amount, plus aggregate totals.
 *
 * @returns Outstanding receivables with top projects and grand total.
 *
 * @example
 * const { totalMinor, count, topProjects } = await getOutstandingReceivables()
 */
export async function getOutstandingReceivables(): Promise<OutstandingReceivablesResult> {
  const supabase = await createClient()

  // ---- 3a. Fetch active projects (non-terminal statuses) ----
  const activeStatuses: string[] = [
    'quoted',
    'deposit_received',
    'in_progress',
    'delivered',
    'disputed',
    'closed_short_paid',
  ]

  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, client, total_value_minor, currency')
    .in('status', activeStatuses)
    .order('created_at', { ascending: false })

  if (projectsError) {
    console.error(
      'getOutstandingReceivables: projects fetch error:',
      projectsError.message
    )
    return { totalMinor: 0, count: 0, topProjects: [] }
  }

  if (!projects || projects.length === 0) {
    return { totalMinor: 0, count: 0, topProjects: [] }
  }

  const projectIds: string[] = projects.map((p: { id: string }) => p.id)

  // ---- 3b. Fetch income transactions linked to those projects ----
  const { data: incomeTxns, error: incomeError } = await supabase
    .from('transactions')
    .select('project_id, amount_minor')
    .eq('type', 'income')
    .eq('status', 'active')
    .in('project_id', projectIds)

  if (incomeError) {
    console.error(
      'getOutstandingReceivables: income fetch error:',
      incomeError.message
    )
  }

  // ---- 3c. Aggregate income per project ----
  const incomeByProject: Record<string, number> = {}
  for (const txn of incomeTxns ?? []) {
    if (txn.project_id) {
      incomeByProject[txn.project_id] =
        (incomeByProject[txn.project_id] ?? 0) + (txn.amount_minor ?? 0)
    }
  }

  // ---- 3d. Compute outstanding balance per project ----
  const projectsWithOutstanding: ReceivableProject[] = projects
    .map(
      (project: {
        id: string
        name: string
        client: string
        total_value_minor: number
        currency: string
      }) => {
        const received: number = incomeByProject[project.id] ?? 0
        const outstandingMinor: number = Math.max(
          0,
          project.total_value_minor - received
        )
        return {
          id: project.id,
          name: project.name,
          client: project.client,
          outstandingMinor,
          currency: project.currency,
        }
      }
    )
    .filter((project: ReceivableProject) => project.outstandingMinor > 0)
    .sort(
      (a: ReceivableProject, b: ReceivableProject) =>
        b.outstandingMinor - a.outstandingMinor
    )

  const topProjects = projectsWithOutstanding.slice(0, 3)
  const totalMinor = projectsWithOutstanding.reduce(
    (sum: number, p: ReceivableProject) => sum + p.outstandingMinor,
    0
  )

  return {
    totalMinor,
    count: projectsWithOutstanding.length,
    topProjects,
  }
}
