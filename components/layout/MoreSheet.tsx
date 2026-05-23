/**
 * MoreSheet — Mobile overflow bottom sheet for secondary navigation items.
 *
 * Slides up from the bottom listing nav items that don't fit in the tab bar.
 * Tap the backdrop to dismiss.
 *
 * DESIGN SPEC:
 *   - Slides up from bottom
 *   - White background, 16px top border-radius
 *   - Lists: Upload, Income Statement, Projects, Subscriptions, Tax Position,
 *            Vault, Month-End, Settings, Review Queue
 *   - Each item: icon + full name
 *   - Backdrop: semi-transparent black, tap to dismiss
 */

'use client'

import { useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { X } from 'lucide-react'
import { MOBILE_OVERFLOW_ITEMS } from '@/lib/config/navigation'
import type { NavItem } from '@/lib/config/navigation'

// ============================================================================
// Types
// ============================================================================

interface MoreSheetProps {
  /** Whether the sheet is currently visible. */
  isOpen: boolean
  /** Callback to close the sheet. */
  onClose: () => void
  /** Pending review count for the Review Queue badge. */
  reviewCount?: number
}

// ============================================================================
// Component
// ============================================================================

/**
 * MoreSheet — mobile overflow navigation bottom sheet.
 *
 * @param isOpen       — visibility state
 * @param onClose      — close callback (backdrop tap, ESC, or item click)
 * @param reviewCount  — badge count for Review Queue
 */
export function MoreSheet({ isOpen, onClose, reviewCount = 0 }: MoreSheetProps): JSX.Element | null {
  const pathname = usePathname()

  /** Close on Escape key. */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  /** Prevent body scroll when sheet is open. */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const isActiveRoute = useCallback(
    (href: string): boolean => {
      if (href === '/dashboard') {
        return pathname === '/dashboard' || pathname === '/'
      }
      return pathname === href || pathname.startsWith(`${href}/`)
    },
    [pathname]
  )

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      {/* ── Backdrop ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          animation: 'fadeIn 150ms ease',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Sheet Panel ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
          borderRadius: '16px 16px 0 0',
          padding: '16px 0',
          maxHeight: '70vh',
          overflowY: 'auto',
          animation: 'slideUp 200ms ease',
        }}
        role="dialog"
        aria-label="More navigation options"
      >
        {/* Drag handle */}
        <div
          style={{
            width: '40px',
            height: '4px',
            borderRadius: '2px',
            backgroundColor: '#D1CFC8',
            margin: '0 auto 16px',
          }}
          aria-hidden="true"
        />

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px 12px',
            borderBottom: '1px solid #F0EFEA',
            marginBottom: '8px',
          }}
        >
          <h2
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '16px',
              fontWeight: 600,
              color: '#181818',
              margin: 0,
            }}
          >
            More
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#F5F5F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#6B6B6B',
              transition: 'all 150ms ease',
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav Items */}
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: '0 12px',
          }}
        >
          {MOBILE_OVERFLOW_ITEMS.map((item) => {
            const isActive = isActiveRoute(item.href)
            const badgeCount = item.badge === 'review_count' ? reviewCount : undefined
            const Icon = item.icon

            return (
              <SheetItem
                key={item.href}
                item={item}
                isActive={isActive}
                badgeCount={badgeCount}
                onClick={onClose}
              />
            )
          })}
        </nav>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

// ============================================================================
// Sheet Item Sub-component
// ============================================================================

interface SheetItemProps {
  item: NavItem
  isActive: boolean
  badgeCount?: number
  onClick: () => void
}

function SheetItem({ item, isActive, badgeCount, onClick }: SheetItemProps): JSX.Element {
  const Icon = item.icon
  const bgColor = isActive ? '#242424' : 'transparent'
  const textColor = isActive ? '#FFFFFF' : '#181818'

  return (
    <Link
      href={item.href}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        height: '48px',
        padding: '0 16px',
        borderRadius: '10px',
        backgroundColor: bgColor,
        color: textColor,
        textDecoration: 'none',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '15px',
        fontWeight: 500,
        transition: 'all 150ms ease',
      }}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon size={20} strokeWidth={1.8} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {badgeCount !== undefined && badgeCount > 0 && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '24px',
            height: '22px',
            padding: '0 8px',
            borderRadius: '11px',
            backgroundColor: '#F37002',
            color: '#FFFFFF',
            fontSize: '12px',
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </Link>
  )
}

export default MoreSheet
