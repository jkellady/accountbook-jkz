/**
 * CategorySelector — Two-level category picker
 *
 * First dropdown selects a primary category (16 options). The second
 * dropdown dynamically updates to show subcategories for the selected
 * category. "Other" appears at the bottom of each list. If the user
 * selects "Other" 3+ times for the same category, a text input appears
 * allowing them to create a new subcategory.
 *
 * @example
 * <CategorySelector
 *   category={category}
 *   subcategory={subcategory}
 *   onChange={({ category, subcategory }) => {
 *     setValue('category', category)
 *     setValue('subcategory', subcategory)
 *   }}
 * />
 */

"use client"


import React, { useState, useCallback, useEffect } from 'react'
import {
  CATEGORY_TAXONOMY,
  PRIMARY_CATEGORIES,
  getSubcategories,
} from '@/lib/validation/transaction'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface CategorySelectorProps {
  /** Selected primary category name. */
  readonly category: string
  /** Selected subcategory name — null when none selected. */
  readonly subcategory: string | null
  /** Called when category or subcategory changes. */
  readonly onChange: (payload: { category: string; subcategory: string | null }) => void
  /** Validation error for category. */
  readonly categoryError?: string
  /** Disable interaction. */
  readonly disabled?: boolean
}

/** Per-category counters for "Other" selections — stored in localStorage. */
const OTHER_COUNT_KEY = 'txn_cat_other_count'

interface OtherCountMap {
  [category: string]: number
}

function loadOtherCounts(): OtherCountMap {
  try {
    const raw = localStorage.getItem(OTHER_COUNT_KEY)
    return raw ? (JSON.parse(raw) as OtherCountMap) : {}
  } catch {
    return {}
  }
}

function saveOtherCounts(counts: OtherCountMap): void {
  localStorage.setItem(OTHER_COUNT_KEY, JSON.stringify(counts))
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function CategorySelector({
  category,
  subcategory,
  onChange,
  categoryError,
  disabled = false,
}: CategorySelectorProps): React.JSX.Element {
  const [otherCounts, setOtherCounts] = useState<OtherCountMap>(loadOtherCounts)
  const [showCustomSubcategory, setShowCustomSubcategory] = useState(false)
  const [customSubcategory, setCustomSubcategory] = useState('')

  // Available subcategories for the currently selected primary category
  const availableSubcategories = React.useMemo(
    () => getSubcategories(category),
    [category],
  )

  // Track if we should show the custom subcategory input
  const currentOtherCount = category ? (otherCounts[category] ?? 0) : 0
  const shouldShowCustomInput = showCustomSubcategory || currentOtherCount >= 3

  // Reset custom state when category changes
  useEffect(() => {
    setShowCustomSubcategory(false)
    setCustomSubcategory('')
  }, [category])

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newCategory = e.target.value
      const newSubcategories = getSubcategories(newCategory)
      const defaultSub = newSubcategories.length > 0 ? newSubcategories[0] : null

      onChange({
        category: newCategory,
        subcategory: defaultSub,
      })
    },
    [onChange],
  )

  const handleSubcategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value

      if (value === '__OTHER__') {
        // User selected "Other" — track the count
        const newCounts: OtherCountMap = {
          ...otherCounts,
          [category]: (otherCounts[category] ?? 0) + 1,
        }
        setOtherCounts(newCounts)
        saveOtherCounts(newCounts)

        if ((newCounts[category] ?? 0) >= 3) {
          setShowCustomSubcategory(true)
          onChange({ category, subcategory: customSubcategory || '(review if >5%)' })
        } else {
          onChange({ category, subcategory: '(review if >5%)' })
        }
        return
      }

      setShowCustomSubcategory(false)
      onChange({ category, subcategory: value || null })
    },
    [category, otherCounts, onChange, customSubcategory],
  )

  const handleCustomSubcategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setCustomSubcategory(value)
      onChange({ category, subcategory: value || null })
    },
    [category, onChange],
  )

  // --------------------------------------------------------------------------
  // Render helpers
  // --------------------------------------------------------------------------

  return (
    <div className="category-selector">
      {/* --- Primary category --- */}
      <label
        style={{
          display: 'block',
          fontSize: '13px',
          fontWeight: 500,
          color: '#6B6B6B',
          marginBottom: '8px',
        }}
      >
        Category
      </label>

      <select
        value={category}
        onChange={handleCategoryChange}
        disabled={disabled}
        aria-invalid={!!categoryError}
        aria-describedby={categoryError ? 'category-error' : undefined}
        style={{
          width: '100%',
          height: '44px',
          padding: '0 12px',
          borderRadius: '8px',
          border: categoryError ? '1px solid #E53E3E' : '1px solid #E5E5E5',
          backgroundColor: '#FFFFFF',
          fontSize: '14px',
          color: '#181818',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'border-color 0.15s ease',
          appearance: 'none',
          WebkitAppearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B6B6B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: '36px',
        }}
      >
        <option value="" disabled>
          Select a category...
        </option>
        {PRIMARY_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      {categoryError && (
        <span
          id="category-error"
          role="alert"
          style={{
            display: 'block',
            fontSize: '12px',
            color: '#E53E3E',
            marginTop: '6px',
            marginBottom: '12px',
          }}
        >
          {categoryError}
        </span>
      )}

      {/* --- Subcategory --- */}
      {category && (
        <>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#6B6B6B',
              marginTop: categoryError ? '0' : '16px',
              marginBottom: '8px',
            }}
          >
            Subcategory
          </label>

          {!shouldShowCustomInput ? (
            <select
              value={subcategory ?? ''}
              onChange={handleSubcategoryChange}
              disabled={disabled}
              style={{
                width: '100%',
                height: '44px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #E5E5E5',
                backgroundColor: '#FFFFFF',
                fontSize: '14px',
                color: '#181818',
                outline: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'border-color 0.15s ease',
                appearance: 'none',
                WebkitAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B6B6B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '36px',
              }}
            >
              {availableSubcategories.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
              <option value="__OTHER__">Other...</option>
            </select>
          ) : (
            <input
              type="text"
              value={customSubcategory}
              onChange={handleCustomSubcategoryChange}
              placeholder="Enter new subcategory..."
              disabled={disabled}
              style={{
                width: '100%',
                height: '44px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #F37002',
                backgroundColor: '#FFFFFF',
                fontSize: '14px',
                color: '#181818',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
            />
          )}

          {/* Hint text about "Other" usage */}
          <span
            style={{
              display: 'block',
              fontSize: '11px',
              color: '#6B6B6B',
              marginTop: '4px',
            }}
          >
            {currentOtherCount > 0 && currentOtherCount < 3
              ? `"Other" selected ${currentOtherCount} time(s) for this category. Select 3 times to unlock custom input.`
              : shouldShowCustomInput
                ? 'Enter a custom subcategory name.'
                : 'Select "Other" to use a custom subcategory.'}
          </span>
        </>
      )}
    </div>
  )
}
