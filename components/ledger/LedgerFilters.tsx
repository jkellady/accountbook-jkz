/**
 * ============================================================================
 * LedgerFilters — Filter Bar for the Ledger List
 * ============================================================================
 *
 * Comprehensive filter controls with URL search param sync.
 * All filters are debounced where appropriate (search: 300ms).
 *
 * Supported filters:
 *   - search:       full-text on vendor, description, category
 *   - entity:       'all' | 'personal' | 'jk-zentra'
 *   - type:         'all' | 'income' | 'expense'
 *   - status:       'all' | 'active' | 'pending_review' | 'archived'
 *   - dateFrom:     ISO date string
 *   - dateTo:       ISO date string
 *   - categories:   multi-select from 16 predefined categories
 *   - currency:     'all' | 'MYR' | 'USD'
 *   - tags:         multi-select with free-text input
 *
 * Mobile: collapses into a bottom sheet triggered by a "Filters" button
 * showing the active filter count.
 *
 * @example
 * <LedgerFilters
 *   filters={currentFilters}
 *   onFiltersChange={handleFiltersChange}
 *   availableTags={['urgent', 'recurring', 'client-a']}
 * />
 */

'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** Filter state shape — mirrors URL search params. */
export interface LedgerFiltersState {
  search: string
  entity: 'all' | 'personal' | 'jk-zentra'
  type: 'all' | 'income' | 'expense'
  status: 'all' | 'active' | 'pending_review' | 'archived'
  dateFrom: string
  dateTo: string
  categories: string[]
  currency: 'all' | 'MYR' | 'USD'
  tags: string[]
}

/** Props for the LedgerFilters component. */
interface LedgerFiltersProps {
  /** Current filter state. */
  filters: LedgerFiltersState
  /** Called when any filter changes. */
  onFiltersChange: (filters: LedgerFiltersState) => void
  /** Available tags for autocomplete (fetched from DB). */
  availableTags: string[]
  /** Whether the component is in mobile bottom-sheet mode. */
  isMobile?: boolean
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/** The 16 predefined transaction categories from the schema. */
const ALL_CATEGORIES: string[] = [
  'Software',
  'Services Income',
  'Hardware',
  'Infrastructure',
  'Marketing',
  'Travel',
  'Meals',
  'Office',
  'Professional Services',
  'Tax',
  'Utilities',
  'Insurance',
  'Rent',
  'Salary',
  'Transfer',
  'Other',
]

/** Entity filter options. */
const ENTITY_OPTIONS: Array<{ value: LedgerFiltersState['entity']; label: string; color: string }> = [
  { value: 'all', label: 'All', color: '#6B6B6B' },
  { value: 'personal', label: 'Personal', color: '#6B6B6B' },
  { value: 'jk-zentra', label: 'JK Zentra', color: '#F37002' },
]

/** Type filter options. */
const TYPE_OPTIONS: Array<{ value: LedgerFiltersState['type']; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
]

/** Status filter options. */
const STATUS_OPTIONS: Array<{ value: LedgerFiltersState['status']; label: string; pillColor: string }> = [
  { value: 'all', label: 'All', pillColor: '#6B6B6B' },
  { value: 'active', label: 'Active', pillColor: '#1F8A4C' },
  { value: 'pending_review', label: 'Pending', pillColor: '#C77700' },
  { value: 'archived', label: 'Archived', pillColor: '#A0A0A0' },
]

/** Currency filter options. */
const CURRENCY_OPTIONS: Array<{ value: LedgerFiltersState['currency']; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'MYR', label: 'MYR' },
  { value: 'USD', label: 'USD' },
]

// ----------------------------------------------------------------------------
// Utility: count active filters
// ----------------------------------------------------------------------------

/**
 * Count the number of non-default (active) filters.
 * Used to show the badge on the mobile filters button.
 */
