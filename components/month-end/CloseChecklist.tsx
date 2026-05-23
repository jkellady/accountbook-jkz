/**
 * CloseChecklist.tsx
 * JK Zentra Finance Cockpit — Sprint 1
 *
 * The 8-check pre-close checklist UI.
 * Each check shows: green checkmark (passed), red X (failed), or grey circle
 * with clock (waived). Failed checks show a "Waive" button with reason input.
 * Includes a progress bar: "5 of 8 passed".
 */

'use client'

import React, { useState, useCallback } from 'react'
import type { CheckResult } from '@/lib/actions/monthEnd'

// ---------------------------------------------------------------------------
// Design system tokens
// ---------------------------------------------------------------------------

const BG_OFF_WHITE = '#FAFAF7'
const CARD_BG = '#FFFFFF'
const CARD_BORDER = '#E8E6E1'
const BORDER_RADIUS = '8px'

const COLOR_PASS = '#1F8A4C'
const COLOR_FAIL = '#B43A2D'
const COLOR_WAIVED = '#C77700'
const COLOR_NEUTRAL = '#9B9B9B'
const COLOR_PROGRESS_FILL = '#F37002'
const COLOR_PROGRESS_TRACK = '#E5E5E5'
const COLOR_TEXT_PRIMARY = '#181818'
const COLOR_TEXT_SECONDARY = '#6B6B6B'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CloseChecklistProps {
  /** The 8 check results from the server. */
  checks: CheckResult[]
  /** Called when the user waives a check (provides reason). */
  onWaive: (checkName: string, reason: string) => void
  /** Currently waived checks with their reasons. */
  waivedChecks: Record<string, string>
}

// ---------------------------------------------------------------------------
// Icons (inline SVGs — no external dependencies)
// ---------------------------------------------------------------------------

function IconCheck({ color }: { color: string }): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill={color} />
      <path d="M6 10L8.5 12.5L14 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconX({ color }: { color: string }): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill={color} />
      <path d="M7 7L13 13M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconClock({ color }: { color: string }): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill={color} />
      <circle cx="10" cy="10" r="8" fill="white" />
      <path d="M10 6V10L12.5 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconCircle({ color }: { color: string }): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke={color} strokeWidth="2" fill="none" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Single check card
// ---------------------------------------------------------------------------

interface CheckCardProps {
  check: CheckResult
  isWaived: boolean
  waiverReason: string | undefined
  onWaive: (checkName: string, reason: string) => void
}

