/**
 * ============================================================================
 * LedgerSort — Sort Controls for the Ledger List
 * ============================================================================
 *
 * Provides sort-by dropdown and direction toggle. Syncs with URL search params.
 * Default sort: occurred_at desc (newest transactions first).
 *
 * Sortable columns:
 *   - date      → transactions.occurred_at
 *   - amount    → transactions.amount_minor
 *   - vendor    → transactions.vendor
 *   - category  → transactions.category
 *
 * @example
 * <LedgerSort
 *   sortField="date"
 *   sortDir="desc"
 *   onSortChange={(field, dir) => { ... }}
 * />
 */

'use client'

import React, { useCallback } from 'react'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** Sortable column fields — must match columns in the transactions table. */
export type SortField = 'date' | 'amount' | 'vendor' | 'category'

/** Sort direction. */
export type SortDirection = 'asc' | 'desc'

/** Props for the LedgerSort component. */
interface LedgerSortProps {
  /** Currently active sort field. */
  sortField: SortField
  /** Currently active sort direction. */
  sortDirection: SortDirection
  /** Called when sort configuration changes. */
  onSortChange: (field: SortField, direction: SortDirection) => void
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/** Human-readable labels for each sort field. */
const FIELD_LABELS: Record<SortField, string> = {
  date: 'Date',
  amount: 'Amount',
  vendor: 'Vendor',
  category: 'Category',
}

/** All available sort options. */
const SORT_FIELDS: SortField[] = ['date', 'amount', 'vendor', 'category']

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

/**
 * Sort controls for the ledger.
 *
 * Shows a segmented control for sort field and a direction toggle button.
 * Fully accessible with ARIA labels.
 */
export function LedgerSort({
  sortField,
  sortDirection,
  onSortChange,
}: LedgerSortProps): JSX.Element {

  /**
   * Handle field selection — clicking the active field toggles direction.
   */
  const handleFieldClick = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        // Toggle direction
        onSortChange(field, sortDirection === 'asc' ? 'desc' : 'asc')
      } else {
        // New field — default to desc for date, asc for others
        const defaultDir: SortDirection = field === 'date' ? 'desc' : 'asc'
        onSortChange(field, defaultDir)
      }
    },
    [sortField, sortDirection, onSortChange]
  )

  /**
   * Handle explicit direction toggle.
   */
  const handleDirToggle = useCallback(() => {
    onSortChange(sortField, sortDirection === 'asc' ? 'desc' : 'asc')
  }, [sortField, sortDirection, onSortChange])

  return (
    <div
      className="ledger-sort"
      role="group"
      aria-label="Sort transactions"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontSize: '13px',
          color: '#6B6B6B',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        Sort by
      </span>

      {/* Field buttons */}
      <div
        style={{
          display: 'flex',
          border: '1px solid #E8E6E1',
          borderRadius: '8px',
          overflow: 'hidden',
          background: 'white',
        }}
      >
        {SORT_FIELDS.map((field) => {
          const isActive = field === sortField
          return (
            <button
              key={field}
              onClick={() => handleFieldClick(field)}
              aria-pressed={isActive}
              aria-label={`Sort by ${FIELD_LABELS[field]}${isActive ? `, ${sortDirection === 'asc' ? 'ascending' : 'descending'}` : ''}`}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                border: 'none',
                borderRight: '1px solid #E8E6E1',
                background: isActive ? '#FFF6EF' : 'white',
                color: isActive ? '#C14A0E' : '#6B6B6B',
                cursor: 'pointer',
                transition: 'all 120ms ease',
                whiteSpace: 'nowrap',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = '#FAFAF7'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'white'
                }
              }}
            >
              {FIELD_LABELS[field]}
              {isActive && (
                <span
                  aria-hidden="true"
                  style={{ marginLeft: '4px', fontSize: '11px' }}
                >
                  {sortDirection === 'asc' ? '\u2191' : '\u2193'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Direction toggle */}
      <button
        onClick={handleDirToggle}
        aria-label={`Toggle sort direction, currently ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
        title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
        style={{
          width: '32px',
          height: '32px',
          border: '1px solid #E8E6E1',
          borderRadius: '8px',
          background: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          color: '#6B6B6B',
          transition: 'all 120ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#FAFAF7'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'white'
        }}
      >
        {sortDirection === 'asc' ? '\u2191' : '\u2193'}
      </button>
    </div>
  )
}

export default LedgerSort
