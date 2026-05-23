/**
 * AppLayout — Root layout component for the JK Zentra Finance Cockpit.
 *
 * Switches between desktop (sidebar + top bar) and mobile (bottom tab bar + FAB)
 * at the 820px breakpoint. Manages keyboard shortcuts, nav active state, and
 * responsive layout switching.
 *
 * LAYOUT STRUCTURE:
 *
 *   Desktop (>= 820px):
 *     ┌────────┬──────────────────────────────────────┐
 *     │Sidebar │  Top Bar (48px, sticky)              │
 *     │(220px) ├──────────────────────────────────────┤
 *     │        │                                      │
 *     │  Nav   │  Page content (scrollable)           │
 *     │ Items  │                                      │
 *     │        │                                      │
 *     └────────┴──────────────────────────────────────┘
 *
 *   Mobile (< 820px):
 *     ┌──────────────────────────────────────┐
 *     │  Page content                        │
 *     │                                      │
 *     │  [+] FAB (centered above tab bar)    │
 *     ├────────┬────────┬────────┬──────────┤
 *     │ Dash   │ Ledger │   +    │ More     │
 *     └────────┴────────┴────────┴──────────┘
 */

'use client'

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { getPageMeta } from '@/lib/config/navigation'
import { SHORTCUT_ITEMS } from '@/lib/config/navigation'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { MoreSheet } from './MoreSheet'
import { FloatingUploadButton } from './FloatingUploadButton'

// ============================================================================
// Types
// ============================================================================

interface AppLayoutProps {
  /** Page content rendered inside the layout. */
  children: ReactNode
  /** Number of transactions with status = 'pending_review' (from Supabase). */
  reviewCount?: number
  /** Number of unread in-app reminders (from Supabase). */
  notificationCount?: number
  /** Signed-in user's display name (from users.display_name). */
  userName?: string | null
  /** Sign-out callback forwarded to the user menu. */
  onSignOut?: () => void
  /** Navigate-to-settings callback forwarded to the user menu. */
  onSettings?: () => void
  /** Callback when "Snap Receipt" is selected from the FAB sheet. */
  onSnapReceipt?: () => void
  /** Callback when "Upload File" is selected from the FAB sheet. */
  onUploadFile?: (files: FileList) => void
}

/** Responsive breakpoint in pixels — below this we show mobile layout. */
const MOBILE_BREAKPOINT = 820

// ============================================================================
// Component
// ============================================================================

/**
 * AppLayout — root responsive shell for the Finance Cockpit.
 *
 * @param children           — page content to render
 * @param reviewCount        — pending review transaction count (badge)
 * @param notificationCount  — unread notification count (bell badge)
 * @param userName           — user's display name for avatar
 * @param onSignOut          — sign out handler
 * @param onSettings         — settings navigation handler
 * @param onSnapReceipt      — camera capture handler from FAB
 * @param onUploadFile       — file upload handler from FAB
 */
