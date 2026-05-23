/**
 * ============================================================================
 * SubscriptionCleanup — Unused Subscription Detection & Cleanup
 * ============================================================================
 *
 * Fourth tab of the Subscription Command Center. Identifies subscriptions
 * that may be candidates for archival:
 *
 *   - Subscriptions with NO linked transaction in 60+ days
 *   - Subscriptions that have NEVER been charged (never linked)
 *
 * Each row shows:
 *   - Name, vendor, category
 *   - Last linked invoice date (or "Never")
 *   - Total spent YTD
 *   - Days since last charge (or "∞")
 *   - Action buttons: Review | Archive | Keep
 *
 * The component receives pre-computed candidate data from the server action
 * {@link getCleanupCandidates} in subscriptions.ts.
 *
 * @example
 * <SubscriptionCleanup
 *   candidates={candidates}
 *   onReview={(sub) => openDetailPanel(sub.id)}
 *   onArchive={(id) => archiveSubscription(id)}
 *   onKeep={(id) => dismissCandidate(id)}
 * />
 */

'use client'

import React, { useState, useMemo, useCallback } from 'react'
import type { SubscriptionRow } from '@/lib/supabase/database.types'
import { formatAmount } from '@/lib/utils/currency'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A subscription flagged for cleanup review with computed metadata. */
interface CleanupCandidate {
  subscription: SubscriptionRow
  /** ISO date of most recent linked transaction, or null */
  lastInvoiceDate: string | null
  /** Sum of linked transaction amounts YTD in minor units */
  totalSpentYtdMinor: number
  /** Days since the last linked charge (Infinity if never charged) */
  daysSinceLastCharge: number
  /** Whether this subscription has had NO linked transactions ever */
  neverCharged: boolean
}

/** Props for the SubscriptionCleanup component. */
interface SubscriptionCleanupProps {
  /** Pre-computed cleanup candidates from the server */
  candidates: CleanupCandidate[]
  /** Called when user clicks "Review" — opens detail/edit panel */
  onReview?: (subscription: SubscriptionRow) => void
  /** Called when user clicks "Archive" — soft-deletes the subscription */
  onArchive?: (id: string) => void | Promise<void>
  /** Called when user clicks "Keep" — dismisses from the cleanup list */
  onKeep?: (id: string) => void
  /** Loading state for async actions */
  isLoading?: boolean
}

/** Filter tab type. */
type FilterTab = 'all' | 'never_charged' | 'stale'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Risk colour thresholds for days since last charge. */
const RISK_COLORS = {
  critical: '#B43A2D', // 90+ days or never charged
  warning: '#C77700',  // 60–89 days
  ok: '#1F8A4C',       // < 60 days (shouldn't appear in this list)
} as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get a risk colour based on days since last charge.
 */
function riskColor(days: number, neverCharged: boolean): string {
  if (neverCharged || days >= 90) return RISK_COLORS.critical
  if (days >= 60) return RISK_COLORS.warning
  return RISK_COLORS.ok
}

/**
 * Format days since last charge for display.
 */
