/**
 * BankReconciliation.tsx
 * JK Zentra Finance Cockpit — Sprint 1
 *
 * Bank reconciliation section:
 *  - Opening balance input (minor units, formatted as RM)
 *  - Closing balance input (minor units, formatted as RM)
 *  - Computed expected: opening + income - expenses (auto-calculated)
 *  - Variance: closing - computed (auto-calculated)
 *  - Color: green if variance = 0, amber if |variance| < 500, red if >= 500
 *  - Variance explanation textarea (required if variance != 0)
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { formatRM, getVarianceColor } from '@/lib/actions/monthEnd'

// ---------------------------------------------------------------------------
// Design system tokens
// ---------------------------------------------------------------------------

const BG_OFF_WHITE = '#FAFAF7'
const CARD_BG = '#FFFFFF'
const CARD_BORDER = '#E8E6E1'
const INPUT_BORDER = '#D0CBC4'
const INPUT_BORDER_FOCUS = '#F37002'
const COLOR_TEXT_PRIMARY = '#181818'
const COLOR_TEXT_SECONDARY = '#6B6B6B'
const COLOR_LABEL = '#4A4A4A'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BankReconciliationProps {
  /** Opening bank balance in minor units (sen). */
  openingBalanceMinor: number | null
  /** Closing bank balance in minor units (sen). */
  closingBalanceMinor: number | null
  /** Total income in minor units for the month (pre-calculated). */
  totalIncomeMinor: number
  /** Total expenses in minor units for the month (pre-calculated). */
  totalExpensesMinor: number
  /** Current variance explanation text. */
  reconciliationNote: string
  /** Called when opening balance changes. */
  onOpeningBalanceChange: (minor: number | null) => void
  /** Called when closing balance changes. */
  onClosingBalanceChange: (minor: number | null) => void
  /** Called when reconciliation note changes. */
  onReconciliationNoteChange: (note: string) => void
  /** Whether the month is already closed (read-only mode). */
  isClosed: boolean
}

// ---------------------------------------------------------------------------
// Currency input sub-component
// ---------------------------------------------------------------------------

interface CurrencyInputProps {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
  placeholder?: string
  testId?: string
}

