/**
 * JK Zentra Finance Cockpit — Subscription Radar Widget
 * Dashboard Zone 2 — Upcoming Payments
 *
 * Displays a scannable list of upcoming subscription renewals within the
 * next 14 days. Shows count, total amount due, and the next 5 renewals
 * with colour-coded urgency indicators.
 *
 * - Red:   due within 7 days
 * - Amber: due in 7–14 days
 * - Neutral: due in 15–30 days (if window extended)
 *
 * @module components/dashboard/SubscriptionRadar
 */

import Link from 'next/link'
import { Calendar, ChevronRight } from 'lucide-react'
import { getUpcomingPaymentsForDashboard } from '@/lib/actions/dashboard'
import { formatAmount } from '@/lib/utils/currency'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SubscriptionRadarProps {
  /** Look-ahead window in days (default 14). */
  days?: number
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

/**
 * Compute the display colour for a due date based on days until payment.
 *
 * @param dateStr - ISO date string of the next payment.
 * @returns Hex colour code for the date text.
 */
function getDateColor(dateStr: string | null): string {
  if (!dateStr) return '#A0A0A0'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = new Date(dateStr)
  due.setHours(0, 0, 0, 0)

  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 7) return '#B43A2D' // Red — urgent
  if (diffDays <= 14) return '#C77700' // Amber — approaching
  return '#6B6B6B' // Neutral — comfortable
}

/**
 * Format a date for compact display (e.g. "Mar 3").
 *
 * @param dateStr - ISO date string.
 * @returns Formatted date string like "Mar 3".
 */
function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—'

  const date = new Date(dateStr)
  return date.toLocaleDateString('en-MY', {
    month: 'short',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Subscription Radar — upcoming payments widget for the dashboard.
 *
 * Fetches upcoming subscription renewals server-side and renders a
 * scannable card with count, total, and a colour-coded list.
 *
 * @param props - Component props.
 * @returns JSX.Element
 */
export async function SubscriptionRadar({
  days = 14,
}: SubscriptionRadarProps): Promise<JSX.Element> {
  const { subscriptions, totalMinor, count } =
    await getUpcomingPaymentsForDashboard(days)

  const hasPayments = count > 0
  const primaryCurrency = subscriptions[0]?.currency ?? 'MYR'

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E8E6E1',
        borderRadius: '12px',
        padding: '20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ---- Header ---- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        <Calendar size={16} color="#6B6B6B" strokeWidth={2} />
        <h3
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: '#6B6B6B',
            margin: 0,
          }}
        >
          Upcoming Payments
        </h3>
      </div>

      {!hasPayments ? (
        /* ---- Empty state ---- */
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: '#A0A0A0',
            textAlign: 'center',
            padding: '24px 0',
          }}
        >
          <Calendar size={28} color="#A0A0A0" strokeWidth={1.5} />
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              color: '#A0A0A0',
              margin: 0,
            }}
          >
            No upcoming payments. Nice and quiet.
          </p>
        </div>
      ) : (
        <>
          {/* ---- Summary ---- */}
          <div style={{ marginBottom: '16px' }}>
            <p
              style={{
                fontFamily: 'Fraunces, serif',
                fontSize: '24px',
                fontWeight: 600,
                color: '#181818',
                margin: '0 0 4px 0',
                lineHeight: 1.2,
              }}
            >
              {formatAmount(totalMinor, primaryCurrency)}
            </p>
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                color: '#A0A0A0',
                margin: 0,
              }}
            >
              {count} renewal{count !== 1 ? 's' : ''} in next {days} days
            </p>
          </div>

          {/* ---- List ---- */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              flex: 1,
            }}
          >
            {subscriptions.map(
              (sub: {
                id: string
                name: string
                vendor: string
                amount_minor: number
                currency: string
                next_payment_at: string | null
              }) => (
                <div
                  key={sub.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#181818',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={sub.name}
                    >
                      {sub.name}
                    </span>
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '12px',
                        color: '#A0A0A0',
                      }}
                    >
                      {sub.vendor}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '2px',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: getDateColor(sub.next_payment_at),
                      }}
                    >
                      {formatShortDate(sub.next_payment_at)}
                    </span>
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '13px',
                        color: '#181818',
                      }}
                    >
                      {formatAmount(sub.amount_minor, sub.currency)}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}

      {/* ---- Footer link ---- */}
      <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
        <Link
          href="/subscriptions"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
            color: '#F37002',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 500,
          }}
        >
          View all
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  )
}
