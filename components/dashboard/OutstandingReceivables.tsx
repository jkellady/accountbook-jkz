/**
 * JK Zentra Finance Cockpit — Outstanding Receivables Widget
 * Dashboard Zone 2 — Receivables
 *
 * Displays how much the business is owed across active projects.
 * Shows total outstanding, project count, and the top 3 projects by
 * outstanding balance with client name and amount.
 *
 * Outstanding = project.total_value_minor - SUM(income transactions)
 *
 * @module components/dashboard/OutstandingReceivables
 */

import Link from 'next/link'
import { Banknote, ChevronRight } from 'lucide-react'
import { getOutstandingReceivables } from '@/lib/actions/dashboard'
import { formatAmount } from '@/lib/utils/currency'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Outstanding Receivables — receivables summary widget for the dashboard.
 *
 * Fetches outstanding balances server-side and renders a card with total
 * owed, active project count, and a list of top projects.
 *
 * @returns JSX.Element
 */
export async function OutstandingReceivables(): Promise<JSX.Element> {
  const { totalMinor, count, topProjects } = await getOutstandingReceivables()

  const primaryCurrency = topProjects[0]?.currency ?? 'MYR'
  const hasReceivables = count > 0

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
        <Banknote size={16} color="#6B6B6B" strokeWidth={2} />
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
          Outstanding
        </h3>
      </div>

      {!hasReceivables ? (
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
          <Banknote size={28} color="#A0A0A0" strokeWidth={1.5} />
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              color: '#A0A0A0',
              margin: 0,
            }}
          >
            All caught up. Every project paid in full.
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
              across {count} active project{count !== 1 ? 's' : ''}
            </p>
          </div>

          {/* ---- Project list ---- */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              flex: 1,
            }}
          >
            {topProjects.map(
              (project: {
                id: string
                name: string
                client: string
                outstandingMinor: number
                currency: string
              }) => (
                <div
                  key={project.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
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
                      title={project.name}
                    >
                      {project.name}
                    </span>
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '12px',
                        color: '#A0A0A0',
                      }}
                    >
                      {project.client}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#181818',
                      flexShrink: 0,
                    }}
                  >
                    {formatAmount(project.outstandingMinor, project.currency)}
                  </span>
                </div>
              )
            )}
          </div>
        </>
      )}

      {/* ---- Footer link ---- */}
      <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
        <Link
          href="/projects"
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
          View all projects
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  )
}
