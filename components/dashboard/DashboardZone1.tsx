/**
 * JK Zentra Finance Cockpit — Dashboard Zone 1 (KPI Strip)
 * Sprint 1
 *
 * The top section of the dashboard: a horizontal strip of four KPI cards
 * that show the most important numbers at a glance. This is the first thing
 * the user sees — it must be scannable, precise, and load fast.
 *
 * Cards:
 *   1. Spend MTD    — total expenses this month vs last month, with entity split
 *   2. Income MTD   — total income this month, source count and names
 *   3. Net Cash Flow — income minus spend, colour-coded (green/red)
 *   4. Review Queue — transactions pending review, with action link
 *
 * Layout:
 *   - Desktop (>=1024px): 4-column grid
 *   - Tablet (769–1023px):  2x2 grid
 *   - Mobile (<=768px):     single column stack
 *
 * Each card is a KPICard — white bg, 1px border, 12px radius, hover lift.
 * Clicking a card navigates to the relevant module.
 *
 * @module components/dashboard/DashboardZone1
 */

import { getDashboardKPIs } from '../../lib/actions/dashboardZone1'
import { KPICard } from './KPICard'
import { formatAmount } from '../../lib/utils/currency'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Dashboard Zone 1 — KPI strip.
 *
 * Fetches KPI data server-side and renders four metric cards in a responsive
 * grid. Each card navigates to its relevant module on click.
 *
 * @returns JSX.Element
 */
export async function DashboardZone1(): Promise<JSX.Element> {
  const kpis = await getDashboardKPIs()

  const spendFormatted = formatAmount(kpis.spend_mtd_minor, 'MYR')
  const incomeFormatted = formatAmount(kpis.income_mtd_minor, 'MYR')
  const netFlowFormatted = formatAmount(Math.abs(kpis.net_cash_flow_minor), 'MYR')

  // Net flow: green if positive (income > spend), red if negative
  const netFlowVariant = kpis.net_cash_flow_minor >= 0 ? 'positive' : 'negative' as const

  return (
    <section
      aria-label="Key performance indicators"
      style={{
        width: '100%',
        marginBottom: '24px',
      }}
    >
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        
      >
        {/* Card 1: Spend MTD */}
        <KPICard
          label="Spend MTD"
          value={spendFormatted}
          subtitle={`vs last month: --%`}
          delta={undefined}
          splitBar={{
            personal_minor: kpis.spend_by_entity.personal_minor,
            jk_zentra_minor: kpis.spend_by_entity.jk_zentra_minor,
            personal_label: 'Personal',
            jk_zentra_label: 'JK Zentra',
          }}
          href="/ledger?type=expense"
        />

        {/* Card 2: Income MTD */}
        <KPICard
          label="Income MTD"
          value={incomeFormatted}
          subtitle={`${kpis.income_source_count} source${kpis.income_source_count !== 1 ? 's' : ''}`}
          sourceNames={kpis.income_source_names}
          href="/ledger?type=income"
        />

        {/* Card 3: Net Cash Flow */}
        <KPICard
          label="Net Cash Flow"
          value={`${kpis.net_cash_flow_minor >= 0 ? '+' : '-'}${netFlowFormatted}`}
          subtitle={`Spend ${formatAmount(kpis.spend_mtd_minor, 'MYR')}, Income ${formatAmount(kpis.income_mtd_minor, 'MYR')}`}
          delta={{
            text: kpis.net_cash_flow_minor >= 0 ? 'In surplus' : 'In deficit',
            variant: netFlowVariant,
          }}
          href="/income-statement"
        />

        {/* Card 4: Review Queue */}
        <KPICard
          label="Review Queue"
          value={String(kpis.review_queue_count)}
          subtitle="needs your review"
          badgeCount={kpis.review_queue_count > 0 ? kpis.review_queue_count : undefined}
          actionLink={
            kpis.review_queue_count > 0
              ? { text: 'Review now →', href: '/review' }
              : undefined
          }
          href="/review"
        />
      </div>


    </section>
  )
}