function CurrencyInput({
  label,
  value,
  onChange,
  disabled = false,
  placeholder = '0.00',
  testId,
}: CurrencyInputProps): React.ReactElement {
  const [rawValue, setRawValue] = useState(() =>
    value != null ? (value / 100).toFixed(2) : ''
  )

  // Sync when value prop changes externally
  useEffect(() => {
    setRawValue(value != null ? (value / 100).toFixed(2) : '')
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const raw = e.target.value
      // Allow only digits and one decimal point
      const cleaned = raw.replace(/[^0-9.]/g, '')
      const parts = cleaned.split('.')
      const normalised = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned

      setRawValue(normalised)

      // Convert to minor units
      if (normalised === '' || normalised === '.') {
        onChange(null)
        return
      }

      const floatVal = parseFloat(normalised)
      if (!Number.isNaN(floatVal)) {
        onChange(Math.round(floatVal * 100))
      }
    },
    [onChange]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: COLOR_LABEL,
          lineHeight: '18px',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '14px',
            color: COLOR_TEXT_SECONDARY,
            fontWeight: 500,
            pointerEvents: 'none',
          }}
        >
          RM
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={rawValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          data-testid={testId}
          style={{
            width: '100%',
            padding: '10px 12px 10px 40px',
            fontSize: '14px',
            fontFamily: 'inherit',
            color: COLOR_TEXT_PRIMARY,
            background: disabled ? '#F0EFEC' : CARD_BG,
            border: `1px solid ${INPUT_BORDER}`,
            borderRadius: '6px',
            outline: 'none',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => {
            if (!disabled) {
              e.currentTarget.style.borderColor = INPUT_BORDER_FOCUS
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(243, 112, 2, 0.12)'
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = INPUT_BORDER
            e.currentTarget.style.boxShadow = 'none'
            // Reformat to 2 decimal places on blur
            const floatVal = parseFloat(rawValue)
            if (!Number.isNaN(floatVal)) {
              setRawValue(floatVal.toFixed(2))
            }
          }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Read-only summary row
// ---------------------------------------------------------------------------

interface SummaryRowProps {
  label: string
  value: string
  valueColor?: string
  isBold?: boolean
}

function SummaryRow({ label, value, valueColor, isBold = false }: SummaryRowProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: `1px solid ${CARD_BORDER}`,
      }}
    >
      <span
        style={{
          fontSize: '14px',
          color: COLOR_TEXT_SECONDARY,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '14px',
          fontWeight: isBold ? 700 : 500,
          color: valueColor ?? COLOR_TEXT_PRIMARY,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

/**
 * Bank reconciliation panel.
 *
 * Accepts opening/closing balances, computes the expected closing from
 * transactions, and shows the variance with colour-coded severity.
 *
 * @param openingBalanceMinor        — opening balance in sen
 * @param closingBalanceMinor        — closing balance in sen
 * @param totalIncomeMinor           — total income for the month in sen
 * @param totalExpensesMinor         — total expenses for the month in sen
 * @param reconciliationNote         — current note value
 * @param onOpeningBalanceChange     — callback for opening balance changes
 * @param onClosingBalanceChange     — callback for closing balance changes
 * @param onReconciliationNoteChange — callback for note changes
 * @param isClosed                   — whether month is closed (read-only)
 */
export function BankReconciliation({
  openingBalanceMinor,
  closingBalanceMinor,
  totalIncomeMinor,
  totalExpensesMinor,
  reconciliationNote,
  onOpeningBalanceChange,
  onClosingBalanceChange,
  onReconciliationNoteChange,
  isClosed,
}: BankReconciliationProps): React.ReactElement {
  const opening = openingBalanceMinor ?? 0
  const closing = closingBalanceMinor ?? 0
  const computed = opening + totalIncomeMinor - totalExpensesMinor
  const variance = closingBalanceMinor != null ? closing - computed : null
  const varianceColor = getVarianceColor(variance)
  const needsExplanation = variance != null && variance !== 0

  return (
    <section
      style={{
        background: BG_OFF_WHITE,
        borderRadius: '12px',
        padding: '24px',
      }}
    >
      <h2
        style={{
          fontSize: '18px',
          fontWeight: 700,
          color: COLOR_TEXT_PRIMARY,
          margin: '0 0 20px 0',
          lineHeight: '24px',
        }}
      >
        Bank Reconciliation
      </h2>

      {/* Input fields */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <CurrencyInput
          label="Opening Balance"
          value={openingBalanceMinor}
          onChange={onOpeningBalanceChange}
          disabled={isClosed}
          placeholder="0.00"
          testId="opening-balance-input"
        />
        <CurrencyInput
          label="Closing Balance"
          value={closingBalanceMinor}
          onChange={onClosingBalanceChange}
          disabled={isClosed}
          placeholder="0.00"
          testId="closing-balance-input"
        />
      </div>

      {/* Computed summary */}
      <div
        style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
        }}
      >
        <SummaryRow label="Opening Balance" value={formatRM(opening)} />
        <SummaryRow label={'+ Income'} value={formatRM(totalIncomeMinor)} valueColor="#1F8A4C" />
        <SummaryRow label={'- Expenses'} value={formatRM(totalExpensesMinor)} valueColor="#B43A2D" />
        <SummaryRow
          label="Computed Closing"
          value={formatRM(computed)}
          isBold
          valueColor={COLOR_TEXT_PRIMARY}
        />
      </div>

      {/* Variance display */}
      <div
        style={{
          background: CARD_BG,
          border: `2px solid ${varianceColor}`,
          borderRadius: '8px',
          padding: '14px 16px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: varianceColor,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.5px',
              marginBottom: '4px',
            }}
          >
            {variance == null
              ? 'Enter closing balance'
              : variance === 0
                ? 'Reconciled'
                : 'Variance'}
          </div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: varianceColor,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {variance != null ? formatRM(Math.abs(variance)) : '—'}
          </div>
        </div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#FFFFFF',
            background: varianceColor,
            padding: '6px 14px',
            borderRadius: '12px',
          }}
        >
          {variance == null
            ? 'Pending'
            : variance === 0
              ? 'Balanced'
              : Math.abs(variance) < 500
                ? 'Small Variance'
                : 'Large Variance'}
        </div>
      </div>

      {/* Variance explanation (required if variance != 0) */}
      {needsExplanation && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: COLOR_LABEL,
              lineHeight: '18px',
            }}
          >
            Variance Explanation
            <span style={{ color: '#B43A2D', marginLeft: '4px' }}>*</span>
          </label>
          <textarea
            value={reconciliationNote}
            onChange={(e) => onReconciliationNoteChange(e.target.value)}
            disabled={isClosed}
            placeholder="Explain the variance (e.g. bank fees, timing differences, missing transactions...)"
            rows={3}
            data-testid="variance-note-input"
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              fontFamily: 'inherit',
              color: COLOR_TEXT_PRIMARY,
              background: isClosed ? '#F0EFEC' : CARD_BG,
              border: `1px solid ${INPUT_BORDER}`,
              borderRadius: '6px',
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              if (!isClosed) {
                e.currentTarget.style.borderColor = INPUT_BORDER_FOCUS
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(243, 112, 2, 0.12)'
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = INPUT_BORDER
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          {reconciliationNote.trim().length === 0 && (
            <span style={{ fontSize: '12px', color: '#B43A2D' }}>
              Required — explain why the variance exists
            </span>
          )}
        </div>
      )}
    </section>
  )
}
