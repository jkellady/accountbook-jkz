/**
 * ReopenMonth.tsx
 * JK Zentra Finance Cockpit — Sprint 1
 *
 * Reopen interface:
 *  - Only visible if month is already closed
 *  - "Reopen Month" button (secondary, grey)
 *  - Click → modal with required reason textarea (min 10 chars)
 *  - Shows warning: "This will unlock all transactions and clear reference codes."
 *  - On confirm: calls reopenMonth server action, logs in audit_log
 */

'use client'

import React, { useState, useCallback } from 'react'
import { reopenMonth, formatMonthYear } from '@/lib/actions/monthEnd'

// ---------------------------------------------------------------------------
// Design system tokens
// ---------------------------------------------------------------------------

const COLOR_SECONDARY = '#6B6B6B'
const COLOR_SECONDARY_HOVER = '#555555'
const COLOR_SECONDARY_DISABLED = '#B8B8B8'
const COLOR_TEXT_PRIMARY = '#181818'
const COLOR_TEXT_SECONDARY = '#6B6B6B'
const COLOR_OVERLAY = 'rgba(0, 0, 0, 0.45)'
const COLOR_MODAL_BG = '#FFFFFF'
const COLOR_BORDER = '#E8E6E1'
const COLOR_DANGER = '#B43A2D'
const COLOR_DANGER_BG = '#FFEBEE'
const INPUT_BORDER = '#D0CBC4'
const INPUT_BORDER_FOCUS = '#F37002'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReopenMonthProps {
  /** Calendar year of the closed month. */
  year: number
  /** Calendar month (1–12) of the closed month. */
  month: number
  /** UUID of the entity. */
  entityId: string
  /** Display name of the entity. */
  entityName: string
  /** Called on successful reopen. */
  onSuccess: () => void
  /** Called if reopen fails. */
  onError: (message: string) => void
}

// ---------------------------------------------------------------------------
// Reopen modal
// ---------------------------------------------------------------------------

interface ReopenModalProps {
  open: boolean
  monthName: string
  year: number
  entityName: string
  isLoading: boolean
  reason: string
  onReasonChange: (reason: string) => void
  onConfirm: () => void
  onCancel: () => void
}

function ReopenModal({
  open,
  monthName,
  year,
  entityName,
  isLoading,
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
}: ReopenModalProps): React.ReactElement | null {
  if (!open) return null

  const reasonValid = reason.trim().length >= 10
  const remainingChars = Math.max(0, 10 - reason.trim().length)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reopen-month-title"
      aria-describedby="reopen-month-desc"
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
          maxWidth: '480px',
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
            backgroundColor: COLOR_DANGER_BG,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.645 18.302 1.553 18.645 1.553 18.994C1.553 19.344 1.645 19.687 1.82 19.989C1.995 20.291 2.247 20.541 2.549 20.712C2.851 20.883 3.193 20.969 3.54 20.96H20.46C20.807 20.969 21.149 20.883 21.451 20.712C21.753 20.541 22.005 20.291 22.18 19.989C22.355 19.687 22.447 19.344 22.447 18.994C22.447 18.645 22.355 18.302 22.18 18L13.71 3.86C13.532 3.566 13.281 3.323 12.982 3.155C12.683 2.987 12.345 2.9 12.001 2.9C11.656 2.9 11.318 2.987 11.019 3.155C10.72 3.323 10.469 3.566 10.291 3.86H10.29Z"
              stroke={COLOR_DANGER}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>

        <h3
          id="reopen-month-title"
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: COLOR_TEXT_PRIMARY,
            margin: '0 0 8px 0',
          }}
        >
          Reopen {monthName} {year}?
        </h3>

        <p
          id="reopen-month-desc"
          style={{
            fontSize: '14px',
            color: COLOR_TEXT_SECONDARY,
            lineHeight: '22px',
            margin: '0 0 16px 0',
          }}
        >
          You are about to reopen the books for{' '}
          <strong style={{ color: COLOR_TEXT_PRIMARY }}>
            {entityName} — {monthName} {year}
          </strong>
          .
        </p>

        {/* Warning box */}
        <div
          style={{
            backgroundColor: COLOR_DANGER_BG,
            border: `1px solid ${COLOR_DANGER}22`,
            borderRadius: '8px',
            padding: '14px 16px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: COLOR_DANGER,
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1L1 15H15L8 1Z"
                fill={COLOR_DANGER}
                fillOpacity="0.15"
              />
              <path
                d="M8 6V9M8 12H8.005M8 1L1 15H15L8 1Z"
                stroke={COLOR_DANGER}
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            This will:
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: '20px',
              fontSize: '13px',
              color: COLOR_DANGER,
              lineHeight: '22px',
            }}
          >
            <li>Unlock all transactions in {monthName} {year}</li>
            <li>Clear all assigned reference codes</li>
            <li>Require a reason (logged to audit trail)</li>
            <li>Mark the existing accountant pack as stale</li>
          </ul>
        </div>

        {/* Reason input */}
        <div style={{ marginBottom: '20px' }}>
          <label
            htmlFor="reopen-reason"
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: COLOR_TEXT_PRIMARY,
              display: 'block',
              marginBottom: '6px',
            }}
          >
            Reason for reopening
            <span style={{ color: COLOR_DANGER, marginLeft: '4px' }}>*</span>
          </label>
          <textarea
            id="reopen-reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Explain why you need to reopen this month (min 10 characters)..."
            rows={4}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              fontFamily: 'inherit',
              color: COLOR_TEXT_PRIMARY,
              background: isLoading ? '#F0EFEC' : '#FFFFFF',
              border: `1px solid ${reasonValid || reason.trim().length === 0 ? INPUT_BORDER : COLOR_DANGER}`,
              borderRadius: '6px',
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              if (!isLoading) {
                e.currentTarget.style.borderColor = INPUT_BORDER_FOCUS
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(243, 112, 2, 0.12)'
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor =
                reasonValid || reason.trim().length === 0 ? INPUT_BORDER : COLOR_DANGER
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '6px',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                color: reasonValid ? COLOR_TEXT_SECONDARY : COLOR_DANGER,
              }}
            >
              {remainingChars > 0
                ? `${remainingChars} more character${remainingChars > 1 ? 's' : ''} required`
                : reasonValid
                  ? 'Reason looks good'
                  : ''}
            </span>
            <span
              style={{
                fontSize: '12px',
                color: COLOR_TEXT_SECONDARY,
              }}
            >
              {reason.trim().length} / 10 min
            </span>
          </div>
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
            disabled={isLoading || !reasonValid}
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#FFFFFF',
              background: reasonValid && !isLoading ? COLOR_DANGER : COLOR_SECONDARY_DISABLED,
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              cursor: reasonValid && !isLoading ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: '140px',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              if (reasonValid && !isLoading) {
                e.currentTarget.style.backgroundColor = '#9A2E22'
              }
            }}
            onMouseLeave={(e) => {
              if (reasonValid && !isLoading) {
                e.currentTarget.style.backgroundColor = COLOR_DANGER
              }
            }}
          >
            {isLoading ? (
              <>
                <Spinner />
                Reopening...
              </>
            ) : (
              'Reopen Month'
            )}
          </button>
        </div>
      </div>

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
      <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
      <path d="M8 2 A6 6 0 0 1 14 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
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
 * Reopen Month button + modal.
 *
 * Only shown when a month is closed. Clicking opens a modal requiring
 * a reason (min 10 characters) before the reopen server action is called.
 *
 * @param year       — calendar year
 * @param month      — calendar month (1–12)
 * @param entityId   — entity UUID
 * @param entityName — display name
 * @param onSuccess  — callback on successful reopen
 * @param onError    — callback on reopen failure
 */