function CheckCard({ check, isWaived, waiverReason, onWaive }: CheckCardProps): React.ReactElement {
  const [showWaiveInput, setShowWaiveInput] = useState(false)
  const [waiveReason, setWaiveReason] = useState('')

  const handleWaiveSubmit = useCallback((): void => {
    if (waiveReason.trim().length < 5) return
    onWaive(check.name, waiveReason.trim())
    setShowWaiveInput(false)
    setWaiveReason('')
  }, [waiveReason, check.name, onWaive])

  const handleCancelWaive = useCallback((): void => {
    setShowWaiveInput(false)
    setWaiveReason('')
  }, [])

  // Determine left border colour and icon
  let leftBorderColor = COLOR_NEUTRAL
  let icon: React.ReactElement

  if (isWaived) {
    leftBorderColor = COLOR_WAIVED
    icon = <IconClock color={COLOR_WAIVED} />
  } else if (check.passed) {
    leftBorderColor = COLOR_PASS
    icon = <IconCheck color={COLOR_PASS} />
  } else {
    leftBorderColor = COLOR_FAIL
    icon = <IconX color={COLOR_FAIL} />
  }

  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderLeft: `4px solid ${leftBorderColor}`,
        borderRadius: BORDER_RADIUS,
        padding: '14px 16px',
        marginBottom: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'box-shadow 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {icon}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: COLOR_TEXT_PRIMARY,
              lineHeight: '20px',
            }}
          >
            {check.name}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: COLOR_TEXT_SECONDARY,
              lineHeight: '18px',
              marginTop: '2px',
            }}
          >
            {check.details}
          </div>
        </div>

        {/* Status badge */}
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.5px',
            padding: '4px 10px',
            borderRadius: '12px',
            whiteSpace: 'nowrap',
            ...(isWaived
              ? { backgroundColor: '#FFF3E0', color: COLOR_WAIVED }
              : check.passed
                ? { backgroundColor: '#E8F5E9', color: COLOR_PASS }
                : { backgroundColor: '#FFEBEE', color: COLOR_FAIL }),
          }}
        >
          {isWaived ? 'Waived' : check.passed ? 'Passed' : 'Failed'}
        </div>
      </div>

      {/* Waive button / input */}
      {!check.passed && !isWaived && check.waivable && (
        <div style={{ marginLeft: '32px' }}>
          {!showWaiveInput ? (
            <button
              type="button"
              onClick={() => setShowWaiveInput(true)}
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: COLOR_WAIVED,
                background: 'transparent',
                border: `1px solid ${COLOR_WAIVED}`,
                borderRadius: '6px',
                padding: '4px 12px',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FFF3E0'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Waive this check
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                placeholder="Reason for waiving (min 5 characters)..."
                rows={2}
                style={{
                  fontSize: '13px',
                  padding: '8px 10px',
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: '6px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  color: COLOR_TEXT_PRIMARY,
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleWaiveSubmit}
                  disabled={waiveReason.trim().length < 5}
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: waiveReason.trim().length >= 5 ? '#FFFFFF' : '#9B9B9B',
                    background: waiveReason.trim().length >= 5 ? COLOR_WAIVED : '#E5E5E5',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 14px',
                    cursor: waiveReason.trim().length >= 5 ? 'pointer' : 'not-allowed',
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  Confirm Waive
                </button>
                <button
                  type="button"
                  onClick={handleCancelWaive}
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: COLOR_TEXT_SECONDARY,
                    background: 'transparent',
                    border: `1px solid ${CARD_BORDER}`,
                    borderRadius: '6px',
                    padding: '5px 14px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Show waiver reason if already waived */}
      {isWaived && waiverReason && (
        <div
          style={{
            marginLeft: '32px',
            fontSize: '12px',
            color: COLOR_WAIVED,
            fontStyle: 'italic',
            backgroundColor: '#FFF8F0',
            padding: '6px 10px',
            borderRadius: '6px',
          }}
        >
          Waived: {waiverReason}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

interface ProgressBarProps {
  passedCount: number
  totalCount: number
  waivedCount: number
}

function ProgressBar({ passedCount, totalCount, waivedCount }: ProgressBarProps): React.ReactElement {
  const effectivePassed = passedCount + waivedCount
  const percentage = totalCount > 0 ? (effectivePassed / totalCount) * 100 : 0

  return (
    <div style={{ marginBottom: '20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: COLOR_TEXT_PRIMARY,
          }}
        >
          {effectivePassed} of {totalCount} checks ready
        </span>
        <span
          style={{
            fontSize: '13px',
            color: COLOR_TEXT_SECONDARY,
          }}
        >
          {waivedCount > 0 && `${waivedCount} waived`}
        </span>
      </div>
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: COLOR_PROGRESS_TRACK,
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: COLOR_PROGRESS_FILL,
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

/**
 * The 8-check pre-close checklist UI.
 *
 * Displays each check with its pass/fail/waived status, a progress bar,
 * and controls to waive individual checks with a reason.
 *
 * @param checks        — array of {@link CheckResult} from the server
 * @param onWaive       — callback when user waives a check
 * @param waivedChecks  — map of check name → waiver reason
 */
export function CloseChecklist({ checks, onWaive, waivedChecks }: CloseChecklistProps): React.ReactElement {
  const passedCount = checks.filter((c) => c.passed).length
  const waivedCount = Object.keys(waivedChecks).length
  const totalCount = checks.length

  return (
    <section
      style={{
        background: BG_OFF_WHITE,
        borderRadius: '12px',
        padding: '24px',
      }}
    >
      <h2
        style={{
          fontSize: '18px',
          fontWeight: 700,
          color: COLOR_TEXT_PRIMARY,
          margin: '0 0 20px 0',
          lineHeight: '24px',
        }}
      >
        Pre-Close Checklist
      </h2>

      <ProgressBar
        passedCount={passedCount}
        totalCount={totalCount}
        waivedCount={waivedCount}
      />

      <div role="list" aria-label="Pre-close checklist items">
        {checks.map((check) => (
          <div key={check.name} role="listitem">
            <CheckCard
              check={check}
              isWaived={check.name in waivedChecks}
              waiverReason={waivedChecks[check.name]}
              onWaive={onWaive}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
