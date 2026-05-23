/**
 * PWABootstrap — Service Worker registration and PWA lifecycle manager.
 *
 * Client-only component that:
 *   1. Registers the service worker on mount
 *   2. Listens for service worker updates (new version available)
 *   3. Monitors online/offline state and shows an offline indicator
 *   4. Shows an "Update available" toast when a new SW is waiting
 *
 * Mount this component once at the root of your app (e.g. inside the
 * root layout or AppLayout).
 *
 * @example
 * ```tsx
 * // In your root layout or AppLayout:
 * <PWABootstrap />
 * ```
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { OfflineIndicator } from './OfflineIndicator'
import { InstallPrompt } from './InstallPrompt'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** States for the service worker update UI. */
interface SWUpdateState {
  /** Whether a new service worker is waiting to activate. */
  readonly updateAvailable: boolean
  /** The waiting ServiceWorker registration, if any. */
  readonly waitingSW: ServiceWorker | null
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Bootstraps all PWA functionality: service worker registration,
 * update detection, offline monitoring, and install prompting.
 *
 * Renders invisible UI components (OfflineIndicator, InstallPrompt)
 * and manages a toast notification when a new app version is available.
 *
 * @returns {JSX.Element} The PWA bootstrap wrapper with child indicators.
 */
export function PWABootstrap(): JSX.Element {
  const [updateState, setUpdateState] = useState<SWUpdateState>({
    updateAvailable: false,
    waitingSW: null,
  })

  // ── Service Worker Registration ──────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    /**
     * Registers the service worker and sets up update detection.
     */
    async function registerSW(): Promise<void> {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')

        // Check for updates immediately
        await registration.update()

        // Listen for new service workers waiting
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // New SW is waiting — there's an update available
              setUpdateState({
                updateAvailable: true,
                waitingSW: newWorker,
              })
            }
          })
        })

        // Also check if there's already a waiting SW on page load
        if (registration.waiting && navigator.serviceWorker.controller) {
          setUpdateState({
            updateAvailable: true,
            waitingSW: registration.waiting,
          })
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[PWA] Service worker registration failed:', error)
      }
    }

    registerSW()
  }, [])

  // ── Listen for SW messages (update available from SWR strategy) ──────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    /**
     * Handles messages posted from the service worker.
     */
    function handleMessage(event: MessageEvent<unknown>): void {
      if (
        event.data &&
        typeof event.data === 'object' &&
        'type' in event.data &&
        event.data.type === 'SW_UPDATE_AVAILABLE'
      ) {
        setUpdateState((prev) => ({
          ...prev,
          updateAvailable: true,
        }))
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [])

  // ── Update action ────────────────────────────────────────────────────────

  /**
   * Applies the waiting service worker update and reloads the page.
   */
  const handleApplyUpdate = useCallback(() => {
    if (!updateState.waitingSW) return

    // Tell the waiting SW to skip waiting and activate
    updateState.waitingSW.postMessage({ type: 'SKIP_WAITING' })

    // Listen for the new controller to take over, then reload
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })
  }, [updateState.waitingSW])

  /**
   * Dismisses the update toast without applying the update.
   */
  const handleDismissUpdate = useCallback(() => {
    setUpdateState((prev) => ({
      ...prev,
      updateAvailable: false,
    }))
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Offline status banner — fixed at top */}
      <OfflineIndicator />

      {/* Install prompt — floating banner on mobile */}
      <InstallPrompt />

      {/* Update available toast */}
      {updateState.updateAvailable && (
        <UpdateToast
          onApply={handleApplyUpdate}
          onDismiss={handleDismissUpdate}
        />
      )}
    </>
  )
}

// -----------------------------------------------------------------------------
// Update Toast sub-component
// -----------------------------------------------------------------------------

/**
 * Props for the UpdateToast component.
 */
interface UpdateToastProps {
  /** Callback when the user clicks "Update" to apply the new version. */
  readonly onApply: () => void
  /** Callback when the user dismisses the toast. */
  readonly onDismiss: () => void
}

/**
 * A toast notification shown when a new service worker is waiting.
 * Provides "Update" and "Dismiss" actions.
 *
 * @param {UpdateToastProps} props - Component props.
 * @returns {JSX.Element} The update toast.
 */
function UpdateToast({ onApply, onDismiss }: UpdateToastProps): JSX.Element {
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 9998,
        backgroundColor: '#181818',
        color: '#FFFFFF',
        borderRadius: '12px',
        padding: '14px 18px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        fontFamily: 'Inter, system-ui, sans-serif',
        maxWidth: '340px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Refresh icon */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#F37002"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#FFFFFF',
            }}
          >
            Update Available
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss update notification"
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#A0A0A0',
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: 1,
            padding: '2px',
            fontFamily: 'inherit',
          }}
        >
          &times;
        </button>
      </div>

      {/* Body */}
      <p
        style={{
          margin: 0,
          fontSize: '13px',
          color: '#C0C0C0',
          lineHeight: 1.5,
        }}
      >
        A new version of Zentra is ready. Update now for the latest features
        and improvements.
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#C0C0C0',
            backgroundColor: 'transparent',
            border: '1px solid #3A3A3A',
            borderRadius: '8px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Later
        </button>
        <button
          type="button"
          onClick={onApply}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#FFFFFF',
            backgroundColor: '#F37002',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Update Now
        </button>
      </div>
    </div>
  )
}

export default PWABootstrap
