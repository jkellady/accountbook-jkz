/**
 * CloseMonthButton.tsx
 * JK Zentra Finance Cockpit — Sprint 1
 *
 * The close action button:
 *  - Disabled until checklist passes (or all failed checks are waived)
 *  - On click: confirmation modal showing month name, year, entity name
 *  - Primary button: "Close [Month] [Year]"
 *  - Loading state while processing
 *  - Success callback for toast + redirect
 */

'use client'

import React, { useState, useCallback } from 'react'
import { closeMonth, formatMonthYear } from '@/lib/actions/monthEnd'
import type { CloseMonthResult } from '@/lib/actions/monthEnd'

// ---------------------------------------------------------------------------
// Design system tokens
// ---------------------------------------------------------------------------

const COLOR_PRIMARY = '#F37002'
const COLOR_PRIMARY_HOVER = '#E06500'
const COLOR_PRIMARY_DISABLED = '#F9BC82'
const COLOR_TEXT_PRIMARY = '#181818'
const COLOR_TEXT_SECONDARY = '#6B6B6B'
const COLOR_OVERLAY = 'rgba(0, 0, 0, 0.45)'
const COLOR_MODAL_BG = '#FFFFFF'
const COLOR_BORDER = '#E8E6E1'
const COLOR_DANGER = '#B43A2D'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CloseMonthButtonProps {
  /** Calendar year to close (e.g. 2026). */
  year: number
  /** Calendar month to close (1–12). */
  month: number
  /** UUID of the entity being closed. */
  entityId: string
  /** Display name of the entity (e.g. "JK Zentra"). */
  entityName: string
  /** Whether all checks pass (or are waived). */
  canClose: boolean
  /** Opening bank balance in minor units (optional). */
  openingBalanceMinor?: number
  /** Closing bank balance in minor units (optional). */
  closingBalanceMinor?: number
  /** Reconciliation note (required if variance != 0). */
  reconciliationNote?: string
  /** Checks that have been waived with reasons. */
  waivedChecks: Array<{ checkName: string; reason: string }>
  /** Reference prefix override (default: "YYYY-MM"). */
  referencePrefix?: string
  /** Called on successful close. */
  onSuccess: (result: CloseMonthResult) => void
  /** Called if close fails. */
  onError: (message: string) => void
}

// ---------------------------------------------------------------------------
// Confirmation modal
// ---------------------------------------------------------------------------

