/**
 * OfflineIndicator — PWA offline status banner.
 *
 * Displays a subtle amber banner at the top of the page when the browser
 * detects it is offline. Uses the useOnlineStatus hook for reactive
 * online/offline tracking.
 *
 * DESIGN SYSTEM:
 *   - Background: #FFF3DD (amber tint)
 *   - Text: #C77700 (dark amber)
 *   - Full width, fixed to top of viewport
 *   - Disappears automatically when connectivity is restored
 *
 * @example
 * ```tsx
 * <OfflineIndicator />
 * ```
 */

'use client'

import { useOnlineStatus } from '@/hooks/useOnlineStatus'

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Renders an offline warning banner fixed to the top of the viewport.
 *
 * The banner is only visible when `navigator.onLine` is `false`. It
 * automatically disappears when the browser comes back online.
 *
 * @returns {JSX.Element | null} The offline banner, or null if online.
 */
export function OfflineIndicator(): JSX.Element | null {
  const { isOnline } = useOnlineStatus()

  // Don't render anything when online
  if (isOnline) {
    return null
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: '#FFF3DD',
        color: '#C77700',
        padding: '10px 16px',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        fontWeight: 500,
        textAlign: 'center',
        borderBottom: '1px solid #FFE4B3',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
      }}
    >
      {/* Offline icon — SVG for no network dependency */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      <span>You&apos;re offline. Some features may not work.</span>
    </div>
  )
}

export default OfflineIndicator
