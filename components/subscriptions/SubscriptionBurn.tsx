/**
 * ============================================================================
 * SubscriptionBurn — Monthly Burn Calculation & Category Breakdown
 * ============================================================================
 *
 * Third tab of the Subscription Command Center. Computes and displays the
 * total monthly burn across all active subscriptions, normalised to MYR.
 *
 * Normalisation formula:
 *   monthly  = full amount
 *   yearly   = amount ÷ 12
 *   quarterly= amount ÷ 3
 *   trial    = 0
 *   one_time = 0
 *
 * Displays:
 *   - Big number: "RM 1,247/month"
 *   - Annual commitment: "RM 14,964/year"
 *   - Per-subscription breakdown table
 *   - Per-category horizontal bar chart
 *   - Entity split (Personal vs JK Zentra)
 *
 * All amounts use INTEGER minor units internally, formatted for display
 * via {@link formatAmount}.
 *
 * @example
 * <SubscriptionBurn
 *   subscriptions={activeSubs}
 *   entities={[{ id: '...', name: 'Personal' }, { id: '...', name: 'JK Zentra' }]}
 * />
 */

'use client'

import React, { useMemo } from 'react'
import type { SubscriptionRow, BillingCycle } from '@/lib/supabase/database.types'
import { formatAmount } from '@/lib/utils/currency'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for the SubscriptionBurn component. */
interface SubscriptionBurnProps {
  /** Active subscription rows */
  subscriptions: SubscriptionRow[]
  /** Entity lookup for display names */
  entities: Array<{ id: string; name: string }>
  /** Optional hard-coded FX rates for non-MYR currencies */
  fxRates?: Record<string, number>
}

/** A single subscription's contribution to the burn calculation. */
interface BurnLineItem {
  id: string
  name: string
  vendor: string
  category: string
  entityId: string
  entityName: string
  billingCycle: BillingCycle
  amountMinor: number
  currency: string
  /** Monthly MYR-equivalent minor units */
  monthlyMyrMinor: number
  /** Percentage of total monthly burn */
  percentOfTotal: number
}

/** Category aggregate for the bar chart. */
interface CategoryBurn {
  category: string
  monthlyMyrMinor: number
  percentOfTotal: number
  /** Bar color — derived from category hash */
  barColor: string
}

/** Entity aggregate for the split view. */
interface EntityBurn {
  entityId: string
  entityName: string
  monthlyMyrMinor: number
  percentOfTotal: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Hard-coded FX rates: 1 unit of foreign currency = N MYR. */
const DEFAULT_FX_RATES: Record<string, number> = {
  MYR: 1,
  USD: 4.45,
  SGD: 3.35,
  EUR: 4.85,
  GBP: 5.65,
} as const

/** Billing-cycle divisor for monthly normalisation. */
const CYCLE_DIVISOR: Record<BillingCycle, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
  trial: 0,
  one_time: 0,
} as const

/** Pre-defined category bar colours (cycled). */
const CATEGORY_COLORS = [
  '#1F8A4C', // green
  '#2563EB', // blue
  '#C77700', // amber
  '#7B1FA2', // purple
  '#B43A2D', // red
  '#00838F', // teal
  '#5C6BC0', // indigo
  '#E64A19', // deep orange
  '#388E3C', // dark green
  '#1976D2', // dark blue
  '#F57C00', // dark amber
  '#6A1B9A', // dark purple
] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a foreign-currency amount to MYR minor units.
 *
 * @param amountMinor - Amount in source currency minor units
 * @param currency - Source currency code
 * @param fxRates - FX rate lookup
 * @returns Equivalent MYR minor units
 */
function toMyrMinor(
  amountMinor: number,
  currency: string,
  fxRates: Record<string, number>
): number {
  if (currency === 'MYR') return amountMinor
  const rate = fxRates[currency] ?? 1
  return Math.round(amountMinor * rate)
}

/**
 * Normalise a subscription amount to monthly MYR-equivalent minor units.
 *
 * @param amountMinor - Subscription amount in minor units
 * @param currency - Subscription currency
 * @param billingCycle - Subscription billing cycle
 * @param fxRates - FX rate lookup
 * @returns Monthly MYR-equivalent minor units
 */
function normalizeMonthlyMyr(
  amountMinor: number,
  currency: string,
  billingCycle: BillingCycle,
  fxRates: Record<string, number>
): number {
  if (billingCycle === 'trial' || billingCycle === 'one_time') return 0
  const myrAmount = toMyrMinor(amountMinor, currency, fxRates)
  return Math.round(myrAmount / CYCLE_DIVISOR[billingCycle])
}

/**
 * Pick a deterministic colour for a category name.
 */
function categoryColor(category: string): string {
  let hash = 0
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash)
  }
  const idx = Math.abs(hash) % CATEGORY_COLORS.length
  return CATEGORY_COLORS[idx]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Burn calculation view with big numbers, breakdown table, and category bars.
 *
 * @param props - See {@link SubscriptionBurnProps}
 * @returns JSX.Element
 */
