/**
 * JK Zentra Finance Cockpit — Dashboard Zone 2 (Radars)
 * Sprint 1
 *
 * The "Radars" section of the dashboard: a horizontal strip of three
 * summary widgets that answer key questions at a glance.
 *
 * Positioned below the KPI strip (Zone 1) and above the spend breakdown
 * (Zone 3).
 *
 * Layout:
 *   - Desktop: 3-column grid (equal width)
 *   - Mobile:  single column (stacked)
 *
 * +-------------------------------------------------------------+
 * | [Upcoming Payments]  | [Tax Position]    | [Receivables]    |
 * |                       |                    |                  |
 * | Next 14 days          | CP500 status      | You're owed      |
 * | 4 renewals            | Next: Mar 10      | RM 24,000        |
 * | RM 1,247 due          | Amount: RM 1,931  | 3 active projects|
 * |                       |                   |                  |
 * | [Anthropic] Mar 3     | [On track]        | Acme Corp: 8k    |
 * | [Vercel]    Mar 12    | Tax reserve: 4.2k | PhoneLab: 16k    |
 * | [Cursor]    Mar 15    |                   |                  |
 * +-------------------------------------------------------------+
 *
 * Each widget is a Server Component that fetches its own data. They
 * render in parallel via React's streaming SSR.
 *
 * @module components/dashboard/DashboardZone2
 */

import { SubscriptionRadar } from './SubscriptionRadar'
import { TaxPositionGlance } from './TaxPositionGlance'
import { OutstandingReceivables } from './OutstandingReceivables'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Dashboard Zone 2 — Radars strip.
 *
 * Renders a responsive 3-column grid containing:
 *   1. SubscriptionRadar    — upcoming subscription renewals
 *   2. TaxPositionGlance    — CP500 status + tax reserve
 *   3. OutstandingReceivables — unpaid project balances
 *
 * @returns JSX.Element
 */
export function DashboardZone2(): JSX.Element {
  return (
    <section
      aria-label="Dashboard radars"
      style={{
        width: '100%',
        marginBottom: '24px',
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <SubscriptionRadar />
        <TaxPositionGlance />
        <OutstandingReceivables />
      </div>


    </section>
  )
}
