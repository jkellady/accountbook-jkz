/**
 * JK Zentra Finance Cockpit — Tax Position Glance Widget
 * Dashboard Zone 2 — Tax Position
 *
 * Displays a one-glance summary of the user's tax standing:
 *   - CP500 status pill (overpaying / underpaying / on-track)
 *   - Next CP500 due date and amount
 *   - Tax reserve balance
 *   - Quick verdict sentence
 *
 * @module components/dashboard/TaxPositionGlance
 */

import Link from 'next/link'
import { Shield, ChevronRight } from 'lucide-react'
import { getTaxPositionGlance } from '@/lib/actions/dashboard'
import { formatAmount } from '@/lib/utils/currency'
import type { TaxVerdictStatus } from '@/lib/actions/dashboard'

// ---------------------------------------------------------------------------
// Colour mapping for verdict pills
// ---------------------------------------------------------------------------

const PILL_STYLES: Record<
  TaxVerdictStatus,
  { bg: string; text: string; label: string }
> = {
  overpaying: {
    bg: '#E8F5E9',
    text: '#1F8A4C',
    label: 'Overpaying',
  },
  underpaying: {
    bg: '#FDECEA',
    text: '#B43A2D',
    label: 'Underpaying',
  },
  on_track: {
    bg: '#E3F2FD',
    text: '#1565C0',
    label: 'On track',
  },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Tax Position Glance — tax summary widget for the dashboard.
 *
 * Fetches the user's tax position server-side and renders a card with
 * a status pill, next CP500 details, reserve balance, and a verdict.
 *
 * @returns JSX.Element
 */
export async function TaxPositionGlance(): Promise<JSX.Element> {
  const {
    verdict,
    nextCp500Date,
    nextCp500AmountMinor,
    taxReserveMinor,
    status,
  } = await getTaxPositionGlance()

  const pill = PILL_STYLES[status]
  const hasCp500 = nextCp500Date !== null && nextCp500AmountMinor !== null

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
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Shield size={16} color="#6B6B6B" strokeWidth={2} />
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
            Tax Position
          </h3>
        </div>

        {/* Status pill */}
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: pill.bg,
            color: pill.text,
            padding: '3px 10px',
            borderRadius: '999px',
            whiteSpace: 'nowrap',
          }}
        >
          {pill.label}
        </span>
      </div>

      {/* ---- Next CP500 ---- */}
      {hasCp500 ? (
        <div style={{ marginBottom: '14px' }}>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '12px',
              color: '#A0A0A0',
              margin: '0 0 4px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Next CP500
          </p>
          <p
            style={{
              fontFamily: 'Fraunces, serif',
              fontSize: '22px',
              fontWeight: 600,
              color: '#181818',
              margin: '0 0 4px 0',
              lineHeight: 1.2,
            }}
          >
            {formatAmount(nextCp500AmountMinor ?? 0, 'MYR')}
          </p>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              color: '#6B6B6B',
              margin: 0,
            }}
          >
            Due{' '}
            {new Date(nextCp500Date as string).toLocaleDateString('en-MY', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      ) : (
        <div style={{ marginBottom: '14px' }}>
          <p
            style={{
              fontFamily: 'Fraunces, serif',
              fontSize: '20px',
              fontWeight: 600,
              color: '#181818',
              margin: '0 0 4px 0',
              lineHeight: 1.2,
            }}
          >
            No pending CP500
          </p>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              color: '#A0A0A0',
              margin: 0,
            }}
          >
            All instalments paid for this tax year.
          </p>
        </div>
      )}

      {/* ---- Tax Reserve ---- */}
      <div
        style={{
          borderTop: '1px solid #F0EFEC',
          paddingTop: '12px',
          marginBottom: '12px',
        }}
      >
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '12px',
            color: '#A0A0A0',
            margin: '0 0 4px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Tax Reserve
        </p>
        <p
          style={{
            fontFamily: 'Fraunces, serif',
            fontSize: '20px',
            fontWeight: 600,
            color: '#181818',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {formatAmount(taxReserveMinor, 'MYR')}
        </p>
      </div>

      {/* ---- Verdict sentence ---- */}
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '13px',
          color: '#6B6B6B',
          margin: '0 0 16px 0',
          fontStyle: 'italic',
          lineHeight: 1.4,
        }}
      >
        {verdict}
      </p>

      {/* ---- Footer link ---- */}
      <div style={{ marginTop: 'auto' }}>
        <Link
          href="/tax-position"
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
          View details
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  )
}