export function SubscriptionBurn({
  subscriptions,
  entities,
  fxRates = DEFAULT_FX_RATES,
}: SubscriptionBurnProps): React.JSX.Element {
  // -- Build entity lookup --------------------------------------------------
  const entityMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entities) map.set(e.id, e.name)
    return map
  }, [entities])

  // -- Compute burn line items ----------------------------------------------
  const lineItems: BurnLineItem[] = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === 'active')

    const items = active.map((sub) => {
      const monthlyMyrMinor = normalizeMonthlyMyr(
        sub.amount_minor,
        sub.currency,
        sub.billing_cycle,
        fxRates
      )

      return {
        id: sub.id,
        name: sub.name,
        vendor: sub.vendor,
        category: sub.category,
        entityId: sub.entity_id,
        entityName: entityMap.get(sub.entity_id) ?? 'Unknown',
        billingCycle: sub.billing_cycle,
        amountMinor: sub.amount_minor,
        currency: sub.currency,
        monthlyMyrMinor,
        percentOfTotal: 0, // filled after total known
      }
    })

    const total = items.reduce((sum, i) => sum + i.monthlyMyrMinor, 0)

    return items
      .map((item) => ({
        ...item,
        percentOfTotal: total > 0 ? (item.monthlyMyrMinor / total) * 100 : 0,
      }))
      .sort((a, b) => b.monthlyMyrMinor - a.monthlyMyrMinor)
  }, [subscriptions, fxRates, entityMap])

  // -- Totals ---------------------------------------------------------------
  const monthlyBurnMinor = useMemo(
    () => lineItems.reduce((sum, i) => sum + i.monthlyMyrMinor, 0),
    [lineItems]
  )
  const annualCommitmentMinor = monthlyBurnMinor * 12
  const subscriptionCount = lineItems.filter((i) => i.monthlyMyrMinor > 0).length

  // -- Category breakdown ---------------------------------------------------
  const categoryBurns: CategoryBurn[] = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of lineItems) {
      const current = map.get(item.category) ?? 0
      map.set(item.category, current + item.monthlyMyrMinor)
    }

    const total = monthlyBurnMinor
    const rows = Array.from(map.entries())
      .map(([category, monthlyMyrMinor]) => ({
        category,
        monthlyMyrMinor,
        percentOfTotal: total > 0 ? (monthlyMyrMinor / total) * 100 : 0,
        barColor: categoryColor(category),
      }))
      .sort((a, b) => b.monthlyMyrMinor - a.monthlyMyrMinor)

    return rows
  }, [lineItems, monthlyBurnMinor])

  // -- Entity split ---------------------------------------------------------
  const entityBurns: EntityBurn[] = useMemo(() => {
    const map = new Map<string, { name: string; amount: number }>()
    for (const item of lineItems) {
      const existing = map.get(item.entityId)
      if (existing) {
        existing.amount += item.monthlyMyrMinor
      } else {
        map.set(item.entityId, { name: item.entityName, amount: item.monthlyMyrMinor })
      }
    }

    const total = monthlyBurnMinor
    return Array.from(map.entries())
      .map(([entityId, { name, amount }]) => ({
        entityId,
        entityName: name,
        monthlyMyrMinor: amount,
        percentOfTotal: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.monthlyMyrMinor - a.monthlyMyrMinor)
  }, [lineItems, monthlyBurnMinor])

  // -- FX notice ------------------------------------------------------------
  const hasForeignCurrency = useMemo(
    () => lineItems.some((i) => i.currency !== 'MYR'),
    [lineItems]
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Big Numbers ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {/* Monthly burn */}
        <StatCard
          label="Monthly Burn"
          amountMinor={monthlyBurnMinor}
          currency="MYR"
          subtitle={`${subscriptionCount} active subscription${subscriptionCount !== 1 ? 's' : ''}`}
          highlight
        />

        {/* Annual commitment */}
        <StatCard
          label="Annual Commitment"
          amountMinor={annualCommitmentMinor}
          currency="MYR"
          subtitle="Projected yearly spend"
        />

        {/* Average per sub */}
        <StatCard
          label="Avg. per Subscription"
          amountMinor={subscriptionCount > 0 ? Math.round(monthlyBurnMinor / subscriptionCount) : 0}
          currency="MYR"
          subtitle="Monthly average"
        />
      </div>

      {/* FX notice */}
      {hasForeignCurrency && (
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: '#FFF8E1',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '12px',
            color: '#C77700',
          }}
        >
          💱 Foreign currencies converted using cached FX rates. Go to Settings → FX to refresh.
        </div>
      )}

      {/* ── Two-column layout: breakdown + categories ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
        }}
      >
        {/* Left: Breakdown table */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E8E6E1',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E8E6E1',
              fontSize: '15px',
              fontWeight: 600,
              color: '#181818',
            }}
          >
            Per-Subscription Breakdown
          </div>

          {lineItems.length === 0 ? (
            <EmptyBurnState message="No active subscriptions" />
          ) : (
            <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
              {lineItems.map((item) => (
                <BurnLine key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Right: Category bars + entity split */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Category breakdown */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E8E6E1',
              borderRadius: '12px',
              padding: '16px 20px',
            }}
          >
            <div
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#181818',
                marginBottom: '16px',
              }}
            >
              By Category
            </div>

            {categoryBurns.length === 0 ? (
              <EmptyBurnState message="No data" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {categoryBurns.map((cat) => (
                  <CategoryBar key={cat.category} category={cat} />
                ))}
              </div>
            )}
          </div>

          {/* Entity split */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E8E6E1',
              borderRadius: '12px',
              padding: '16px 20px',
            }}
          >
            <div
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#181818',
                marginBottom: '16px',
              }}
            >
              By Entity
            </div>

            {entityBurns.length === 0 ? (
              <EmptyBurnState message="No data" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {entityBurns.map((ent) => (
                  <EntityBar key={ent.entityId} entity={ent} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

/** Big-number stat card for the burn summary. */
function StatCard({
  label,
  amountMinor,
  currency,
  subtitle,
  highlight = false,
}: {
  label: string
  amountMinor: number
  currency: string
  subtitle: string
  highlight?: boolean
}): React.JSX.Element {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E8E6E1',
        borderRadius: '12px',
        padding: '20px',
        borderLeft: highlight ? '4px solid #1F8A4C' : '1px solid #E8E6E1',
      }}
    >
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#6B6B6B',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '8px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '28px',
          fontWeight: 700,
          color: '#181818',
          marginBottom: '6px',
        }}
      >
        {formatAmount(amountMinor, currency)}
        <span style={{ fontSize: '14px', fontWeight: 400, color: '#6B6B6B', marginLeft: '4px' }}>
          /mo
        </span>
      </div>
      <div style={{ fontSize: '12px', color: '#A0A0A0' }}>{subtitle}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Burn line item
// ---------------------------------------------------------------------------

/** Single row in the per-subscription breakdown. */
function BurnLine({ item }: { item: BurnLineItem }): React.JSX.Element {
  const cycleLabels: Record<BillingCycle, string> = {
    monthly: '/mo',
    yearly: '/yr',
    quarterly: '/qtr',
    trial: 'trial',
    one_time: '1x',
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 90px 100px 60px',
        gap: '10px',
        alignItems: 'center',
        padding: '12px 20px',
        borderBottom: '1px solid #F0EEEA',
      }}
    >
      {/* Name + vendor */}
      <div>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#181818',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.name}
        </div>
        <div style={{ fontSize: '11px', color: '#A0A0A0', marginTop: '2px' }}>
          {item.vendor} · {item.entityName}
        </div>
      </div>

      {/* Original amount */}
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '12px',
          color: '#6B6B6B',
          textAlign: 'right',
        }}
      >
        {formatAmount(item.amountMinor, item.currency)}
        <span style={{ fontSize: '10px', color: '#A0A0A0' }}>{cycleLabels[item.billingCycle]}</span>
      </div>

      {/* Monthly MYR */}
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '13px',
          fontWeight: 600,
          color: '#181818',
          textAlign: 'right',
        }}
      >
        {formatAmount(item.monthlyMyrMinor, 'MYR')}
      </div>

      {/* Percent */}
      <div
        style={{
          fontSize: '11px',
          color: '#A0A0A0',
          textAlign: 'right',
        }}
      >
        {item.percentOfTotal.toFixed(1)}%
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category bar
// ---------------------------------------------------------------------------

