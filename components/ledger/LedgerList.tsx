/**
 * ============================================================================
 * LedgerList — Main Ledger Component for JK Zentra Finance Cockpit
 * ============================================================================
 *
 * The unified transaction list: single source of truth for all income
 * and expenses. Switches between a sortable table (desktop) and card
 * list (mobile). Supports URL-based filters, debounced search, infinite
 * scroll, and a friendly empty state.
 *
 * Features:
 *   - Desktop: full sortable table via TransactionTable
 *   - Mobile: vertical card stack via TransactionCard
 *   - Empty state with CTA to upload first receipt
 *   - Infinite scroll (50 items, loads more on scroll)
 *   - URL-based filter state (refresh-safe, shareable)
 *   - Debounced search (300ms)
 *   - Fully typed TypeScript — zero `any`
 *
 * @example
 * // Inside a Next.js page at /ledger
 * export default function LedgerPage() {
 *   return <LedgerList />
 * }
 */

'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'

import { LedgerFilters, type LedgerFiltersState, countActiveFilters } from './LedgerFilters'
import { LedgerSort, type SortField, type SortDirection } from './LedgerSort'
import { TransactionTable } from './TransactionTable'
import { TransactionCard } from './TransactionCard'

import type { TransactionRow } from '@/lib/supabase/database.types'
import { formatAmount } from '@/lib/utils/currency'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** Entity info needed for display — joined from entities table. */
interface EntityInfo {
  id: string
  name: string
  slug: string
  color: string
}

