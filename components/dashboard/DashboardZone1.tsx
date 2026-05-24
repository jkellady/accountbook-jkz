/**
 * JK Zentra Finance Cockpit — Dashboard Zone 1 (KPI Strip)
 *
 * The top section of the dashboard: a horizontal strip of four KPI cards
 * that show the most important numbers at a glance.
 *
 * @module components/dashboard/DashboardZone1
 */

import { getDashboardKPIs } from "@/lib/actions/dashboardZone1"
import { KPICard } from "./KPICard"

export async function DashboardZone1(): Promise<JSX.Element> {
  const kpis = await getDashboardKPIs()

  const spendFormatted = `RM ${(kpis.spend_mtd_minor / 100).toFixed(2)}`
  const incomeFormatted = `RM ${(kpis.income_mtd_minor / 100).toFixed(2)}`
  const netFlowFormatted = `RM ${(Math.abs(kpis.net_cash_flow_minor) / 100).toFixed(2)}`

  const netFlowVariant = kpis.net_cash_flow_minor >= 0 ? "positive" : "negative" as const

  return (
    <section aria-label="Key performance indicators" className="w-full mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Spend MTD"
          value={spendFormatted}
          subtitle="vs last month: --%"
          delta={undefined}
          href="/ledger?type=expense"
        />
        <KPICard
          label="Income MTD"
          value={incomeFormatted}
          subtitle={`${kpis.income_source_count ?? 0} source${(kpis.income_source_count ?? 0) !== 1 ? "s" : ""}`}
          href="/ledger?type=income"
        />
        <KPICard
          label="Net Cash Flow"
          value={`${kpis.net_cash_flow_minor >= 0 ? "+" : "-"}${netFlowFormatted}`}
          subtitle={`Spend ${spendFormatted}, Income ${incomeFormatted}`}
          delta={{
            text: kpis.net_cash_flow_minor >= 0 ? "In surplus" : "In deficit",
            variant: netFlowVariant,
          }}
          href="/income-statement"
        />
        <KPICard
          label="Review Queue"
          value={String(kpis.review_queue_count ?? 0)}
          subtitle="needs your review"
          badgeCount={(kpis.review_queue_count ?? 0) > 0 ? (kpis.review_queue_count ?? 0) : undefined}
          actionLink={
            (kpis.review_queue_count ?? 0) > 0
              ? { text: "Review now →", href: "/review" }
              : undefined
          }
          href="/review"
        />
      </div>
    </section>
  )
}