/**
 * Subscription Utility Functions — Stack Radar
 * JK Zentra Finance Cockpit
 *
 * Pure helper functions for calculating monthly burn, urgency levels,
 * annual commitment, and filtering subscriptions for the Stack Radar view.
 *
 * All functions are pure — no side effects, no external dependencies.
 */

import type { SubscriptionRow, BillingCycle, SubscriptionStatus } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Urgency level derived from days until renewal and subscription status. */
export type UrgencyLevel = 'critical' | 'warning' | 'normal' | 'distant' | 'trial' | 'expired';

/** Complete urgency metadata returned by getUrgencyLevel. */
export interface UrgencyMeta {
  /** The urgency tier — drives visual styling and sort order. */
  level: UrgencyLevel;
  /** CSS-friendly colour identifier — maps to border/text colours in the UI. */
  color: string;
  /** Numeric priority — lower = more urgent. Used for default sort ordering. */
  priority: number;
}

/** Categories that qualify a subscription for the Stack Radar tool inventory. */
export const STACK_RADAR_CATEGORIES: readonly string[] = [
  'AI & Software',
  'SaaS Subscriptions',
  'Software Licenses',
  'Cloud/Hosting',
  'Domains',
];

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format a minor-unit amount (sen/cents) as a human-readable currency string.
 * Uses MYR (Malaysian Ringgit) with 2 decimal places.
 *
 * @param minor — amount in minor units (e.g. 12900 for RM 129.00)
 * @returns formatted string, e.g. "RM 129.00"
 */