function formatDaysSince(days: number, neverCharged: boolean): string {
  if (neverCharged) return 'Never charged'
  if (days === Infinity) return '∞'
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  return `${days} days`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Cleanup view for identifying and managing unused subscriptions.
 *
 * @param props - See {@link SubscriptionCleanupProps}
 * @returns JSX.Element
 */
export function SubscriptionCleanup({
  candidates,
  onReview,
  onArchive,
  onKeep,
  isLoading = false,
}: SubscriptionCleanupProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [archivingId, setArchivingId] = useState<string | null>(null)

  // -- Filter tabs ----------------------------------------------------------
  const tabs: { key: FilterTab; label: string; count: number }[] = useMemo(() => {
    const all = candidates.filter((c) => !dismissedIds.has(c.subscription.id))
    const never = all.filter((c) => c.neverCharged)
    const stale = all.filter((c) => !c.neverCharged)

    return [
      { key: 'all', label: 'All Candidates', count: all.length },
      { key: 'never_charged', label: 'Never Charged', count: never.length },
      { key: 'stale', label: 'Stale (60d+)', count: stale.length },
    ]
  }, [candidates, dismissedIds])

  const filtered = useMemo(() => {
    let rows = candidates.filter((c) => !dismissedIds.has(c.subscription.id))

    if (activeTab === 'never_charged') {
      rows = rows.filter((c) => c.neverCharged)
    } else if (activeTab === 'stale') {
      rows = rows.filter((c) => !c.neverCharged)
    }

    // Sort: never charged first, then by days desc
    rows.sort((a, b) => {
      if (a.neverCharged && !b.neverCharged) return -1
      if (!a.neverCharged && b.neverCharged) return 1
      return b.daysSinceLastCharge - a.daysSinceLastCharge
    })

    return rows
  }, [candidates, dismissedIds, activeTab])

  // -- Handlers -------------------------------------------------------------

  const handleKeep = useCallback(
    (id: string) => {
      setDismissedIds((prev) => new Set(prev).add(id))
      onKeep?.(id)
    },
    [onKeep]
  )

  const handleArchive = useCallback(
    async (id: string) => {
      setArchivingId(id)
      try {
        await onArchive?.(id)
        setDismissedIds((prev) => new Set(prev).add(id))
      } finally {
        setArchivingId(null)
      }
    },
    [onArchive]
  )

  // -- Stats ----------------------------------------------------------------
  const totalMonthlyAtRisk = useMemo(() => {
    return filtered.reduce((sum, c) => {
      // Only count monthly/quarterly/yearly cycles as "at risk" spend
      const cycle = c.subscription.billing_cycle
      if (cycle === 'trial' || cycle === 'one_time') return sum
      return sum + c.subscription.amount_minor
    }, 0)
  }, [filtered])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Header + stats ── */}
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
            Subscription Cleanup
          </h2>
          <span
            style={{
              fontSize: '13px',
              color: '#6B6B6B',
              marginTop: '4px',
              display: 'block',
            }}
          >
            {candidates.length} subscription{candidates.length !== 1 ? 's' : ''} flagged for review
          </span>
        </div>

        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '16px',
            fontWeight: 600,
            color: '#B43A2D',
            textAlign: 'right',
          }}
        >
          {formatAmount(totalMonthlyAtRisk, 'MYR')}
          <span
            style={{
              fontSize: '12px',
              fontWeight: 400,
              color: '#A0A0A0',
              marginLeft: '6px',
            }}
          >
            /mo at risk
          </span>
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '20px',
          padding: '4px',
          backgroundColor: '#F0EEEA',
          borderRadius: '10px',
          width: 'fit-content',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: activeTab === tab.key ? 600 : 400,
              border: 'none',
              backgroundColor: activeTab === tab.key ? '#181818' : 'transparent',
              color: activeTab === tab.key ? '#FFFFFF' : '#6B6B6B',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {tab.label}
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '10px',
                backgroundColor: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : '#E5E5E5',
                color: activeTab === tab.key ? '#FFFFFF' : '#6B6B6B',
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E6E1',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 110px 120px 110px 200px',
            gap: '12px',
            padding: '12px 20px',
            backgroundColor: '#FAFAF7',
            borderBottom: '1px solid #E8E6E1',
            fontSize: '12px',
            fontWeight: 600,
            color: '#6B6B6B',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          <div>Subscription</div>
          <div>Vendor</div>
          <div style={{ textAlign: 'center' }}>Last Invoice</div>
          <div style={{ textAlign: 'right' }}>YTD Spent</div>
          <div style={{ textAlign: 'center' }}>Since Charge</div>
          <div style={{ textAlign: 'center' }}>Actions</div>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <EmptyCleanupState />
        ) : (
          filtered.map((candidate) => (
            <CleanupRow
              key={candidate.subscription.id}
              candidate={candidate}
              onReview={onReview}
              onArchive={handleArchive}
              onKeep={handleKeep}
              isArchiving={archivingId === candidate.subscription.id}
              isLoading={isLoading}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cleanup row sub-component
// ---------------------------------------------------------------------------

/**
 * Single row in the cleanup table.
 */
function CleanupRow({
  candidate: c,
  onReview,
  onArchive,
  onKeep,
  isArchiving,
  isLoading,
}: {
  candidate: CleanupCandidate
  onReview?: (sub: SubscriptionRow) => void
  onArchive: (id: string) => void | Promise<void>
  onKeep: (id: string) => void
  isArchiving: boolean
  isLoading: boolean
}): React.JSX.Element {
  const sub = c.subscription
  const risk = riskColor(c.daysSinceLastCharge, c.neverCharged)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 110px 120px 110px 200px',
        gap: '12px',
        padding: '14px 20px',
        borderBottom: '1px solid #F0EEEA',
        alignItems: 'center',
        transition: 'background-color 0.1s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#FAFAF7'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#FFFFFF'
      }}
    >
      {/* Name + category */}
      <div>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#181818',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {sub.name}
          {c.neverCharged && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: '#FFF3E0',
                color: '#C77700',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              NEVER
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: '#A0A0A0',
            marginTop: '2px',
          }}
        >
          {sub.category} · {sub.billing_cycle} ·{' '}
          {formatAmount(sub.amount_minor, sub.currency)}
        </div>
      </div>

      {/* Vendor */}
      <div
        style={{
          fontSize: '13px',
          color: '#181818',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {sub.vendor}
      </div>

      {/* Last invoice date */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: '12px',
            fontWeight: c.lastInvoiceDate ? 400 : 600,
            color: c.lastInvoiceDate ? '#181818' : '#B43A2D',
          }}
        >
          {c.lastInvoiceDate ?? '—'}
        </div>
      </div>

      {/* YTD spent */}
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '13px',
          fontWeight: 500,
          color: '#181818',
          textAlign: 'right',
        }}
      >
        {formatAmount(c.totalSpentYtdMinor, sub.currency)}
      </div>

      {/* Days since last charge */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '12px',
            backgroundColor: `${risk}15`,
            color: risk,
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: risk,
              display: 'inline-block',
            }}
          />
          {formatDaysSince(c.daysSinceLastCharge, c.neverCharged)}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
        <ActionButton
          label="Review"
          variant="secondary"
          onClick={() => onReview?.(sub)}
          disabled={isLoading}
        />
        <ActionButton
          label={isArchiving ? '...' : 'Archive'}
          variant="danger"
          onClick={() => {
            if (window.confirm(`Archive "${sub.name}"? This can be undone later.`)) {
              onArchive(sub.id)
            }
          }}
          disabled={isArchiving || isLoading}
        />
        <ActionButton
          label="Keep"
          variant="ghost"
          onClick={() => onKeep(sub.id)}
          disabled={isLoading}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Action button