export function AppLayout({
  children,
  reviewCount = 0,
  notificationCount = 0,
  userName,
  onSignOut,
  onSettings,
  onSnapReceipt,
  onUploadFile,
}: AppLayoutProps): JSX.Element {
  const pathname = usePathname()

  // ── Responsive state ───────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState<boolean>(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches)
    }
    handleChange(mql)
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  // ── Sheet / modal state ────────────────────────────────────────────────
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const handleMoreOpen = useCallback(() => setMoreSheetOpen(true), [])
  const handleMoreClose = useCallback(() => setMoreSheetOpen(false), [])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Ignore shortcuts when typing in inputs / textareas
      const target = event.target as HTMLElement
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      ) {
        return
      }

      // Close modals/panels with Escape
      if (event.key === 'Escape') {
        setMoreSheetOpen(false)
        setShortcutsOpen(false)
        return
      }

      // Open shortcuts cheat sheet with ?
      if (event.key === '?' && !event.shiftKey) {
        event.preventDefault()
        setShortcutsOpen((prev) => !prev)
        return
      }

      // Open upload with U
      if (event.key === 'u' || event.key === 'U') {
        event.preventDefault()
        // Dispatch a custom event that FloatingUploadButton can listen to
        window.dispatchEvent(new CustomEvent('zentra:open-upload'))
        return
      }

      // Navigate with 1–9
      const num = parseInt(event.key, 10)
      if (!isNaN(num) && num >= 1 && num <= 9) {
        const item = SHORTCUT_ITEMS[num - 1]
        if (item) {
          event.preventDefault()
          window.location.href = item.href
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Derived state ──────────────────────────────────────────────────────
  const pageMeta = useMemo(() => getPageMeta(pathname), [pathname])
  const sidebarWidth = isMobile ? 0 : 220

  // Prevent hydration mismatch — render nothing until mounted
  if (!mounted) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#FAFAF7',
        }}
      />
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#FAFAF7',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* ── Desktop Sidebar ── */}
      {!isMobile && (
        <Sidebar
          reviewCount={reviewCount}
        />
      )}

      {/* ── Main Content Area ── */}
      <div
        style={{
          marginLeft: isMobile ? 0 : `${sidebarWidth}px`,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: isMobile
            ? 'calc(64px + env(safe-area-inset-bottom))'
            : 0,
          transition: 'margin-left 150ms ease',
        }}
      >
        {/* ── Top Bar (both desktop and mobile) ── */}
        <TopBar
          title={pageMeta.title}
          notificationCount={notificationCount}
          userName={userName}
          onSignOut={onSignOut}
          onSettings={onSettings}
        />

        {/* ── Page Content ── */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      {isMobile && (
        <BottomNav
          onMoreOpen={handleMoreOpen}
          onFabClick={() => {
            window.dispatchEvent(new CustomEvent('zentra:open-upload'))
          }}
        />
      )}

      {/* ── Mobile FAB ── */}
      {isMobile && (
        <FloatingUploadButton
          position="mobile-center"
          onSnapReceipt={onSnapReceipt}
          onUploadFile={onUploadFile}
        />
      )}

      {/* ── Desktop FAB (optional, bottom-right) ── */}
      {!isMobile && (onSnapReceipt || onUploadFile) && (
        <FloatingUploadButton
          position="desktop-br"
          onSnapReceipt={onSnapReceipt}
          onUploadFile={onUploadFile}
        />
      )}

      {/* ── More Sheet (mobile overflow menu) ── */}
      {isMobile && (
        <MoreSheet
          isOpen={moreSheetOpen}
          onClose={handleMoreClose}
          reviewCount={reviewCount}
        />
      )}

      {/* ── Keyboard Shortcuts Cheat Sheet ── */}
      {shortcutsOpen && (
        <ShortcutsCheatSheet onClose={() => setShortcutsOpen(false)} />
      )}
    </div>
  )
}

// ============================================================================
// Shortcuts Cheat Sheet
// ============================================================================

interface ShortcutsCheatSheetProps {
  onClose: () => void
}

/** Overlay showing all available keyboard shortcuts. Triggered by `?`. */
function ShortcutsCheatSheet({ onClose }: ShortcutsCheatSheetProps): JSX.Element {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          padding: '24px',
        }}
        role="dialog"
        aria-label="Keyboard shortcuts"
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '18px',
              fontWeight: 600,
              color: '#181818',
              margin: 0,
            }}
          >
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: '13px',
              color: '#6B6B6B',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            Esc to close
          </button>
        </div>

        {/* Navigation shortcuts */}
        <ShortcutSection title="Navigation">
          {SHORTCUT_ITEMS.map((item) => (
            <ShortcutRow
              key={item.href}
              keys={[item.shortcut!]}
              label={item.label}
            />
          ))}
        </ShortcutSection>

        {/* Action shortcuts */}
        <ShortcutSection title="Actions">
          <ShortcutRow keys={['U']} label="Open upload" />
          <ShortcutRow keys={['?']} label="Show this cheat sheet" />
          <ShortcutRow keys={['Esc']} label="Close modal / panel" />
        </ShortcutSection>
      </div>
    </div>
  )
}

// ── Shortcut Section ──

interface ShortcutSectionProps {
  title: string
  children: ReactNode
}

function ShortcutSection({ title, children }: ShortcutSectionProps): JSX.Element {
  return (
    <div style={{ marginBottom: '20px' }}>
      <h3
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '11px',
          fontWeight: 600,
          color: '#A0A0A0',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin: '0 0 10px',
        }}
      >
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {children}
      </div>
    </div>
  )
}

// ── Shortcut Row ──

interface ShortcutRowProps {
  keys: string[]
  label: string
}

function ShortcutRow({ keys, label }: ShortcutRowProps): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        color: '#181818',
      }}
    >
      <span>{label}</span>
      <div style={{ display: 'flex', gap: '4px' }}>
        {keys.map((k) => (
          <kbd
            key={k}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '28px',
              height: '26px',
              padding: '0 6px',
              borderRadius: '5px',
              backgroundColor: '#F5F5F2',
              border: '1px solid #E8E6E1',
              fontFamily: 'Inter, monospace',
              fontSize: '12px',
              fontWeight: 500,
              color: '#181818',
              lineHeight: 1,
            }}
          >
            {k}
          </kbd>
        ))}
      </div>
    </div>
  )
}

export default AppLayout
