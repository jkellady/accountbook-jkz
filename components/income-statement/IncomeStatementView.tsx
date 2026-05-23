/**
 * IncomeStatementView — Main P&L report screen.
 * JK Zentra Finance Cockpit — Sprint 1
 *
 * Single-screen income statement: Income - Expenses = Net Profit.
 * Period selector, entity filter, export buttons, and responsive layout.
 * Cash basis only. Uses `occurred_at` for transaction date.
 */

'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { IncomeSection } from './IncomeSection'
import { ExpenseSection } from './ExpenseSection'
import { getIncomeStatement } from '@/lib/actions/incomeStatement'
import {
  generateIncomeStatementCSV,
  generateIncomeStatementPDF,
} from '@/lib/utils/exports'
import type {
  IncomeStatementData,
  IncomeStatementPeriod,
  IncomeStatementEntityFilter,
} from '@/lib/actions/incomeStatement'

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Format an integer minor-unit amount as MYR display string.
 * @example 376000 → "RM 3,760.00"
 */
function fmtMYR(minor: number): string {
  const absMinor = Math.abs(minor)
  const ringgit = (absMinor / 100).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `RM ${ringgit}`
}

const PERIOD_OPTIONS: { value: IncomeStatementPeriod; label: string }[] = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'ytd', label: 'YTD' },
  { value: 'full_year', label: 'Full Year' },
  { value: 'custom', label: 'Custom Range' },
]

const ENTITY_OPTIONS: { value: IncomeStatementEntityFilter; label: string }[] = [
  { value: 'jk-zentra', label: 'JK Zentra' },
  { value: 'personal', label: 'Personal' },
  { value: 'all', label: 'All Entities' },
]

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

/**
 * Main Income Statement (P&L) view.
 *
 * Fetches P&L data server-side via `getIncomeStatement` and renders
 * a complete cash-basis income statement with period controls,
 * entity filtering, and export functionality.
 */
