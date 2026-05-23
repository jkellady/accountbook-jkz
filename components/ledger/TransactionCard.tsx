/**
 * ============================================================================
 * TransactionCard — Mobile Transaction Card
 * ============================================================================
 *
 * Clean white card with 1px border, 12px radius. Displays a transaction
 * in a mobile-friendly layout. Tap to expand and show full details.
 *
 * Layout:
 *   Top row:    Vendor (left) + Amount (right, green for income)
 *   Middle row: Date + Category
 *   Bottom row: Entity badge + Status pill + File icon (if file_id)
 *
 * @example
 * <TransactionCard
 *   transaction={tx}
 *   entity={{ name: 'JK Zentra', slug: 'jk-zentra', color: '#F37002' }}
 *   onClick={() => openDetail(tx.id)}
 * />
 */

'use client'

import React, { useState, useCallback } from 'react'
import { formatAmount, getAmountColor } from '@/lib/utils/currency'
import type { TransactionRow, TransactionType, TransactionStatus } from '@/lib/supabase/database.types'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** Simplified entity info needed for display. */
interface EntityInfo {
  name: string
  slug: string
  color: string
}

/** Props for the TransactionCard component. */
interface TransactionCardProps {
  /** The transaction to display. */
  transaction: TransactionRow
  /** The associated entity info (name, color). */
  entity: EntityInfo
  /** Called when the card is tapped (non-expanding areas). */
  onClick?: (transactionId: string) => void
}

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

/**
 * Get a human-readable type label.
 */
function getTypeLabel(type: TransactionType): string {
  switch (type) {
    case 'income':
      return 'Income'
    case 'expense':
      return 'Expense'
    case 'tax_prepayment':
      return 'Tax Prepayment'
    case 'tax_payment_final':
      return 'Tax Final'
    case 'tax_reserve_transfer':
      return 'Tax Reserve'
    default:
      return type
  }
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

/**
 * A single transaction card for mobile layouts.
 *
 * Tap to expand/collapse full details. Shows vendor, amount, date,
 * category, entity badge, status pill, and file attachment indicator.
 */
export function TransactionCard({
  transaction,
  entity,
  onClick,
}: TransactionCardProps): JSX.Element {

  const [expanded, setExpanded] = useState(false)

  /**
   * Toggle expanded detail view.
   */
  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  /**
   * Handle card tap — toggle expansion.
   * If onClick provided, also notify parent.
   */
  const handleCardClick = useCallback(() => {
    handleToggleExpand()
    onClick?.(transaction.id)
  }, [handleToggleExpand, onClick, transaction.id])

  const statusStyles = getStatusStyles(transaction.status)
  const amountColor = getAmountColor(transaction.type)
  const hasFile = transaction.file_id !== null
  const hasTags = transaction.tags && transaction.tags.length > 0
  const hasDescription = transaction.description && transaction.description.trim().length > 0
  const hasNotes = transaction.notes && transaction.notes.trim().length > 0

  return (
    <div
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCardClick()
        }
      }}
      style={{
        background: 'white',
        border: '1px solid #E8E6E1',
        borderRadius: '12px',
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'box-shadow 150ms ease, border-color 150ms ease',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'
        e.currentTarget.style.borderColor = '#D4D0C9'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = '#E8E6E1'
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(243,112,2,0.2)'
        e.currentTarget.style.borderColor = '#F37002'
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = '#E8E6E1'
      }}
    >
      {/* ================================================================== */}
      {/* Top row: Vendor + Amount */}
      {/* ================================================================== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '8px',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#181818',
              fontFamily: 'Inter, system-ui, sans-serif',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {transaction.vendor}
          </div>
          {transaction.subcategory && (
            <div
              style={{
                fontSize: '12px',
                color: '#A0A0A0',
                marginTop: '2px',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              {transaction.subcategory}
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: amountColor,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {formatAmount(transaction.amount_minor, transaction.currency)}
        </div>
      </div>

      {/* ================================================================== */}
      {/* Middle row: Date + Category */}
      {/* ================================================================== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            color: '#6B6B6B',
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          }}
        >
          {formatDate(transaction.occurred_at)}
        </span>
        <span
          style={{
            fontSize: '12px',
            color: '#6B6B6B',
            fontFamily: 'Inter, system-ui, sans-serif',
            background: '#FAFAF7',
            padding: '2px 8px',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          {transaction.category}
        </span>
      </div>

      {/* ================================================================== */}
      {/* Bottom row: Entity badge + Status pill + File icon */}
      {/* ================================================================== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        {/* Entity dot + name */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#6B6B6B',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
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
          {entity.name}
        </span>

        {/* Status pill */}
        <span
          style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: '100px',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'Inter, system-ui, sans-serif',
            ...statusStyles,
          }}
        >
          {getStatusLabel(transaction.status)}
        </span>

        {/* Type label */}
        <span
          style={{
            fontSize: '11px',
            color: '#A0A0A0',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {getTypeLabel(transaction.type)}
        </span>

        {/* File attachment icon */}
        {hasFile && (
          <span
            aria-label="Has attached file"
            title="Has attached file"
            style={{
              marginLeft: 'auto',
              fontSize: '14px',
              color: '#A0A0A0',
            }}
          >
            &#128206;
          </span>
        )}
      </div>

      {/* ================================================================== */}
      {/* Expanded detail section */}
      {/* ================================================================== */}
      {expanded && (
        <div
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #E8E6E1',
            animation: 'fadeIn 200ms ease',
          }}
        >
          {/* Description */}
          {hasDescription && (
            <div style={{ marginBottom: '8px' }}>
              <div
                style={{
                  fontSize: '11px',
                  color: '#A0A0A0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '2px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: 500,
                }}
              >
                Description
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: '#181818',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  lineHeight: 1.5,
                }}
              >
                {transaction.description}
              </div>
            </div>
          )}

          {/* Notes */}
          {hasNotes && (
            <div style={{ marginBottom: '8px' }}>
              <div
                style={{
                  fontSize: '11px',
                  color: '#A0A0A0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '2px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: 500,
                }}
              >
                Notes
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: '#6B6B6B',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                }}
              >
                {transaction.notes}
              </div>
            </div>
          )}

          {/* Reference code */}
          {transaction.reference_code && (
            <div style={{ marginBottom: '8px' }}>
              <div
                style={{
                  fontSize: '11px',
                  color: '#A0A0A0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '2px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: 500,
                }}
              >
                Reference
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: '#181818',
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                }}
              >
                {transaction.reference_code}
              </div>
            </div>
          )}

          {/* Tags */}
          {hasTags && (
            <div style={{ marginBottom: '4px' }}>
              <div
                style={{
                  fontSize: '11px',
                  color: '#A0A0A0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '6px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: 500,
                }}
              >
                Tags
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {transaction.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      background: '#FAFAF7',
                      border: '1px solid #E8E6E1',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#6B6B6B',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Linked file indicator */}
          {hasFile && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '8px',
                padding: '8px 12px',
                background: '#FAFAF7',
                borderRadius: '8px',
              }}
            >
              <span style={{ fontSize: '16px' }}>&#128206;</span>
              <span
                style={{
                  fontSize: '13px',
                  color: '#F37002',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: 500,
                }}
              >
                Receipt attached
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TransactionCard
