/**
 * MonthEndView.tsx
 * JK Zentra Finance Cockpit — Sprint 1
 *
 * Main orchestrator for the Month-End Close module.
 * Shows checklist + bank reconciliation side by side (desktop) or stacked (mobile).
 * Shows Close button or Reopen button based on state.
 * Shows previous close history (list of closed months).
 * Shows Accountant Pack download if pack exists.
 */

'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  runCloseChecklist,
  getCloseStatus,
  getCloseHistory,
  getMonthTransactions,
  formatMonthYear,
  formatRM,
} from '@/lib/actions/monthEnd'
import type {
  CheckResult,
  CloseMonthResult,
  MonthCloseRow,
} from '@/lib/actions/monthEnd'
import { CloseChecklist } from './CloseChecklist'
import { BankReconciliation } from './BankReconciliation'
import { CloseMonthButton } from './CloseMonthButton'
import { ReopenMonth } from './ReopenMonth'

// ---------------------------------------------------------------------------
// Design system tokens
// ---------------------------------------------------------------------------

const BG_OFF_WHITE = '#FAFAF7'
const COLOR_TEXT_PRIMARY = '#181818'
const COLOR_TEXT_SECONDARY = '#6B6B6B'
const COLOR_BORDER = '#E8E6E1'
const COLOR_PRIMARY = '#F37002'
const COLOR_PASS = '#1F8A4C'
const COLOR_CARD_BG = '#FFFFFF'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonthEndViewProps {
  /** Entity UUID. */
  entityId: string
  /** Display name of the entity (e.g. "JK Zentra"). */
  entityName: string
  /** Year to display (default: previous month). */
  year?: number
  /** Month to display (1–12, default: previous month). */
  month?: number
}

// ---------------------------------------------------------------------------
// Helper: determine default month (previous month)
// ---------------------------------------------------------------------------

function getDefaultMonth(): { year: number; month: number } {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), 1)
  d.setDate(0) // last day of previous month
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

// ---------------------------------------------------------------------------
// Sub-component: Month selector
// ---------------------------------------------------------------------------

interface MonthSelectorProps {
  year: number
  month: number
  onChange: (year: number, month: number) => void
  canClose: boolean
}