/** A transaction enriched with its entity info for display. */
interface EnrichedTransaction extends TransactionRow {
  entity: EntityInfo
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/** Number of items to load per page. */
const PAGE_SIZE = 50

/** Default sort: newest transactions first. */
const DEFAULT_SORT_FIELD: SortField = 'date'
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc'

/** Default filter state — everything visible. */
const DEFAULT_FILTERS: LedgerFiltersState = {
  search: '',
  entity: 'all',
  type: 'all',
  status: 'all',
  dateFrom: '',
  dateTo: '',
  categories: [],
  currency: 'all',
  tags: [],
}

/** Mobile breakpoint in pixels. */
const MOBILE_BREAKPOINT = 768

// ----------------------------------------------------------------------------
// Mock data — replace with Supabase query
// ----------------------------------------------------------------------------

/** Generate mock transactions for development/demo. */
function generateMockTransactions(count: number): EnrichedTransaction[] {
  const entities: EntityInfo[] = [
    { id: 'entity-1', name: 'Personal', slug: 'personal', color: '#6B6B6B' },
    { id: 'entity-2', name: 'JK Zentra', slug: 'jk-zentra', color: '#F37002' },
  ]

  const categories = [
    'Software', 'Services Income', 'Hardware', 'Infrastructure',
    'Marketing', 'Travel', 'Meals', 'Office', 'Professional Services',
    'Tax', 'Utilities', 'Insurance', 'Rent', 'Salary', 'Transfer', 'Other',
  ]

  const vendors = [
    'OpenAI', 'Supabase', 'Vercel', 'GitHub', 'Figma', 'Notion', 'Slack',
    'Client ABC', 'Client XYZ', 'LHDN', 'Maybank', 'Cloudflare', 'Datadog',
    'Stripe', 'Google Workspace', 'Adobe', 'JetBrains', 'Apple',
  ]

  const descriptions = [
    'Monthly subscription', 'Annual plan renewal', 'Project payment',
    'Invoice #2026-0042', 'CP500 instalment', 'Office supplies',
    'Team lunch', 'Cloud hosting', null, 'Consulting fee',
  ]

  const allTags = [
    'recurring', 'tax-deductible', 'client-billable', 'urgent',
    'annual', 'software', 'infrastructure', 'travel', 'meals',
  ]

  const transactions: EnrichedTransaction[] = []

  for (let i = 0; i < count; i++) {
    const entity = entities[i % 2]
    const isIncome = i % 5 === 0 // 20% income
    const type = isIncome ? 'income' : 'expense'
    const amountMinor = isIncome
      ? (Math.floor(Math.random() * 50000) + 5000) * 10 // RM 500 - 5000 income
      : (Math.floor(Math.random() * 5000) + 50) * 10    // RM 5 - 500 expense

    const date = new Date(2026, 0, 1)
    date.setDate(date.getDate() + Math.floor(Math.random() * 150))

    const category = categories[i % categories.length]
    const hasFile = Math.random() > 0.6
    const tagCount = Math.floor(Math.random() * 3)
    const txTags: string[] = []
    for (let t = 0; t < tagCount; t++) {
      const tag = allTags[(i + t) % allTags.length]
      if (!txTags.includes(tag)) txTags.push(tag)
    }

    const statuses: Array<'pending_review' | 'active' | 'archived'> = [
      'pending_review', 'active', 'archived',
    ]
    const status = statuses[i % 3]

    transactions.push({
      id: `tx-${i.toString().padStart(4, '0')}`,
      entity_id: entity.id,
      type,
      amount_minor: amountMinor,
      currency: i % 7 === 0 ? 'USD' : 'MYR',
      myr_equiv_minor: amountMinor,
      fx_rate: null,
      occurred_at: date.toISOString().split('T')[0],
      vendor: vendors[i % vendors.length],
      category,
      subcategory: i % 3 === 0 ? 'Premium' : null,
      description: descriptions[i % descriptions.length],
      notes: i % 4 === 0 ? 'Check with accountant' : null,
      tags: txTags,
      status,
      period_status: 'open',
      reference_code: i % 3 === 0 ? `INV-2026-${(i + 1).toString().padStart(3, '0')}` : null,
      closed_at: null,
      subscription_id: null,
      project_id: null,
      file_id: hasFile ? `file-${i}` : null,
      refund_of_transaction_id: null,
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
      entity,
    })
  }

  // Sort by date desc
  transactions.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
  return transactions
}

// ----------------------------------------------------------------------------
// Filter logic
// ----------------------------------------------------------------------------

/**
 * Apply all active filters to a list of transactions.
 * Pure function — no side effects.
 */
function applyFilters(
  transactions: EnrichedTransaction[],
  filters: LedgerFiltersState,
): EnrichedTransaction[] {
  return transactions.filter((tx) => {
    // Entity filter
    if (filters.entity !== 'all') {
      if (tx.entity.slug !== filters.entity) return false
    }

    // Type filter (income vs expense)
    if (filters.type !== 'all') {
      if (tx.type !== filters.type) return false
    }

    // Status filter
    if (filters.status !== 'all') {
      if (tx.status !== filters.status) return false
    }

    // Currency filter
    if (filters.currency !== 'all') {
      if (tx.currency !== filters.currency) return false
    }

    // Date range filter
    if (filters.dateFrom) {
      if (tx.occurred_at < filters.dateFrom) return false
    }
    if (filters.dateTo) {
      if (tx.occurred_at > filters.dateTo) return false
    }

    // Category filter
    if (filters.categories.length > 0) {
      if (!filters.categories.includes(tx.category)) return false
    }

    // Tags filter (must have ALL selected tags — AND semantics)
    if (filters.tags.length > 0) {
      const txTagsLower = tx.tags.map((t) => t.toLowerCase())
      const hasAllTags = filters.tags.every((tag) => txTagsLower.includes(tag))
      if (!hasAllTags) return false
    }

    // Search filter (vendor, description, category)
    if (filters.search.trim()) {
      const query = filters.search.toLowerCase().trim()
      const inVendor = tx.vendor.toLowerCase().includes(query)
      const inCategory = tx.category.toLowerCase().includes(query)
      const inDescription = tx.description
        ? tx.description.toLowerCase().includes(query)
        : false
      const inSubcategory = tx.subcategory
        ? tx.subcategory.toLowerCase().includes(query)
        : false
      const inReference = tx.reference_code
        ? tx.reference_code.toLowerCase().includes(query)
        : false
      if (!inVendor && !inCategory && !inDescription && !inSubcategory && !inReference) {
        return false
      }
    }

    return true
  })
}

// ----------------------------------------------------------------------------
// Sort logic
// ----------------------------------------------------------------------------

/**
 * Sort transactions by the given field and direction.
 * Pure function — no side effects.
 */
function applySort(
  transactions: EnrichedTransaction[],
  field: SortField,
  direction: SortDirection,
): EnrichedTransaction[] {
  const sorted = [...transactions]
  const multiplier = direction === 'asc' ? 1 : -1

  sorted.sort((a, b) => {
    switch (field) {
      case 'date':
        return multiplier * a.occurred_at.localeCompare(b.occurred_at)
      case 'amount':
        return multiplier * (a.amount_minor - b.amount_minor)
      case 'vendor':
        return multiplier * a.vendor.localeCompare(b.vendor)
      case 'category':
        return multiplier * a.category.localeCompare(b.category)
      default:
        return 0
    }
  })

  return sorted
}

// ----------------------------------------------------------------------------
// URL helpers
// ----------------------------------------------------------------------------

/**
 * Serialize filter state to URLSearchParams.
 * Only includes non-default values to keep URLs clean.
 */
function filtersToParams(filters: LedgerFiltersState): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.search.trim()) params.set('search', filters.search.trim())
  if (filters.entity !== 'all') params.set('entity', filters.entity)
  if (filters.type !== 'all') params.set('type', filters.type)
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.categories.length > 0) params.set('categories', filters.categories.join(','))
  if (filters.currency !== 'all') params.set('currency', filters.currency)
  if (filters.tags.length > 0) params.set('tags', filters.tags.join(','))

  return params
}