interface ConfirmModalProps {
  open: boolean
  monthName: string
  year: number
  entityName: string
  isLoading: boolean
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmModal({
  open,
  monthName,
  year,
  entityName,
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmModalProps): React.ReactElement | null {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-month-title"
      aria-describedby="close-month-desc"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      {/* Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: COLOR_OVERLAY,
        }}
      />

      {/* Modal card */}
      <div
        style={{
          position: 'relative',
          background: COLOR_MODAL_BG,
          borderRadius: '12px',
          padding: '28px',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          animation: 'modalIn 0.2s ease-out',
        }}
      >
        {/* Warning icon */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#FFF3E0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 5L3 19H21L12 5Z"
              fill="none"
              stroke={COLOR_PRIMARY}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M12 10V14" stroke={COLOR_PRIMARY} strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="17" r="0.8" fill={COLOR_PRIMARY} />
          </svg>
        </div>

        <h3
          id="close-month-title"
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: COLOR_TEXT_PRIMARY,
            margin: '0 0 8px 0',
          }}
        >
          Close {monthName} {year}?
        </h3>

        <p
          id="close-month-desc"
          style={{
            fontSize: '14px',
            color: COLOR_TEXT_SECONDARY,
            lineHeight: '22px',
            margin: '0 0 20px 0',
          }}
        >
          This will lock all transactions for{' '}
          <strong style={{ color: COLOR_TEXT_PRIMARY }}>
            {entityName} — {monthName} {year}
          </strong>
          . Once closed, transactions cannot be edited without reopening the month.
          <br />
          <br />
          Reference codes will be assigned and an accountant pack will be generated.
        </p>

        {/* Danger note */}
        <div
          style={{
            backgroundColor: '#FFEBEE',
            border: `1px solid ${COLOR_DANGER}22`,
            borderRadius: '6px',
            padding: '10px 12px',
            marginBottom: '20px',
            fontSize: '13px',
            color: COLOR_DANGER,
            lineHeight: '18px',
          }}
        >
          This action cannot be undone. You can reopen the month later if needed.
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: COLOR_TEXT_SECONDARY,
              background: 'transparent',
              border: `1px solid ${COLOR_BORDER}`,
              borderRadius: '8px',
              padding: '10px 20px',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F5F5F0'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#FFFFFF',
              background: isLoading ? COLOR_PRIMARY_DISABLED : COLOR_PRIMARY,
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: '140px',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) e.currentTarget.style.backgroundColor = COLOR_PRIMARY_HOVER
            }}
            onMouseLeave={(e) => {
              if (!isLoading) e.currentTarget.style.backgroundColor = COLOR_PRIMARY
            }}
          >
            {isLoading ? (
              <>
                <Spinner />
                Closing...
              </>
            ) : (
              `Close ${monthName}`
            )}
          </button>
        </div>
      </div>

      {/* Modal animation keyframes — injected inline for self-containment */}
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function Spinner(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      style={{ animation: 'spin 0.8s linear infinite' }}
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="2"
      />
      <path
        d="M8 2 A6 6 0 0 1 14 8"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

/**
 * The Close Month button with confirmation modal.
 *
 * Only enables when all checklist checks pass (or are waived).
 * Shows a confirmation dialog before calling the server action.
 *
 * @param year                — calendar year
 * @param month               — calendar month (1–12)
 * @param entityId            — entity UUID
 * @param entityName          — display name for the modal
 * @param canClose            — whether the close button should be enabled
 * @param openingBalanceMinor — optional opening balance
 * @param closingBalanceMinor — optional closing balance
 * @param reconciliationNote  — optional reconciliation note
 * @param waivedChecks        — array of waived checks with reasons
 * @param referencePrefix     — optional reference prefix
 * @param onSuccess           — callback on successful close
 * @param onError             — callback on close failure
 */
export function CloseMonthButton({
  year,
  month,
  entityId,
  entityName,
  canClose,
  openingBalanceMinor,
  closingBalanceMinor,
  reconciliationNote,
  waivedChecks,
  referencePrefix,
  onSuccess,
  onError,
}: CloseMonthButtonProps): React.ReactElement {
  const [showModal, setShowModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const monthName = formatMonthYear(year, month)

  const handleOpenModal = useCallback((): void => {
    if (!canClose || isLoading) return
    setShowModal(true)
  }, [canClose, isLoading])

  const handleCancel = useCallback((): void => {
    if (isLoading) return
    setShowModal(false)
  }, [isLoading])

  const handleConfirm = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      const result = await closeMonth({
        year,
        month,
        entityId,
        openingBalanceMinor,
        closingBalanceMinor,
        reconciliationNote,
        waivedChecks,
        referencePrefix,
      })
      setShowModal(false)
      onSuccess(result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Close failed'
      onError(message)
    } finally {
      setIsLoading(false)
    }
  }, [
    year,
    month,
    entityId,
    openingBalanceMinor,
    closingBalanceMinor,
    reconciliationNote,
    waivedChecks,
    referencePrefix,
    onSuccess,
    onError,
  ])

  return (
    <>
      <button
        type="button"
        onClick={handleOpenModal}
        disabled={!canClose || isLoading}
        style={{
          width: '100%',
          fontSize: '15px',
          fontWeight: 700,
          color: canClose ? '#FFFFFF' : '#FFFFFF',
          background: canClose ? COLOR_PRIMARY : COLOR_PRIMARY_DISABLED,
          border: 'none',
          borderRadius: '10px',
          padding: '14px 24px',
          cursor: canClose ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s ease, transform 0.1s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          boxShadow: canClose ? '0 2px 8px rgba(243, 112, 2, 0.25)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (canClose) e.currentTarget.style.backgroundColor = COLOR_PRIMARY_HOVER
        }}
        onMouseLeave={(e) => {
          if (canClose) e.currentTarget.style.backgroundColor = COLOR_PRIMARY
        }}
        onMouseDown={(e) => {
          if (canClose) e.currentTarget.style.transform = 'scale(0.98)'
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M9 1L11.5 6.5H17.5L12.5 10.5L14.5 16.5L9 12.5L3.5 16.5L5.5 10.5L0.5 6.5H6.5L9 1Z"
            fill="white"
          />
        </svg>
        Close {monthName}
      </button>

      <ConfirmModal
        open={showModal}
        monthName={monthName.split(' ')[0]}
        year={year}
        entityName={entityName}
        isLoading={isLoading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  )
}
