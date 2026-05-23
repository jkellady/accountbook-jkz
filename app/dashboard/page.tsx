/**
 * @fileoverview Dashboard Page — The Morning Briefing.
 *
 * Server Component that renders the three-zone dashboard layout.
 * Zone 1 (KPIs), Zone 2 (Radars), and Zone 3 (Spend breakdown) each fetch
 * their own data in parallel via React's streaming SSR.
 *
 * Wrapped in AppShellLayout from (app)/layout.tsx, which provides the
 * responsive sidebar/topbar and PWA bootstrap.
 *
 * CROSS-MODULE CONNECTIONS:
 *   - DashboardPage.tsx  → orchestrates all three zones
 *   - DashboardZone1.tsx → KPI strip (income, expenses, tax reserve, net)
 *   - DashboardZone2.tsx → Radar widgets (subscriptions, tax, receivables)
 *   - DashboardZone3.tsx → Spend breakdown + recent transactions
 */

import type { Metadata } from 'next'
import { DashboardPage } from '@/components/dashboard/DashboardPage'

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Dashboard',
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

/**
 * Dashboard route — renders the three-zone morning briefing.
 *
 * Each zone is a Server Component that streams its data independently,
 * so the page starts rendering immediately without waiting for all
 * data fetches to complete.
 */
export default function DashboardRoute(): JSX.Element {
  return <DashboardPage />
}
