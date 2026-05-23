/**
 * useOnlineStatus — React hook for tracking browser online/offline state.
 *
 * Wraps the `navigator.onLine` API in a reactive hook that updates
 * when the browser goes online or offline. Also tracks whether the user
 * was offline at any point during the session (useful for showing a
 * "back online" toast).
 *
 * @example
 * ```tsx
 * const { isOnline, wasOffline } = useOnlineStatus();
 * if (!isOnline) return <OfflineBanner />;
 * if (isOnline && wasOffline) return <BackOnlineToast />;
 * ```
 */

'use client'

import { useState, useEffect, useCallback } from 'react'

// -----------------------------------------------------------------------------
// Return type
// -----------------------------------------------------------------------------

/**
 * Return value of the useOnlineStatus hook.
 */
export interface OnlineStatus {
  /** Whether the browser is currently online (has network connectivity). */
  readonly isOnline: boolean
  /**
   * Whether the user was offline at any point during the current session.
   * Resets to `false` when explicitly cleared (e.g. after showing a toast).
   */
  readonly wasOffline: boolean
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Tracks the browser's online/offline status.
 *
 * Listens to the `online` and `offline` window events and exposes
 * `isOnline` plus a sticky `wasOffline` flag. The flag remains `true`
 * once the user has been offline, until the component unmounts or the
 * page is refreshed.
 *
 * @returns {{ isOnline: boolean; wasOffline: boolean }} Current network status.
 */
export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [wasOffline, setWasOffline] = useState<boolean>(false)

  /**
   * Explicitly clears the `wasOffline` flag.
   * Call this after showing a "back online" toast so it does not reappear.
   */
  const clearWasOffline = useCallback(() => {
    setWasOffline(false)
  }, [])

  useEffect(() => {
    /**
     * Updates state when the browser comes online.
     * Sets `wasOffline` to true only if transitioning from offline.
     */
    function handleOnline(): void {
      setIsOnline((prev) => {
        if (!prev) {
          setWasOffline(true)
        }
        return true
      })
    }

    /**
     * Updates state when the browser goes offline.
     */
    function handleOffline(): void {
      setIsOnline(false)
    }

    // Initialise with the current navigator state
    setIsOnline(navigator.onLine)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, wasOffline, clearWasOffline } as OnlineStatus & {
    clearWasOffline: () => void
  }
}
