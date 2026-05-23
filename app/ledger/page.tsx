/**
 * @fileoverview Ledger Page — Unified Transaction List.
 *
 * Server Component entry point for the ledger. The LedgerList client
 * component handles its own data fetching, filtering, sorting, and
 * infinite scroll. This page simply provides the shell.
 *
 * Wrapped in AppShellLayout from (app)/layout.tsx.
 */

import type { Metadata } from 'next'
import { LedgerList } from '@/components/ledger/LedgerList'

export const metadata: Metadata = {
  title: 'Ledger',
}

/**
 * Ledger route — renders the full transaction list with filters and sorting.
 */
export default function LedgerRoute(): JSX.Element {
  return (
    <div className="app-container py-6">
      <LedgerList />
    </div>
  )
}
