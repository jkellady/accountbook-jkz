/**
 * StackRadarCard — Mobile card component for Stack Radar
 * JK Zentra Finance Cockpit
 *
 * Displays a single subscription as a clean card with urgency-coloured
 * left border. Used in the mobile grid view (below md breakpoint).
 */

'use client';

import { useMemo } from 'react';
import { getUrgencyLevel, getDaysUntilRenewal, getRenewalLabel, formatAmount, getUrgencyBorderColor, getUrgencyTextColor } from '@/lib/utils/subscriptionUtils';
import type { SubscriptionRow } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StackRadarCardProps {
  /** Subscription data to display */
  subscription: SubscriptionRow;
  /** Callback when Edit is clicked */
  onEdit: (id: string) => void;
  /** Callback when Pause is clicked */
  onPause: (id: string) => void;
  /** Callback when Cancel is clicked */
  onCancel: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Mobile card for a subscription in the Stack Radar.
 *
 * Features:
 * - 4px urgency-coloured left border (red/amber/blue/neutral)
 * - Vendor name (large, bold), plan (small, grey)
 * - Amount right-aligned in JetBrains Mono
 * - Days until renewal as a prominent badge
 * - Billing cycle pill
 * - Trial badge (blue) if applicable
 * - Action button row: Edit, Pause, Cancel
 */
export default function StackRadarCard({
  subscription,
  onEdit,
  onPause,
  onCancel,
}: StackRadarCardProps): JSX.Element {
  const urgency = useMemo(
    () => getUrgencyLevel(subscription.next_payment_at, subscription.status),
    [subscription.next_payment_at, subscription.status],
  );

  const days = useMemo(
    () => getDaysUntilRenewal(subscription.next_payment_at),
    [subscription.next_payment_at],
  );

  const renewalLabel = useMemo(() => getRenewalLabel(days), [days]);
  const formattedAmount = useMemo(
    () => formatAmount(subscription.amount_minor),
    [subscription.amount_minor],
  );

  const borderColor = getUrgencyBorderColor(urgency.level);
  const daysTextColor = getUrgencyTextColor(urgency.level);
  const isExpired = urgency.level === 'expired';
  const isTrial = urgency.level === 'trial';

  /** Convert billing cycle to display label */
  const cycleLabel = useMemo(() => {
    const map: Record<string, string> = {
      monthly: 'mo',
      yearly: 'yr',
      quarterly: 'qtr',
      trial: 'trial',
      one_time: 'once',
    };
    return map[subscription.billing_cycle] ?? subscription.billing_cycle;
  }, [subscription.billing_cycle]);

  /** Status pill colour mapping */
  const statusPill = useMemo(() => {
    switch (subscription.status) {
      case 'active':
        return { bg: '#ECFDF5', text: '#059669', label: 'Active' };
      case 'trial':
        return { bg: '#EFF6FF', text: '#2563EB', label: 'Trial' };
      case 'paused':
        return { bg: '#FFFBEB', text: '#C77700', label: 'Paused' };
      case 'cancelled':
        return { bg: '#F5F5F4', text: '#78716C', label: 'Cancelled' };
      case 'expired':
        return { bg: '#F5F5F4', text: '#78716C', label: 'Expired' };
      default:
        return { bg: '#F5F5F4', text: '#78716C', label: subscription.status };
    }
  }, [subscription.status]);

  return (
    <div
      className="relative rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: borderColor,
        borderColor: '#E8E6E1',
      }}
      role="listitem"
      aria-label={`${subscription.vendor} ${subscription.name}`}
    >
      {/* Top row: Vendor + Amount */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className={`truncate text-base font-semibold leading-tight ${isExpired ? 'line-through' : ''}`}
            style={{ color: isExpired ? '#A0A0A0' : '#181818' }}
          >
            {subscription.vendor}
          </h3>
          {subscription.plan && (
            <p className="mt-0.5 truncate text-xs" style={{ color: '#78716C' }}>
              {subscription.plan}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p
            className="font-mono text-base font-semibold"
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              color: urgency.level === 'critical' && !isExpired ? '#B43A2D' : '#181818',
              fontSize: urgency.level === 'critical' && !isExpired ? '1.125rem' : '1rem',
              fontWeight: urgency.level === 'critical' && !isExpired ? 700 : 600,
            }}
          >
            {formattedAmount}
          </p>
        </div>
      </div>

      {/* Meta row: Cycle pill + Days badge */}
      <div className="mb-3 flex items-center gap-2">
        {/* Billing cycle pill */}
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
          style={{
            backgroundColor: '#F5F5F4',
            color: '#78716C',
          }}
        >
          {cycleLabel}
        </span>

        {/* Status pill */}
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            backgroundColor: statusPill.bg,
            color: statusPill.text,
          }}
        >
          {statusPill.label}
        </span>

        {/* Trial badge */}
        {isTrial && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
            }}
          >
            Trial
          </span>
        )}

        {/* Days until renewal */}
        {!isTrial && (
          <span
            className={`ml-auto text-xs font-semibold ${isExpired ? 'line-through' : ''}`}
            style={{ color: daysTextColor }}
          >
            {renewalLabel}
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="mb-3 h-px w-full" style={{ backgroundColor: '#F0EEE9' }} />

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onEdit(subscription.id)}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-stone-100"
          style={{ color: '#44403C' }}
          aria-label={`Edit ${subscription.vendor}`}
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit
        </button>

        {subscription.status !== 'paused' && subscription.status !== 'cancelled' && subscription.status !== 'expired' && (
          <button
            onClick={() => onPause(subscription.id)}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-stone-100"
            style={{ color: '#C77700' }}
            aria-label={`Pause ${subscription.vendor}`}
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
            Pause
          </button>
        )}

        {subscription.status !== 'cancelled' && subscription.status !== 'expired' && (
          <button
            onClick={() => onCancel(subscription.id)}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-red-50"
            style={{ color: '#B43A2D' }}
            aria-label={`Cancel ${subscription.vendor}`}
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