export function countActiveFilters(filters: LedgerFiltersState): number {
  let count = 0
  if (filters.search.trim()) count++
  if (filters.entity !== 'all') count++
  if (filters.type !== 'all') count++
  if (filters.status !== 'all') count++
  if (filters.dateFrom) count++
  if (filters.dateTo) count++
  if (filters.categories.length > 0) count++
  if (filters.currency !== 'all') count++
  if (filters.tags.length > 0) count++
  return count
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

/**
 * Filter bar for the ledger list.
 *
 * Desktop: inline filter controls.
 * Mobile: collapsible bottom sheet.
 */
export function LedgerFilters({
  filters,
  onFiltersChange,
  availableTags,
  isMobile = false,
}: LedgerFiltersProps): JSX.Element {

  // --------------------------------------------------------------------------
  // Local state for debounced search
  // --------------------------------------------------------------------------

  const [searchInput, setSearchInput] = useState(filters.search)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local search input when external filters change
  useEffect(() => {
    setSearchInput(filters.search)
  }, [filters.search])

  // --------------------------------------------------------------------------
  // Mobile bottom sheet
  // --------------------------------------------------------------------------

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

  // --------------------------------------------------------------------------
  // Category dropdown state
  // --------------------------------------------------------------------------

  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const categoryRef = useRef<HTMLDivElement>(null)

  // Close category dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // --------------------------------------------------------------------------
  // Tag input state
  // --------------------------------------------------------------------------

  const [tagInput, setTagInput] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const tagRef = useRef<HTMLDivElement>(null)

  // Close tag dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tagRef.current && !tagRef.current.contains(event.target as Node)) {
        setTagSuggestions([])
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  /**
   * Update a single filter field, preserving the rest.
   */
  const updateFilter = useCallback(
    <K extends keyof LedgerFiltersState>(key: K, value: LedgerFiltersState[K]) => {
      onFiltersChange({ ...filters, [key]: value })
    },
    [filters, onFiltersChange]
  )

  /**
   * Handle search input with 300ms debounce.
   */
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value)

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }

      searchTimeoutRef.current = setTimeout(() => {
        updateFilter('search', value)
      }, 300)
    },
    [updateFilter]
  )

  /**
   * Toggle a category in the multi-select.
   */
  const toggleCategory = useCallback(
    (category: string) => {
      const current = filters.categories
      const next = current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category]
      updateFilter('categories', next)
    },
    [filters.categories, updateFilter]
  )

  /**
   * Add a tag to the filter.
   */
  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase()
      if (!trimmed) return
      if (!filters.tags.includes(trimmed)) {
        updateFilter('tags', [...filters.tags, trimmed])
      }
      setTagInput('')
      setTagSuggestions([])
    },
    [filters.tags, updateFilter]
  )

  /**
   * Remove a tag from the filter.
   */
  const removeTag = useCallback(
    (tag: string) => {
      updateFilter(
        'tags',
        filters.tags.filter((t) => t !== tag)
      )
    },
    [filters.tags, updateFilter]
  )

  /**
   * Handle tag input changes — show suggestions.
   */
  const handleTagInputChange = useCallback(
    (value: string) => {
      setTagInput(value)
      if (value.trim()) {
        const matched = availableTags.filter(
          (t) =>
            t.toLowerCase().includes(value.toLowerCase()) &&
            !filters.tags.includes(t.toLowerCase())
        )
        setTagSuggestions(matched.slice(0, 5))
      } else {
        setTagSuggestions([])
      }
    },
    [availableTags, filters.tags]
  )

  /**
   * Clear all filters back to defaults.
   */
  const clearAllFilters = useCallback(() => {
    onFiltersChange({
      search: '',
      entity: 'all',
      type: 'all',
      status: 'all',
      dateFrom: '',
      dateTo: '',
      categories: [],
      currency: 'all',
      tags: [],
    })
    setSearchInput('')
    setTagInput('')
  }, [onFiltersChange])

  // --------------------------------------------------------------------------
  // Render helpers
  // --------------------------------------------------------------------------

  const activeFilterCount = countActiveFilters(filters)

  /**
   * Render a segmented button group for toggle filters.
   */
  const renderToggleGroup = <T extends string>(
    options: Array<{ value: T; label: string; color?: string }>,
    currentValue: T,
    onChange: (value: T) => void,
    ariaLabel: string
  ) => (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        border: '1px solid #E8E6E1',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'white',
        flexShrink: 0,
      }}
    >
      {options.map((opt) => {
        const isActive = opt.value === currentValue
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              border: 'none',
              borderRight: '1px solid #E8E6E1',
              background: isActive ? '#FFF6EF' : 'white',
              color: isActive ? '#C14A0E' : '#6B6B6B',
              cursor: 'pointer',
              transition: 'all 120ms ease',
              whiteSpace: 'nowrap',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = '#FAFAF7'
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'white'
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )

  // --------------------------------------------------------------------------
  // Filter row content (shared between desktop and mobile)
  // --------------------------------------------------------------------------

  const FilterContent = () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Row 1: Search + Entity + Type + Status */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
          <span
            aria-hidden="true"
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
            placeholder="Search vendor, description, category..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            aria-label="Search transactions"
            style={{
              width: '100%',
              padding: '7px 12px 7px 36px',
              border: '1px solid #E8E6E1',
              borderRadius: '8px',
              fontSize: '13px',
              fontFamily: 'Inter, system-ui, sans-serif',
              background: 'white',
              color: '#181818',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#F37002'
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(243,112,2,0.15)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#E8E6E1'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </div>

        {/* Entity toggle */}
        {renderToggleGroup(
          ENTITY_OPTIONS,
          filters.entity,
          (v) => updateFilter('entity', v),
          'Filter by entity'
        )}

        {/* Type toggle */}
        {renderToggleGroup(
          TYPE_OPTIONS,
          filters.type,
          (v) => updateFilter('type', v),
          'Filter by transaction type'
        )}

        {/* Status toggle */}
        {renderToggleGroup(
          STATUS_OPTIONS,
          filters.status,
          (v) => updateFilter('status', v),
          'Filter by status'
        )}
      </div>

      {/* Row 2: Date range + Category + Currency + Tags + Clear */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Date From */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span style={{ fontSize: '13px', color: '#6B6B6B', whiteSpace: 'nowrap' }}>From</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
            aria-label="Date from"
            style={{
              padding: '6px 10px',
              border: '1px solid #E8E6E1',
              borderRadius: '8px',
              fontSize: '13px',
              fontFamily: 'Inter, system-ui, sans-serif',
              background: 'white',
              color: '#181818',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#F37002'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#E8E6E1'
            }}
          />
        </div>

        {/* Date To */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span style={{ fontSize: '13px', color: '#6B6B6B', whiteSpace: 'nowrap' }}>To</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
            aria-label="Date to"
            style={{
              padding: '6px 10px',
              border: '1px solid #E8E6E1',
              borderRadius: '8px',
              fontSize: '13px',
              fontFamily: 'Inter, system-ui, sans-serif',
              background: 'white',
              color: '#181818',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#F37002'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#E8E6E1'
            }}
          />
        </div>

        {/* Category multi-select dropdown */}
        <div ref={categoryRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
            aria-haspopup="listbox"
            aria-expanded={categoryDropdownOpen}
            aria-label={`Select categories${filters.categories.length > 0 ? `, ${filters.categories.length} selected` : ''}`}
            style={{
              padding: '6px 14px',
              border: '1px solid #E8E6E1',
              borderRadius: '8px',
              fontSize: '13px',
              fontFamily: 'Inter, system-ui, sans-serif',
              background: 'white',
              color: filters.categories.length > 0 ? '#C14A0E' : '#6B6B6B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: filters.categories.length > 0 ? 600 : 400,
              transition: 'all 120ms ease',
            }}
          >
            Category
            {filters.categories.length > 0 && (
              <span
                style={{
                  background: '#C14A0E',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '1px 7px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                {filters.categories.length}
              </span>
            )}
            <span style={{ fontSize: '10px', marginLeft: '2px' }}>&#9662;</span>
          </button>

          {categoryDropdownOpen && (
            <div
              role="listbox"
              aria-multiselectable="true"
              aria-label="Categories"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: 'white',
                border: '1px solid #E8E6E1',
                borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                zIndex: 50,
                minWidth: '220px',
                maxHeight: '280px',
                overflowY: 'auto',
                padding: '6px 0',
              }}
            >
              {ALL_CATEGORIES.map((cat) => {
                const selected = filters.categories.includes(cat)
                return (
                  <div
                    key={cat}
                    role="option"
                    aria-selected={selected}
                    onClick={() => toggleCategory(cat)}
                    style={{
                      padding: '8px 14px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: selected ? '#FFF6EF' : 'transparent',
                      color: selected ? '#C14A0E' : '#181818',
                      fontWeight: selected ? 500 : 400,
                      transition: 'background 80ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!selected) e.currentTarget.style.background = '#FAFAF7'
                    }}
                    onMouseLeave={(e) => {
                      if (!selected) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span
                      style={{
                        width: '16px',
                        height: '16px',
                        border: selected ? '2px solid #F37002' : '2px solid #D4D0C9',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        background: selected ? '#F37002' : 'white',
                      }}
                    >
                      {selected && (
                        <span style={{ color: 'white', fontSize: '11px' }}>&#10003;</span>
                      )}
                    </span>
                    {cat}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Currency toggle */}
        {renderToggleGroup(
          CURRENCY_OPTIONS,
          filters.currency,
          (v) => updateFilter('currency', v),
          'Filter by currency'
        )}

        {/* Tags multi-select with autocomplete */}
        <div ref={tagRef} style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
              alignItems: 'center',
              padding: '4px 8px',
              border: '1px solid #E8E6E1',
              borderRadius: '8px',
              background: 'white',
              minHeight: '34px',
              boxSizing: 'border-box',
            }}
            onClick={() => {
              const input = document.getElementById('tag-input')
              input?.focus()
            }}
          >
            {filters.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  background: '#FFF6EF',
                  color: '#C14A0E',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                {tag}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeTag(tag)
                  }}
                  aria-label={`Remove tag ${tag}`}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: '#C14A0E',
                    fontSize: '14px',
                    lineHeight: 1,
                    padding: 0,
                    margin: 0,
                  }}
                >
                  &times;
                </button>
              </span>
            ))}
            <input
              id="tag-input"
              type="text"
              placeholder={filters.tags.length === 0 ? 'Add tags...' : ''}
              value={tagInput}
              onChange={(e) => handleTagInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tagInput.trim()) {
                  e.preventDefault()
                  addTag(tagInput)
                }
                if (e.key === 'Backspace' && !tagInput && filters.tags.length > 0) {
                  removeTag(filters.tags[filters.tags.length - 1])
                }
              }}
              aria-label="Add tag filter"
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '13px',
                fontFamily: 'Inter, system-ui, sans-serif',
                flex: 1,
                minWidth: '80px',
                background: 'transparent',
                color: '#181818',
                padding: '3px 4px',
              }}
            />
          </div>

          {/* Tag suggestions dropdown */}
          {tagSuggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: 'white',
                border: '1px solid #E8E6E1',
                borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                zIndex: 50,
                maxHeight: '200px',
                overflowY: 'auto',
                padding: '6px 0',
              }}
            >
              {tagSuggestions.map((suggestion) => (
                <div
                  key={suggestion}
                  onClick={() => addTag(suggestion)}
                  style={{
                    padding: '8px 14px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    color: '#181818',
                    transition: 'background 80ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#FAFAF7'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white'
                  }}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Clear all */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            aria-label={`Clear all ${activeFilterCount} active filters`}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              border: '1px solid #E8E6E1',
              borderRadius: '8px',
              background: 'white',
              color: '#6B6B6B',
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              whiteSpace: 'nowrap',
              transition: 'all 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#FAFAF7'
              e.currentTarget.style.color = '#C14A0E'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white'
              e.currentTarget.style.color = '#6B6B6B'
            }}
          >
            Clear all ({activeFilterCount})
          </button>
        )}
      </div>
    </div>
  )

  // --------------------------------------------------------------------------
  // Mobile: bottom sheet
  // --------------------------------------------------------------------------

  if (isMobile) {
    return (
      <>
        {/* Filters trigger button */}
        <button
          onClick={() => setMobileSheetOpen(true)}
          aria-label={`Open filters, ${activeFilterCount} active`}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 500,
            border: '1px solid #E8E6E1',
            borderRadius: '8px',
            background: 'white',
            color: '#181818',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <span>&#9776;</span>
          Filters
          {activeFilterCount > 0 && (
            <span
              style={{
                background: '#F37002',
                color: 'white',
                borderRadius: '10px',
                padding: '1px 7px',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Bottom sheet overlay */}
        {mobileSheetOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
            }}
          >
            {/* Backdrop */}
            <div
              onClick={() => setMobileSheetOpen(false)}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
              }}
            />

            {/* Sheet */}
            <div
              role="dialog"
              aria-label="Filter options"
              style={{
                position: 'relative',
                background: 'white',
                borderRadius: '16px 16px 0 0',
                maxHeight: '85vh',
                overflowY: 'auto',
                padding: '20px 16px',
                boxShadow: '0 -4px 24px rgba(0,0,0,0.1)',
              }}
            >
              {/* Handle bar */}
              <div
                style={{
                  width: '40px',
                  height: '4px',
                  background: '#D4D0C9',
                  borderRadius: '2px',
                  margin: '0 auto 16px',
                }}
              />

              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: 600,
                    fontFamily: 'Inter, system-ui, sans-serif',
                    color: '#181818',
                  }}
                >
                  Filters
                </h3>
                <button
                  onClick={() => setMobileSheetOpen(false)}
                  aria-label="Close filters"
                  style={{
                    border: 'none',
                    background: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#6B6B6B',
                    padding: '4px',
                  }}
                >
                  &times;
                </button>
              </div>

              <FilterContent />

              {/* Apply button */}
              <button
                onClick={() => setMobileSheetOpen(false)}
                style={{
                  width: '100%',
                  marginTop: '16px',
                  padding: '12px',
                  fontSize: '15px',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '10px',
                  background: '#F37002',
                  color: 'white',
                  cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                Show Results
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  // --------------------------------------------------------------------------
  // Desktop: inline filters
  // --------------------------------------------------------------------------

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #E8E6E1',
        borderRadius: '12px',
        padding: '16px',
      }}
    >
      <FilterContent />
    </div>
  )
}

export default LedgerFilters
