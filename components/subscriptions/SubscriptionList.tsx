/**
 * ============================================================================
 * SubscriptionList — Sortable, Filterable List View
 * ============================================================================
 *
 * Default tab of the Subscription Command Center. Displays all subscriptions
 * in a sortable table with status pills, billing-cycle badges, and
 * next-payment-at highlighting.
 *
 * Features:
 *   - Sort by: next_payment_at (default), amount_minor, vendor, name, created_at
 *   - Filter by: status, entity, category
 *   - Click row → opens detail/edit panel (via onSelect callback)
 *   - Color-coded status pills per design system
 *   - Amounts in JetBrains Mono, right-aligned
 *
 * @example
 * <SubscriptionList
 *   subscriptions={subs}
 *   entities={[{ id: '...', name: 'Personal' }, { id: '...', name: 'JK Zentra' }]}
 *   onSelect={(sub) => setSelectedId(sub.id)}
 * />
 */

'use client'

import React, { useState, useMemo, useCallback } from 'react'
import type { SubscriptionRow, SubscriptionStatus } from '@/lib/supabase/database.types'
import { formatAmount } from '@/lib/utils/currency'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A subscription row augmented with its entity name for display. */
interface SubscriptionWithEntity extends SubscriptionRow {
  entityName: string
}

/** Props for the SubscriptionList component. */
interface SubscriptionListProps {
  /** Pre-fetched subscription rows (join with entity name client-side) */
  subscriptions: SubscriptionRow[]
  /** Entity lookup map: id → display name */
  entities: Array<{ id: string; name: string }>
  /** Called when a row is clicked */
  onSelect?: (subscription: SubscriptionRow) => void
  /** Called when the user requests an edit */
  onEdit?: (subscription: SubscriptionRow) => void
  /** Called when the user archives a subscription */
  onArchive?: (id: string) => void | Promise<void>
}

/** Sortable column identifiers. */
type SortColumn =
  | 'next_payment_at'
  | 'amount_minor'
  | 'vendor'
  | 'name'
  | 'created_at'

/** Sort direction. */
type SortDir = 'asc' | 'desc'

/** Active filter state. */
interface FilterState {
  status: string
  entityId: string
  category: string
  search: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Status pill colors — MUST match design system spec. */
const STATUS_PILL: Record<
  SubscriptionStatus,
  { bg: string; text: string; label: string }
> = {
  active: { bg: '#1F8A4C', text: '#FFFFFF', label: 'Active' },
  trial: { bg: '#2563EB', text: '#FFFFFF', label: 'Trial' },
  cancelled: { bg: '#A0A0A0', text: '#FFFFFF', label: 'Cancelled' },
  paused: { bg: '#C77700', text: '#FFFFFF', label: 'Paused' },
  expired: { bg: '#B43A2D', text: '#FFFFFF', label: 'Expired' },
  archived: { bg: '#E5E5E5', text: '#6B6B6B', label: 'Archived' },
} as const

/** Billing cycle badge colors. */
const CYCLE_BADGE: Record<string, { bg: string; text: string }> = {
  monthly: { bg: '#E8F5E9', text: '#1F8A4C' },
  yearly: { bg: '#E3F2FD', text: '#2563EB' },
  quarterly: { bg: '#FFF3E0', text: '#C77700' },
  trial: { bg: '#F3E5F5', text: '#7B1FA2' },
  one_time: { bg: '#F5F5F5', text: '#6B6B6B' },
} as const

/** Sort column display labels. */
const SORT_LABELS: Record<SortColumn, string> = {
  next_payment_at: 'Next Payment',
  amount_minor: 'Amount',
  vendor: 'Vendor',
  name: 'Name',
  created_at: 'Created',
} as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the relative time string for a payment date.
 *
 * @param dateStr - ISO date string (YYYY-MM-DD)
 * @returns Human-readable relative time (e.g. "in 3 days", "overdue")
 */
function relativePaymentText(dateStr: string | null): string {
  if (!dateStr) return '—'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const payment = new Date(dateStr + 'T00:00:00')
  const diffMs = payment.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / 86_400_000)

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return `in ${diffDays} days`
}