export function formatAmount(minor: number): string {
  const major = minor / 100;
  return `RM ${major.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Core calculations
// ---------------------------------------------------------------------------

/**
 * Calculate the monthly burn for a single subscription.
 *
 * | Billing cycle | Calculation         |
 * |---------------|---------------------|
 * | monthly       | full amount         |
 * | yearly        | amount / 12         |
 * | quarterly     | amount / 3          |
 * | trial         | 0 (no burn)         |
 * | one_time      | 0 (no burn)         |
 *
 * @param amountMinor — cost in minor currency units (sen/cents)
 * @param billingCycle — one of 'monthly' | 'yearly' | 'quarterly' | 'trial' | 'one_time'
 * @returns monthly burn in minor units (may be fractional — returns number for aggregation)
 *
 * @example
 * calculateMonthlyBurn(120000, 'yearly')  // => 10000  (RM 1200/yr = RM 100/mo)
 * calculateMonthlyBurn(2900, 'monthly')   // => 2900   (RM 29/mo)
 * calculateMonthlyBurn(0, 'trial')        // => 0
 */
export function calculateMonthlyBurn(amountMinor: number, billingCycle: BillingCycle): number {
  switch (billingCycle) {
    case 'monthly':
      return amountMinor;
    case 'yearly':
      return Math.round(amountMinor / 12);
    case 'quarterly':
      return Math.round(amountMinor / 3);
    case 'trial':
    case 'one_time':
      return 0;
    default:
      // Exhaustive fallback — if an unknown cycle slips through, treat as no burn
      return 0;
  }
}

/**
 * Calculate the number of days until the next payment date.
 *
 * Returns negative values for overdue renewals (e.g. -3 means "overdue by 3 days").
 * Returns positive values for upcoming renewals (e.g. 12 means "12 days until").
 *
 * @param nextPaymentAt — ISO-8601 date string (e.g. '2026-07-15') or null
 * @returns days until renewal; positive = future, negative = overdue, 0 = today
 */
export function getDaysUntilRenewal(nextPaymentAt: string | null): number {
  if (!nextPaymentAt) {
    return Number.POSITIVE_INFINITY;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const renewalDate = new Date(nextPaymentAt);
  renewalDate.setHours(0, 0, 0, 0);

  const diffMs = renewalDate.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

// ---------------------------------------------------------------------------
// Urgency scoring
// ---------------------------------------------------------------------------

/**
 * Derive the urgency level, colour, and sort priority from renewal date + status.
 *
 * Priority order (lower number = more urgent, appears first):
 * | Priority | Level    | Condition                          |
 * |----------|----------|------------------------------------|
 * | 0        | trial    | status === 'trial'                 |
 * | 1        | critical | < 7 days OR overdue                |
 * | 2        | warning  | 7–14 days                          |
 * | 3        | normal   | 15–30 days                         |
 * | 4        | distant  | 30+ days                           |
 * | 5        | expired  | status === 'expired'/'cancelled'   |
 *
 * @param nextPaymentAt — ISO-8601 date string or null
 * @param status — subscription status (e.g. 'active', 'trial', 'cancelled')
 * @returns UrgencyMeta with level, colour key, and numeric priority
 */
export function getUrgencyLevel(
  nextPaymentAt: string | null,
  status: SubscriptionStatus,
): UrgencyMeta {
  // Trial is always top priority regardless of days
  if (status === 'trial') {
    return { level: 'trial', color: 'blue', priority: 0 };
  }

  // Cancelled or expired subscriptions are lowest priority
  if (status === 'cancelled' || status === 'expired') {
    return { level: 'expired', color: 'grey', priority: 5 };
  }

  const days = getDaysUntilRenewal(nextPaymentAt);

  // No payment date — treat as distant (no urgency data)
  if (days === Number.POSITIVE_INFINITY) {
    return { level: 'distant', color: 'neutral', priority: 4 };
  }

  // Overdue or < 7 days = critical
  if (days < 7) {
    return { level: 'critical', color: 'red', priority: 1 };
  }

  // 7–14 days = warning
  if (days <= 14) {
    return { level: 'warning', color: 'amber', priority: 2 };
  }

  // 15–30 days = normal
  if (days <= 30) {
    return { level: 'normal', color: 'neutral', priority: 3 };
  }

  // 30+ days = distant
  return { level: 'distant', color: 'neutral', priority: 4 };
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/**
 * Filter subscriptions for display on the Stack Radar.
 *
 * A subscription qualifies if:
 * 1. `is_stack_radar` is true (flagged for radar inclusion)
 * 2. `status` is NOT 'archived' (archived = soft-deleted, never shown)
 * 3. `category` matches one of the tech/SaaS categories
 *
 * @param subs — raw array of SubscriptionRow from the database
 * @returns filtered array eligible for Stack Radar display
 */
export function filterForStackRadar(subs: SubscriptionRow[]): SubscriptionRow[] {
  return subs.filter((sub) => {
    // Must be flagged for Stack Radar
    if (!sub.is_stack_radar) {
      return false;
    }

    // Exclude archived (soft-deleted) subscriptions
    if (sub.status === 'archived') {
      return false;
    }

    // Must be in a relevant tech/SaaS category
    if (!STACK_RADAR_CATEGORIES.includes(sub.category)) {
      return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/**
 * Calculate total annual commitment across a set of subscriptions.
 *
 * For each subscription, annualises the amount:
 * | Cycle     | Annual amount        |
 * |-----------|----------------------|
 * | monthly   | amount * 12          |
 * | quarterly | amount * 4           |
 * | yearly    | amount (as-is)       |
 * | trial     | 0                    |
 * | one_time  | 0                    |
 *
 * @param subs — array of SubscriptionRow
 * @returns total annual commitment in minor units
 */
export function calculateAnnualCommitment(subs: SubscriptionRow[]): number {
  return subs.reduce((total, sub) => {
    switch (sub.billing_cycle) {
      case 'monthly':
        return total + sub.amount_minor * 12;
      case 'quarterly':
        return total + sub.amount_minor * 4;
      case 'yearly':
        return total + sub.amount_minor;
      case 'trial':
      case 'one_time':
        return total;
      default:
        return total;
    }
  }, 0);
}

/**
 * Calculate total monthly burn across a set of subscriptions.
 *
 * Sums the monthly-normalised burn of each subscription.
 * Trial and one_time subscriptions contribute 0.
 *
 * @param subs — array of SubscriptionRow
 * @returns total monthly burn in minor units
 */
export function calculateTotalMonthlyBurn(subs: SubscriptionRow[]): number {
  return subs.reduce((total, sub) => {
    return total + calculateMonthlyBurn(sub.amount_minor, sub.billing_cycle);
  }, 0);
}

/**
 * Compute the "next 30 days" spend — sum of all subscriptions whose
 * next payment falls within the next 30 days.
 *
 * @param subs — array of SubscriptionRow
 * @returns total amount due in the next 30 days, in minor units
 */
export function calculateNext30DaysSpend(subs: SubscriptionRow[]): number {
  return subs.reduce((total, sub) => {
    const days = getDaysUntilRenewal(sub.next_payment_at);
    if (days <= 30 && days >= 0) {
      return total + sub.amount_minor;
    }
    return total;
  }, 0);
}

/**
 * Count how many subscriptions have a renewal in the next 30 days.
 *
 * @param subs — array of SubscriptionRow
 * @returns count of subscriptions renewing within 30 days
 */
export function countRenewalsNext30Days(subs: SubscriptionRow[]): number {
  return subs.filter((sub) => {
    const days = getDaysUntilRenewal(sub.next_payment_at);
    return days <= 30 && days >= 0;
  }).length;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Produce a human-readable renewal label from days until renewal.
 *
 * @param days — number of days (from getDaysUntilRenewal)
 * @returns human-readable string like "12 days", "Renewed today", "Overdue by 3 days"
 */
export function getRenewalLabel(days: number): string {
  if (days === Number.POSITIVE_INFINITY) {
    return 'No date';
  }
  if (days === 0) {
    return 'Renewed today';
  }
  if (days < 0) {
    return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  }
  return `${days} day${days === 1 ? '' : 's'}`;
}

/**
 * Get the CSS border colour for a given urgency level.
 * Maps to the design system colour palette.
 *
 * @param level — UrgencyLevel
 * @returns hex colour string
 */
export function getUrgencyBorderColor(level: UrgencyLevel): string {
  switch (level) {
    case 'critical':
      return '#B43A2D';
    case 'warning':
      return '#C77700';
    case 'trial':
      return '#2563EB';
    case 'expired':
      return '#A0A0A0';
    case 'normal':
    case 'distant':
    default:
      return '#E8E6E1';
  }
}

/**
 * Get the CSS background colour for a table row at a given urgency level.
 *
 * @param level — UrgencyLevel
 * @returns hex colour string for background
 */
export function getUrgencyBgColor(level: UrgencyLevel): string {
  switch (level) {
    case 'critical':
      return '#FEF2F2'; // red-50
    case 'warning':
      return '#FFFBEB'; // amber-50
    case 'trial':
      return '#EFF6FF'; // blue-50
    case 'expired':
      return '#F5F5F4'; // stone-100
    case 'normal':
      return '#FFFFFF';
    case 'distant':
    default:
      return '#FAFAF7';
  }
}

/**
 * Get the CSS text colour for days-until-renewal display.
 *
 * @param level — UrgencyLevel
 * @returns hex colour string
 */
export function getUrgencyTextColor(level: UrgencyLevel): string {
  switch (level) {
    case 'critical':
      return '#B43A2D';
    case 'warning':
      return '#C77700';
    case 'trial':
      return '#2563EB';
    case 'expired':
      return '#A0A0A0';
    case 'normal':
      return '#44403C';
    case 'distant':
      return '#A0A0A0';
    default:
      return '#44403C';
  }
}