export function ReopenMonth({
  year,
  month,
  entityId,
  entityName,
  onSuccess,
  onError,
}: ReopenMonthProps): React.ReactElement {
  const [showModal, setShowModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [reason, setReason] = useState('')

  const monthName = formatMonthYear(year, month)

  const handleOpenModal = useCallback((): void => {
    setReason('')
    setShowModal(true)
  }, [])

  const handleCancel = useCallback((): void => {
    if (isLoading) return
    setShowModal(false)
    setReason('')
  }, [isLoading])

  const handleConfirm = useCallback(async (): Promise<void> => {
    if (reason.trim().length < 10) return
    setIsLoading(true)
    try {
      await reopenMonth(year, month, entityId, reason.trim())
      setShowModal(false)
      setReason('')
      onSuccess()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Reopen failed'
      onError(message)
    } finally {
      setIsLoading(false)
    }
  }, [year, month, entityId, reason, onSuccess, onError])

  return (
    <>
      <button
        type="button"
        onClick={handleOpenModal}
        disabled={isLoading}
        style={{
          width: '100%',
          fontSize: '15px',
          fontWeight: 600,
          color: COLOR_SECONDARY,
          background: '#FFFFFF',
          border: `1.5px solid ${COLOR_BORDER}`,
          borderRadius: '10px',
          padding: '14px 24px',
          cursor: 'pointer',
          transition: 'background 0.15s ease, border-color 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#F5F5F0'
          e.currentTarget.style.borderColor = COLOR_SECONDARY
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#FFFFFF'
          e.currentTarget.style.borderColor = COLOR_BORDER
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M3 9V15C3 15.5304 3.21071 16.0391 3.58579 16.4142C3.96086 16.7893 4.46957 17 5 17H13C13.5304 17 14.0391 16.7893 14.4142 16.4142C14.7893 16.0391 15 15.5304 15 15V9M12 5L9 2M9 2L6 5M9 2V12"
            stroke={COLOR_SECONDARY}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Reopen {monthName}
      </button>

      <ReopenModal
        open={showModal}
        monthName={monthName.split(' ')[0]}
        year={year}
        entityName={entityName}
        isLoading={isLoading}
        reason={reason}
        onReasonChange={setReason}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  )
}
