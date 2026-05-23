/**
 * InstallPrompt — PWA install banner for mobile browsers.
 *
 * Detects when the app is installable (via the `beforeinstallprompt` event)
 * and shows a polite, dismissible banner on mobile devices. The banner
 * prompts the user to add Zentra to their home screen for faster access.
 *
 * BEHAVIOUR:
 *   - Only shows on mobile browsers (detected via user agent / screen size)
 *   - Hidden when app is already in standalone/display-mode
 *   - "Install" button triggers the native install prompt
 *   - "Dismiss" button hides the banner for 7 days (stored in localStorage)
 *   - Respects the `beforeinstallprompt` event for deferred installation
 *
 * DESIGN SYSTEM:
 *   - Background: #FFF6EF (warm tint)
 *   - Accent: #F37002 (Zentra orange)
 *   - Border radius: 12px
 *
 * @example
 * ```tsx
 * <InstallPrompt />
 * ```
 */

'use client'

import { useState, useEffect, useCallback } from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * The browser's BeforeInstallPromptEvent — not yet in standard TypeScript DOM.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

/** localStorage key for tracking when the banner was last dismissed. */
const STORAGE_KEY = 'zentra_install_prompt_dismissed_at'

/** Cooldown period in milliseconds — 7 days. */
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

/** Time after which the banner is considered dismissible again. */
function isCooldownExpired(dismissedAt: string | null): boolean {
  if (!dismissedAt) return true
  const dismissedTime = parseInt(dismissedAt, 10)
  if (isNaN(dismissedTime)) return true
  return Date.now() - dismissedTime > DISMISS_COOLDOWN_MS
}

/** Detect if the app is running in standalone / installed mode. */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS standalone detection
    ('standalone' in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true)
  )
}

/** Detect if the device is mobile (screen width under 820px). */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 820 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Renders a dismissible PWA install banner on supported mobile browsers.
 *
 * Listens for the `beforeinstallprompt` event to capture the deferred install
 * prompt. Shows a styled banner with Install and Dismiss actions. The banner
 * respects a 7-day cooldown after dismissal.
 *
 * @returns {JSX.Element | null} The install banner, or null when hidden.
 */
export function InstallPrompt(): JSX.Element | null {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState<boolean>(false)
  const [mounted, setMounted] = useState<boolean>(false)

  // ── Mount detection ───────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true)
  }, [])

  // ── Listen for beforeinstallprompt event ──────────────────────────────────
  useEffect(() => {
    /**
     * Captures the install prompt event so we can trigger it later.
     */
    function handleBeforeInstallPrompt(event: Event): void {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)

      // Only show if not standalone, on mobile, and not in cooldown
      const dismissedAt = localStorage.getItem(STORAGE_KEY)
      if (
        !isStandalone() &&
        isMobileDevice() &&
        isCooldownExpired(dismissedAt)
      ) {
        setVisible(true)
      }
    }

    /**
     * Fired when the app is installed — hide the banner.
     */
    function handleAppInstalled(): void {
      setDeferredPrompt(null)
      setVisible(false)
    }

    window.addEventListener(
      'beforeinstallprompt',
      handleBeforeInstallPrompt as EventListener
    )
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt as EventListener
      )
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // ── Also check visibility on mount (in case prompt was captured before) ──
  useEffect(() => {
    if (!deferredPrompt) return
    const dismissedAt = localStorage.getItem(STORAGE_KEY)
    if (
      !isStandalone() &&
      isMobileDevice() &&
      isCooldownExpired(dismissedAt)
    ) {
      setVisible(true)
    }
  }, [deferredPrompt])

  // ── Handlers ─────────────────────────────────────────────────────────────

  /**
   * Triggers the native browser install prompt.
   */
  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()

    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      // User installed — clean up
      setDeferredPrompt(null)
      setVisible(false)
    }
    // If dismissed, the banner stays visible — user can try again
  }, [deferredPrompt])

  /**
   * Dismisses the banner and stores the dismissal timestamp in localStorage
   * for the 7-day cooldown period.
   */
  const handleDismiss = useCallback(() => {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, Date.now().toString())
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────

  // Prevent hydration mismatch
  if (!mounted) return null

  // Don't show if no prompt available, not visible, or already installed
  if (!visible || !deferredPrompt) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
        left: '16px',
        right: '16px',
        zIndex: 9000,
        backgroundColor: '#FFF6EF',
        borderRadius: '12px',
        padding: '14px 16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        border: '1px solid #FFE8D6',
      }}
    >
      {/* App icon */}
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          backgroundColor: '#181818',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '22px',
          fontWeight: 700,
          color: '#F37002',
        }}
      >
        Z
      </div>

      {/* Text content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#181818',
            lineHeight: 1.3,
          }}
        >
          Add Zentra to Home Screen
        </div>
        <div
          style={{
            fontSize: '12px',
            color: '#6B6B6B',
            marginTop: '2px',
            lineHeight: 1.4,
          }}
        >
          Install for faster access and offline use
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#6B6B6B',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={handleInstall}
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
            whiteSpace: 'nowrap',
          }}
        >
          Install
        </button>
      </div>
    </div>
  )
}

export default InstallPrompt
