/**
 * Income Statement (P&L) Server Actions
 * JK Zentra Finance Cockpit — Sprint 1
 *
 * Cash-basis P&L data fetching. Income recognized when received,
 * expenses when paid. All amounts in integer minor units (sen/cents)
 * until render time. Uses `occurred_at` for cash-basis date.
 */

'use server'

import { createActionClient } from '@/lib/supabase/server'
import type {
  TransactionRow,
  ProjectRow,
  EntityRow,
} from '@/lib/supabase/database.types'

// ----------------------------------------------------------------------------
// Period handling
// ----------------------------------------------------------------------------

export type IncomeStatementPeriod =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'ytd'
  | 'full_year'
  | 'custom'

export type IncomeStatementEntityFilter =
  | 'jk-zentra'
  | 'personal'
  | 'all'

interface DateRange {
  dateFrom: string // ISO-8601, inclusive
  dateTo: string // ISO-8601, inclusive
}

/**
 * Build a human-readable label for the selected period.
 */
function buildPeriodLabel(
  period: IncomeStatementPeriod,
  dateFrom: string,
  dateTo: string
): string {
  const from = new Date(dateFrom + 'T00:00:00')
  const to = new Date(dateTo + 'T00:00:00')

  const fmtMY = new Intl.DateTimeFormat('en-MY', {
    month: 'long',
    year: 'numeric',
  })
  const fmtFull = new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  switch (period) {
    case 'this_month':
    case 'last_month':
      return fmtMY.format(from)
    case 'this_quarter':
      return `Q${Math.floor(from.getMonth() / 3) + 1} ${from.getFullYear()}`
    case 'ytd':
      return `YTD ${from.getFullYear()}`
    case 'full_year':
      return `FY ${from.getFullYear()}`
    case 'custom':
      return `${fmtFull.format(from)} – ${fmtFull.format(to)}`
    default:
      return `${dateFrom} – ${dateTo}`
  }
}

/**
 * Compute the ISO-8601 date range for a given period.
 */
function computeDateRange(
  period: IncomeStatementPeriod,
  customFrom?: string,
  customTo?: string
): DateRange {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() // 0-based

  switch (period) {
    case 'this_month': {
      const from = new Date(y, m, 1)
      const to = new Date(y, m + 1, 0)
      return { dateFrom: isoDate(from), dateTo: isoDate(to) }
    }
    case 'last_month': {
      const from = new Date(y, m - 1, 1)
      const to = new Date(y, m, 0)
      return { dateFrom: isoDate(from), dateTo: isoDate(to) }
    }
    case 'this_quarter': {
      const qStartMonth = Math.floor(m / 3) * 3
      const from = new Date(y, qStartMonth, 1)
      const to = new Date(y, qStartMonth + 3, 0)
      return { dateFrom: isoDate(from), dateTo: isoDate(to) }
    }
    case 'ytd': {
      const from = new Date(y, 0, 1)
      const to = new Date(y, m, now.getDate())
      return { dateFrom: isoDate(from), dateTo: isoDate(to) }
    }
    case 'full_year': {
      const from = new Date(y, 0, 1)
      const to = new Date(y, 11, 31)
      return { dateFrom: isoDate(from), dateTo: isoDate(to) }
    }
    case 'custom': {
      if (!customFrom || !customTo) {
        throw new Error('Custom period requires both dateFrom and dateTo')
      }
      return { dateFrom: customFrom, dateTo: customTo }
    }
  }
}

