/**
 * Tax Position Page — Tax Dashboard.
 *
 * Detailed tax position view with CP500 schedule, tax reserve balance,
 * forecast calculations, and tax prep guidance.
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tax Position',
}

export default function TaxPositionRoute(): JSX.Element {
  return (
    <div className="app-container py-6">
      <div className="page-header">
        <h1>Tax Position</h1>
        <p>Tax reserve, CP500 schedule, and forecast</p>
      </div>
      <div className="card">
        <p className="text-sm text-grey">
          Tax position view component to be mounted here.
        </p>
      </div>
    </div>
  )
}
