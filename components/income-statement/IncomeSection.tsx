/**
 * IncomeSection — Income rows for the P&L statement.
 * JK Zentra Finance Cockpit — Sprint 1
 *
 * Displays income grouped by vendor/source.
 * Vendor name (left), description (small, grey), amount (right, green).
 * Total row at bottom: bold, border-top.
 */

import React from 'react'
import type { IncomeSource } from '@/lib/actions/incomeStatement'

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------

interface IncomeSectionProps {
  /** Income sources pre-sorted by amount descending. */
  sources: IncomeSource[]
  /** Total income in minor units. */
  totalMinor: number
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Format an integer minor-unit amount as MYR display string.
 * @example 800000 → "RM 8,000.00"
 */
function fmtMYR(minor: number): string {
  const absMinor = Math.abs(minor)
  const ringgit = (absMinor / 100).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `RM ${ringgit}`
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

/**
 * Renders the income portion of the P&L statement.
 *
 * @param sources   — array of income sources sorted by amount desc
 * @param totalMinor — aggregate income in minor units
 */
export function IncomeSection({ sources, totalMinor }: IncomeSectionProps): React.ReactElement {
  return (
    <section aria-label="Income">
      {/* Section header */}
      <div className="is-section-header is-income-header">
        <span className="is-section-title">Income</span>
        <span className="is-section-total is-income-total">
          {fmtMYR(totalMinor)}
        </span>
      </div>

      {/* Income rows */}
      <div className="is-rows">
        {sources.map((src) => (
          <div key={src.vendor} className="is-row is-income-row">
            <div className="is-row-main">
              <span className="is-row-label">{src.vendor}</span>
              <span className="is-row-amount is-income-color">
                {fmtMYR(src.amountMinor)}
              </span>
            </div>
            {src.description && (
              <div className="is-row-description">{src.description}</div>
            )}
          </div>
        ))}
      </div>

      {/* Total row */}
      <div className="is-total-row">
        <span className="is-total-label">Total Income</span>
        <span className="is-total-amount is-income-color">
          {fmtMYR(totalMinor)}
        </span>
      </div>
    </section>
  )
}
