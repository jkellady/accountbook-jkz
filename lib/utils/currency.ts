/**
 * ============================================================================
 * JK Zentra Finance Cockpit — Currency Formatting Utilities
 * ============================================================================
 *
 * All monetary amounts in the database are stored as INTEGER minor units
 * (sen / cents). These utilities convert between display strings and minor units.
 *
 * NEVER use floating-point arithmetic for money.
 */

// ----------------------------------------------------------------------------
// Supported currency codes
// ----------------------------------------------------------------------------

export type CurrencyCode = 'MYR' | 'USD' | 'SGD' | 'EUR' | 'GBP'

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  MYR: 'RM',
  USD: '$',
  SGD: 'S$',
  EUR: '\u20AC',
  GBP: '\u00A3',
}

const CURRENCY_DECIMALS: Record<CurrencyCode, number> = {
  MYR: 2,
  USD: 2,
  SGD: 2,
  EUR: 2,
  GBP: 2,
}

// ----------------------------------------------------------------------------
// Type guards
// ----------------------------------------------------------------------------

/**
 * Check if a string is a supported currency code.
 */
export function isCurrencyCode(value: string): value is CurrencyCode {
  return value in CURRENCY_SYMBOLS
}

// ----------------------------------------------------------------------------
// Format minor units → display string
// ----------------------------------------------------------------------------

/**
 * Convert minor units (sen / cents) to a human-readable display string.
 *
 * @param minor - Amount in minor units (e.g. 1250 for RM 12.50)
 * @param currency - Currency code (MYR, USD, SGD, EUR, GBP)
 * @returns Formatted string (e.g. "RM 12.50" or "$ 20.00")
 *
 * @example
 * formatAmount(1250, 'MYR') // "RM 12.50"
 * formatAmount(2000, 'USD') // "$ 20.00"
 * formatAmount(0, 'SGD')    // "S$ 0.00"
 * formatAmount(-500, 'MYR') // "-RM 5.00"
 */
export function formatAmount(minor: number, currency: CurrencyCode | string): string {
  const code = isCurrencyCode(currency) ? currency : 'MYR'
  const symbol = CURRENCY_SYMBOLS[code]
  const decimals = CURRENCY_DECIMALS[code]
  const major = minor / Math.pow(10, decimals)
  const formatted = major.toLocaleString('en-MY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${symbol} ${formatted}`
}

/**
 * Convert minor units to a compact display string (no space after symbol).
 *
 * @param minor - Amount in minor units
 * @param currency - Currency code
 * @returns Compact formatted string (e.g. "RM12.50")
 */
export function formatAmountCompact(minor: number, currency: CurrencyCode | string): string {
  const code = isCurrencyCode(currency) ? currency : 'MYR'
  const symbol = CURRENCY_SYMBOLS[code]
  const decimals = CURRENCY_DECIMALS[code]
  const major = minor / Math.pow(10, decimals)
  const formatted = major.toLocaleString('en-MY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${symbol}${formatted}`
}

// ----------------------------------------------------------------------------
// Parse display string → minor units
// ----------------------------------------------------------------------------

/**
 * Parse a user-entered display string into minor units (sen / cents).
 *
 * Handles comma separators, optional currency symbols, and decimal points.
 *
 * @param display - User input (e.g. "12.50", "1,250.00", "RM 12.50")
 * @param currency - Currency code for determining decimal places
 * @returns Amount in minor units (e.g. 1250)
 *
 * @example
 * parseAmount("12.50", "MYR")   // 1250
 * parseAmount("1,250", "USD")   // 125000
 * parseAmount("RM 12.50", "MYR") // 1250
 * parseAmount("", "MYR")        // 0
 */
export function parseAmount(display: string, currency: CurrencyCode | string): number {
  if (!display || display.trim() === '') return 0

  const code = isCurrencyCode(currency) ? currency : 'MYR'
  const decimals = CURRENCY_DECIMALS[code]
  const multiplier = Math.pow(10, decimals)

  // Strip currency symbol and whitespace
  let cleaned = display.trim()
  const symbol = CURRENCY_SYMBOLS[code]
  if (symbol && cleaned.startsWith(symbol)) {
    cleaned = cleaned.slice(symbol.length).trim()
  }

  // Also strip generic $ and other symbols that might be present
  cleaned = cleaned.replace(/[^\d.-]/g, '')

  const parsed = parseFloat(cleaned)
  if (isNaN(parsed)) return 0

  return Math.round(parsed * multiplier)
}

// ----------------------------------------------------------------------------
// Currency symbol lookup
// ----------------------------------------------------------------------------

/**
 * Get the display symbol for a currency code.
 *
 * @param currency - Currency code
 * @returns Symbol string (e.g. 'RM', '$', 'S$')
 *
 * @example
 * getCurrencySymbol('MYR') // 'RM'
 * getCurrencySymbol('USD') // '$'
 * getCurrencySymbol('SGD') // 'S$'
 * getCurrencySymbol('EUR') // '\u20AC'
 * getCurrencySymbol('GBP') // '\u00A3'
 */
export function getCurrencySymbol(currency: CurrencyCode | string): string {
  const code = isCurrencyCode(currency) ? currency : 'MYR'
  return CURRENCY_SYMBOLS[code]
}

// ----------------------------------------------------------------------------
// Strip currency symbols for input fields
// ----------------------------------------------------------------------------

/**
 * Strip currency symbols and formatting from a display string,
 * leaving only the numeric portion suitable for an input field.
 *
 * @param display - Formatted amount string (e.g. "RM 12.50", "$1,250.00")
 * @returns Clean numeric string (e.g. "12.50", "1250.00")
 *
 * @example
 * stripCurrency("RM 12.50")  // "12.50"
 * stripCurrency("$1,250.00")  // "1250.00"
 * stripCurrency("S$ 0.00")   // "0.00"
 * stripCurrency("")          // ""
 */
export function stripCurrency(display: string): string {
  if (!display) return ''

  // Remove all currency symbols
  let cleaned = display
    .replace(/RM\s*/g, '')
    .replace(/S\$/g, '')
    .replace(/[$\u20AC\u00A3]/g, '')
    .trim()

  // Remove comma thousand separators
  cleaned = cleaned.replace(/,/g, '')

  return cleaned
}

// ----------------------------------------------------------------------------
// Colour helpers for income / expense amounts
// ----------------------------------------------------------------------------

/**
 * Get the CSS colour for an amount based on transaction type.
 * Income is green, everything else (expense, tax) is dark.
 *
 * @param type - Transaction type
 * @returns Hex colour string
 */
export function getAmountColor(type: string): string {
  if (type === 'income') return '#1F8A4C'
  return '#181818'
}
