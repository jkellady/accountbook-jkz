/**
 * CurrencyInput — Amount input with integrated currency selector
 *
 * Displays a number input paired with a currency dropdown. Stores values
 * in minor units (sen/cents) internally. On focus, shows the raw integer
 * (e.g. 1250). On blur, formats as a human-readable currency string
 * (e.g. "RM 12.50"). Default currency is MYR with USD as secondary.
 *
 * @example
 * <CurrencyInput
 *   amountMinor={1250}
 *   currency="MYR"
 *   onChange={({ amountMinor, currency }) => {
 *     setValue('amount_minor', amountMinor)
 *     setValue('currency', currency)
 *   }}
 *   error="Amount is required"
 * />
 */

"use client"


import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  CURRENCY_SYMBOLS,
  formatMinor,
  fromMinorUnits,
  toMinorUnits,
  SUPPORTED_CURRENCIES,
} from '@/lib/validation/transaction'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** Currency code — one of the five supported currencies. */
type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

interface CurrencyInputProps {
  /** Amount in minor units (e.g. 1250 = RM 12.50). */
  readonly amountMinor: number | null
  /** Selected currency code. */
  readonly currency: CurrencyCode
  /** Called when amount or currency changes. */
  readonly onChange: (payload: { amountMinor: number; currency: CurrencyCode }) => void
  /** Optional label text — defaults to "Amount". */
  readonly label?: string
  /** Validation error message. */
  readonly error?: string
  /** Disable interaction. */
  readonly disabled?: boolean
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Parses a raw string input into minor units.
 * Handles:
 *   - Empty string → null
 *   - "12.50" → 1250
 *   - "12" → 1200
 *   - "1250" (already in minor) → 1250 (when < 1000, treats as major)
 *
 * Returns null if the input is not a valid number.
 */
function parseInputToMinor(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Try parsing as a decimal major amount first
  const asDecimal = Number.parseFloat(trimmed)
  if (Number.isNaN(asDecimal)) return null

  // If the number has a decimal point, treat as major units
  if (trimmed.includes('.')) {
    return toMinorUnits(asDecimal)
  }

  // No decimal point — small numbers (< 1000) are treated as major units
  // to avoid user confusion. Large numbers (≥ 1000) are treated as minor.
  if (asDecimal < 1000) {
    return toMinorUnits(asDecimal)
  }

  // Already in minor units
  return asDecimal
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function CurrencyInput({
  amountMinor,
  currency,
  onChange,
  label = 'Amount',
  error,
  disabled = false,
}: CurrencyInputProps): React.JSX.Element {
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Determine the display value for the input
  const displayValue: string = React.useMemo(() => {
    if (amountMinor === null || amountMinor === undefined) return ''

    if (isFocused) {
      // Show raw minor units as integer while editing
      return String(amountMinor)
    }

    // Show formatted on blur — but the input itself stays a number type,
    // so we show the major-unit decimal for easier editing
    const major = fromMinorUnits(amountMinor)
    return major.toFixed(2)
  }, [amountMinor, isFocused])

  // Keep track of the raw input value while focused for smooth editing
  const [rawValue, setRawValue] = useState(displayValue)

  // Sync rawValue when displayValue changes externally
  useEffect(() => {
    if (!isFocused) {
      setRawValue(displayValue)
    }
  }, [displayValue, isFocused])

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    // Switch to showing raw minor units for precise editing
    if (amountMinor !== null && amountMinor !== undefined) {
      setRawValue(String(amountMinor))
    }
  }, [amountMinor])

  const handleBlur = useCallback(() => {
    setIsFocused(false)

    // Parse the raw input and commit the minor-unit value
    const parsed = parseInputToMinor(rawValue)
    if (parsed !== null && parsed >= 0) {
      onChange({ amountMinor: parsed, currency })
      setRawValue((fromMinorUnits(parsed)).toFixed(2))
    } else if (rawValue.trim() === '') {
      // Allow empty — let validation catch it
      // Keep the raw empty string
    }
  }, [rawValue, currency, onChange])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setRawValue(val)

      // Attempt to parse immediately for real-time feedback
      const parsed = parseInputToMinor(val)
      if (parsed !== null && parsed >= 0) {
        onChange({ amountMinor: parsed, currency })
      }
    },
    [currency, onChange],
  )

  const handleCurrencyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newCurrency = e.target.value as CurrencyCode
      if (amountMinor !== null && amountMinor !== undefined) {
        onChange({ amountMinor, currency: newCurrency })
      } else {
        onChange({ amountMinor: 0, currency: newCurrency })
      }
    },
    [amountMinor, onChange],
  )

  // --------------------------------------------------------------------------
  // Derived display
  // --------------------------------------------------------------------------

  const formattedPreview =
    amountMinor !== null && amountMinor !== undefined && amountMinor > 0 && !isFocused
      ? formatMinor(amountMinor, currency)
      : null

  return (
    <div className="currency-input">
      <label
        style={{
          display: 'block',
          fontSize: '13px',
          fontWeight: 500,
          color: '#6B6B6B',
          marginBottom: '8px',
        }}
      >
        {label}
      </label>

      <div
        style={{
          display: 'flex',
          gap: '0',
          height: '44px',
          borderRadius: '8px',
          border: error ? '1px solid #E53E3E' : '1px solid #E5E5E5',
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          transition: 'border-color 0.15s ease',
        }}
      >
        {/* Currency selector */}
        <select
          value={currency}
          onChange={handleCurrencyChange}
          disabled={disabled}
          aria-label="Currency"
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            border: 'none',
            borderRight: '1px solid #E5E5E5',
            backgroundColor: '#FAFAF7',
            padding: '0 12px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#181818',
            cursor: disabled ? 'not-allowed' : 'pointer',
            outline: 'none',
            minWidth: '70px',
          }}
        >
          {SUPPORTED_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>

        {/* Amount input */}
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={rawValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={isFocused ? 'e.g. 1250' : '0.00'}
          aria-invalid={!!error}
          aria-describedby={error ? 'amount-error' : undefined}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            padding: '0 12px',
            fontSize: '15px',
            color: '#181818',
            backgroundColor: 'transparent',
            minWidth: 0,
          }}
        />
      </div>

      {/* Formatted preview below input */}
      {formattedPreview && (
        <span
          style={{
            display: 'block',
            fontSize: '12px',
            color: '#6B6B6B',
            marginTop: '4px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formattedPreview}
          {isFocused ? ' (editing minor units)' : ' (minor units stored)'}
        </span>
      )}

      {isFocused && amountMinor !== null && amountMinor > 0 && (
        <span
          style={{
            display: 'block',
            fontSize: '11px',
            color: '#6B6B6B',
            marginTop: '2px',
          }}
        >
          Raw minor units: {amountMinor}
        </span>
      )}

      {error && (
        <span
          id="amount-error"
          role="alert"
          style={{
            display: 'block',
            fontSize: '12px',
            color: '#E53E3E',
            marginTop: '6px',
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}
