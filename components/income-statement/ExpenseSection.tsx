/**
 * ExpenseSection — Expense category tree for the P&L statement.
 * JK Zentra Finance Cockpit — Sprint 1
 *
 * Displays expenses grouped by category → subcategory.
 * Category header: bold, category total on right.
 * Subcategory rows: indented 16px, lighter text.
 * "Other" category always at bottom (enforced by server sort).
 * Total row at bottom: bold, border-top.
 */

import React from 'react'
import type { ExpenseCategory } from '@/lib/actions/incomeStatement'

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------

interface ExpenseSectionProps {
  /** Expense categories pre-sorted by total descending. */
  byCategory: ExpenseCategory[]
  /** Total expenses in minor units. */
  totalMinor: number
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Format an integer minor-unit amount as MYR display string.
 * @example 424000 → "RM 4,240.00"
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
 * Renders the expense portion of the P&L statement.
 *
 * @param byCategory — array of expense categories sorted by total desc
 * @param totalMinor  — aggregate expenses in minor units
 */
export function ExpenseSection({ byCategory, totalMinor }: ExpenseSectionProps): React.ReactElement {
  return (
    <section aria-label="Expenses">
      {/* Section header */}
      <div className="is-section-header is-expense-header">
        <span className="is-section-title">Expenses</span>
        <span className="is-section-total is-expense-total">
          {fmtMYR(totalMinor)}
        </span>
      </div>

      {/* Category tree */}
      <div className="is-rows">
        {byCategory.map((cat) => (
          <div key={cat.category} className="is-category-block">
            {/* Category header */}
            <div className="is-row is-category-header">
              <span className="is-row-label is-category-label">
                {cat.category}
              </span>
              <span className="is-row-amount is-category-total">
                {fmtMYR(cat.totalMinor)}
              </span>
            </div>

            {/* Subcategory rows */}
            {cat.subcategories.map((sub) => (
              <div key={sub.subcategory} className="is-row is-subcategory-row">
                <span className="is-row-label is-subcategory-label">
                  {sub.subcategory}
                </span>
                <span className="is-row-amount is-subcategory-amount">
                  {fmtMYR(sub.amountMinor)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Total row */}
      <div className="is-total-row">
        <span className="is-total-label">Total Expenses</span>
        <span className="is-total-amount">
          {fmtMYR(totalMinor)}
        </span>
      </div>
    </section>
  )
}
