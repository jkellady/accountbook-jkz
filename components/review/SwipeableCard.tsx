/**
 * SwipeableCard.tsx
 *
 * Mobile-only swipe gesture wrapper for review cards.
 * Swipe right = approve (green background + checkmark).
 * Swipe left  = reject (red background + X).
 * 80px snap threshold; below it the card snaps back.
 *
 * Uses touch events (onTouchStart / onTouchMove / onTouchEnd) for 60fps
 * gesture tracking with CSS transform translateX. No libraries.
 */

'use client'

import React, { useCallback, useRef, useState } from 'react'

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

/** Distance the user must drag before the action triggers. */
const SNAP_THRESHOLD = 80

/** Background opacity ramps up over this distance. */
const OPACITY_RAMP = 150

// ------------------------------------------------------------------
// Props
// ------------------------------------------------------------------

interface SwipeableCardProps {
  /** Called when user swipes right past the threshold. */
  onApprove: () => void
  /** Called when user swipes left past the threshold. */
  onReject: () => void
  /** The card content to render inside the swipe wrapper. */
  children: React.ReactNode
  /** Whether swipe actions are temporarily disabled (e.g. during edit). */
  disabled?: boolean
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

/**
 * Wraps a review card with touch-based swipe gestures.
 *
 * On mobile the user can drag the card horizontally. Dragging right reveals
 * a green approval layer; dragging left reveals a red rejection layer. Once
 * the drag passes {@link SNAP_THRESHOLD}px the action commits and the card
 * animates off-screen.
 */
export function SwipeableCard({
  onApprove,
  onReject,
  children,
  disabled = false,
}: SwipeableCardProps): JSX.Element {
  const [translateX, setTranslateX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef(0)
  const currentX = useRef(0)
  const committed = useRef(false)

  const reset = useCallback(() => {
    setTranslateX(0)
    setIsDragging(false)
    startX.current = 0
    currentX.current = 0
  }, [])

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || committed.current) return
      startX.current = e.touches[0].clientX
      currentX.current = e.touches[0].clientX
      setIsDragging(true)
    },
    [disabled]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging || disabled || committed.current) return
      currentX.current = e.touches[0].clientX
      const dx = currentX.current - startX.current
      setTranslateX(dx)
    },
    [isDragging, disabled]
  )

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || disabled || committed.current) return

    const dx = currentX.current - startX.current

    if (dx > SNAP_THRESHOLD) {
      // Approve — animate off to the right then commit
      committed.current = true
      setTranslateX(window.innerWidth)
      setTimeout(() => onApprove(), 220)
    } else if (dx < -SNAP_THRESHOLD) {
      // Reject — animate off to the left then commit
      committed.current = true
      setTranslateX(-window.innerWidth)
      setTimeout(() => onReject(), 220)
    } else {
      // Snap back
      reset()
    }
  }, [isDragging, disabled, onApprove, onReject, reset])

  // ---- Background layer opacity ------------------------------------

  const bgOpacity = Math.min(Math.abs(translateX) / OPACITY_RAMP, 0.95)
  const isRight = translateX > 0
  const isLeft = translateX < 0

  return (
    <div className="relative w-full overflow-hidden">
      {/* Approval background layer (green + checkmark) */}
      <div
        className="pointer-events-none absolute inset-0 z-0 flex items-center justify-end rounded-xl pr-8"
        style={{
          backgroundColor: isRight ? `rgba(31, 138, 76, ${bgOpacity})` : 'transparent',
          opacity: isRight ? 1 : 0,
          transition: isDragging ? 'none' : 'opacity 200ms ease',
        }}
        aria-hidden="true"
      >
        {isRight && (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      {/* Rejection background layer (red + X) */}
      <div
        className="pointer-events-none absolute inset-0 z-0 flex items-center justify-start rounded-xl pl-8"
        style={{
          backgroundColor: isLeft ? `rgba(180, 58, 45, ${bgOpacity})` : 'transparent',
          opacity: isLeft ? 1 : 0,
          transition: isDragging ? 'none' : 'opacity 200ms ease',
        }}
        aria-hidden="true"
      >
        {isLeft && (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </div>

      {/* Card content — draggable layer */}
      <div
        className="relative z-10"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          touchAction: 'pan-y', // allow vertical scroll, handle horizontal ourselves
        }}
      >
        {children}
      </div>
    </div>
  )
}
