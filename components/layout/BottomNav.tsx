/**
 * BottomNav — Mobile bottom tab bar with 4 slots + FAB.
 *
 * Tab layout:
 *   [Dashboard] [Ledger] [FAB] [More]
 *
 * DESIGN SPEC:
 *   - Height: 64px + env(safe-area-inset-bottom)
 *   - Background: #181818
 *   - Inactive: #6B6B6B icon + label
 *   - Active: white icon + label
 *   - Label font: Inter 11px
 *   - FAB: 56px orange circle centered above the bar
 */

'use client'

import { useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BookOpen, Upload, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { MOBILE_TAB_ITEMS, MOBILE_OVERFLOW_ITEMS } from '@/lib/config/navigation'
import type { NavItem } from '@/lib/config/navigation'

// ============================================================================
// Types
// ============================================================================

interface BottomNavProps {
  /** Callback when the "More" button is tapped. */
  onMoreOpen: () => void
  /** Callback when the FAB (center upload button) is tapped. */
  onFabClick: () => void
}

// ============================================================================
// Styles
// ============================================================================

const BAR_STYLE: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 50,
  height: 'calc(64px + env(safe-area-inset-bottom))',
  paddingBottom: 'env(safe-area-inset-bottom)',
  backgroundColor: '#181818',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-around',
  borderTop: '1px solid #242424',
}

// ============================================================================
// Component
// ============================================================================

/**
 * BottomNav — mobile tab bar with Dashboard, Ledger, FAB, and More.
 *
 * @param onMoreOpen  — opens the overflow bottom sheet
 * @param onFabClick  — opens the upload options sheet
 */
export function BottomNav({ onMoreOpen, onFabClick }: BottomNavProps): JSX.Element {
  const pathname = usePathname()

  /** Check if a route is active. */
  const isActiveRoute = useCallback(
    (href: string): boolean => {
      if (href === '/dashboard') {
        return pathname === '/dashboard' || pathname === '/'
      }
      return pathname === href || pathname.startsWith(`${href}/`)
    },
    [pathname]
  )

  // Mobile tab items: Dashboard and Ledger
  const dashboardItem = MOBILE_TAB_ITEMS[0] // Dashboard
  const ledgerItem = MOBILE_TAB_ITEMS[1] // Ledger

  return (
    <nav style={BAR_STYLE} aria-label="Mobile navigation">
      {/* ── Tab 1: Dashboard ── */}
      <TabButton
        item={dashboardItem}
        isActive={isActiveRoute(dashboardItem.href)}
        label="Dash"
      />

      {/* ── Tab 2: Ledger ── */}
      <TabButton
        item={ledgerItem}
        isActive={isActiveRoute(ledgerItem.href)}
        label="Ledger"
      />

      {/* ── Tab 3: FAB (center) ── */}
      <button
        type="button"
        onClick={onFabClick}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#F37002',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(243,112,2,0.3)',
          transition: 'all 150ms ease',
          transform: 'translateY(-14px)',
          position: 'relative',
          zIndex: 51,
        }}
        aria-label="Upload"
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-14px) scale(1.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(-14px) scale(1)'
        }}
        onTouchStart={(e) => {
          e.currentTarget.style.transform = 'translateY(-14px) scale(0.95)'
        }}
        onTouchEnd={(e) => {
          e.currentTarget.style.transform = 'translateY(-14px) scale(1)'
        }}
      >
        <Upload size={24} strokeWidth={2} color="#FFFFFF" />
      </button>

      {/* ── Tab 4: More ── */}
      <button
        type="button"
        onClick={onMoreOpen}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          height: '64px',
          padding: '0 16px',
          backgroundColor: 'transparent',
          border: 'none',
          color: '#6B6B6B',
          cursor: 'pointer',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '11px',
          fontWeight: 500,
          transition: 'all 150ms ease',
        }}
        aria-label="More options"
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          More
          <ChevronUp size={12} strokeWidth={2} />
        </span>
      </button>
    </nav>
  )
}

// ============================================================================
// Tab Button Sub-component
// ============================================================================

interface TabButtonProps {
  item: NavItem
  isActive: boolean
  label: string
}

function TabButton({ item, isActive, label }: TabButtonProps): JSX.Element {
  const color = isActive ? '#FFFFFF' : '#6B6B6B'
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        height: '64px',
        padding: '0 16px',
        textDecoration: 'none',
        color,
        transition: 'all 150ms ease',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '11px',
        fontWeight: 500,
      }}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
      <span>{label}</span>
    </Link>
  )
}

export default BottomNav
