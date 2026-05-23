/**
 * InlineEdit.tsx
 *
 * Inline editing panel for a pending-review transaction.
 *
 * Desktop: form on the left (55%), file viewer on the right (45%).
 * Mobile: form stacked above the file viewer.
 *
 * Every field maps to an actual `transactions` table column (vetted against
 * schema.sql + database.types.ts). On save the extraction row is also marked
 * `manually_corrected = true`.
 */

'use client'

import React, { useCallback, useState } from 'react'
import type {
  EntityRow,
  TransactionRow,
  TransactionType,
  ExtractionRow,
} from '@/lib/supabase/database.types'

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

/** Predefined category options for the dropdown. */
const CATEGORY_OPTIONS: string[] = [
  'Software',
  'Services Income',
  'Infrastructure',
  'Marketing',
  'Professional Services',
  'Office & Admin',
  'Travel & Meals',
  'Hardware',
  'Subscriptions',
  'Tax',
  'Transfer',
  'Uncategorised',
]

/** Transaction type options rendered as togglable chips. */
const TYPE_OPTIONS: TransactionType[] = [
  'income',
  'expense',
  'tax_prepayment',
  'tax_payment_final',
  'tax_reserve_transfer',
]

/** Human-readable labels for transaction types. */
const TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Income',
  expense: 'Expense',
  tax_prepayment: 'Tax Prepayment',
  tax_payment_final: 'Tax Final',
  tax_reserve_transfer: 'Reserve Transfer',
}

/** Currency options. */
const CURRENCY_OPTIONS: string[] = ['MYR', 'USD', 'SGD', 'EUR', 'GBP']

// ------------------------------------------------------------------
// Helper: format minor units as decimal string
// ------------------------------------------------------------------

function minorToDecimal(minor: number): string {
  return (minor / 100).toFixed(2)
}

function decimalToMinor(decimal: string): number {
  return Math.round(parseFloat(decimal || '0') * 100)
}

// ------------------------------------------------------------------
// Props
// ------------------------------------------------------------------

interface InlineEditProps {
  /** The transaction row being edited. */
  transaction: TransactionRow
  /** The linked entity (for toggling Personal / JK Zentra). */
  entity: EntityRow
  /** All available entities (for the entity toggle). */
  allEntities: EntityRow[]
  /** Optional extraction data (so we can mark manually_corrected). */
  extraction: ExtractionRow | null
  /** Optional file public URL for the file viewer panel. */
  fileUrl?: string | null
  /** Called when the user clicks Save with the updated transaction fields. */
  onSave: (data: TransactionEditForm) => void
  /** Called when the user cancels editing. */
  onCancel: () => void
}

/**
 * Flattened form shape — only the fields we let the user edit.
 * Mirrors the TransactionUpdate type but with friendlier types for the form.
 */
