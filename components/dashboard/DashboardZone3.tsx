/**
 * JK Zentra Finance Cockpit — Dashboard Zone 3 (Spend Breakdown)
 * Sprint 1
 *
 * The bottom section of the dashboard: a three-column grid showing spend
 * patterns and recent activity. Answers "Where did the money go?" and
 * "What just happened?"
 *
 * Columns:
 *   1. Top Categories — horizontal bar chart of spend by category
 *   2. Top Vendors — ranked list of vendors by spend amount
 *   3. Recent Transactions — last 7 transactions with type colour-coding
 *
 * Layout:
 *   - Desktop (>=769px): 3-column grid
 *   - Mobile (<=768px):  single column stack
 *
 * Each column is a white card with 1px border, 12px radius. Category bars
 * use JK Zentra orange (#F37002) and Personal grey (#6B6B6B). Transaction
 * amounts are green for income, dark for expenses.
 *
 * @module components/dashboard/DashboardZone3
 */

import Link from 'next/link'
import { getDashboardBreakdown } from '../../lib/actions/dashboardZone3'
import { formatAmount } from '../../lib/utils/currency'
import type { CategoryBreakdownItem, VendorBreakdownItem, RecentTransactionItem } from '../../lib/actions/dashboardZone3'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format an ISO date string to a compact display format.
 */
function formatDate(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
  })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Top Categories column — horizontal bar chart.
 */
function TopCategoriesColumn({
  categories,
}: {
  categories: CategoryBreakdownItem[]
}): JSX.Element {
  if (categories.length === 0) {
    return (
      <div style={{ color: '#A0A0A0', fontSize: '13px', padding: '16px 0' }}>
        No expense data this month
      </div>
    )
  }

  const maxAmount = categories[0]?.amount_minor ?? 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {categories.map((cat, idx) => {
        const isOther = cat.category === 'Other'
        const barWidth = maxAmount > 0 ? (cat.amount_minor / maxAmount) * 100 : 0

        return (
          <div key={cat.category}>
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
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: '13px',
                  fontWeight: isOther ? 400 : 500,
                  color: isOther ? '#A0A0A0' : '#181818',
                }}
              >
                {cat.category}
              </span>
              <span
                style={{
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  fontSize: '12px',
                  color: isOther ? '#A0A0A0' : '#181818',
                }}
              >
                {formatAmount(cat.amount_minor, 'MYR')}
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '6px',
                background: '#F0EFEA',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${barWidth}%`,
                  height: '100%',
                  background: isOther ? '#D0CFC9' : idx === 0 ? '#F37002' : '#6B6B6B',
                  borderRadius: '3px',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Top Vendors column — simple ranked list.
 */
function TopVendorsColumn({
  vendors,
}: {
  vendors: VendorBreakdownItem[]
}): JSX.Element {
  if (vendors.length === 0) {
    return (
      <div style={{ color: '#A0A0A0', fontSize: '13px', padding: '16px 0' }}>
        No vendor data this month
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {vendors.map((v) => (
        <div
          key={v.vendor}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 0',
            borderBottom: '1px solid #F0EFEA',
          }}
        >
          <div>
            <span
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                color: '#181818',
              }}
            >
              {v.vendor}
            </span>
            <span
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '11px',
                color: '#A0A0A0',
                marginLeft: '6px',
              }}
            >
              {v.count} tx{v.count !== 1 ? 's' : ''}
            </span>
          </div>
          <span
            style={{
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              fontSize: '13px',
              color: '#181818',
            }}
          >
            {formatAmount(v.amount_minor, 'MYR')}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Recent Transactions column — mini list with colour coding.
 */
function RecentTransactionsColumn({
  transactions,
}: {
  transactions: RecentTransactionItem[]
}): JSX.Element {
  if (transactions.length === 0) {
    return (
      <div style={{ color: '#A0A0A0', fontSize: '13px', padding: '16px 0' }}>
        No recent transactions
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {transactions.map((t) => {
        const isIncome = t.type === 'income'
        const amountColor = isIncome ? '#1F8A4C' : '#181818'

        return (
          <Link
            key={t.id}
            href={`/ledger/${t.id}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid #F0EFEA',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'background 0.15s ease',
            }}
            className="recent-txn-row"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span
                style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#181818',
                }}
              >
                {t.vendor}
              </span>
              <span
                style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: '11px',
                  color: '#A0A0A0',
                }}
              >
                {formatDate(t.occurred_at)} · {t.category}
              </span>
            </div>
            <span
              style={{
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: '13px',
                fontWeight: 600,
                color: amountColor,
              }}
            >
              {isIncome ? '+' : '-'}
              {formatAmount(t.amount_minor, t.currency)}
            </span>
          </Link>
        )
      })}

      {/* View all link */}
      <div style={{ marginTop: '8px', textAlign: 'right' }}>
        <Link
          href="/ledger"
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            color: '#F37002',
            textDecoration: 'none',
          }}
        >
          View all →
        </Link>
      </div>

      <style jsx>{`
        .recent-txn-row:hover {
          background: #FAFAF7;
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * Dashboard Zone 3 — Spend breakdown section.
 *
 * Fetches breakdown data server-side and renders three columns:
 * top categories, top vendors, and recent transactions.
 *
 * @returns JSX.Element
 */
export async function DashboardZone3(): Promise<JSX.Element> {
  const breakdown = await getDashboardBreakdown()

  return (
    <section
      aria-label="Spend breakdown"
      style={{
        width: '100%',
        marginBottom: '24px',
      }}
    >
      <div
        className="zone3-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        {/* Column 1: Top Categories */}
        <article
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8E6E1',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <header
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: '#6B6B6B',
              marginBottom: '16px',
            }}
          >
            Top Categories
          </header>
          <TopCategoriesColumn categories={breakdown.top_categories} />
        </article>

        {/* Column 2: Top Vendors */}
        <article
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8E6E1',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <header
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: '#6B6B6B',
              marginBottom: '16px',
            }}
          >
            Top Vendors
          </header>
          <TopVendorsColumn vendors={breakdown.top_vendors} />
        </article>

        {/* Column 3: Recent Transactions */}
        <article
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8E6E1',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <header
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: '#6B6B6B',
              marginBottom: '16px',
            }}
          >
            Last 7 Transactions
          </header>
          <RecentTransactionsColumn transactions={breakdown.recent_transactions} />
        </article>
      </div>

      {/* Responsive styles */}
      <style jsx>{`
        @media (max-width: 768px) {
          .zone3-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}
