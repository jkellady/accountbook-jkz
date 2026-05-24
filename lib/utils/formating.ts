/**
 * Currency and number formatting utilities.
 * Safe to import from both Server and Client Components.
 */

export function fmtMinor(minor: number): string {
  const major = Math.floor(minor / 100);
  const frac = minor % 100;
  const fracStr = frac < 10 ? `0${frac}` : `${frac}`;
  return `${major}.${fracStr}`;
}

export function formatMYR(minor: number): string {
  return `RM ${fmtMinor(minor)}`;
}

export function formatAmount(minor: number, currency: string): string {
  const symbols: Record<string, string> = {
    MYR: 'RM', USD: '$', SGD: 'S$', EUR: '€', GBP: '£',
  };
  const symbol = symbols[currency] ?? currency;
  return `${symbol} ${fmtMinor(minor)}`;
}