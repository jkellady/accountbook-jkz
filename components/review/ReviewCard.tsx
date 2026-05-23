/**
 * ReviewCard.tsx
 *
 * Individual review card for a single pending-review transaction.
 *
 * Layout:
 *   Left: file thumbnail (80px) with click-to-expand.
 *   Right: extracted fields in a clean grid.
 *   Bottom: action bar (Looks good / Edit / Reject).
 *
 * Low-confidence fields (< 0.85) are highlighted with an orange background.
 * A confidence dot (green / amber / orange) sits next to the overall score.
 *
 * Fully typed against schema.sql + database.types.ts.
 */

'use client'

import React, { useMemo, useState } from 'react'
import type {
  EntityRow,
  TransactionRow,
  ExtractionRow,
} from '@/lib/supabase/database.types'
import { LooksGoodButton, EditButton, RejectButton } from './ReviewActions'
import { InlineEdit, TransactionEditForm } from './InlineEdit'

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/**
 * Format an amount in minor units (sen/cents) as a human-readable
 * currency string.  e.g. 12350 → "MYR 123.50"
 */
function formatCurrency(amountMinor: number, currency: string): string {
  const major = (amountMinor / 100).toFixed(2)
  return `${currency} ${major}`
}

/**
 * Format an ISO date string (YYYY-MM-DD) to a readable format.
 * e.g. "2026-06-15" → "Jun 15, 2026"
 */
function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-MY', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Confidence colour stops. */
const CONFIDENCE_HIGH = 0.85
const CONFIDENCE_MEDIUM = 0.6

type ConfidenceLevel = 'high' | 'medium' | 'low'

function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_HIGH) return 'high'
  if (score >= CONFIDENCE_MEDIUM) return 'medium'
  return 'low'
}

/** Overall confidence computed as average of per-field scores. */
function computeOverallConfidence(scores: Record<string, number> | null): number {
  if (!scores) return 0
  const values = Object.values(scores)
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

// Confidence dot colour (CSS background value)
function confidenceDotColour(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return '#1F8A4C'
    case 'medium':
      return '#C77700'
    case 'low':
      return '#F37002'
  }
}

// ------------------------------------------------------------------
// ConfidenceBadge
// ------------------------------------------------------------------

function ConfidenceBadge({ scores }: { scores: Record<string, number> | null }): JSX.Element {
  const overall = computeOverallConfidence(scores)
  const level = getConfidenceLevel(overall)
  const dotColour = confidenceDotColour(level)
  const label = level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low'

  return (
    <div className="flex items-center gap-2" title={`Overall confidence: ${Math.round(overall * 100)}%`}>
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: dotColour }}
        aria-hidden="true"
      />
      <span className="text-xs font-medium text-[#6B6B6B]">
        {label} confidence
      </span>
      <span className="font-mono text-xs tabular-nums text-[#A09B96]">
        {Math.round(overall * 100)}%
      </span>
    </div>
  )
}

// ------------------------------------------------------------------
// FieldRow — extracted data row with optional low-confidence highlight
// ------------------------------------------------------------------

interface FieldRowProps {
  /** Human-readable label for the field. */
  label: string
  /** Display value (already formatted). */
  value: string | null | undefined
  /** Confidence score for this specific field (0.0 – 1.0). */
  confidence: number | undefined
}

