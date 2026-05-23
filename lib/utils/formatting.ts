/**
 * Currency and number formatting utilities.
 *
 * These are pure functions with no server-side dependencies.
 * Safe to import from both Server Components and Client Components.
 *
 * @module lib/utils/formatting
 */

// ---------------------------------------------------------------------------
// Minor-unit formatting
// ---------------------------------------------------------------------------

/**
 * Format an integer minor-unit amount as a human-readable decimal string.
 * e.g. 32680 → "326.80", 1250 → "12.50"
 *
 * @param minor - Amount in minor units (sen for MYR, cents for USD).
 * @returns Decimal string with exactly 2 fractional digits.
 */
export function fmtMinor(minor: number): string {
  const major = Math.floor(minor / 100);
  const frac = minor % 100;
  const fracStr = frac < 10 ? `0${frac}` : `${frac}`;
  return `${major}.${fracStr}`;
}

/**
 * Format a minor-unit amount as MYR currency string.
 * e.g. 32680 → "RM 326.80"
 *
 * @param minor - Amount in minor units (sen).
 * @returns Formatted MYR string.
 */
export function formatMYR(minor: number): string {
  return `RM ${fmtMinor(minor)}`;
}

/**
 * Format a minor-unit amount with currency symbol.
 * Supports MYR, USD, SGD, EUR, GBP.
 *
 * @param minor - Amount in minor units.
 * @param currency - ISO 4217 currency code.
 * @returns Formatted amount with symbol.
 */
export function formatAmount(minor: number, currency: string): string {
  const symbols: Record<string, string> = {
    MYR: 'RM',
    USD: '$',
    SGD: 'S$',
    EUR: '€',
    GBP: '£',
  };
  const symbol = symbols[currency] ?? currency;
  return `${symbol} ${fmtMinor(minor)}`;
}
