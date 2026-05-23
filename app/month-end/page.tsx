/**
 * Month-End Page — Close Month Workflow.
 *
 * Month-end checklist, bank reconciliation, and close/reopen
 * month controls. Prevents accidental edits to closed periods.
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Month-End',
}

export default function MonthEndRoute(): JSX.Element {
  return (
    <div className="app-container py-6">
      <div className="page-header">
        <h1>Month-End</h1>
        <p>Close the month and reconcile balances</p>
      </div>
      <div className="card">
        <p className="text-sm text-grey">
          Month-end checklist and close controls to be mounted here.
        </p>
      </div>
    </div>
  )
}
