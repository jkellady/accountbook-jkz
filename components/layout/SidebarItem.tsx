/**
 * SidebarItem — Individual navigation item for the desktop sidebar.
 *
 * Renders an icon + label with hover / active states and optional keyboard
 * shortcut hint. Used exclusively by the Sidebar component.
 *
 * DESIGN SPEC:
 *   - Height: 40px, padding: 0 12px, border-radius: 8px
 *   - Default: #A0A0A0 text, transparent background
 *   - Hover:   #242424 background, white text
 *   - Active:  #242424 background, white text, 3px #F37002 left border
 *   - Font:    Inter 13px weight 500
 *   - Gap between sibling items: 2px
 */

'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import type { BadgeSource } from '@/lib/config/navigation'

// ============================================================================
// Types
// ============================================================================

interface SidebarItemProps {
  /** Display label shown next to the icon. */
  label: string
  /** Route href. */
  href: string
  /** Lucide icon component. */
  icon: LucideIcon
  /** Whether this route is currently active. */
  isActive: boolean
  /** Keyboard shortcut key shown on hover (desktop only). */
  shortcut?: string
  /** Optional badge count displayed as a filled pill. */
  badgeCount?: number
  /** Whether to render in collapsed (icon-only) mode. */
  collapsed?: boolean
}

// ============================================================================
// Styles
// ============================================================================

const BASE_STYLES: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: '40px',
  padding: '0 12px',
  borderRadius: '8px',
  gap: '10px',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: '13px',
  fontWeight: 500,
  textDecoration: 'none',
  transition: 'all 150ms ease',
  position: 'relative',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  userSelect: 'none',
}

const STATE_STYLES = {
  default: {
    color: '#A0A0A0',
    backgroundColor: 'transparent',
    borderLeft: '3px solid transparent',
  } as React.CSSProperties,
  hover: {
    color: '#FFFFFF',
    backgroundColor: '#242424',
  } as React.CSSProperties,
  active: {
    color: '#FFFFFF',
    backgroundColor: '#242424',
    borderLeft: '3px solid #F37002',
  } as React.CSSProperties,
}

// ============================================================================
// Helpers
// ============================================================================

/** Map a badge source to a human-readable aria-label suffix. */
function badgeAriaLabel(count: number, label: string): string {
  return `${label}, ${count} pending item${count === 1 ? '' : 's'}`
}

/** Format a count for display — caps at 99+. */
function formatBadge(count: number): string {
  return count > 99 ? '99+' : String(count)
}

// ============================================================================
// Component
// ============================================================================

/**
 * SidebarItem — renders a single navigable row in the desktop sidebar.
 *
 * @param label      — display text
 * @param href       — Next.js route
 * @param icon       — Lucide icon component
 * @param isActive   — whether this item matches the current pathname
 * @param shortcut   — single character shown on hover (e.g. "3")
 * @param badgeCount — optional numeric badge (e.g. pending review count)
 * @param collapsed  — when true, hides the label for icon-only mode
 */
export function SidebarItem({
  label,
  href,
  icon: Icon,
  isActive,
  shortcut,
  badgeCount,
  collapsed = false,
}: SidebarItemProps): JSX.Element {
  const computedStyle = useMemo<React.CSSProperties>(() => {
    const state = isActive ? STATE_STYLES.active : STATE_STYLES.default
    return { ...BASE_STYLES, ...state }
  }, [isActive])

  const ariaLabel = badgeCount && badgeCount > 0
    ? badgeAriaLabel(badgeCount, label)
    : label

  return (
    <Link
      href={href}
      style={computedStyle}
      aria-label={ariaLabel}
      aria-current={isActive ? 'page' : undefined}
      onMouseEnter={(e) => {
        if (!isActive) {
          const el = e.currentTarget
          el.style.color = STATE_STYLES.hover.color as string
          el.style.backgroundColor = STATE_STYLES.hover.backgroundColor as string
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          const el = e.currentTarget
          el.style.color = STATE_STYLES.default.color as string
          el.style.backgroundColor = STATE_STYLES.default.backgroundColor as string
          el.style.borderLeft = STATE_STYLES.default.borderLeft as string
        }
      }}
    >
      {/* Icon */}
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />

      {/* Label — hidden when collapsed */}
      {!collapsed && (
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
      )}

      {/* Badge pill — shown even in collapsed mode as a small dot */}
      {badgeCount !== undefined && badgeCount > 0 && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: collapsed ? '8px' : '20px',
            height: collapsed ? '8px' : '18px',
            padding: collapsed ? '0' : '0 6px',
            borderRadius: collapsed ? '50%' : '9px',
            backgroundColor: '#F37002',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 600,
            lineHeight: 1,
            flexShrink: 0,
          }}
          aria-label={`${badgeCount} pending`}
        >
          {!collapsed && formatBadge(badgeCount)}
        </span>
      )}

      {/* Keyboard shortcut hint — only on hover, desktop only, never when collapsed */}
      {!collapsed && shortcut && (
        <kbd
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: 'Inter, monospace',
            fontSize: '11px',
            fontWeight: 500,
            color: '#6B6B6B',
            backgroundColor: 'transparent',
            border: 'none',
            padding: 0,
            opacity: 0,
            transition: 'opacity 150ms ease',
            pointerEvents: 'none',
          }}
          className="sidebar-item-shortcut"
          aria-hidden="true"
        >
          {shortcut}
        </kbd>
      )}
    </Link>
  )
}

export default SidebarItem
