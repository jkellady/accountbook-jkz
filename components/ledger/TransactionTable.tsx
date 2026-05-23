/**
 * ============================================================================
 * TransactionTable — Desktop Transaction Table
 * ============================================================================
 *
 * Full-featured sortable table for desktop viewports. Displays transactions
 * in a clean tabular layout with:
 *   - Sortable column headers with visual arrow indicators
 *   - Hover row highlighting
 *   - Click row to open detail panel
 *   - JetBrains Mono for amounts (tabular numerals)
 *   - Right-aligned amounts
 *   - Paperclip icon for file attachments
 *   - Colour-coded status pills
 *   - Entity dots with names
 *
 * @example
 * <TransactionTable
 *   transactions={transactions}
 *   entities={entityMap}
 *   sortField="date"
 *   sortDirection="desc"
 *   onSortChange={(field, dir) => { ... }}
 *   onRowClick={(id) => openDetail(id)}
 *   selectedId={selectedTransactionId}
 * />
 */

'use client'

import React, { useCallback } from 'react'
import { formatAmount, getAmountColor } from '@/lib/utils/currency'
import type { TransactionRow, TransactionStatus } from '@/lib/supabase/database.types'
import type { SortField, SortDirection } from './LedgerSort'

export type { SortField, SortDirection }

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** Simplified entity info for display. */
interface EntityInfo {
  name: string
  slug: string
  color: string
}

/** Props for the TransactionTable component. */
interface TransactionTableProps {
  /** Array of transactions to display. */
  transactions: TransactionRow[]
  /** Map of entity_id → EntityInfo for rendering entity columns. */
  entities: Record<string, EntityInfo>
  /** Currently active sort field. */
  sortField: SortField
  /** Currently active sort direction. */
  sortDirection: SortDirection
  /** Called when a column header is clicked to change sort. */
  onSortChange: (field: SortField, direction: SortDirection) => void
  /** Called when a row is clicked. */
  onRowClick?: (transactionId: string) => void
  /** Currently selected transaction ID (highlighted row). */
  selectedId?: string | null
}

// ----------------------------------------------------------------------------
// Column definitions
// ----------------------------------------------------------------------------

/** Metadata for each sortable column. */
interface ColumnDef {
  key: SortField
  label: string
  width: string
  align: 'left' | 'right' | 'center'
  sortable: boolean
}

const COLUMNS: ColumnDef[] = [
  { key: 'date', label: 'Date', width: '110px', align: 'left', sortable: true },
  { key: 'vendor', label: 'Vendor', width: '1fr', align: 'left', sortable: true },
  { key: 'category', label: 'Category', width: '140px', align: 'left', sortable: true },
  { key: 'vendor', label: 'Entity', width: '120px', align: 'left', sortable: false }, // entity uses vendor slot but renders differently
  { key: 'amount', label: 'Amount', width: '130px', align: 'right', sortable: true },
  { key: 'date', label: 'Status', width: '110px', align: 'center', sortable: false }, // status uses non-sortable slot
  { key: 'date', label: '', width: '40px', align: 'center', sortable: false }, // file icon column
]

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Format an ISO date string to "22 May 2026" format.
 */
function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Get the CSS styles for a status pill.
 */
function getStatusStyles(status: TransactionStatus): React.CSSProperties {
  switch (status) {
    case 'pending_review':
      return {
        background: '#FFF8F0',
        color: '#C77700',
      }
    case 'active':
      return {
        background: '#F0FAF4',
        color: '#1F8A4C',
      }
    case 'archived':
      return {
        background: '#F5F5F3',
        color: '#A0A0A0',
      }
    default:
      return {
        background: '#F5F5F3',
        color: '#A0A0A0',
      }
  }
}

/**
 * Get a human-readable status label.
 */
