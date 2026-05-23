/**
 * Vault Page — Document Storage.
 *
 * Browse, search, and manage all uploaded files (receipts, invoices,
 * bank statements, contracts).
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vault',
}

export default function VaultRoute(): JSX.Element {
  return (
    <div className="app-container py-6">
      <div className="page-header">
        <h1>Vault</h1>
        <p>All your receipts, invoices, and documents</p>
      </div>
      <div className="card">
        <p className="text-sm text-grey">
          Vault grid/list view component to be mounted here.
        </p>
      </div>
    </div>
  )
}
