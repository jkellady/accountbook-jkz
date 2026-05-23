/**
 * Navigation Configuration for JK Zentra Finance Cockpit
 *
 * Single source of truth for all navigation items across the app.
 * Drives desktop sidebar, mobile bottom tabs, and the "More" overflow sheet.
 *
 * Badge sources reference columns from the schema — never invent columns.
 *   - 'review_count' → COUNT(*) FROM transactions WHERE status = 'pending_review'
 *   - 'notification_count' → COUNT(*) FROM reminders WHERE status = 'pending' AND channel = 'in_app'
 *
 * Keyboard shortcuts are bound in AppLayout.tsx via useEffect keydown listener.
 */

import {
  LayoutDashboard,
  Upload,
  BookOpen,
  TrendingUp,
  FolderKanban,
  CreditCard,
  Shield,
  Archive,
  Lock,
  Eye,
  Settings,
} from 'lucide-react'

import type { LucideIcon } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

/** Source for a dynamically-fetched badge count.
 *  'review_count'      → COUNT(*) FROM transactions WHERE status = 'pending_review'
 *  'notification_count' → COUNT(*) FROM reminders WHERE status = 'pending' AND channel = 'in_app'
 */
export type BadgeSource = 'review_count' | 'notification_count'

/** Single navigation item — rendered in sidebar, bottom tab, or overflow sheet. */
export interface NavItem {
  /** Display label shown next to the icon. */
  label: string
  /** Route href (e.g. '/dashboard'). */
  href: string
  /** Lucide icon component — imported at the top of this file. */
  icon: LucideIcon
  /** Keyboard shortcut key (desktop only). Numbers 1–9 map to sidebar index. */
  shortcut?: string
  /** Dynamic badge source — triggers a Supabase count fetch. */
  badge?: BadgeSource
  /** Whether this item appears as a primary tab in the mobile bottom bar. */
  mobileTab?: boolean
  /** Whether this item appears in the mobile "More" overflow sheet. */
  mobileOverflow?: boolean
}

/** Page metadata derived from the current route. */
export interface PageMeta {
  title: string
  description?: string
}

// ============================================================================
// Navigation Items (order = sidebar order on desktop)
// ============================================================================

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    shortcut: '1',
    mobileTab: true,
    mobileOverflow: false,
  },
  {
    label: 'Upload',
    href: '/upload',
    icon: Upload,
    shortcut: '2',
    mobileTab: false,
    mobileOverflow: true,
  },
  {
    label: 'Ledger',
    href: '/ledger',
    icon: BookOpen,
    shortcut: '3',
    mobileTab: true,
    mobileOverflow: false,
  },
  {
    label: 'Income Statement',
    href: '/income-statement',
    icon: TrendingUp,
    shortcut: '4',
    mobileTab: false,
    mobileOverflow: true,
  },
  {
    label: 'Projects',
    href: '/projects',
    icon: FolderKanban,
    shortcut: '5',
    mobileTab: false,
    mobileOverflow: true,
  },
  {
    label: 'Subscriptions',
    href: '/subscriptions',
    icon: CreditCard,
    shortcut: '6',
    mobileTab: false,
    mobileOverflow: true,
  },
  {
    label: 'Tax Position',
    href: '/tax-position',
    icon: Shield,
    shortcut: '7',
    mobileTab: false,
    mobileOverflow: true,
  },
  {
    label: 'Vault',
    href: '/vault',
    icon: Archive,
    shortcut: '8',
    mobileTab: false,
    mobileOverflow: true,
  },
  {
    label: 'Month-End',
    href: '/month-end',
    icon: Lock,
    shortcut: '9',
    mobileTab: false,
    mobileOverflow: true,
  },
  {
    label: 'Review Queue',
    href: '/review-queue',
    icon: Eye,
    badge: 'review_count',
    mobileTab: false,
    mobileOverflow: true,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    mobileTab: false,
    mobileOverflow: true,
  },
]

// ============================================================================
// Convenience lookups
// ============================================================================

/** Items shown in the desktop sidebar (all items). */
export const SIDEBAR_ITEMS: NavItem[] = NAV_ITEMS

/** Items shown as primary tabs in the mobile bottom bar. */
export const MOBILE_TAB_ITEMS: NavItem[] = NAV_ITEMS.filter((item) => item.mobileTab)

/** Items shown in the mobile "More" overflow sheet. */
export const MOBILE_OVERFLOW_ITEMS: NavItem[] = NAV_ITEMS.filter((item) => item.mobileOverflow)

/** Nav items with keyboard shortcuts — for the shortcuts cheat sheet. */
export const SHORTCUT_ITEMS: NavItem[] = NAV_ITEMS.filter((item) => item.shortcut)

// ============================================================================
// Page title lookup by href
// ============================================================================

/** Derive the page title from a route path. */
export function getPageMeta(pathname: string): PageMeta {
  const item = NAV_ITEMS.find((nav) => nav.href === pathname)
  if (item) {
    return { title: item.label }
  }

  // Fallbacks for known sub-routes
  if (pathname.startsWith('/ledger/')) {
    return { title: 'Transaction Detail', description: 'View transaction details' }
  }
  if (pathname.startsWith('/projects/')) {
    return { title: 'Project Detail', description: 'View project details' }
  }
  if (pathname.startsWith('/subscriptions/')) {
    return { title: 'Subscription Detail', description: 'View subscription details' }
  }

  return { title: 'JK Zentra Finance Cockpit' }
}
