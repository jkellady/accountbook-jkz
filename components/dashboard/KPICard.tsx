/**
 * JK Zentra Finance Cockpit — KPICard
 * Sprint 1
 *
 * Reusable KPI card component for the Zone 1 strip. Displays a labelled metric
 * with optional delta badge, subtitle, and bottom strip. Used by all four KPI
 * cards (Spend MTD, Income MTD, Net Cash Flow, Review Queue).
 *
 * Design:
 *   - White background, 1px solid #E8E6E1 border, 12px radius
 *   - Label: 11px uppercase, #6B6B6B, letter-spacing 0.18em
 *   - Value: JetBrains Mono 36px desktop / 28px mobile, #181818
 *   - Subtitle: 13px, #A0A0A0
 *   - Delta badge: green (#1F8A4C) or red (#B43A2D) pill
 *   - Bottom strip: split bar or source names
 *   - Hover: border → #181818, translateY(-1px)
 *
 * @module components/dashboard/KPICard
 */

import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Delta badge variant — drives pill colour. */
type DeltaVariant = 'positive' | 'negative' | 'neutral'

/** Props for the KPICard component. */
export interface KPICardProps {
  /** Short uppercase label (e.g. "SPEND MTD"). */
  label: string
  /** Primary metric value as a pre-formatted string (e.g. "RM 1,250.00"). */
  value: string
  /** Optional subtitle text (e.g. "vs last month: +12%"). */
  subtitle?: string
  /** Optional delta badge text and variant. */
  delta?: {
    text: string
    variant: DeltaVariant
  }
  /** Optional bottom strip — split bar data (Personal vs JK Zentra). */
  splitBar?: {
    personal_minor: number
    jk_zentra_minor: number
    personal_label?: string
    jk_zentra_label?: string
  }
  /** Optional bottom strip — list of source names. */
  sourceNames?: string[]
  /** Navigation href when the card is clicked. */
  href: string
  /** Optional orange badge count (e.g. review queue count). */
  badgeCount?: number
  /** Optional action link text (e.g. "Review now →"). */
  actionLink?: {
    text: string
    href: string
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format minor units for the split bar tooltip display.
 */
function formatMinor(minor: number): string {
  const major = minor / 100
  return major.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Reusable KPI card for the dashboard Zone 1 strip.
 *
 * Renders a metric with label, optional delta badge, optional bottom strip,
 * and click navigation. Hover state darkens the border and lifts slightly.
 *
 * @param props - KPICardProps
 * @returns JSX.Element
 */
export function KPICard({
  label,
  value,
  subtitle,
  delta,
  splitBar,
  sourceNames,
  href,
  badgeCount,
  actionLink,
}: KPICardProps): JSX.Element {
  const totalSplit = (splitBar?.personal_minor ?? 0) + (splitBar?.jk_zentra_minor ?? 0)
  const personalPct =
    totalSplit > 0
      ? Math.round(((splitBar?.personal_minor ?? 0) / totalSplit) * 100)
      : 50

  const deltaBg: Record<DeltaVariant, string> = {
    positive: '#E8F5E9',
    negative: '#FDEDEC',
    neutral: '#F5F5F5',
  }

  const deltaColor: Record<DeltaVariant, string> = {
    positive: '#1F8A4C',
    negative: '#B43A2D',
    neutral: '#6B6B6B',
  }

  return (
    <Link
      href={href}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <article
        className="kpi-card hover:border-dark hover:-translate-y-px transition-all"
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E6E1',
          borderRadius: '12px',
          padding: '20px',
          cursor: 'pointer',
          transition: 'border-color 0.2s ease, transform 0.2s ease',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Top: Label */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}
        >
          <span
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: '#6B6B6B',
            }}
          >
            {label}
          </span>
          {badgeCount !== undefined && badgeCount > 0 && (
            <span
              style={{
                background: '#F37002',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px',
                minWidth: '20px',
                textAlign: 'center',
              }}
            >
              {badgeCount}
            </span>
          )}
        </header>

        {/* Middle: Value */}
        <div style={{ marginBottom: '4px' }}>
          <span
            className="kpi-value text-[28px] md:text-4xl"
          >
            {value}
          </span>
        </div>

        {/* Subtitle + Delta */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '12px',
          }}
        >
          {subtitle && (
            <span
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '13px',
                color: '#A0A0A0',
              }}
            >
              {subtitle}
            </span>
          )}
          {delta && (
            <span
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                background: deltaBg[delta.variant],
                color: deltaColor[delta.variant],
              }}
            >
              {delta.text}
            </span>
          )}
        </div>

        {/* Action link */}
        {actionLink && (
          <div style={{ marginBottom: '12px' }}>
            <span
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                color: '#F37002',
              }}
            >
              {actionLink.text}
            </span>
          </div>
        )}

        {/* Bottom strip: Split bar */}
        {splitBar && totalSplit > 0 && (
          <div style={{ marginTop: 'auto' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#A0A0A0',
                marginBottom: '4px',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              <span>{splitBar.personal_label ?? 'Personal'}</span>
              <span>{splitBar.jk_zentra_label ?? 'JK Zentra'}</span>
            </div>
            <div
              style={{
                display: 'flex',
                height: '4px',
                borderRadius: '2px',
                overflow: 'hidden',
                background: '#F0EFEA',
              }}
              title={`Personal: RM ${formatMinor(splitBar.personal_minor)} | JK Zentra: RM ${formatMinor(splitBar.jk_zentra_minor)}`}
            >
              <div
                style={{
                  width: `${personalPct}%`,
                  background: '#6B6B6B',
                  transition: 'width 0.3s ease',
                }}
              />
              <div
                style={{
                  width: `${100 - personalPct}%`,
                  background: '#F37002',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Bottom strip: Source names */}
        {sourceNames && sourceNames.length > 0 && (
          <div
            style={{
              marginTop: 'auto',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
            }}
          >
            {sourceNames.map((name) => (
              <span
                key={name}
                style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: '11px',
                  color: '#A0A0A0',
                  background: '#F5F5F0',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </article>


    </Link>
  )
}
