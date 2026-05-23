/**
 * Sidebar — Desktop left navigation rail (220px fixed).
 *
 * Contains the Zentra logo area at the top and a scrollable list of nav items.
 * Supports a collapsible "icon-only" mode for tablet widths (64px).
 *
 * DESIGN SPEC:
 *   - Background: #181818
 *   - Width: 220px (full) | 64px (collapsed)
 *   - Logo area: 64px height
 *   - Nav items: 40px height, 8px radius, 2px gap
 *   - Active item: #242424 bg, white text, 3px #F37002 left border
 */

'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { SIDEBAR_ITEMS } from '@/lib/config/navigation'
import type { NavItem } from '@/lib/config/navigation'
import { SidebarItem } from './SidebarItem'

// ============================================================================
// Types
// ============================================================================

interface SidebarProps {
  /** When true, sidebar collapses to 64px icon-only mode. */
  collapsed?: boolean
  /** Pending review count for the Review Queue badge. */
  reviewCount?: number
}

// ============================================================================
// Component
// ============================================================================

/**
 * Sidebar — desktop left navigation rail.
 *
 * @param collapsed   — icon-only mode (64px) when true, full (220px) when false
 * @param reviewCount — number of transactions with status = 'pending_review'
 */
export function Sidebar({ collapsed = false, reviewCount = 0 }: SidebarProps): JSX.Element {
  const pathname = usePathname()

  /** Resolve the badge count for a given nav item. */
  const getBadgeCount = (item: NavItem): number | undefined => {
    if (item.badge === 'review_count') {
      return reviewCount > 0 ? reviewCount : undefined
    }
    return undefined
  }

  /** Check if a nav item's href matches the current pathname. */
  const isActiveRoute = (href: string): boolean => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/'
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const sidebarWidth = collapsed ? '64px' : '220px'
  const logoPadding = collapsed ? '0' : '0 16px'

  return (
    <aside
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        height: '100vh',
        backgroundColor: '#181818',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 150ms ease',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 50,
        overflow: 'hidden',
      }}
      aria-label="Main navigation"
    >
      {/* ── Logo Area ── */}
      <div
        style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          padding: logoPadding,
          gap: '8px',
          flexShrink: 0,
          borderBottom: '1px solid #242424',
        }}
      >
        {/* Orange accent square */}
        <div
          style={{
            width: '20px',
            height: '20px',
            backgroundColor: '#F37002',
            borderRadius: '3px',
            flexShrink: 0,
          }}
          aria-hidden="true"
        />

        {/* Text logo — hidden when collapsed */}
        {!collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '16px',
                fontWeight: 700,
                color: '#FFFFFF',
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
              }}
            >
              ZENTRA
            </span>
            <span
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '10px',
                fontWeight: 500,
                color: '#A0A0A0',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                lineHeight: 1,
              }}
            >
              FINANCE COCKPIT
            </span>
          </div>
        )}
      </div>

      {/* ── Nav Items ── */}
      <nav
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 8px',
          gap: '2px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {SIDEBAR_ITEMS.map((item) => (
          <SidebarItem
            key={item.href}
            label={item.label}
            href={item.href}
            icon={item.icon}
            isActive={isActiveRoute(item.href)}
            shortcut={item.shortcut}
            badgeCount={getBadgeCount(item)}
            collapsed={collapsed}
          />
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
