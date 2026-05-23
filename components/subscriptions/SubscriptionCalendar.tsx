/**
 * ============================================================================
 * SubscriptionCalendar — Monthly Payment Calendar Grid
 * ============================================================================
 *
 * Second tab of the Subscription Command Center. Displays a month-grid
 * calendar with coloured dots indicating subscription payments:
 *
 *   🟢 Green = paid (has a last_paid_at this month)
 *   🟠 Amber = due this month (next_payment_at falls in this month)
 *   🔴 Red   = overdue (next_payment_at was last month or earlier)
 *
 * Header shows: "May 2026 — 4 payments due"
 * Clicking a dot opens a popup with subscription details.
 *
 * @example
 * <SubscriptionCalendar
 *   subscriptions={subs}
 *   year={2026}
 *   month={4}
 * />
 */

'use client'

import React, { useState, useMemo, useCallback } from 'react'
import type { SubscriptionRow } from '@/lib/supabase/database.types'
import { formatAmount } from '@/lib/utils/currency'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for the SubscriptionCalendar component. */
interface SubscriptionCalendarProps {
  /** Subscription rows to display on the calendar */
  subscriptions: SubscriptionRow[]
  /** Year to display (e.g. 2026) */
  year?: number
  /** Month to display (0-indexed: 0 = January, 11 = December) */
  month?: number
  /** Called when the user navigates to a different month */
  onMonthChange?: (year: number, month: number) => void
}

/** A payment event for a specific day cell. */
interface DayEvent {
  subscription: SubscriptionRow
  type: 'paid' | 'due' | 'overdue'
}

/** Aggregated data for a single day cell. */
interface DayCell {
  day: number
  dateStr: string // YYYY-MM-DD
  isToday: boolean
  isCurrentMonth: boolean
  events: DayEvent[]
}

/** Detail popup state. */
interface PopupState {
  subscription: SubscriptionRow
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const DOT_COLORS = {
  paid: '#1F8A4C',    // green
  due: '#C77700',     // amber
  overdue: '#B43A2D', // red
} as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the ISO date string for a specific year/month/day.
 */
function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Extract YYYY-MM from a date string.
 */
function toYearMonth(dateStr: string): string {
  return dateStr.slice(0, 7)
}

/**
 * Build the calendar grid for a given year/month.
 */
function buildCalendarGrid(
  year: number,
  month: number,
  events: Map<string, DayEvent[]>
): DayCell[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const firstDayOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDayOfWeek = firstDayOfMonth.getDay() // 0 = Sunday

  const cells: DayCell[] = []

  // Previous month padding
  const prevMonthDays = new Date(year, month, 0).getDate()
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthDays - i
    const dateStr = toDateStr(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, day)
    cells.push({ day, dateStr, isToday: dateStr === todayStr, isCurrentMonth: false, events: [] })
  }

  // Current month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = toDateStr(year, month, day)
    cells.push({
      day,
      dateStr,
      isToday: dateStr === todayStr,
      isCurrentMonth: true,
      events: events.get(dateStr) ?? [],
    })
  }

  // Next month padding (fill to complete 6 rows × 7 cols = 42 cells)
  const remaining = 42 - cells.length
  for (let day = 1; day <= remaining; day++) {
    const dateStr = toDateStr(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, day)
    cells.push({ day, dateStr, isToday: dateStr === todayStr, isCurrentMonth: false, events: [] })
  }

  return cells
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Monthly calendar grid showing subscription payment dates.
 *
 * @param props - See {@link SubscriptionCalendarProps}
 * @returns JSX.Element
 */
