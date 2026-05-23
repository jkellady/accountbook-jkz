/**
 * Income Statement Page — P&L Report.
 *
 * Displays profit and loss data with options to export as CSV or PDF.
 * Supports monthly, quarterly, and yearly views.
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Income Statement',
}

export default function IncomeStatementRoute(): JSX.Element {
  return (
    <div className="app-container py-6">
      <div className="page-header">
        <h1>Income Statement</h1>
        <p>Profit and loss overview with export options</p>
      </div>
      <div className="card">
        <p className="text-sm text-grey">
          Income statement view component to be mounted here.
        </p>
      </div>
    </div>
  )
}