/**
 * Parse URLSearchParams into filter state.
 * Unrecognised values fall back to defaults.
 */
function paramsToFilters(params: URLSearchParams): LedgerFiltersState {
  const validEntities: LedgerFiltersState['entity'][] = ['all', 'personal', 'jk-zentra']
  const entity = params.get('entity')
  const validTypes: LedgerFiltersState['type'][] = ['all', 'income', 'expense']
  const type = params.get('type')
  const validStatuses: LedgerFiltersState['status'][] = ['all', 'active', 'pending_review', 'archived']
  const status = params.get('status')
  const validCurrencies: LedgerFiltersState['currency'][] = ['all', 'MYR', 'USD']
  const currency = params.get('currency')

  return {
    search: params.get('search') || '',
    entity: validEntities.includes(entity as LedgerFiltersState['entity']) ? (entity as LedgerFiltersState['entity']) : 'all',
    type: validTypes.includes(type as LedgerFiltersState['type']) ? (type as LedgerFiltersState['type']) : 'all',
    status: validStatuses.includes(status as LedgerFiltersState['status']) ? (status as LedgerFiltersState['status']) : 'all',
    dateFrom: params.get('dateFrom') || '',
    dateTo: params.get('dateTo') || '',
    categories: params.get('categories')?.split(',').filter(Boolean) ?? [],
    currency: validCurrencies.includes(currency as LedgerFiltersState['currency']) ? (currency as LedgerFiltersState['currency']) : 'all',
    tags: params.get('tags')?.split(',').filter(Boolean) ?? [],
  }
}

// ----------------------------------------------------------------------------
// Main component
// ----------------------------------------------------------------------------

/**
 * Main ledger list component.
 *
 * Orchestrates filters, sorting, pagination, and responsive display.
 * On desktop: renders TransactionTable. On mobile: renders TransactionCard stack.
 * Filter state is synced with URL search params.
 */