/**
 * Get a color for the relative payment text.
 *
 * @param dateStr - ISO date string
 * @returns Hex color
 */
function paymentColor(dateStr: string | null): string {
  if (!dateStr) return '#A0A0A0'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const payment = new Date(dateStr + 'T00:00:00')
  const diffDays = Math.round((payment.getTime() - today.getTime()) / 86_400_000)

  if (diffDays < 0) return '#B43A2D'   // overdue → red
  if (diffDays <= 3) return '#C77700'  // due soon → amber
  return '#1F8A4C'                     // future → green
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Sortable, filterable subscription list view.
 *
 * @param props - See {@link SubscriptionListProps}
 * @returns JSX.Element
 */
export function SubscriptionList({
  subscriptions,
  entities,
  onSelect,
  onEdit,
  onArchive,
}: SubscriptionListProps): React.JSX.Element {
  // -- Build entity lookup --------------------------------------------------
  const entityMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entities) map.set(e.id, e.name)
    return map
  }, [entities])

  const subsWithEntity: SubscriptionWithEntity[] = useMemo(
    () =>
      subscriptions.map((sub) => ({
        ...sub,
        entityName: entityMap.get(sub.entity_id) ?? 'Unknown',
      })),
    [subscriptions, entityMap]
  )

  // -- Unique categories for filter -----------------------------------------
  const categories = useMemo(
    () => Array.from(new Set(subsWithEntity.map((s) => s.category))).sort(),
    [subsWithEntity]
  )

  // -- State: sort & filter -------------------------------------------------
  const [sortCol, setSortCol] = useState<SortColumn>('next_payment_at')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filters, setFilters] = useState<FilterState>({
    status: '',
    entityId: '',
    category: '',
    search: '',
  })

  // -- Toggle sort ----------------------------------------------------------
  const handleSort = useCallback(
    (col: SortColumn) => {
      setSortCol((prev) => {
        if (prev === col) {
          setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
          return prev
        }
        setSortDir('asc')
        return col
      })
    },
    []
  )

  // -- Filtered & sorted data -----------------------------------------------
  const filtered = useMemo(() => {
    let rows = [...subsWithEntity]

    // Status filter
    if (filters.status) {
      rows = rows.filter((r) => r.status === filters.status)
    }

    // Entity filter
    if (filters.entityId) {
      rows = rows.filter((r) => r.entity_id === filters.entityId)
    }

    // Category filter
    if (filters.category) {
      rows = rows.filter((r) => r.category === filters.category)
    }

    // Search (name or vendor)
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase()
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.vendor.toLowerCase().includes(q)
      )
    }

    // Sort
    rows.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1

      switch (sortCol) {
        case 'amount_minor':
          return (a.amount_minor - b.amount_minor) * dir
        case 'vendor':
          return a.vendor.localeCompare(b.vendor) * dir
        case 'name':
          return a.name.localeCompare(b.name) * dir
        case 'created_at':
          return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
        case 'next_payment_at':
        default: {
          // Nulls last when ascending, first when descending
          const aNull = a.next_payment_at === null
          const bNull = b.next_payment_at === null
          if (aNull && bNull) return 0
          if (aNull) return sortDir === 'asc' ? 1 : -1
          if (bNull) return sortDir === 'asc' ? -1 : 1
          return (a.next_payment_at! > b.next_payment_at! ? 1 : -1) * dir
        }
      }
    })

    return rows
  }, [subsWithEntity, filters, sortCol, sortDir])

  // -- Counts by status -----------------------------------------------------
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of subsWithEntity) {
      counts[s.status] = (counts[s.status] ?? 0) + 1
    }
    return counts
  }, [subsWithEntity])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Toolbar: filters + search ── */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E6E1',
          borderRadius: '12px',
        }}
      >
        {/* Search */}
        <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
          <input
            type="text"
            placeholder="Search name or vendor..."
            value={filters.search}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value }))
            }
            style={{
              width: '100%',
              height: '40px',
              padding: '0 14px',
              fontSize: '14px',
              border: '1px solid #E5E5E5',
              borderRadius: '8px',
              backgroundColor: '#FAFAF7',
              color: '#181818',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Status filter */}
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          style={{
            height: '40px',
            padding: '0 12px',
            fontSize: '13px',
            border: '1px solid #E5E5E5',
            borderRadius: '8px',
            backgroundColor: '#FAFAF7',
            color: '#181818',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">All Statuses</option>
          {(['active', 'trial', 'paused', 'cancelled', 'expired'] as const).map(
            (s) => (
              <option key={s} value={s}>
                {STATUS_PILL[s].label} ({statusCounts[s] ?? 0})
              </option>
            )
          )}
        </select>

        {/* Entity filter */}
        <select
          value={filters.entityId}
          onChange={(e) => setFilters((f) => ({ ...f, entityId: e.target.value }))}
          style={{
            height: '40px',
            padding: '0 12px',
            fontSize: '13px',
            border: '1px solid #E5E5E5',
            borderRadius: '8px',
            backgroundColor: '#FAFAF7',
            color: '#181818',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">All Entities</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>

        {/* Category filter */}
        <select
          value={filters.category}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          style={{
            height: '40px',
            padding: '0 12px',
            fontSize: '13px',
            border: '1px solid #E5E5E5',
            borderRadius: '8px',
            backgroundColor: '#FAFAF7',
            color: '#181818',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Sort */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#6B6B6B', marginRight: '4px' }}>
            Sort:
          </span>
          {(Object.keys(SORT_LABELS) as SortColumn[]).map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => handleSort(col)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: sortCol === col ? 600 : 400,
                borderRadius: '6px',
                border: '1px solid',
                borderColor: sortCol === col ? '#181818' : '#E5E5E5',
                backgroundColor: sortCol === col ? '#181818' : '#FFFFFF',
                color: sortCol === col ? '#FFFFFF' : '#6B6B6B',
                cursor: 'pointer',
              }}
            >
              {SORT_LABELS[col]}
              {sortCol === col && (sortDir === 'asc' ? ' ↑' : ' ↓')}
            </button>
          ))}
        </div>

        {/* Clear filters */}
        {(filters.status || filters.entityId || filters.category || filters.search) && (
          <button
            type="button"
            onClick={() =>
              setFilters({ status: '', entityId: '', category: '', search: '' })
            }
            style={{
              padding: '0 12px',
              height: '40px',
              fontSize: '13px',
              color: '#6B6B6B',
              backgroundColor: 'transparent',
              border: '1px solid #E5E5E5',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Results count ── */}
      <div
        style={{
          fontSize: '13px',
          color: '#6B6B6B',
          marginBottom: '12px',
          padding: '0 4px',
        }}
      >
        Showing <strong style={{ color: '#181818' }}>{filtered.length}</strong> of{' '}
        {subscriptions.length} subscriptions
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
        {/* Header row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 100px 120px 100px 90px',
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
          <div style={{ textAlign: 'right' }}>Amount</div>
          <div>Cycle</div>
          <div>Next Payment</div>
          <div>Entity</div>
          <div>Status</div>
        </div>

        {/* Data rows */}
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          filtered.map((sub) => (
            <SubscriptionRowView
              key={sub.id}
              subscription={sub}
              onSelect={onSelect}
              onEdit={onEdit}
              onArchive={onArchive}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row sub-component
// ---------------------------------------------------------------------------

/**
 * Single subscription row in the list.
 */
function SubscriptionRowView({
  subscription: sub,
  onSelect,
  onEdit,
  onArchive,
}: {
  subscription: SubscriptionWithEntity
  onSelect?: (sub: SubscriptionRow) => void
  onEdit?: (sub: SubscriptionRow) => void
  onArchive?: (id: string) => void | Promise<void>
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)

  const statusPill = STATUS_PILL[sub.status]
  const cycleBadge = CYCLE_BADGE[sub.billing_cycle] ?? CYCLE_BADGE.monthly

  const handleClick = useCallback(() => {
    onSelect?.(sub)
  }, [onSelect, sub])

  const handleArchive = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (window.confirm(`Archive "${sub.name}"? This can be undone later.`)) {
        await onArchive?.(sub.id)
      }
      setMenuOpen(false)
    },
    [onArchive, sub.id, sub.name]
  )

  return (
    <div
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      role="button"
      tabIndex={0}
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 100px 120px 90px 100px',
        gap: '12px',
        padding: '14px 20px',
        borderBottom: '1px solid #F0EEEA',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'background-color 0.1s ease',
        alignItems: 'center',
      }}
      onMouseEnter={(e) => {
        if (onSelect) e.currentTarget.style.backgroundColor = '#FAFAF7'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#FFFFFF'
      }}
    >
      {/* Name + plan */}
      <div>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#181818',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {sub.name}
        </div>
        {sub.plan && (
          <div
            style={{
              fontSize: '12px',
              color: '#6B6B6B',
              marginTop: '2px',
            }}
          >
            {sub.plan}
          </div>
        )}
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

      {/* Amount */}
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '14px',
          fontWeight: 500,
          color: '#181818',
          textAlign: 'right',
        }}
      >
        {formatAmount(sub.amount_minor, sub.currency)}
      </div>

      {/* Billing cycle badge */}
      <div>
        <span
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: cycleBadge.bg,
            color: cycleBadge.text,
          }}
        >
          {sub.billing_cycle}
        </span>
      </div>

      {/* Next payment */}
      <div>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: paymentColor(sub.next_payment_at),
          }}
        >
          {sub.next_payment_at ?? '—'}
        </div>
        <div style={{ fontSize: '11px', color: '#A0A0A0', marginTop: '2px' }}>
          {relativePaymentText(sub.next_payment_at)}
        </div>
      </div>

      {/* Entity */}
      <div
        style={{
          fontSize: '12px',
          color: '#6B6B6B',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {sub.entityName}
      </div>

      {/* Status pill + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor: statusPill.bg,
            color: statusPill.text,
            whiteSpace: 'nowrap',
          }}
        >
          {statusPill.label}
        </span>

        {/* Action menu */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((v) => !v)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#A0A0A0',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '2px 6px',
            }}
          >
            ⋮
          </button>
          {menuOpen && (
            <>
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 40,
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  zIndex: 50,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E8E6E1',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  minWidth: '140px',
                  marginTop: '4px',
                  overflow: 'hidden',
                }}
              >
                {onEdit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(sub)
                      setMenuOpen(false)
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '13px',
                      textAlign: 'left',
                      backgroundColor: '#FFFFFF',
                      border: 'none',
                      color: '#181818',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#FAFAF7'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#FFFFFF'
                    }}
                  >
                    Edit
                  </button>
                )}
                {onArchive && (
                  <button
                    type="button"
                    onClick={handleArchive}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '13px',
                      textAlign: 'left',
                      backgroundColor: '#FFFFFF',
                      border: 'none',
                      color: '#B43A2D',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#FFF5F5'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#FFFFFF'
                    }}
                  >
                    Archive
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

/** Rendered when no subscriptions match the current filters. */
function EmptyState(): React.JSX.Element {
  return (
    <div
      style={{
        padding: '48px 20px',
        textAlign: 'center',
        color: '#A0A0A0',
      }}
    >
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
      <div style={{ fontSize: '15px', fontWeight: 500, color: '#6B6B6B', marginBottom: '4px' }}>
        No subscriptions found
      </div>
      <div style={{ fontSize: '13px' }}>
        Try adjusting your filters or create a new subscription
      </div>
    </div>
  )
}
