/**
 * StackRadarRow — Desktop table row component for Stack Radar
 * JK Zentra Finance Cockpit
 *
 * Displays a single subscription as a table row with urgency-coloured
 * background. Used in the desktop table view (md breakpoint and above).
 * Hovering reveals quick-action buttons inline.
 */

'use client';

import { useMemo, useState } from 'react';
import { getUrgencyLevel, getDaysUntilRenewal, getRenewalLabel, formatAmount, getUrgencyBgColor } from '@/lib/utils/subscriptionUtils';
import type { SubscriptionRow } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StackRadarRowProps {
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
 * Desktop table row for a subscription in the Stack Radar.
 *
 * Columns: Vendor | Plan | Amount | Cycle | Days | Status | Actions
 * - Row background changes based on urgency (red/amber/blue tint)
 * - Hovering reveals Edit/Pause/Cancel action buttons
 * - Cancelled/expired rows show strikethrough and muted styling
 */
export default function StackRadarRow({
  subscription,
  onEdit,
  onPause,
  onCancel,
}: StackRadarRowProps): JSX.Element {
  const [isHovered, setIsHovered] = useState(false);

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

  const bgColor = getUrgencyBgColor(urgency.level);
  const isExpired = urgency.level === 'expired';
  const isTrial = urgency.level === 'trial';
  const isCritical = urgency.level === 'critical' && !isExpired;

  /** Billing cycle display label */
  const cycleLabel = useMemo(() => {
    const map: Record<string, string> = {
      monthly: 'Monthly',
      yearly: 'Yearly',
      quarterly: 'Quarterly',
      trial: 'Trial',
      one_time: 'One-time',
    };
    return map[subscription.billing_cycle] ?? subscription.billing_cycle;
  }, [subscription.billing_cycle]);

  /** Status pill configuration */
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

  /** Days label colour */
  const daysColor = useMemo(() => {
    if (isExpired) return '#A0A0A0';
    if (isTrial) return '#2563EB';
    if (isCritical) return '#B43A2D';
    if (urgency.level === 'warning') return '#C77700';
    if (urgency.level === 'distant') return '#A0A0A0';
    return '#44403C';
  }, [urgency.level, isExpired, isTrial, isCritical]);

  return (
    <tr
      className="group transition-colors"
      style={{ backgroundColor: isHovered ? undefined : bgColor }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-urgency={urgency.level}
    >
      {/* Vendor + name */}
      <td className="whitespace-nowrap px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Urgency dot */}
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{
              backgroundColor:
                urgency.level === 'critical' ? '#B43A2D'
                  : urgency.level === 'warning' ? '#C77700'
                    : urgency.level === 'trial' ? '#2563EB'
                      : '#D6D3D1',
            }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p
              className={`truncate text-sm font-semibold ${isExpired ? 'line-through' : ''}`}
              style={{
                color: isExpired ? '#A0A0A0' : '#181818',
                fontWeight: isCritical ? 700 : 600,
              }}
            >
              {subscription.vendor}
            </p>
            <p className="truncate text-xs" style={{ color: '#78716C' }}>
              {subscription.name}
            </p>
          </div>
        </div>
      </td>

      {/* Plan */}
      <td className="whitespace-nowrap px-4 py-3">
        <span
          className={`text-sm ${isExpired ? 'line-through' : ''}`}
          style={{ color: isExpired ? '#A0A0A0' : '#44403C' }}
        >
          {subscription.plan ?? '—'}
        </span>
      </td>

      {/* Amount */}
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <span
          className="text-sm font-semibold tabular-nums"
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            color: isCritical ? '#B43A2D' : isExpired ? '#A0A0A0' : '#181818',
            fontSize: isCritical ? '0.9375rem' : '0.875rem',
            fontWeight: isCritical ? 700 : 600,
          }}
        >
          {formattedAmount}
        </span>
      </td>

      {/* Billing cycle */}
      <td className="whitespace-nowrap px-4 py-3">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
          style={{
            backgroundColor: '#F5F5F4',
            color: '#78716C',
          }}
        >
          {cycleLabel}
        </span>
      </td>

      {/* Days until renewal */}
      <td className="whitespace-nowrap px-4 py-3">
        {isTrial ? (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: '#2563EB', color: '#FFFFFF' }}
          >
            Trial
          </span>
        ) : (
          <span
            className={`text-sm font-medium ${isExpired ? 'line-through' : ''}`}
            style={{ color: daysColor }}
          >
            {renewalLabel}
          </span>
        )}
      </td>

      {/* Status */}
      <td className="whitespace-nowrap px-4 py-3">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium capitalize"
          style={{
            backgroundColor: statusPill.bg,
            color: statusPill.text,
          }}
        >
          {statusPill.label}
        </span>
      </td>

      {/* Actions */}
      <td className="whitespace-nowrap px-4 py-3">
        <div
          className={`flex items-center gap-1 transition-opacity duration-150 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
        >
          <button
            onClick={() => onEdit(subscription.id)}
            className="rounded-lg p-1.5 transition-colors hover:bg-stone-200"
            style={{ color: '#44403C' }}
            aria-label={`Edit ${subscription.vendor}`}
            title="Edit"
            type="button"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>

          {subscription.status !== 'paused' && subscription.status !== 'cancelled' && subscription.status !== 'expired' && (
            <button
              onClick={() => onPause(subscription.id)}
              className="rounded-lg p-1.5 transition-colors hover:bg-amber-100"
              style={{ color: '#C77700' }}
              aria-label={`Pause ${subscription.vendor}`}
              title="Pause"
              type="button"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            </button>
          )}

          {subscription.status !== 'cancelled' && subscription.status !== 'expired' && (
            <button
              onClick={() => onCancel(subscription.id)}
              className="rounded-lg p-1.5 transition-colors hover:bg-red-100"
              style={{ color: '#B43A2D' }}
              aria-label={`Cancel ${subscription.vendor}`}
              title="Cancel"
              type="button"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