export interface TransactionEditForm {
  vendor: string
  amount_minor: number
  currency: string
  occurred_at: string // ISO date string YYYY-MM-DD
  category: string
  subcategory: string | null
  entity_id: string
  type: TransactionType
  description: string | null
  tags: string[]
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

/**
 * Inline editing panel for a pending-review transaction.
 *
 * Renders a full form with every editable transaction field. On desktop
 * the layout is split: the form occupies the left 55% and a file viewer
 * occupies the right 45%. On mobile they stack vertically.
 */
export function InlineEdit({
  transaction,
  entity,
  allEntities,
  extraction,
  fileUrl,
  onSave,
  onCancel,
}: InlineEditProps): JSX.Element {
  const [form, setForm] = useState<TransactionEditForm>({
    vendor: transaction.vendor,
    amount_minor: transaction.amount_minor,
    currency: transaction.currency,
    occurred_at: transaction.occurred_at,
    category: transaction.category,
    subcategory: transaction.subcategory,
    entity_id: transaction.entity_id,
    type: transaction.type,
    description: transaction.description,
    tags: [...transaction.tags],
  })

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ---- field update helpers ----------------------------------------

  const update = useCallback(<K extends keyof TransactionEditForm>(
    key: K,
    value: TransactionEditForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleTagAdd = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase()
      if (!trimmed || form.tags.includes(trimmed)) return
      update('tags', [...form.tags, trimmed])
    },
    [form.tags, update]
  )

  const handleTagRemove = useCallback(
    (tag: string) => {
      update('tags', form.tags.filter((t) => t !== tag))
    },
    [form.tags, update]
  )

  // ---- submit ------------------------------------------------------

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setIsSaving(true)
      setError(null)

      try {
        // If extraction exists, mark it as manually corrected
        if (extraction) {
          const { extractions } = await import('@/lib/actions/extraction')
          await extractions.markCorrected(extraction.id)
        }

        onSave(form)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Save failed')
      } finally {
        setIsSaving(false)
      }
    },
    [extraction, form, onSave]
  )

  // ---- render field blocks -----------------------------------------

  const renderTagsInput = (): JSX.Element => (
    <div className="space-y-2">
      <label htmlFor="tags-input" className="block text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">
        Tags
      </label>
      <div className="flex flex-wrap gap-1.5">
        {form.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-[#F37002]/10 px-2.5 py-1 text-xs font-medium text-[#F37002]"
          >
            {tag}
            <button
              type="button"
              onClick={() => handleTagRemove(tag)}
              className="rounded-full p-0.5 hover:bg-[#F37002]/20"
              aria-label={`Remove tag ${tag}`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
        ))}
      </div>
      <input
        id="tags-input"
        type="text"
        placeholder="Type a tag and press Enter…"
        className="mt-1 block w-full rounded-lg border border-[#E8E6E1] bg-white px-3 py-2 text-sm text-[#181818] placeholder:text-[#A09B96] focus:border-[#F37002] focus:outline-none focus:ring-1 focus:ring-[#F37002]"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleTagAdd(e.currentTarget.value)
            e.currentTarget.value = ''
          }
        }}
      />
    </div>
  )

  const renderEntityToggle = (): JSX.Element => (
    <div className="space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">
        Entity
      </span>
      <div className="flex gap-2">
        {allEntities.map((ent) => {
          const isActive = form.entity_id === ent.id
          return (
            <button
              key={ent.id}
              type="button"
              onClick={() => update('entity_id', ent.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#F37002] focus:ring-offset-1 ${
                isActive
                  ? 'bg-[#181818] text-white shadow'
                  : 'border border-[#E8E6E1] bg-white text-[#6B6B6B] hover:bg-[#FAFAF7]'
              }`}
              aria-pressed={isActive}
            >
              {ent.name}
            </button>
          )
        })}
      </div>
    </div>
  )

  const renderTypeToggle = (): JSX.Element => (
    <div className="space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">
        Type
      </span>
      <div className="flex flex-wrap gap-2">
        {TYPE_OPTIONS.map((t) => {
          const isActive = form.type === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => update('type', t)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-[#F37002] focus:ring-offset-1 ${
                isActive
                  ? 'bg-[#F37002] text-white shadow'
                  : 'border border-[#E8E6E1] bg-white text-[#6B6B6B] hover:bg-[#FAFAF7]'
              }`}
              aria-pressed={isActive}
            >
              {TYPE_LABELS[t]}
            </button>
          )
        })}
      </div>
    </div>
  )

  // ---- main render -------------------------------------------------

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-6 lg:flex-row">
        {/* LEFT: Form fields */}
        <div className="flex-1 space-y-5 overflow-y-auto p-4 lg:p-6">
          {/* Error banner */}
          {error && (
            <div
              className="rounded-lg border border-[#B43A2D]/20 bg-[#B43A2D]/10 px-4 py-3 text-sm text-[#B43A2D]"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Vendor + Amount row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="vendor" className="block text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">
                Vendor
              </label>
              <input
                id="vendor"
                type="text"
                value={form.vendor}
                onChange={(e) => update('vendor', e.target.value)}
                className="block w-full rounded-lg border border-[#E8E6E1] bg-white px-3 py-2 text-sm text-[#181818] placeholder:text-[#A09B96] focus:border-[#F37002] focus:outline-none focus:ring-1 focus:ring-[#F37002]"
                placeholder="e.g. OpenAI"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="amount" className="block text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">
                Amount
              </label>
              <div className="flex gap-2">
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={minorToDecimal(form.amount_minor)}
                  onChange={(e) => update('amount_minor', decimalToMinor(e.target.value))}
                  className="block w-full rounded-lg border border-[#E8E6E1] bg-white px-3 py-2 text-sm text-[#181818] tabular-nums focus:border-[#F37002] focus:outline-none focus:ring-1 focus:ring-[#F37002]"
                  required
                />
                <select
                  value={form.currency}
                  onChange={(e) => update('currency', e.target.value)}
                  className="rounded-lg border border-[#E8E6E1] bg-white px-2 py-2 text-sm text-[#181818] focus:border-[#F37002] focus:outline-none focus:ring-1 focus:ring-[#F37002]"
                  aria-label="Currency"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Date + Category row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="date" className="block text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">
                Date
              </label>
              <input
                id="date"
                type="date"
                value={form.occurred_at}
                onChange={(e) => update('occurred_at', e.target.value)}
                className="block w-full rounded-lg border border-[#E8E6E1] bg-white px-3 py-2 text-sm text-[#181818] focus:border-[#F37002] focus:outline-none focus:ring-1 focus:ring-[#F37002]"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="category" className="block text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">
                Category
              </label>
              <select
                id="category"
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                className="block w-full rounded-lg border border-[#E8E6E1] bg-white px-3 py-2 text-sm text-[#181818] focus:border-[#F37002] focus:outline-none focus:ring-1 focus:ring-[#F37002]"
                required
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subcategory */}
          <div className="space-y-2">
            <label htmlFor="subcategory" className="block text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">
              Subcategory
            </label>
            <input
              id="subcategory"
              type="text"
              value={form.subcategory ?? ''}
              onChange={(e) => update('subcategory', e.target.value || null)}
              placeholder="e.g. AI/ML, Web Design"
              className="block w-full rounded-lg border border-[#E8E6E1] bg-white px-3 py-2 text-sm text-[#181818] placeholder:text-[#A09B96] focus:border-[#F37002] focus:outline-none focus:ring-1 focus:ring-[#F37002]"
            />
          </div>

          {/* Entity + Type toggles */}
          {renderEntityToggle()}
          {renderTypeToggle()}

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="description" className="block text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">
              Description
            </label>
            <textarea
              id="description"
              value={form.description ?? ''}
              onChange={(e) => update('description', e.target.value || null)}
              placeholder="Brief description of the transaction…"
              rows={3}
              className="block w-full resize-none rounded-lg border border-[#E8E6E1] bg-white px-3 py-2 text-sm text-[#181818] placeholder:text-[#A09B96] focus:border-[#F37002] focus:outline-none focus:ring-1 focus:ring-[#F37002]"
            />
          </div>

          {/* Tags */}
          {renderTagsInput()}
        </div>

        {/* RIGHT: File viewer */}
        <div className="h-64 border-t border-[#E8E6E1] lg:h-auto lg:w-[45%] lg:border-l lg:border-t-0">
          {fileUrl ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-[#E8E6E1] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">
                Receipt / File
              </div>
              <div className="flex-1 overflow-auto p-4">
                {fileUrl.match(/\.(pdf)$/i) ? (
                  <iframe
                    src={fileUrl}
                    title="Receipt preview"
                    className="h-full w-full rounded-lg border border-[#E8E6E1]"
                  />
                ) : (
                  <img
                    src={fileUrl}
                    alt="Receipt preview"
                    className="max-h-full w-auto rounded-lg border border-[#E8E6E1] object-contain"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[#A09B96]">
              <div className="text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 text-[#E8E6E1]" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                No file attached
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-end gap-3 border-t border-[#E8E6E1] bg-white px-4 py-3 lg:px-6">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[#E8E6E1] bg-white px-4 py-2 text-sm font-medium text-[#181818] transition hover:bg-[#FAFAF7] focus:outline-none focus:ring-2 focus:ring-[#F37002]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#F37002] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d96202] focus:outline-none focus:ring-2 focus:ring-[#F37002] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          Save
        </button>
      </div>
    </form>
  )
}