/** Convert a Date to ISO-8601 date string (YYYY-MM-DD). */
function isoDate(d: Date): string {
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// ----------------------------------------------------------------------------
// Data types
// ----------------------------------------------------------------------------

export interface IncomeSource {
  vendor: string
  description: string
  amountMinor: number
  currency: string
}

export interface ExpenseSubcategory {
  subcategory: string
  amountMinor: number
}

export interface ExpenseCategory {
  category: string
  subcategories: ExpenseSubcategory[]
  totalMinor: number
}

export interface IncomeStatementData {
  income: {
    totalMinor: number
    sources: IncomeSource[]
  }
  expenses: {
    totalMinor: number
    byCategory: ExpenseCategory[]
  }
  netProfitMinor: number
  outstandingReceivablesMinor: number
  outstandingProjectCount: number
  periodLabel: string
  entityName: string
  dateFrom: string
  dateTo: string
}

// ----------------------------------------------------------------------------
// Server action
// ----------------------------------------------------------------------------

/**
 * Fetch P&L data for a given period and entity filter.
 *
 * @param params.period     — reporting period preset
 * @param params.dateFrom   — required when period === 'custom' (ISO-8601)
 * @param params.dateTo     — required when period === 'custom' (ISO-8601)
 * @param params.entitySlug — 'jk-zentra' | 'personal' | 'all'
 *
 * @returns fully populated IncomeStatementData
 */
export async function getIncomeStatement(params: {
  period: IncomeStatementPeriod
  dateFrom?: string
  dateTo?: string
  entitySlug?: IncomeStatementEntityFilter
}): Promise<IncomeStatementData> {
  const supabase = await createActionClient()

  const entitySlug = params.entitySlug ?? 'jk-zentra'
  const { dateFrom, dateTo } = computeDateRange(
    params.period,
    params.dateFrom,
    params.dateTo
  )

  // Resolve entity filter ---------------------------------------------------
  let entityIds: string[] = []
  let entityNameLabel = 'All Entities'

  if (entitySlug === 'all') {
    const { data: allEntities, error: entityErr } = await supabase
      .from('entities')
      .select('id, name')
    if (entityErr) throw new Error(`entities fetch failed: ${entityErr.message}`)
    entityIds = allEntities?.map((e: Pick<EntityRow, 'id' | 'name'>) => e.id) ?? []
    entityNameLabel = 'All Entities'
  } else {
    const { data: entityRow, error: entityErr } = await supabase
      .from('entities')
      .select('id, name')
      .eq('slug', entitySlug)
      .single()
    if (entityErr) throw new Error(`entity lookup failed: ${entityErr.message}`)
    entityIds = entityRow ? [entityRow.id] : []
    entityNameLabel = entityRow?.name ?? entitySlug
  }

  if (entityIds.length === 0) {
    // No matching entity — return empty report
    return {
      income: { totalMinor: 0, sources: [] },
      expenses: { totalMinor: 0, byCategory: [] },
      netProfitMinor: 0,
      outstandingReceivablesMinor: 0,
      outstandingProjectCount: 0,
      periodLabel: buildPeriodLabel(params.period, dateFrom, dateTo),
      entityName: entityNameLabel,
      dateFrom,
      dateTo,
    }
  }

  // -------------------------------------------------------------------------
  // INCOME: type='income', status='active', occurred_at within period
  // -------------------------------------------------------------------------
  let incomeQuery = supabase
    .from('transactions')
    .select('vendor, description, amount_minor, currency, myr_equiv_minor')
    .eq('type', 'income')
    .eq('status', 'active')
    .gte('occurred_at', dateFrom)
    .lte('occurred_at', dateTo)

  if (entitySlug !== 'all') {
    incomeQuery = incomeQuery.eq('entity_id', entityIds[0])
  } else {
    incomeQuery = incomeQuery.in('entity_id', entityIds)
  }

  const { data: incomeRows, error: incomeErr } =
    await incomeQuery.returns<TransactionRow[]>()

  if (incomeErr) throw new Error(`income fetch failed: ${incomeErr.message}`)

  const incomeSources = (incomeRows ?? [])
    .map((row): IncomeSource => {
      const amountMinor =
        row.myr_equiv_minor !== null && row.myr_equiv_minor !== undefined
          ? row.myr_equiv_minor
          : row.amount_minor
      return {
        vendor: row.vendor,
        description: row.description ?? '',
        amountMinor,
        currency: 'MYR', // always report in MYR
      }
    })
    // Group by vendor: merge descriptions for same vendor
    .reduce<IncomeSource[]>((acc, curr) => {
      const existing = acc.find((s) => s.vendor === curr.vendor)
      if (existing) {
        existing.amountMinor += curr.amountMinor
        if (existing.description && curr.description) {
          existing.description = `${existing.description}; ${curr.description}`
        } else if (curr.description) {
          existing.description = curr.description
        }
        return acc
      }
      return [...acc, curr]
    }, [])
    // Sort by amount desc
    .sort((a, b) => b.amountMinor - a.amountMinor)

  const incomeTotalMinor = incomeSources.reduce(
    (sum, s) => sum + s.amountMinor,
    0
  )

  // -------------------------------------------------------------------------
  // EXPENSES: type='expense', status='active', occurred_at within period
  // -------------------------------------------------------------------------
  let expenseQuery = supabase
    .from('transactions')
    .select('category, subcategory, amount_minor, myr_equiv_minor')
    .eq('type', 'expense')
    .eq('status', 'active')
    .gte('occurred_at', dateFrom)
    .lte('occurred_at', dateTo)

  if (entitySlug !== 'all') {
    expenseQuery = expenseQuery.eq('entity_id', entityIds[0])
  } else {
    expenseQuery = expenseQuery.in('entity_id', entityIds)
  }

  const { data: expenseRows, error: expenseErr } =
    await expenseQuery.returns<TransactionRow[]>()

  if (expenseErr) throw new Error(`expense fetch failed: ${expenseErr.message}`)

  // Group by category → subcategory
  const categoryMap = new Map<string, Map<string, number>>()

  for (const row of expenseRows ?? []) {
    const amountMinor =
      row.myr_equiv_minor !== null && row.myr_equiv_minor !== undefined
        ? row.myr_equiv_minor
        : row.amount_minor

    const category = row.category || 'Other'
    const subcategory = row.subcategory || 'General'

    if (!categoryMap.has(category)) {
      categoryMap.set(category, new Map<string, number>())
    }
    const subMap = categoryMap.get(category)!
    subMap.set(subcategory, (subMap.get(subcategory) ?? 0) + amountMinor)
  }

  // Build sorted ExpenseCategory[] — "Other" always at bottom
  const expenseCategories: ExpenseCategory[] = []
  let otherCategory: ExpenseCategory | null = null

  for (const [category, subMap] of categoryMap) {
    const subcategories: ExpenseSubcategory[] = Array.from(subMap.entries())
      .map(([subcategory, amountMinor]) => ({ subcategory, amountMinor }))
      .sort((a, b) => b.amountMinor - a.amountMinor)

    const totalMinor = subcategories.reduce((s, sc) => s + sc.amountMinor, 0)

    const ec: ExpenseCategory = {
      category,
      subcategories,
      totalMinor,
    }

    if (category === 'Other') {
      otherCategory = ec
    } else {
      expenseCategories.push(ec)
    }
  }

  // Sort categories by total desc (excluding Other)
  expenseCategories.sort((a, b) => b.totalMinor - a.totalMinor)

  // Pin Other at bottom
  if (otherCategory) {
    expenseCategories.push(otherCategory)
  }

  const expenseTotalMinor = expenseCategories.reduce(
    (s, c) => s + c.totalMinor,
    0
  )

  // -------------------------------------------------------------------------
  // NET PROFIT
  // -------------------------------------------------------------------------
  const netProfitMinor = incomeTotalMinor - expenseTotalMinor

  // -------------------------------------------------------------------------
  // OUTSTANDING RECEIVABLES
  // Projects with status NOT in terminal/closed states,
  // minus income transactions already linked to those projects.
  // -------------------------------------------------------------------------
  const EXCLUDED_PROJECT_STATUSES: ProjectRow['status'][] = [
    'fully_paid',
    'cancelled',
    'cancelled_with_deposit_kept',
    'cancelled_partial',
    'closed_short_paid',
    'archived',
  ]

  let projectQuery = supabase
    .from('projects')
    .select('id, total_value_minor, currency')
    .not('status', 'in', `(${EXCLUDED_PROJECT_STATUSES.join(',')})`)

  if (entitySlug !== 'all') {
    projectQuery = projectQuery.eq('entity_id', entityIds[0])
  } else {
    projectQuery = projectQuery.in('entity_id', entityIds)
  }

  const { data: activeProjects, error: projectErr } =
    await projectQuery.returns<ProjectRow[]>()

  if (projectErr)
    throw new Error(`projects fetch failed: ${projectErr.message}`)

  const outstandingProjectCount = activeProjects?.length ?? 0

  // Sum raw project total values (these are in the project currency —
  // for receivables display we keep them as MYR-equivalent where possible)
  const projectIds = (activeProjects ?? []).map((p) => p.id)
  let totalProjectValueMinor = 0

  // Get linked income transactions for these projects
  let linkedIncomeReceivedMinor = 0

  if (projectIds.length > 0) {
    // Sum project total values (use as-is; they're stored in project.currency)
    for (const p of activeProjects ?? []) {
      // For outstanding receivables, we use the total_value_minor as stored
      // (in practice all project values and transactions should be MYR)
      totalProjectValueMinor += p.total_value_minor
    }

    const { data: linkedIncome, error: linkedErr } = await supabase
      .from('transactions')
      .select('myr_equiv_minor, amount_minor')
      .eq('type', 'income')
      .eq('status', 'active')
      .in('project_id', projectIds)

    if (linkedErr)
      throw new Error(`linked income fetch failed: ${linkedErr.message}`)

    linkedIncomeReceivedMinor = (linkedIncome ?? []).reduce((sum, row) => {
      const amt =
        row.myr_equiv_minor !== null && row.myr_equiv_minor !== undefined
          ? row.myr_equiv_minor
          : row.amount_minor
      return sum + amt
    }, 0)
  }

  const outstandingReceivablesMinor = Math.max(
    0,
    totalProjectValueMinor - linkedIncomeReceivedMinor
  )

  // -------------------------------------------------------------------------
  // Build period label
  // -------------------------------------------------------------------------
  const periodLabel = buildPeriodLabel(params.period, dateFrom, dateTo)

  return {
    income: {
      totalMinor: incomeTotalMinor,
      sources: incomeSources,
    },
    expenses: {
      totalMinor: expenseTotalMinor,
      byCategory: expenseCategories,
    },
    netProfitMinor,
    outstandingReceivablesMinor,
    outstandingProjectCount,
    periodLabel,
    entityName: entityNameLabel,
    dateFrom,
    dateTo,
  }
}