export function SubscriptionCalendar({
  subscriptions,
  year: propYear,
  month: propMonth,
  onMonthChange,
}: SubscriptionCalendarProps): React.JSX.Element {
  // -- Default to current month --------------------------------------------
  const now = new Date()
  const [viewYear, setViewYear] = useState(propYear ?? now.getFullYear())
  const [viewMonth, setViewMonth] = useState(propMonth ?? now.getMonth())

  // Sync with props
  useMemo(() => {
    if (propYear !== undefined) setViewYear(propYear)
    if (propMonth !== undefined) setViewMonth(propMonth)
  }, [propYear, propMonth])

  // -- Navigation -----------------------------------------------------------
  const goToPrevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1)
        return 11
      }
      return m - 1
    })
    onMonthChange?.(viewMonth === 0 ? viewYear - 1 : viewYear, viewMonth === 0 ? 11 : viewMonth - 1)
  }, [viewYear, viewMonth, onMonthChange])

  const goToNextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1)
        return 0
      }
      return m + 1
    })
    onMonthChange?.(viewMonth === 11 ? viewYear + 1 : viewYear, viewMonth === 11 ? 0 : viewMonth + 1)
  }, [viewYear, viewMonth, onMonthChange])

  const goToToday = useCallback(() => {
    const t = new Date()
    setViewYear(t.getFullYear())
    setViewMonth(t.getMonth())
    onMonthChange?.(t.getFullYear(), t.getMonth())
  }, [onMonthChange])

  // -- Build events map -----------------------------------------------------
  const eventsMap = useMemo(() => {
    const map = new Map<string, DayEvent[]>()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    for (const sub of subscriptions) {
      // Skip archived
      if (sub.status === 'archived') continue

      // Paid events: last_paid_at
      if (sub.last_paid_at) {
        const dateStr = sub.last_paid_at
        const existing = map.get(dateStr) ?? []
        existing.push({ subscription: sub, type: 'paid' })
        map.set(dateStr, existing)
      }

      // Due / overdue events: next_payment_at
      if (sub.next_payment_at) {
        const dateStr = sub.next_payment_at
        const type: DayEvent['type'] = dateStr < todayStr ? 'overdue' : 'due'
        const existing = map.get(dateStr) ?? []
        existing.push({ subscription: sub, type })
        map.set(dateStr, existing)
      }
    }

    return map
  }, [subscriptions])

  // -- Build grid -----------------------------------------------------------
  const grid = useMemo(
    () => buildCalendarGrid(viewYear, viewMonth, eventsMap),
    [viewYear, viewMonth, eventsMap]
  )

  // -- Count dues this month ------------------------------------------------
  const dueThisMonth = useMemo(() => {
    const ym = toDateStr(viewYear, viewMonth, 1).slice(0, 7)
    let count = 0
    for (const [, events] of eventsMap) {
      for (const ev of events) {
        if (ev.type === 'due' && ev.subscription.next_payment_at?.startsWith(ym)) {
          count++
        }
      }
    }
    return count
  }, [eventsMap, viewYear, viewMonth])

  // -- Popup state ----------------------------------------------------------
  const [popup, setPopup] = useState<PopupState | null>(null)

  const handleDotClick = useCallback(
    (e: React.MouseEvent, subscription: SubscriptionRow) => {
      e.stopPropagation()
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setPopup({
        subscription,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      })
    },
    []
  )

  const closePopup = useCallback(() => setPopup(null), [])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        position: 'relative',
      }}
      onClick={closePopup}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          padding: '16px 20px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E6E1',
          borderRadius: '12px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#181818',
              margin: 0,
            }}
          >
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h2>
          <span
            style={{
              fontSize: '13px',
              color: '#6B6B6B',
              marginTop: '4px',
              display: 'block',
            }}
          >
            {dueThisMonth} payment{dueThisMonth !== 1 ? 's' : ''} due this month
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '12px', marginRight: '16px' }}>
            <LegendItem color={DOT_COLORS.paid} label="Paid" />
            <LegendItem color={DOT_COLORS.due} label="Due" />
            <LegendItem color={DOT_COLORS.overdue} label="Overdue" />
          </div>

          {/* Nav buttons */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goToPrevMonth()
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #E5E5E5',
              backgroundColor: '#FAFAF7',
              color: '#181818',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goToToday()
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #E5E5E5',
              backgroundColor: '#FAFAF7',
              color: '#181818',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            Today
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goToNextMonth()
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #E5E5E5',
              backgroundColor: '#FAFAF7',
              color: '#181818',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* ── Calendar Grid ── */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E6E1',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {/* Day labels */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: '1px solid #E8E6E1',
          }}
        >
          {DAY_LABELS.map((day) => (
            <div
              key={day}
              style={{
                padding: '12px 8px',
                textAlign: 'center',
                fontSize: '12px',
                fontWeight: 600,
                color: '#6B6B6B',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
          }}
        >
          {grid.map((cell, idx) => (
            <DayCellView
              key={idx}
              cell={cell}
              onDotClick={handleDotClick}
            />
          ))}
        </div>
      </div>

      {/* ── Detail Popup ── */}
      {popup && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: Math.min(popup.x, window.innerWidth - 300),
            top: Math.max(popup.y - 180, 8),
            zIndex: 100,
            width: '280px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E8E6E1',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '16px',
          }}
        >
          <SubscriptionPopup subscription={popup.subscription} onClose={closePopup} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Day cell sub-component
// ---------------------------------------------------------------------------

/**
 * Single day cell in the calendar grid.
 */
function DayCellView({
  cell,
  onDotClick,
}: {
  cell: DayCell
  onDotClick: (e: React.MouseEvent, sub: SubscriptionRow) => void
}): React.JSX.Element {
  return (
    <div
      style={{
        minHeight: '80px',
        padding: '8px',
        borderRight: '1px solid #F0EEEA',
        borderBottom: '1px solid #F0EEEA',
        backgroundColor: cell.isCurrentMonth ? '#FFFFFF' : '#FAFAF7',
        opacity: cell.isCurrentMonth ? 1 : 0.5,
        position: 'relative',
      }}
    >
      {/* Day number */}
      <div
        style={{
          fontSize: '13px',
          fontWeight: cell.isToday ? 700 : 400,
          color: cell.isToday ? '#FFFFFF' : cell.isCurrentMonth ? '#181818' : '#A0A0A0',
          backgroundColor: cell.isToday ? '#181818' : 'transparent',
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          marginBottom: '4px',
        }}
      >
        {cell.day}
      </div>

      {/* Event dots */}
      {cell.events.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
          {cell.events.map((ev, i) => (
            <button
              key={`${ev.subscription.id}-${i}`}
              type="button"
              onClick={(e) => onDotClick(e, ev.subscription)}
              title={`${ev.subscription.name} — ${ev.type}`}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: DOT_COLORS[ev.type],
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* Event count pill (if more than 3) */}
      {cell.events.length > 3 && (
        <div
          style={{
            fontSize: '10px',
            color: '#6B6B6B',
            marginTop: '2px',
          }}
        >
          +{cell.events.length - 3} more
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Popup sub-component
// ---------------------------------------------------------------------------

/**
 * Popup card showing subscription details when a calendar dot is clicked.
 */
function SubscriptionPopup({
  subscription: sub,
  onClose,
}: {
  subscription: SubscriptionRow
  onClose: () => void
}): React.JSX.Element {
  const statusColors: Record<string, string> = {
    active: '#1F8A4C',
    trial: '#2563EB',
    paused: '#C77700',
    cancelled: '#A0A0A0',
    expired: '#B43A2D',
  }

  return (
    <div>
      {/* Close button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#A0A0A0',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '2px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Name + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: '#181818',
            flex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {sub.name}
        </span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '10px',
            backgroundColor: statusColors[sub.status] ?? '#6B6B6B',
            color: '#FFFFFF',
            whiteSpace: 'nowrap',
          }}
        >
          {sub.status}
        </span>
      </div>

      {/* Vendor */}
      <div
        style={{
          fontSize: '13px',
          color: '#6B6B6B',
          marginBottom: '12px',
        }}
      >
        {sub.vendor}
        {sub.plan && ` · ${sub.plan}`}
      </div>

      {/* Amount */}
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '16px',
          fontWeight: 600,
          color: '#181818',
          marginBottom: '12px',
          padding: '10px',
          backgroundColor: '#FAFAF7',
          borderRadius: '8px',
          textAlign: 'right',
        }}
      >
        {formatAmount(sub.amount_minor, sub.currency)}
        <span style={{ fontSize: '12px', color: '#6B6B6B', marginLeft: '8px', fontWeight: 400 }}>
          /{sub.billing_cycle}
        </span>
      </div>

      {/* Dates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
        {sub.next_payment_at && (
          <div>
            <span style={{ color: '#A0A0A0', display: 'block', marginBottom: '2px' }}>
              Next payment
            </span>
            <span style={{ color: '#181818', fontWeight: 500 }}>{sub.next_payment_at}</span>
          </div>
        )}
        {sub.last_paid_at && (
          <div>
            <span style={{ color: '#A0A0A0', display: 'block', marginBottom: '2px' }}>
              Last paid
            </span>
            <span style={{ color: '#181818', fontWeight: 500 }}>{sub.last_paid_at}</span>
          </div>
        )}
        {sub.trial_end_date && (
          <div>
            <span style={{ color: '#A0A0A0', display: 'block', marginBottom: '2px' }}>
              Trial ends
            </span>
            <span style={{ color: '#2563EB', fontWeight: 500 }}>{sub.trial_end_date}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Legend item
// ---------------------------------------------------------------------------

/** Single legend entry for the calendar header. */
function LegendItem({ color, label }: { color: string; label: string }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
        }}
      />
      <span style={{ fontSize: '12px', color: '#6B6B6B' }}>{label}</span>
    </div>
  )
}