function FieldRow({ label, value, confidence }: FieldRowProps): JSX.Element {
  const isLowConfidence = confidence !== undefined && confidence < CONFIDENCE_HIGH

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-md px-2 py-1.5 ${
        isLowConfidence ? 'bg-[#FFF6EF] text-[#F37002]' : ''
      }`}
      title={
        confidence !== undefined
          ? `${label} confidence: ${Math.round(confidence * 100)}%`
          : undefined
      }
    >
      <span className={`text-xs font-medium uppercase tracking-wide ${isLowConfidence ? 'text-[#F37002]/80' : 'text-[#A09B96]'}`}>
        {label}
      </span>
      <span className={`text-right text-sm font-medium ${isLowConfidence ? 'text-[#F37002]' : 'text-[#181818]'}`}>
        {value || '—'}
      </span>
    </div>
  )
}

// ------------------------------------------------------------------
// Props
// ------------------------------------------------------------------

interface ReviewCardProps {
  /** The pending-review transaction. */
  transaction: TransactionRow
  /** The linked entity (resolved from entity_id). */
  entity: EntityRow
  /** All available entities (passed down to InlineEdit). */
  allEntities: EntityRow[]
  /** Optional extraction data (confidence scores + extracted fields). */
  extraction: ExtractionRow | null
  /** Optional file public URL for the thumbnail / expand view. */
  fileUrl?: string | null
  /** Called when the card should be removed (approve / reject). */
  onRemove: () => void
  /** Called when the user saves edits. */
  onSaveEdit: (data: TransactionEditForm) => void
  /** Whether this card is currently selected (desktop sidebar detail view). */
  isSelected?: boolean
  /** Click handler for desktop sidebar list item. */
  onSelect?: () => void
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

/**
 * Displays a single pending-review transaction with extracted data,
 * confidence indicators, file thumbnail, and action buttons.
 */
export function ReviewCard({
  transaction,
  entity,
  allEntities,
  extraction,
  fileUrl,
  onRemove,
  onSaveEdit,
  isSelected = false,
  onSelect,
}: ReviewCardProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [isImageExpanded, setIsImageExpanded] = useState(false)

  // Parse confidence_scores JSONB into a typed map
  const confidenceMap: Record<string, number> = useMemo(() => {
    if (!extraction?.confidence_scores) return {}
    const raw = extraction.confidence_scores
    if (typeof raw !== 'object' || raw === null) return {}
    const map: Record<string, number> = {}
    for (const [key, val] of Object.entries(raw)) {
      if (typeof val === 'number') map[key] = val
    }
    return map
  }, [extraction])

  // Determine per-field confidence values
  const vendorConfidence = confidenceMap['vendor']
  const amountConfidence = confidenceMap['amount']
  const dateConfidence = confidenceMap['date']
  const categoryConfidence = confidenceMap['category']

  // ---- editing state -----------------------------------------------

  if (isEditing) {
    return (
      <div className="h-[70vh] overflow-hidden rounded-xl border border-[#E8E6E1] bg-white shadow-sm lg:h-[600px]">
        <InlineEdit
          transaction={transaction}
          entity={entity}
          allEntities={allEntities}
          extraction={extraction}
          fileUrl={fileUrl}
          onSave={(data) => {
            onSaveEdit(data)
            setIsEditing(false)
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    )
  }

  // ---- collapsed list item (desktop sidebar) -----------------------

  if (onSelect && !isSelected) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-left transition hover:border-[#E8E6E1] hover:bg-white focus:border-[#F37002] focus:outline-none"
      >
        {/* Thumbnail */}
        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border border-[#E8E6E1] bg-[#FAFAF7]">
          {fileUrl ? (
            <img
              src={fileUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#A09B96]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[#181818]">
            {transaction.vendor}
          </div>
          <div className="truncate text-xs text-[#6B6B6B]">
            {formatDate(transaction.occurred_at)} · {transaction.category}
          </div>
        </div>

        {/* Amount */}
        <div className="text-right">
          <div className="font-mono text-sm font-semibold tabular-nums text-[#181818]">
            {formatCurrency(transaction.amount_minor, transaction.currency)}
          </div>
        </div>
      </button>
    )
  }

  // ---- full card (selected / mobile detail view) -------------------

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm ${
        isSelected ? 'border-[#F37002]/40 ring-1 ring-[#F37002]/20' : 'border-[#E8E6E1]'
      }`}
    >
      {/* Top: thumbnail + field grid */}
      <div className="flex gap-4 p-4 lg:gap-5 lg:p-5">
        {/* Left: file thumbnail */}
        <button
          type="button"
          onClick={() => fileUrl && setIsImageExpanded(true)}
          className={`flex-shrink-0 overflow-hidden rounded-lg border border-[#E8E6E1] bg-[#FAFAF7] ${
            fileUrl ? 'cursor-pointer hover:border-[#F37002]' : 'cursor-default'
          }`}
          style={{ width: 80, height: 80 }}
          aria-label={fileUrl ? 'Click to expand receipt image' : 'No receipt image'}
        >
          {fileUrl ? (
            <img
              src={fileUrl}
              alt="Receipt thumbnail"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#A09B96]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          )}
        </button>

        {/* Right: extracted fields */}
        <div className="min-w-0 flex-1">
          {/* Header: vendor + confidence */}
          <div className="mb-3 flex items-start justify-between gap-2">
            <h3 className="truncate text-base font-semibold text-[#181818]">
              {transaction.vendor}
            </h3>
            <ConfidenceBadge scores={confidenceMap} />
          </div>

          {/* Field grid */}
          <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
            <FieldRow
              label="Amount"
              value={formatCurrency(transaction.amount_minor, transaction.currency)}
              confidence={amountConfidence}
            />
            <FieldRow
              label="Date"
              value={formatDate(transaction.occurred_at)}
              confidence={dateConfidence}
            />
            <FieldRow
              label="Category"
              value={transaction.category}
              confidence={categoryConfidence}
            />
            <FieldRow
              label="Subcategory"
              value={transaction.subcategory}
              confidence={undefined}
            />
            <FieldRow
              label="Entity"
              value={entity?.name ?? '—'}
              confidence={undefined}
            />
            <FieldRow
              label="Type"
              value={transaction.type}
              confidence={undefined}
            />
            {transaction.description && (
              <div className="col-span-1 sm:col-span-2">
                <FieldRow
                  label="Description"
                  value={transaction.description}
                  confidence={undefined}
                />
              </div>
            )}
            {transaction.tags.length > 0 && (
              <div className="col-span-1 sm:col-span-2">
                <div className="mt-1 flex flex-wrap gap-1">
                  {transaction.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[#E8E6E1]/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#6B6B6B]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center gap-3 border-t border-[#E8E6E1] bg-[#FAFAF7]/50 px-4 py-3 lg:px-5">
        <LooksGoodButton transactionId={transaction.id} onDone={onRemove} />
        <EditButton isEditing={isEditing} onToggleEdit={() => setIsEditing(!isEditing)} />
        <div className="ml-auto">
          <RejectButton transactionId={transaction.id} onDone={onRemove} />
        </div>
      </div>

      {/* Expanded image modal (lightbox) */}
      {isImageExpanded && fileUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setIsImageExpanded(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Receipt preview"
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img
              src={fileUrl}
              alt="Expanded receipt"
              className="max-h-[85vh] rounded-lg border border-white/20 object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setIsImageExpanded(false)}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#181818] shadow-lg transition hover:bg-[#FAFAF7] focus:outline-none focus:ring-2 focus:ring-[#F37002]"
              aria-label="Close preview"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
