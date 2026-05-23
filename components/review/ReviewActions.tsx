/**
 * ReviewActions.tsx
 *
 * Action buttons for the review workflow:
 * - LooksGoodButton: primary CTA — optimistically marks transaction 'active'
 * - EditButton: opens inline editing panel
 * - RejectButton: marks transaction 'archived' with 5-second undo toast
 *
 * All buttons support keyboard shortcuts (A=Approve, E=Edit, R=Reject)
 * and are fully accessible with ARIA labels + live-region announcements.
 */

'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

/** Props shared by every action button. */
interface BaseActionProps {
  /** Called when the action completes successfully. */
  onDone?: () => void
  /** Additional CSS class(es) for the outer wrapper. */
  className?: string
}

// ------------------------------------------------------------------
// LooksGoodButton — Approve
// ------------------------------------------------------------------

interface LooksGoodButtonProps extends BaseActionProps {
  /** The transaction ID being approved (for optimistic updates). */
  transactionId: string
}

/**
 * Primary approve action.
 *
 * Fires `transactions.approve(id)` optimistically — the card disappears
 * immediately while the server request fires in the background. If the
 * request fails the card re-appears with an error banner.
 */
export function LooksGoodButton({
  transactionId,
  onDone,
  className = '',
}: LooksGoodButtonProps): JSX.Element {
  const [isApproving, setIsApproving] = useState(false)
  const [optimisticDone, setOptimisticDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const doneRef = useRef(false)

  const handleApprove = useCallback(async () => {
    if (isApproving || doneRef.current) return
    doneRef.current = true
    setIsApproving(true)
    setOptimisticDone(true)
    setError(null)

    try {
      // Optimistic UI: trigger callback immediately so parent removes the card
      onDone?.()

      // Server action fires in background (imported dynamically to avoid
      // bundling server code into the client graph when tree-shaken).
      const { transactions } = await import('@/lib/actions/transactions')
      await transactions.approve(transactionId)
    } catch (err: unknown) {
      // Rollback: show error, allow retry
      setOptimisticDone(false)
      setIsApproving(false)
      doneRef.current = false
      setError(err instanceof Error ? err.message : 'Approval failed')
    }
  }, [isApproving, onDone, transactionId])

  // Keyboard shortcut: A
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === 'a' ||
        e.key === 'A'
      ) {
        // Don't trigger if typing in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return
        e.preventDefault()
        handleApprove()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleApprove])

  if (optimisticDone) {
    return (
      <span className="sr-only" role="status" aria-live="polite">
        Transaction approved
      </span>
    )
  }

  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleApprove}
        disabled={isApproving}
        className="inline-flex items-center gap-2 rounded-lg bg-[#F37002] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#d96202] focus:outline-none focus:ring-2 focus:ring-[#F37002] focus:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Looks good — approve transaction"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Looks good
      </button>

      {error && (
        <span className="text-xs text-[#B43A2D]" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

// ------------------------------------------------------------------
// EditButton
// ------------------------------------------------------------------

interface EditButtonProps extends BaseActionProps {
  /** Whether the inline editor is currently open. */
  isEditing: boolean
  /** Called when the user wants to toggle edit mode. */
  onToggleEdit: () => void
}

/**
 * Secondary action that opens the inline editing panel.
 *
 * Keyboard shortcut: E
 */
export function EditButton({
  isEditing,
  onToggleEdit,
  className = '',
}: EditButtonProps): JSX.Element {
  // Keyboard shortcut: E
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E') {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return
        e.preventDefault()
        onToggleEdit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onToggleEdit])

  return (
    <button
      type="button"
      onClick={onToggleEdit}
      className={`inline-flex items-center gap-2 rounded-lg border border-[#E8E6E1] bg-white px-4 py-2.5 text-sm font-medium text-[#181818] shadow-sm transition-all hover:bg-[#FAFAF7] focus:outline-none focus:ring-2 focus:ring-[#F37002] focus:ring-offset-2 active:scale-95 ${className}`}
      aria-label={isEditing ? 'Cancel editing' : 'Edit transaction details'}
      aria-pressed={isEditing}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
      {isEditing ? 'Cancel' : 'Edit'}
    </button>
  )
}

// ------------------------------------------------------------------
// RejectButton — with 5-second undo toast
// ------------------------------------------------------------------

interface RejectButtonProps extends BaseActionProps {
  /** The transaction ID being rejected. */
  transactionId: string
  /** Optional label override (e.g. "Archive" instead of "Reject"). */
  label?: string
}

/**
 * Reject action with optimistic UI and a 5-second undo toast.
 *
 * When clicked the card disappears immediately. A toast banner appears
 * for 5 seconds allowing the user to undo the rejection. If not undone
 * within 5 seconds, the server action fires and the rejection is final.
 *
 * Keyboard shortcut: R
 */
export function RejectButton({
  transactionId,
  onDone,
  label = 'Reject',
  className = '',
}: RejectButtonProps): JSX.Element {
  const [isRejecting, setIsRejecting] = useState(false)
  const [optimisticDone, setOptimisticDone] = useState(false)
  const [showUndoToast, setShowUndoToast] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const doneRef = useRef(false)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const commitReject = useCallback(async () => {
    try {
      const { transactions } = await import('@/lib/actions/transactions')
      await transactions.reject(transactionId)
      setOptimisticDone(true)
      onDone?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Rejection failed')
      setOptimisticDone(false)
      doneRef.current = false
    }
  }, [transactionId, onDone])

  const handleReject = useCallback(() => {
    if (isRejecting || doneRef.current) return
    doneRef.current = true
    setIsRejecting(true)
    setError(null)
    setOptimisticDone(true)
    setShowUndoToast(true)

    // Optimistic: tell parent to remove card
    onDone?.()

    // 5-second undo window
    timerRef.current = setTimeout(() => {
      setShowUndoToast(false)
      commitReject()
    }, 5000)
  }, [isRejecting, onDone, commitReject])

  const handleUndo = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    doneRef.current = false
    setOptimisticDone(false)
    setIsRejecting(false)
    setShowUndoToast(false)
    setError(null)
  }, [])

  // Keyboard shortcut: R
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return
        e.preventDefault()
        handleReject()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleReject])

  // Undo toast overlay
  if (showUndoToast) {
    return (
      <div
        className={`flex items-center gap-3 rounded-lg border border-[#B43A2D]/20 bg-[#B43A2D]/10 px-4 py-3 ${className}`}
        role="alert"
      >
        <span className="text-sm text-[#B43A2D]">Transaction rejected</span>
        <button
          type="button"
          onClick={handleUndo}
          className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-[#B43A2D] shadow-sm transition hover:bg-[#FAFAF7] focus:outline-none focus:ring-2 focus:ring-[#B43A2D]"
          aria-label="Undo rejection"
        >
          Undo
        </button>
      </div>
    )
  }

  if (optimisticDone) {
    return (
      <span className="sr-only" role="status" aria-live="polite">
        Transaction rejected
      </span>
    )
  }

  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleReject}
        disabled={isRejecting}
        className="inline-flex items-center gap-2 rounded-lg border border-[#B43A2D]/20 bg-white px-4 py-2.5 text-sm font-medium text-[#B43A2D] shadow-sm transition-all hover:bg-[#B43A2D]/5 focus:outline-none focus:ring-2 focus:ring-[#B43A2D] focus:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={`${label} transaction`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        {label}
      </button>

      {error && (
        <span className="text-xs text-[#B43A2D]" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
