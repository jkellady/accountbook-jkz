/**
 * TopBar — Sticky top navigation bar showing page title and user actions.
 *
 * DESIGN SPEC:
 *   - Height: 48px, white background, 1px bottom border #E8E6E1
 *   - Left:  current page title (Fraunces 18px)
 *   - Right: notification bell (with badge), user avatar + dropdown menu
 *   - Position: sticky top
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Bell, LogOut, Settings, User } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface TopBarProps {
  /** Page title displayed on the left (derived from route). */
  title: string
  /** Number of unread notifications (pending in-app reminders). */
  notificationCount?: number
  /** User display name shown in the avatar menu. */
  userName?: string | null
  /** Callback when user clicks Sign Out. */
  onSignOut?: () => void
  /** Callback when user clicks Settings. */
  onSettings?: () => void
}

// ============================================================================
// Styles
// ============================================================================

const BAR_STYLE: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 40,
  height: '48px',
  backgroundColor: '#FFFFFF',
  borderBottom: '1px solid #E8E6E1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 20px',
  flexShrink: 0,
}

// ============================================================================
// Component
// ============================================================================

/**
 * TopBar — sticky page header with title, notifications, and user menu.
 *
 * @param title             — page title (from getPageMeta)
 * @param notificationCount — unread notification badge count
 * @param userName          — display name for the avatar
 * @param onSignOut         — sign out callback
 * @param onSettings        — navigate to settings callback
 */
export function TopBar({
  title,
  notificationCount = 0,
  userName,
  onSignOut,
  onSettings,
}: TopBarProps): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  /** Close menu on outside click. */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const handleToggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev)
  }, [])

  const handleSignOut = useCallback(() => {
    setMenuOpen(false)
    onSignOut?.()
  }, [onSignOut])

  const handleSettings = useCallback(() => {
    setMenuOpen(false)
    onSettings?.()
  }, [onSettings])

  /** User initials for the avatar fallback. */
  const initials = useMemo(() => {
    if (!userName) return 'U'
    return userName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [userName])

  return (
    <header style={BAR_STYLE}>
      {/* ── Left: Page Title ── */}
      <h1
        style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: '18px',
          fontWeight: 600,
          color: '#181818',
          margin: 0,
          lineHeight: 1,
        }}
      >
        {title}
      </h1>

      {/* ── Right: Actions ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Notification Bell */}
        <button
          type="button"
          style={{
            position: 'relative',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            color: '#6B6B6B',
            transition: 'all 150ms ease',
          }}
          aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ''}`}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F5F5F2'
            e.currentTarget.style.color = '#181818'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#6B6B6B'
          }}
        >
          <Bell size={18} strokeWidth={1.8} />
          {notificationCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                minWidth: '16px',
                height: '16px',
                padding: '0 4px',
                borderRadius: '8px',
                backgroundColor: '#F37002',
                color: '#FFFFFF',
                fontSize: '10px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>

        {/* User Avatar + Dropdown */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={handleToggleMenu}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#181818',
              color: '#FFFFFF',
              border: '2px solid #E8E6E1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '12px',
              fontWeight: 600,
              transition: 'all 150ms ease',
              padding: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#F37002'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E8E6E1'
            }}
            aria-label={`User menu${userName ? ` for ${userName}` : ''}`}
            aria-expanded={menuOpen}
          >
            {initials}
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <>
              {/* Backdrop */}
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 55,
                }}
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />

              {/* Menu Panel */}
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  zIndex: 60,
                  minWidth: '180px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                  border: '1px solid #E8E6E1',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
                role="menu"
              >
                {/* User name header */}
                {userName && (
                  <div
                    style={{
                      padding: '8px 12px',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#181818',
                      borderBottom: '1px solid #F0EFEA',
                      marginBottom: '4px',
                    }}
                  >
                    {userName}
                  </div>
                )}

                {/* Settings */}
                <MenuItem
                  icon={<Settings size={16} strokeWidth={1.8} />}
                  label="Settings"
                  onClick={handleSettings}
                />

                {/* Divider */}
                <div
                  style={{
                    height: '1px',
                    backgroundColor: '#F0EFEA',
                    margin: '4px 0',
                  }}
                />

                {/* Sign Out */}
                <MenuItem
                  icon={<LogOut size={16} strokeWidth={1.8} />}
                  label="Sign Out"
                  onClick={handleSignOut}
                  danger
                />
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

// ============================================================================
// Menu Item Sub-component
// ============================================================================

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}

function MenuItem({ icon, label, onClick, danger = false }: MenuItemProps): JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        height: '36px',
        padding: '0 12px',
        borderRadius: '6px',
        border: 'none',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '13px',
        fontWeight: 500,
        color: danger ? '#DC2626' : '#181818',
        transition: 'all 150ms ease',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = danger ? '#FEF2F2' : '#F5F5F2'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      {icon}
      {label}
    </button>
  )
}

export default TopBar
