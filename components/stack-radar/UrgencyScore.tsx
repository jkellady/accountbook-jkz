/**
 * UrgencyScore — Reusable urgency indicator for Stack Radar
 * JK Zentra Finance Cockpit
 *
 * Displays a compact visual urgency indicator for a subscription.
 * Renders as a coloured dot + label combination used in both card and table views.
 */

'use client';

import { getUrgencyLevel, getDaysUntilRenewal, getRenewalLabel } from '@/lib/utils/subscriptionUtils';
import type { SubscriptionStatus } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UrgencyScoreProps {
  /** ISO-8601 date string for the next payment, or null if unknown */
  nextPaymentAt: string | null;
  /** Subscription status (active, trial, cancelled, paused, expired) */
  status: SubscriptionStatus;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * UrgencyScore — a compact dot + label showing how urgent a subscription renewal is.
 *
 * Visual states:
 * | Level    | Dot colour | Label text example          |
 * |----------|------------|-----------------------------|
 * | critical | #B43A2D    | "Overdue by 3 days" / "2 days" |
 * | warning  | #C77700    | "8 days"                    |
 * | normal   | #44403C    | "21 days"                   |
 * | distant  | #A0A0A0    | "45 days"                   |
 * | trial    | #2563EB    | "TRIAL"                     |
 * | expired  | #A0A0A0    | "Expired"                   |
 */
export default function UrgencyScore({ nextPaymentAt, status }: UrgencyScoreProps): JSX.Element {
  const urgency = getUrgencyLevel(nextPaymentAt, status);
  const days = getDaysUntilRenewal(nextPaymentAt);

  // Trial gets a special "TRIAL" badge regardless of days
  if (urgency.level === 'trial') {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: '#2563EB' }}
          aria-hidden="true"
        />
        <span
          className="text-xs font-semibold tracking-wide uppercase"
          style={{ color: '#2563EB' }}
        >
          Trial
        </span>
      </div>
    );
  }

  // Expired / cancelled
  if (urgency.level === 'expired') {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: '#A0A0A0' }}
          aria-hidden="true"
        />
        <span className="text-xs" style={{ color: '#A0A0A0' }}>
          Expired
        </span>
      </div>
    );
  }

  // All other levels — show dot + renewal label
  const dotColor = urgency.color === 'red'
    ? '#B43A2D'
    : urgency.color === 'amber'
      ? '#C77700'
      : urgency.color === 'neutral'
        ? '#44403C'
        : '#A0A0A0';

  const textColor = urgency.color === 'red'
    ? '#B43A2D'
    : urgency.color === 'amber'
      ? '#C77700'
      : urgency.color === 'neutral'
        ? '#44403C'
        : '#A0A0A0';

  const label = getRenewalLabel(days);

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: dotColor }}
        aria-hidden="true"
      />
      <span
        className="text-xs font-medium"
        style={{ color: textColor }}
      >
        {label}
      </span>
    </div>
  );
}