export function LedgerList(): JSX.Element {

  // --------------------------------------------------------------------------
  // URL state sync
  // --------------------------------------------------------------------------

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // --------------------------------------------------------------------------
  // Sort state
  // --------------------------------------------------------------------------

  const [sortField, setSortField] = useState<SortField>(() => {
    const urlField = searchParams.get('sortField')
    const validFields: SortField[] = ['date', 'amount', 'vendor', 'category']
    return validFields.includes(urlField as SortField) ? (urlField as SortField) : DEFAULT_SORT_FIELD
  })

  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const urlDir = searchParams.get('sortDir')
    return urlDir === 'asc' ? 'asc' : DEFAULT_SORT_DIRECTION
  })

  // --------------------------------------------------------------------------
  // Filter state (synced with URL)
  // --------------------------------------------------------------------------

  const [filters, setFilters] = useState<LedgerFiltersState>(() => {
    return paramsToFilters(searchParams)
  })

  /**
   * Update filters and push to URL.
   */
  const handleFiltersChange = useCallback(
    (newFilters: LedgerFiltersState) => {
      setFilters(newFilters)
      const params = filtersToParams(newFilters)
      // Preserve sort params in URL too
      params.set('sortField', sortField)
      params.set('sortDir', sortDirection)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [router, pathname, sortField, sortDirection]
  )

  /**
   * Update sort and push to URL.
   */
  const handleSortChange = useCallback(
    (field: SortField, direction: SortDirection) => {
      setSortField(field)
      setSortDirection(direction)
      const params = filtersToParams(filters)
      params.set('sortField', field)
      params.set('sortDir', direction)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [router, pathname, filters]
  )

  // --------------------------------------------------------------------------
  // Responsive: detect mobile
  // --------------------------------------------------------------------------

  const [isMobile, setIsMobile] = useState<boolean>(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // --------------------------------------------------------------------------
  // Data loading — mock for now, replace with Supabase
  // --------------------------------------------------------------------------

  const [allTransactions] = useState<EnrichedTransaction[]>(() =>
    generateMockTransactions(150)
  )

  const [availableTags] = useState<string[]>([
    'recurring', 'tax-deductible', 'client-billable', 'urgent',
    'annual', 'software', 'infrastructure', 'travel', 'meals',
  ])

  // --------------------------------------------------------------------------
  // Filter + sort + paginate
  // --------------------------------------------------------------------------

  /** All filtered and sorted transactions. */
  const processedTransactions = useMemo(() => {
    const filtered = applyFilters(allTransactions, filters)
    return applySort(filtered, sortField, sortDirection)
  }, [allTransactions, filters, sortField, sortDirection])

  /** Visible count for infinite scroll. */
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  /** Reset visible count when filters change. */
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [filters, sortField, sortDirection])

  /** Currently visible subset. */
  const visibleTransactions = useMemo(() => {
    return processedTransactions.slice(0, visibleCount)
  }, [processedTransactions, visibleCount])

  const hasMore = visibleCount < processedTransactions.length

  // --------------------------------------------------------------------------
  // Infinite scroll
  // --------------------------------------------------------------------------

  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hasMore) return
    if (!loadMoreRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + PAGE_SIZE)
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, visibleCount])

  // --------------------------------------------------------------------------
  // Derived state
  // --------------------------------------------------------------------------

  const activeFilterCount = countActiveFilters(filters)
  const totalCount = processedTransactions.length
  const isEmpty = allTransactions.length === 0

  /** Entity map for table lookups. */
  const entityMap = useMemo(() => {
    const map: Record<string, { name: string; slug: string; color: string }> = {}
    allTransactions.forEach((tx) => {
      if (!map[tx.entity_id]) {
        map[tx.entity_id] = tx.entity
      }
    })
    return map
  }, [allTransactions])

  // --------------------------------------------------------------------------
  // Selection state (detail panel)
  // --------------------------------------------------------------------------

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleRowClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }, [])

  // --------------------------------------------------------------------------
  // Summary stats
  // --------------------------------------------------------------------------

  const summaryStats = useMemo(() => {
    let incomeMinor = 0
    let expenseMinor = 0
    processedTransactions.forEach((tx) => {
      if (tx.type === 'income') {
        incomeMinor += tx.amount_minor
      } else {
        expenseMinor += tx.amount_minor
      }
    })
    return { incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor }
  }, [processedTransactions])

  // --------------------------------------------------------------------------
  // Empty state
  // --------------------------------------------------------------------------

  if (isEmpty) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: '#FAFAF7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            fontSize: '36px',
          }}
        >
          &#128196;
        </div>
        <h2
          style={{
            margin: '0 0 8px',
            fontSize: '20px',
            fontWeight: 600,
            color: '#181818',
          }}
        >
          No transactions yet
        </h2>
        <p
          style={{
            margin: '0 0 24px',
            fontSize: '14px',
            color: '#6B6B6B',
            maxWidth: '320px',
            lineHeight: 1.5,
          }}
        >
          Upload your first receipt to get started. We'll extract the details automatically.
        </p>
        <button
          onClick={() => {
            // Navigate to upload page or open upload modal
            // router.push('/upload') or similar
          }}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 600,
            border: 'none',
            borderRadius: '10px',
            background: '#F37002',
            color: 'white',
            cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'opacity 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
        >
          Upload Receipt
        </button>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // Main render
  // --------------------------------------------------------------------------

  return (
    <div
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* ================================================================ */}
      {/* Header: title + stats + sort */}
      {/* ================================================================ */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 700,
              color: '#181818',
              letterSpacing: '-0.02em',
            }}
          >
            Ledger
          </h1>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '13px',
              color: '#6B6B6B',
            }}
          >
            {totalCount.toLocaleString()} transaction{totalCount !== 1 ? 's' : ''}
            {summaryStats.incomeMinor > 0 && (
              <>
                {' · '}
                <span style={{ color: '#1F8A4C', fontWeight: 500 }}>
                  +{formatAmount(summaryStats.incomeMinor, 'MYR')}
                </span>
              </>
            )}
            {summaryStats.expenseMinor > 0 && (
              <>
                {' · '}
                <span style={{ color: '#181818', fontWeight: 500 }}>
                  -{formatAmount(summaryStats.expenseMinor, 'MYR')}
                </span>
              </>
            )}
            {summaryStats.netMinor !== 0 && (
              <>
                {' · '}
                <span
                  style={{
                    fontWeight: 600,
                    color: summaryStats.netMinor >= 0 ? '#1F8A4C' : '#C14A0E',
                  }}
                >
                  Net: {formatAmount(Math.abs(summaryStats.netMinor), 'MYR')}
                  {summaryStats.netMinor < 0 ? ' deficit' : ' surplus'}
                </span>
              </>
            )}
          </p>
        </div>

        <LedgerSort
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
        />
      </div>

      {/* ================================================================ */}
      {/* Filters */}
      {/* ================================================================ */}
      <div>
        {isMobile ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <LedgerFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              availableTags={availableTags}
              isMobile={true}
            />
            {/* Also show search inline on mobile */}
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#A0A0A0',
                  fontSize: '14px',
                }}
              >
                &#128269;
              </span>
              <input
                type="text"
                placeholder="Search..."
                value={filters.search}
                onChange={(e) =>
                  handleFiltersChange({ ...filters, search: e.target.value })
                }
                aria-label="Search transactions"
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  border: '1px solid #E8E6E1',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  background: 'white',
                  color: '#181818',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#F37002'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E8E6E1'
                }}
              />
            </div>
          </div>
        ) : (
          <LedgerFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            availableTags={availableTags}
            isMobile={false}
          />
        )}
      </div>

      {/* ================================================================ */}
      {/* Transaction list: table (desktop) or cards (mobile) */}
      {/* ================================================================ */}
      {isMobile ? (
        // Mobile: card stack
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {visibleTransactions.map((tx) => (
            <TransactionCard
              key={tx.id}
              transaction={tx}
              entity={tx.entity}
              onClick={handleRowClick}
            />
          ))}

          {/* Load more sentinel */}
          {hasMore && (
            <div
              ref={loadMoreRef}
              style={{
                padding: '20px',
                textAlign: 'center',
                color: '#A0A0A0',
                fontSize: '13px',
              }}
            >
              Loading more...
            </div>
          )}

          {/* End of list */}
          {!hasMore && totalCount > 0 && (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: '#A0A0A0',
                fontSize: '13px',
              }}
            >
              {totalCount} transaction{totalCount !== 1 ? 's' : ''} total
            </div>
          )}
        </div>
      ) : (
        // Desktop: sortable table
        <>
          <TransactionTable
            transactions={visibleTransactions}
            entities={entityMap}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            onRowClick={handleRowClick}
            selectedId={selectedId}
          />

          {/* Load more sentinel */}
          {hasMore && (
            <div
              ref={loadMoreRef}
              style={{
                padding: '20px',
                textAlign: 'center',
                color: '#A0A0A0',
                fontSize: '13px',
              }}
            >
              Loading more...
            </div>
          )}

          {/* End of list */}
          {!hasMore && totalCount > 0 && (
            <div
              style={{
                padding: '16px',
                textAlign: 'center',
                color: '#A0A0A0',
                fontSize: '13px',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              Showing all {totalCount.toLocaleString()} transaction
              {totalCount !== 1 ? 's' : ''}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default LedgerList