/** Horizontal bar for a category's burn contribution. */
function CategoryBar({ category }: { category: CategoryBurn }): React.JSX.Element {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#181818',
          }}
        >
          {category.category}
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            color: '#6B6B6B',
          }}
        >
          {formatAmount(category.monthlyMyrMinor, 'MYR')}
        </span>
      </div>
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: '#F0EEEA',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(category.percentOfTotal, 100)}%`,
            height: '100%',
            backgroundColor: category.barColor,
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div
        style={{
          fontSize: '11px',
          color: '#A0A0A0',
          marginTop: '2px',
          textAlign: 'right',
        }}
      >
        {category.percentOfTotal.toFixed(1)}%
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Entity bar
// ---------------------------------------------------------------------------

/** Horizontal bar for an entity's burn contribution. */
function EntityBar({ entity }: { entity: EntityBurn }): React.JSX.Element {
  const barColor = entity.entityName === 'JK Zentra' ? '#F37002' : '#6B6B6B'

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#181818',
          }}
        >
          {entity.entityName}
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            color: '#6B6B6B',
          }}
        >
          {formatAmount(entity.monthlyMyrMinor, 'MYR')}
        </span>
      </div>
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: '#F0EEEA',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(entity.percentOfTotal, 100)}%`,
            height: '100%',
            backgroundColor: barColor,
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div
        style={{
          fontSize: '11px',
          color: '#A0A0A0',
          marginTop: '2px',
          textAlign: 'right',
        }}
      >
        {entity.percentOfTotal.toFixed(1)}%
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

/** Displayed when there's no burn data to show. */
function EmptyBurnState({ message }: { message: string }): React.JSX.Element {
  return (
    <div
      style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: '#A0A0A0',
        fontSize: '13px',
      }}
    >
      {message}
    </div>
  )
}
