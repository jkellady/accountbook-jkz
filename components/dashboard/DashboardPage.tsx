/**
 * JK Zentra Finance Cockpit — Dashboard Page
 * Sprint 1
 *
 * The single-page morning briefing that composes all three dashboard zones
 * into a cohesive, scannable layout. Designed to be the first screen the
 * user sees after signing in — everything important, nothing more.
 *
 * Zones:
 *   - Zone 1 (top):    KPI strip — the most important numbers
 *   - Zone 2 (middle): Radars — subscription, tax, receivables (Sprint 3)
 *   - Zone 3 (bottom): Spend breakdown — patterns and recent activity
 *
 * Layout:
 *   - Background: #FAFAF7 (off-white)
 *   - Max-width: 1180px, centered
 *   - 24px gap between zones
 *   - Responsive: full-width with padding on all breakpoints
 *
 * The page is a Server Component that orchestrates three child server
 * components (Zones 1–3). Each zone fetches its own data so they render
 * in parallel via React's streaming SSR.
 *
 * @module components/dashboard/DashboardPage
 */

import { DashboardZone1 } from './DashboardZone1'
import { DashboardZone2 } from './DashboardZone2'
import { DashboardZone3 } from './DashboardZone3'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DashboardPage — the full morning briefing composition.
 *
 * Renders all three dashboard zones in a vertical stack with consistent
 * spacing and responsive constraints. Zone 2 (Radars) was built in Sprint 3
 * and is imported directly.
 *
 * @returns JSX.Element
 */
export function DashboardPage(): JSX.Element {
  return (
    <main
      style={{
        background: '#FAFAF7',
        minHeight: '100vh',
        padding: '24px 16px',
      }}
    >
      <div
        className="dashboard-container"
        style={{
          maxWidth: '1180px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Zone 1: KPI strip — the most important numbers */}
        <DashboardZone1 />

        {/* Zone 2: Radars — subscription, tax, receivables */}
        <DashboardZone2 />

        {/* Zone 3: Spend breakdown — patterns and recent activity */}
        <DashboardZone3 />
      </div>
    </main>
  )
}