export function IncomeStatementView(): React.ReactElement {
  // ---- State ----
  const [period, setPeriod] = useState<IncomeStatementPeriod>('this_month')
  const [entitySlug, setEntitySlug] =
    useState<IncomeStatementEntityFilter>('jk-zentra')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [data, setData] = useState<IncomeStatementData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ---- Fetch data ----
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getIncomeStatement({
        period,
        dateFrom: period === 'custom' ? customFrom : undefined,
        dateTo: period === 'custom' ? customTo : undefined,
        entitySlug,
      })
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load P&L data')
    } finally {
      setLoading(false)
    }
  }, [period, entitySlug, customFrom, customTo])

  useEffect(() => {
    // Auto-fetch on mount and whenever controls change
    // Skip if custom period is selected but dates aren't set yet
    if (period === 'custom' && (!customFrom || !customTo)) {
      return
    }
    void loadData()
  }, [loadData, period, entitySlug, customFrom, customTo])

  // ---- Export handlers ----
  const handleExportCSV = useCallback(() => {
    if (!data) return
    const csv = generateIncomeStatementCSV(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `income-statement-${data.dateFrom}-${data.dateTo}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [data])

  const handleExportPDF = useCallback(() => {
    if (!data) return
    const html = generateIncomeStatementPDF(data)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const printWindow = window.open(url, '_blank')
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.focus()
        // User can use browser print-to-PDF
      })
    }
    // Clean up blob URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }, [data])

  // ---- Derived values ----
  const netLabel = useMemo(
    () => (data && data.netProfitMinor >= 0 ? 'Net Profit' : 'Net Loss'),
    [data]
  )
  const netColor = useMemo(
    () => (data && data.netProfitMinor >= 0 ? '#1F8A4C' : '#B43A2D'),
    [data]
  )

  // ---- Render ----
  return (
    <div className="is-view">
      {/* CSS-in-JSX styles */}
      <style>{`
        .is-view {
          max-width: 720px;
          margin: 0 auto;
          padding: 24px 16px 48px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI',
            sans-serif;
          background: #fafaf7;
          min-height: 100vh;
        }

        /* Toolbar */
        .is-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          margin-bottom: 20px;
        }
        .is-select {
          padding: 8px 12px;
          border: 1px solid #e8e6e1;
          border-radius: 8px;
          background: #fff;
          font-family: inherit;
          font-size: 13px;
          color: #181818;
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B6B6B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 32px;
        }
        .is-select:focus {
          outline: none;
          border-color: #f37002;
          box-shadow: 0 0 0 2px rgba(243, 112, 2, 0.12);
        }
        .is-btn {
          padding: 8px 14px;
          border: 1px solid #e8e6e1;
          border-radius: 8px;
          background: #fff;
          font-family: inherit;
          font-size: 13px;
          color: #181818;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .is-btn:hover {
          background: #f5f4f0;
          border-color: #d4d0c8;
        }
        .is-btn:active {
          background: #ebe9e3;
        }
        .is-btn-group {
          display: flex;
          gap: 0;
        }
        .is-btn-group .is-btn {
          border-radius: 0;
        }
        .is-btn-group .is-btn:first-child {
          border-radius: 8px 0 0 8px;
        }
        .is-btn-group .is-btn:last-child {
          border-radius: 0 8px 8px 0;
          margin-left: -1px;
        }

        /* Custom date inputs */
        .is-custom-dates {
          display: flex;
          gap: 8px;
          align-items: center;
          width: 100%;
          margin-top: -4px;
        }
        .is-date-input {
          padding: 8px 10px;
          border: 1px solid #e8e6e1;
          border-radius: 8px;
          background: #fff;
          font-family: inherit;
          font-size: 13px;
          color: #181818;
        }
        .is-date-input:focus {
          outline: none;
          border-color: #f37002;
          box-shadow: 0 0 0 2px rgba(243, 112, 2, 0.12);
        }

        /* Card */
        .is-card {
          background: #fff;
          border: 1px solid #e8e6e1;
          border-radius: 12px;
          padding: 24px;
        }

        /* Title */
        .is-title {
          font-size: 20px;
          font-weight: 600;
          letter-spacing: -0.02em;
          margin-bottom: 4px;
        }
        .is-subtitle {
          font-size: 13px;
          color: #6b6b6b;
          margin-bottom: 20px;
        }

        /* Shared row styles */
        .is-section-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-top: 20px;
          margin-bottom: 10px;
          padding-bottom: 6px;
        }
        .is-section-title {
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .is-section-total {
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          font-size: 14px;
          font-weight: 700;
        }
        .is-income-total {
          color: #181818;
        }
        .is-expense-total {
          color: #181818;
        }

        .is-rows {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .is-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding: 4px 0;
        }
        .is-row-main {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          width: 100%;
        }
        .is-row-label {
          font-size: 14px;
          color: #181818;
        }
        .is-row-amount {
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          font-size: 14px;
          color: #181818;
          white-space: nowrap;
        }
        .is-row-description {
          font-size: 12px;
          color: #a0a0a0;
          margin-top: -2px;
          padding-bottom: 2px;
        }
        .is-income-color {
          color: #1f8a4c;
        }
        .is-income-row {
          flex-direction: column;
          align-items: stretch;
          gap: 0;
        }
        .is-income-row .is-row-main {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }

        /* Category / subcategory */
        .is-category-block {
          margin-bottom: 4px;
        }
        .is-category-header {
          font-weight: 700;
        }
        .is-category-label {
          font-weight: 700;
        }
        .is-category-total {
          font-weight: 700;
        }
        .is-subcategory-row {
          padding-left: 16px;
        }
        .is-subcategory-label {
          color: #6b6b6b;
          font-size: 14px;
        }
        .is-subcategory-amount {
          color: #6b6b6b;
          font-size: 14px;
        }

        /* Total row */
        .is-total-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #e5e5e5;
        }
        .is-total-label {
          font-size: 14px;
          font-weight: 700;
        }
        .is-total-amount {
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          font-size: 14px;
          font-weight: 700;
        }

        /* Net Profit */
        .is-net-section {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 2px solid #181818;
        }
        .is-net-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        .is-net-label {
          font-size: 16px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .is-net-amount {
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          font-size: 22px;
          font-weight: 700;
        }

        /* Receivables note */
        .is-receivables-note {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #e5e5e5;
          font-size: 13px;
          font-style: italic;
          color: #a0a0a0;
          text-align: center;
        }

        /* Loading */
        .is-loading {
          text-align: center;
          padding: 48px 0;
          color: #a0a0a0;
          font-size: 14px;
        }

        /* Error */
        .is-error {
          text-align: center;
          padding: 32px 0;
          color: #b43a2d;
          font-size: 14px;
        }

        /* Divider */
        .is-divider {
          border: none;
          border-top: 1px solid #e5e5e5;
          margin: 0;
        }

        /* Responsive */
        @media (max-width: 600px) {
          .is-view {
            padding: 16px 12px 32px;
          }
          .is-toolbar {
            flex-direction: column;
            align-items: stretch;
          }
          .is-select,
          .is-btn {
            width: 100%;
          }
          .is-btn-group {
            width: 100%;
          }
          .is-btn-group .is-btn {
            flex: 1;
          }
          .is-card {
            padding: 16px;
          }
          .is-net-amount {
            font-size: 18px;
          }
        }
      `}</style>

      {/* Toolbar */}
      <div className="is-toolbar">
        <select
          className="is-select"
          value={period}
          onChange={(e) => setPeriod(e.target.value as IncomeStatementPeriod)}
          aria-label="Reporting period"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          className="is-select"
          value={entitySlug}
          onChange={(e) =>
            setEntitySlug(e.target.value as IncomeStatementEntityFilter)
          }
          aria-label="Entity filter"
        >
          {ENTITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className="is-btn-group">
          <button
            className="is-btn"
            onClick={handleExportCSV}
            disabled={!data || loading}
            type="button"
          >
            Export CSV
          </button>
          <button
            className="is-btn"
            onClick={handleExportPDF}
            disabled={!data || loading}
            type="button"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Custom date range */}
      {period === 'custom' && (
        <div className="is-toolbar">
          <div className="is-custom-dates">
            <input
              type="date"
              className="is-date-input"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              aria-label="Custom date from"
            />
            <span style={{ color: '#6B6B6B', fontSize: 13 }}>to</span>
            <input
              type="date"
              className="is-date-input"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              aria-label="Custom date to"
            />
          </div>
        </div>
      )}

      {/* Card */}
      <div className="is-card">
        {loading && !data && (
          <div className="is-loading">Loading statement...</div>
        )}

        {error && (
          <div className="is-error">
            {error}
            <br />
            <button
              className="is-btn"
              onClick={() => void loadData()}
              type="button"
              style={{ marginTop: 12 }}
            >
              Retry
            </button>
          </div>
        )}

        {data && (
          <>
            {/* Title */}
            <h1 className="is-title">
              Income Statement — {data.periodLabel}
            </h1>
            <p className="is-subtitle">
              {data.entityName} &middot; {data.dateFrom} &ndash; {data.dateTo}
            </p>

            {/* Income */}
            <IncomeSection
              sources={data.income.sources}
              totalMinor={data.income.totalMinor}
            />

            <hr className="is-divider" />

            {/* Expenses */}
            <ExpenseSection
              byCategory={data.expenses.byCategory}
              totalMinor={data.expenses.totalMinor}
            />

            {/* Net Profit */}
            <div className="is-net-section">
              <div className="is-net-row">
                <span className="is-net-label">{netLabel}</span>
                <span
                  className="is-net-amount"
                  style={{ color: netColor }}
                >
                  {fmtMYR(Math.abs(data.netProfitMinor))}
                </span>
              </div>
            </div>

            {/* Receivables note */}
            {data.outstandingReceivablesMinor > 0 && (
              <p className="is-receivables-note">
                Outstanding receivables not yet recognized:{" "}
                {fmtMYR(data.outstandingReceivablesMinor)} across{" "}
                {data.outstandingProjectCount} active project
                {data.outstandingProjectCount === 1 ? '' : 's'}.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