// ---------------------------------------------------------------------------

/** Reusable action button for the cleanup table. */
function ActionButton({
  label,
  variant,
  onClick,
  disabled,
}: {
  label: string
  variant: 'secondary' | 'danger' | 'ghost'
  onClick: () => void
  disabled?: boolean
}): React.JSX.Element {
  const styles: Record<string, React.CSSProperties> = {
    secondary: {
      backgroundColor: '#FAFAF7',
      color: '#181818',
      border: '1px solid #E5E5E5',
    },
    danger: {
      backgroundColor: '#FFF5F5',
      color: '#B43A2D',
      border: '1px solid #FECACA',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#6B6B6B',
      border: '1px solid transparent',
    },
  }

  const hoverBg: Record<string, string> = {
    secondary: '#F0EEEA',
    danger: '#FEE2E2',
    ghost: '#F5F5F5',
  }

  const [isHovered, setIsHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '6px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.1s ease',
        ...styles[variant],
        backgroundColor: isHovered && !disabled ? hoverBg[variant] : styles[variant].backgroundColor,
      }}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

/** Displayed when no cleanup candidates match the current filter. */
function EmptyCleanupState(): React.JSX.Element {
  return (
    <div
      style={{
        padding: '48px 20px',
        textAlign: 'center',
        color: '#A0A0A0',
      }}
    >
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>✨</div>
      <div
        style={{
          fontSize: '15px',
          fontWeight: 500,
          color: '#6B6B6B',
          marginBottom: '4px',
        }}
      >
        All clear
      </div>
      <div style={{ fontSize: '13px' }}>
        No subscriptions need cleanup attention right now
      </div>
    </div>
  )
}