function getStatusLabel(status: TransactionStatus): string {
  switch (status) {
    case 'pending_review':
      return 'Pending'
    case 'active':
      return 'Active'
    case 'archived':
      return 'Archived'
    default:
      return status
  }
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

/**
 * Desktop sortable transaction table.
 *
 * Renders transactions in a grid layout with sortable headers.
 * Clicking a row fires onRowClick. Status pills are colour-coded.
 * Amounts use JetBrains Mono and are right-aligned.
 */
export function TransactionTable({
  transactions,
  entities,
  sortField,
  sortDirection,
  onSortChange,
  onRowClick,
  selectedId,
}: TransactionTableProps): JSX.Element {

  /**
   * Handle column header click — cycles sort field/direction.
   */
  const handleHeaderClick = useCallback(
    (column: ColumnDef) => {
      if (!column.sortable) return

      const field = column.key
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
   * Get the sort indicator arrow for a column.
   */
  const getSortIndicator = useCallback(
    (field: SortField): string | null => {
      if (field !== sortField) return null
      return sortDirection === 'asc' ? '\u2191' : '\u2193'
    },
    [sortField, sortDirection]
  )

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #E8E6E1',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* ================================================================== */}
      {/* Table Header */}
      {/* ================================================================== */}
      <div
        role="rowgroup"
        style={{
          display: 'grid',
          gridTemplateColumns: COLUMNS.map((c) => c.width).join(' '),
          background: '#FAFAF7',
          borderBottom: '1px solid #E8E6E1',
        }}
      >
        {COLUMNS.map((col, idx) => {
          const isSortable = col.sortable
          const isActive = col.key === sortField && isSortable
          const indicator = isSortable ? getSortIndicator(col.key) : null

          // Override labels for non-sortable columns
          const label = col.label || (idx === 3 ? 'Entity' : idx === 5 ? 'Status' : '')

          return (
            <div
              key={`${col.key}-${idx}`}
              role="columnheader"
              aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              onClick={() => handleHeaderClick(col)}
              style={{
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#6B6B6B',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontFamily: 'Inter, system-ui, sans-serif',
                cursor: isSortable ? 'pointer' : 'default',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: col.align,
                gap: '4px',
                transition: 'color 100ms ease',
              }}
              onMouseEnter={(e) => {
                if (isSortable) e.currentTarget.style.color = '#181818'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#6B6B6B'
              }}
            >
              {label}
              {indicator && (
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: '11px',
                    color: '#C14A0E',
                    fontWeight: 700,
                  }}
                >
                  {indicator}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* ================================================================== */}
      {/* Table Body */}
      {/* ================================================================== */}
      <div role="rowgroup">
        {transactions.map((tx) => {
          const entity = entities[tx.entity_id]
          const isSelected = selectedId === tx.id
          const amountColor = getAmountColor(tx.type)
          const statusStyles = getStatusStyles(tx.status)
          const hasFile = tx.file_id !== null

          return (
            <div
              key={tx.id}
              role="row"
              aria-selected={isSelected}
              onClick={() => onRowClick?.(tx.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: COLUMNS.map((c) => c.width).join(' '),
                alignItems: 'center',
                borderBottom: '1px solid #F0EFEA',
                cursor: onRowClick ? 'pointer' : 'default',
                background: isSelected ? '#FFF6EF' : 'white',
                transition: 'background 100ms ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = '#FAFAF7'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isSelected ? '#FFF6EF' : 'white'
              }}
            >
              {/* Date */}
              <div
                role="cell"
                style={{
                  padding: '12px 16px',
                  fontSize: '13px',
                  color: '#181818',
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                }}
              >
                {formatDate(tx.occurred_at)}
              </div>

              {/* Vendor */}
              <div
                role="cell"
                style={{
                  padding: '12px 16px',
                  fontSize: '13px',
                  color: '#181818',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {tx.vendor}
                {tx.subcategory && (
                  <span style={{ color: '#A0A0A0', fontWeight: 400, marginLeft: '6px' }}>
                    / {tx.subcategory}
                  </span>
                )}
              </div>

              {/* Category */}
              <div
                role="cell"
                style={{
                  padding: '12px 16px',
                  fontSize: '13px',
                  color: '#6B6B6B',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                <span
                  style={{
                    background: '#FAFAF7',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                >
                  {tx.category}
                </span>
              </div>

              {/* Entity */}
              <div
                role="cell"
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {entity && (
                  <>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: entity.color,
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: '13px',
                        color: '#6B6B6B',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      }}
                    >
                      {entity.name}
                    </span>
                  </>
                )}
                {!entity && (
                  <span
                    style={{
                      fontSize: '13px',
                      color: '#A0A0A0',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  >
                    Unknown
                  </span>
                )}
              </div>

              {/* Amount */}
              <div
                role="cell"
                style={{
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: amountColor,
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatAmount(tx.amount_minor, tx.currency)}
              </div>

              {/* Status */}
              <div
                role="cell"
                style={{
                  padding: '12px 16px',
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 12px',
                    borderRadius: '100px',
                    fontSize: '12px',
                    fontWeight: 600,
                    fontFamily: 'Inter, system-ui, sans-serif',
                    ...statusStyles,
                  }}
                >
                  {getStatusLabel(tx.status)}
                </span>
              </div>

              {/* File icon */}
              <div
                role="cell"
                style={{
                  padding: '12px 16px',
                  textAlign: 'center',
                }}
              >
                {hasFile ? (
                  <span
                    role="img"
                    aria-label="Has attached file"
                    title="Has attached file"
                    style={{
                      fontSize: '14px',
                      color: '#A0A0A0',
                      cursor: 'pointer',
                    }}
                  >
                    &#128206;
                  </span>
                ) : (
                  <span style={{ fontSize: '14px', color: '#E8E6E1' }}>&mdash;</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ================================================================== */}
      {/* Empty state (within table) */}
      {/* ================================================================== */}
      {transactions.length === 0 && (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: '#A0A0A0',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '14px',
          }}
        >
          No transactions match your filters.
        </div>
      )}
    </div>
  )
}

export default TransactionTable