function MonthSelector({ year, month, onChange, canClose }: MonthSelectorProps): React.ReactElement {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  // Generate last 24 months as options
  const options = useMemo(() => {
    const opts: { year: number; month: number; label: string }[] = []
    const now = new Date()
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      opts.push({ year: y, month: m, label: `${months[m - 1]} ${y}` })
    }
    return opts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedValue = `${year}-${String(month).padStart(2, '0')}`

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      <label
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: COLOR_TEXT_PRIMARY,
        }}
      >
        Month:
      </label>
      <select
        value={selectedValue}
        onChange={(e) => {
          const [y, m] = e.target.value.split('-').map(Number)
          onChange(y, m)
        }}
        style={{
          fontSize: '14px',
          fontFamily: 'inherit',
          color: COLOR_TEXT_PRIMARY,
          background: COLOR_CARD_BG,
          border: `1px solid ${COLOR_BORDER}`,
          borderRadius: '8px',
          padding: '8px 32px 8px 12px',
          cursor: 'pointer',
          outline: 'none',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='%236B6B6B' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
        }}
      >
        {options.map((opt) => (
          <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${String(opt.month).padStart(2, '0')}`}>
            {opt.label}
          </option>
        ))}
      </select>

      {!canClose && (
        <span
          style={{
            fontSize: '12px',
            color: COLOR_TEXT_SECONDARY,
            fontStyle: 'italic',
          }}
        >
          Current/future months cannot be closed
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: Close history list
// ---------------------------------------------------------------------------

function CloseHistoryList({ history }: { history: MonthCloseRow[] }): React.ReactElement {
  if (history.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: COLOR_TEXT_SECONDARY,
          fontSize: '14px',
          background: BG_OFF_WHITE,
          borderRadius: '12px',
        }}
      >
        No months closed yet. Close your first month to see history here.
      </div>
    )
  }

  return (
    <div
      style={{
        background: COLOR_CARD_BG,
        border: `1px solid ${COLOR_BORDER}`,
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${COLOR_BORDER}`,
          background: BG_OFF_WHITE,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: COLOR_TEXT_PRIMARY,
            margin: 0,
          }}
        >
          Close History
        </h3>
        <span
          style={{
            fontSize: '12px',
            color: COLOR_TEXT_SECONDARY,
            fontWeight: 500,
          }}
        >
          {history.length} month{history.length !== 1 ? 's' : ''} closed
        </span>
      </div>

      <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
        {history.map((item) => {
          const monthName = formatMonthYear(item.year, item.month)
          const isReopened = item.reopened_at != null
          const hasPack = item.pack_file_id != null

          return (
            <div
              key={item.id}
              style={{
                padding: '14px 20px',
                borderBottom: `1px solid ${COLOR_BORDER}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                opacity: isReopened ? 0.55 : 1,
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FAFAF7'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                {/* Status dot */}
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isReopened ? '#B43A2D' : COLOR_PASS,
                    flexShrink: 0,
                  }}
                  title={isReopened ? 'Reopened' : 'Closed'}
                />

                <div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: COLOR_TEXT_PRIMARY,
                    }}
                  >
                    {monthName}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: COLOR_TEXT_SECONDARY,
                      marginTop: '2px',
                    }}
                  >
                    {item.reference_prefix}
                    {isReopened && ' • Reopened'}
                    {hasPack && !isReopened && ' • Pack generated'}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: COLOR_TEXT_PRIMARY,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatRM(item.closing_balance_minor)}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: COLOR_TEXT_SECONDARY,
                    marginTop: '2px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {item.reconciliation_variance_minor != null && item.reconciliation_variance_minor !== 0
                    ? `Variance: ${formatRM(Math.abs(item.reconciliation_variance_minor))}`
                    : 'Reconciled'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: Accountant pack download card
// ---------------------------------------------------------------------------

function PackDownloadCard({ packFileId, year, month, entityName }: { packFileId: string; year: number; month: number; entityName: string }): React.ReactElement {
  const [isHovered, setIsHovered] = useState(false)
  const monthName = formatMonthYear(year, month)

  return (
    <div
      style={{
        background: COLOR_CARD_BG,
        border: `1px solid ${COLOR_BORDER}`,
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        transition: 'box-shadow 0.15s ease',
        boxShadow: isHovered ? '0 2px 12px rgba(0,0,0,0.08)' : 'none',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* ZIP icon */}
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: '#FFF3E0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="2" width="16" height="16" rx="3" fill={COLOR_PRIMARY} fillOpacity="0.15" />
            <path d="M6 2V8M10 2V8M14 2V8" stroke={COLOR_PRIMARY} strokeWidth="1.5" strokeLinecap="round" />
            <rect x="5" y="12" width="10" height="5" rx="1" fill={COLOR_PRIMARY} fillOpacity="0.2" />
          </svg>
        </div>

        <div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: COLOR_TEXT_PRIMARY,
            }}
          >
            Accountant Pack
          </div>
          <div
            style={{
              fontSize: '12px',
              color: COLOR_TEXT_SECONDARY,
              marginTop: '2px',
            }}
          >
            {entityName} — {monthName}
          </div>
        </div>
      </div>

      <a
        href={`/api/files/download/${packFileId}`}
        download
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: COLOR_PRIMARY,
          textDecoration: 'none',
          padding: '8px 16px',
          border: `1.5px solid ${COLOR_PRIMARY}`,
          borderRadius: '8px',
          transition: 'background 0.15s ease',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#FFF3E0'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        Download
      </a>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: Toast notification
// ---------------------------------------------------------------------------

interface ToastProps {
  message: string
  type: 'success' | 'error'
  onDismiss: () => void
}

function Toast({ message, type, onDismiss }: ToastProps): React.ReactElement {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const bgColor = type === 'success' ? COLOR_PASS : '#B43A2D'

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 2000,
        background: bgColor,
        color: '#FFFFFF',
        padding: '14px 20px',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: 500,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        animation: 'toastIn 0.3s ease-out',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        maxWidth: '400px',
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          fontSize: '16px',
          padding: '0 0 0 8px',
          opacity: 0.7,
        }}
        aria-label="Dismiss"
      >
        &times;
      </button>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

/**
 * MonthEndView — main orchestrator for the Month-End Close module.
 *
 * Fetches data, manages state, and renders:
 *  - Month selector dropdown
 *  - CloseChecklist (left/top panel)
 *  - BankReconciliation (right/bottom panel)
 *  - Close button OR Reopen button (based on close state)
 *  - Accountant Pack download (if pack exists)
 *  - Close history list
 *
 * @param entityId   — entity UUID
 * @param entityName — display name
 * @param year       — optional year override
 * @param month      — optional month override (1–12)
 */
export function MonthEndView({ entityId, entityName, year: propYear, month: propMonth }: MonthEndViewProps): React.ReactElement {
  const defaultMonth = useMemo(() => getDefaultMonth(), [])
  const [year, setYear] = useState(propYear ?? defaultMonth.year)
  const [month, setMonth] = useState(propMonth ?? defaultMonth.month)

  // Core state
  const [checks, setChecks] = useState<CheckResult[]>([])
  const [isClosed, setIsClosed] = useState(false)
  const [closedAt, setClosedAt] = useState<string | null>(null)
  const [canClose, setCanClose] = useState(false)
  const [closeHistory, setCloseHistory] = useState<MonthCloseRow[]>([])
  const [packFileId, setPackFileId] = useState<string | null>(null)

  // Reconciliation state
  const [openingBalance, setOpeningBalance] = useState<number | null>(null)
  const [closingBalance, setClosingBalance] = useState<number | null>(null)
  const [reconciliationNote, setReconciliationNote] = useState('')
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)

  // Waived checks
  const [waivedChecks, setWaivedChecks] = useState<Record<string, string>>({})

  // Loading & toast
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // -------------------------------------------------------------------------
  // Load data
  // -------------------------------------------------------------------------

  const loadData = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      // Run checklist
      const checklistResult = await runCloseChecklist(year, month, entityId)
      setChecks(checklistResult.checks)

      // Get close status
      const status = await getCloseStatus(year, month, entityId)
      setIsClosed(status.isClosed)
      setClosedAt(status.closedAt)
      setCanClose(status.canClose)

      // Get close history
      const history = await getCloseHistory(entityId)
      setCloseHistory(history)

      // Get month transactions for income/expense totals
      const transactions = await getMonthTransactions(year, month, entityId)
      const income = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + (t.myr_equiv_minor ?? t.amount_minor), 0)
      const expenses = transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + (t.myr_equiv_minor ?? t.amount_minor), 0)
      setTotalIncome(income)
      setTotalExpenses(expenses)

      // Find current month's close record for pack file
      const currentClose = history.find(
        (h) => h.year === year && h.month === month && h.reopened_at == null
      )
      if (currentClose) {
        setPackFileId(currentClose.pack_file_id)
        setOpeningBalance(currentClose.opening_balance_minor)
        setClosingBalance(currentClose.closing_balance_minor)
        setReconciliationNote(currentClose.reconciliation_note ?? '')
      } else {
        setPackFileId(null)
      }

      // Reset waived checks on month change
      setWaivedChecks({})
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load data'
      setToast({ message, type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }, [year, month, entityId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleMonthChange = useCallback((newYear: number, newMonth: number): void => {
    setYear(newYear)
    setMonth(newMonth)
    setOpeningBalance(null)
    setClosingBalance(null)
    setReconciliationNote('')
    setPackFileId(null)
  }, [])

  const handleWaiveCheck = useCallback((checkName: string, reason: string): void => {
    setWaivedChecks((prev) => ({ ...prev, [checkName]: reason }))
  }, [])

  const handleCloseSuccess = useCallback((result: CloseMonthResult): void => {
    setIsClosed(true)
    setPackFileId(result.packFileId)
    setToast({ message: `Month closed successfully. Reference prefix: ${result.closeId.slice(0, 8)}...`, type: 'success' })
    loadData()
  }, [loadData])

  const handleReopenSuccess = useCallback((): void => {
    setIsClosed(false)
    setPackFileId(null)
    setToast({ message: 'Month reopened successfully. Transactions are now editable.', type: 'success' })
    loadData()
  }, [loadData])

  const handleError = useCallback((message: string): void => {
    setToast({ message, type: 'error' })
  }, [])

  // Determine if close button should be enabled
  const allChecksReady = useMemo(() => {
    return checks.every(
      (c) => c.passed || (c.waivable && c.name in waivedChecks)
    )
  }, [checks, waivedChecks])

  // Variance validation: if there's a variance, note must be filled
  const hasVariance = (closingBalance ?? 0) !== 0 && ((closingBalance ?? 0) - ((openingBalance ?? 0) + totalIncome - totalExpenses)) !== 0
  const varianceNoteValid = !hasVariance || reconciliationNote.trim().length > 0
  const closeButtonEnabled = canClose && allChecksReady && varianceNoteValid && !isLoading

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      style={{
        background: BG_OFF_WHITE,
        minHeight: '100vh',
        padding: '24px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          maxWidth: '1200px',
          margin: '0 auto 24px auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: COLOR_TEXT_PRIMARY,
              margin: '0 0 4px 0',
            }}
          >
            Month-End Close
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: COLOR_TEXT_SECONDARY,
              margin: 0,
            }}
          >
            {entityName} &middot; Lock transactions after review
          </p>
        </div>

        <MonthSelector
          year={year}
          month={month}
          onChange={handleMonthChange}
          canClose={canClose}
        />
      </header>

      {/* Month status banner */}
      {isClosed && closedAt && (
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto 20px auto',
            background: '#E8F5E9',
            border: '1px solid #1F8A4C33',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '14px',
            color: COLOR_PASS,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="9" fill={COLOR_PASS} />
            <path d="M5.5 9L8 11.5L13 6.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <strong>{formatMonthYear(year, month)}</strong> is closed. All transactions are locked.
          {packFileId && (
            <span style={{ marginLeft: 'auto', fontSize: '12px' }}>
              Accountant pack available below
            </span>
          )}
        </div>
      )}

      {/* Main content grid */}
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '20px',
        }}
      >
        {/* Responsive: 2 columns on desktop */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))',
            gap: '20px',
          }}
        >
          {/* Left: Checklist */}
          <div>
            {isLoading ? (
              <SkeletonCard />
            ) : (
              <CloseChecklist
                checks={checks}
                onWaive={handleWaiveCheck}
                waivedChecks={waivedChecks}
              />
            )}
          </div>

          {/* Right: Bank Reconciliation + Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isLoading ? (
              <SkeletonCard />
            ) : (
              <>
                <BankReconciliation
                  openingBalanceMinor={openingBalance}
                  closingBalanceMinor={closingBalance}
                  totalIncomeMinor={totalIncome}
                  totalExpensesMinor={totalExpenses}
                  reconciliationNote={reconciliationNote}
                  onOpeningBalanceChange={setOpeningBalance}
                  onClosingBalanceChange={setClosingBalance}
                  onReconciliationNoteChange={setReconciliationNote}
                  isClosed={isClosed}
                />

                {/* Action button: Close OR Reopen */}
                <div
                  style={{
                    padding: '4px 0',
                  }}
                >
                  {isClosed ? (
                    <ReopenMonth
                      year={year}
                      month={month}
                      entityId={entityId}
                      entityName={entityName}
                      onSuccess={handleReopenSuccess}
                      onError={handleError}
                    />
                  ) : (
                    <CloseMonthButton
                      year={year}
                      month={month}
                      entityId={entityId}
                      entityName={entityName}
                      canClose={closeButtonEnabled}
                      openingBalanceMinor={openingBalance ?? undefined}
                      closingBalanceMinor={closingBalance ?? undefined}
                      reconciliationNote={reconciliationNote}
                      waivedChecks={Object.entries(waivedChecks).map(([checkName, reason]) => ({
                        checkName,
                        reason,
                      }))}
                      onSuccess={handleCloseSuccess}
                      onError={handleError}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Accountant Pack download */}
        {packFileId && (
          <PackDownloadCard
            packFileId={packFileId}
            year={year}
            month={month}
            entityName={entityName}
          />
        )}

        {/* Close history */}
        <div style={{ marginTop: '8px' }}>
          {isLoading ? (
            <SkeletonCard />
          ) : (
            <CloseHistoryList history={closeHistory} />
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton loading placeholder
// ---------------------------------------------------------------------------

function SkeletonCard(): React.ReactElement {
  return (
    <div
      style={{
        background: COLOR_CARD_BG,
        border: `1px solid ${COLOR_BORDER}`,
        borderRadius: '12px',
        padding: '24px',
      }}
    >
      <div
        style={{
          height: '20px',
          width: '40%',
          background: '#E8E6E1',
          borderRadius: '4px',
          marginBottom: '16px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      <div
        style={{
          height: '8px',
          width: '100%',
          background: '#E8E6E1',
          borderRadius: '4px',
          marginBottom: '12px',
          animation: 'pulse 1.5s ease-in-out infinite 0.1s',
        }}
      />
      <div
        style={{
          height: '60px',
          width: '100%',
          background: '#E8E6E1',
          borderRadius: '8px',
          marginBottom: '8px',
          animation: 'pulse 1.5s ease-in-out infinite 0.2s',
        }}
      />
      <div
        style={{
          height: '60px',
          width: '100%',
          background: '#E8E6E1',
          borderRadius: '8px',
          animation: 'pulse 1.5s ease-in-out infinite 0.3s',
        }}
      />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
