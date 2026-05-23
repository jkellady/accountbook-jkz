/**
 * ReviewQueue.tsx
 *
 * The core "two-tap discipline" workflow UI.
 *
 * Displays all transactions with `status = 'pending_review'` in a queue.
 * Desktop: collapsible sidebar list + detail panel on the right.
 * Mobile: full-width swipeable cards stacked vertically.
 *
 * Keyboard shortcuts:
 *   J / K   — next / previous transaction
 *   A       — approve current transaction
 *   E       — edit current transaction
 *   R       — reject current transaction
 *
 * All columns referenced exist in schema.sql and database.types.ts.
 */

'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type {
  EntityRow,
  ExtractionRow,
  TransactionRow,
  FileRow,
} from '@/lib/supabase/database.types'
import { ReviewCard } from './ReviewCard'
import { SwipeableCard } from './SwipeableCard'
import type { TransactionEditForm } from './InlineEdit'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

/**
 * A pending transaction with its resolved related rows.
 * The `file` and `extraction` properties are optional because a
 * transaction may exist without an attached receipt or the extraction
 * may not have completed yet.
 */
export interface PendingTransaction {
  transaction: TransactionRow
  entity: EntityRow
  file: FileRow | null
  extraction: ExtractionRow | null
}

interface ReviewQueueProps {
  /** All pending-review transactions with their related data pre-resolved. */
  items: PendingTransaction[]
  /** All entities (Personal + JK Zentra) for the entity toggle in edit mode. */
  allEntities: EntityRow[]
  /** Public URL mapping: file_id → signed Supabase Storage URL. */
  fileUrls: Record<string, string>
  /** Called when the user approves a transaction. */
  onApprove: (transactionId: string) => void
  /** Called when the user rejects a transaction. */
  onReject: (transactionId: string) => void
  /** Called when the user saves edits to a transaction. */
  onSaveEdit: (transactionId: string, data: TransactionEditForm) => void
}

// ------------------------------------------------------------------
// EmptyState
// ------------------------------------------------------------------

function EmptyState(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#1F8A4C]/10">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1F8A4C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 className="mb-1 text-lg font-semibold text-[#181818]">
        All caught up
      </h2>
      <p className="text-sm text-[#6B6B6B]">
        Nothing to review. New receipts will appear here when they are uploaded.
      </p>
    </div>
  )
}

// ------------------------------------------------------------------
// DesktopLayout — sidebar + detail panel
// ------------------------------------------------------------------

interface DesktopLayoutProps {
  items: PendingTransaction[]
  allEntities: EntityRow[]
  fileUrls: Record<string, string>
  selectedIndex: number
  onSelect: (index: number) => void
  onRemove: (index: number) => void
  onSaveEdit: (transactionId: string, data: TransactionEditForm) => void
}

function DesktopLayout({
  items,
  allEntities,
  fileUrls,
  selectedIndex,
  onSelect,
  onRemove,
  onSaveEdit,
}: DesktopLayoutProps): JSX.Element {
  const selected = items[selectedIndex]
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Keep selected item visible in sidebar
  useEffect(() => {
    const el = sidebarRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedIndex])

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Left sidebar — transaction list */}
      <div
        ref={sidebarRef}
        className="w-80 flex-shrink-0 overflow-y-auto rounded-xl border border-[#E8E6E1] bg-white p-2 shadow-sm"
      >
        {items.map((item, i) => (
          <div key={item.transaction.id} data-index={i}>
            <ReviewCard
              transaction={item.transaction}
              entity={item.entity}
              allEntities={allEntities}
              extraction={item.extraction}
              fileUrl={item.file ? fileUrls[item.file.id] ?? null : null}
              onRemove={() => onRemove(i)}
              onSaveEdit={(data) => onSaveEdit(item.transaction.id, data)}
              isSelected={i === selectedIndex}
              onSelect={() => onSelect(i)}
            />
          </div>
        ))}
      </div>

      {/* Right detail panel */}
      <div className="min-w-0 flex-1 overflow-y-auto rounded-xl border border-[#E8E6E1] bg-white p-5 shadow-sm">
        {selected ? (
          <ReviewCard
            transaction={selected.transaction}
            entity={selected.entity}
            allEntities={allEntities}
            extraction={selected.extraction}
            fileUrl={selected.file ? fileUrls[selected.file.id] ?? null : null}
            onRemove={() => onRemove(selectedIndex)}
            onSaveEdit={(data) => onSaveEdit(selected.transaction.id, data)}
            isSelected
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// MobileLayout — stacked swipeable cards
// ------------------------------------------------------------------

interface MobileLayoutProps {
  items: PendingTransaction[]
  allEntities: EntityRow[]
  fileUrls: Record<string, string>
  onRemove: (index: number) => void
  onSaveEdit: (transactionId: string, data: TransactionEditForm) => void
}

function MobileLayout({
  items,
  allEntities,
  fileUrls,
  onRemove,
  onSaveEdit,
}: MobileLayoutProps): JSX.Element {
  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <SwipeableCard
          key={item.transaction.id}
          onApprove={() => onRemove(i)}
          onReject={() => onRemove(i)}
        >
          <ReviewCard
            transaction={item.transaction}
            entity={item.entity}
            allEntities={allEntities}
            extraction={item.extraction}
            fileUrl={item.file ? fileUrls[item.file.id] ?? null : null}
            onRemove={() => onRemove(i)}
            onSaveEdit={(data) => onSaveEdit(item.transaction.id, data)}
          />
        </SwipeableCard>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

/**
 * Review Queue — the heart of the two-tap discipline workflow.
 *
 * Shows all `pending_review` transactions, lets the user approve,
 * edit, or reject each one with minimal friction.
 */
export function ReviewQueue({
  items: initialItems,
  allEntities,
  fileUrls,
  onApprove,
  onReject,
  onSaveEdit,
}: ReviewQueueProps): JSX.Element {
  const [items, setItems] = useState<PendingTransaction[]>(initialItems)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Sync when props change (e.g. server refetch)
  useEffect(() => {
    setItems(initialItems)
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, initialItems.length - 1)))
  }, [initialItems])

  // ---- optimistic removal ------------------------------------------

  const handleRemove = useCallback(
    (index: number) => {
      const removed = items[index]
      if (!removed) return

      // Optimistic: remove from local state immediately
      setItems((prev) => {
        const next = [...prev]
        next.splice(index, 1)
        return next
      })

      // Adjust selected index
      setSelectedIndex((prev) => {
        if (prev >= items.length - 1) return Math.max(0, items.length - 2)
        return prev
      })

      // Fire the appropriate server action
      // (ReviewCard's action buttons already fired the action; this just
      //  ensures the parent knows about the removal for analytics, etc.)
    },
    [items]
  )

  // ---- keyboard shortcuts ------------------------------------------

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in a form field
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      switch (e.key) {
        case 'j':
        case 'J': {
          e.preventDefault()
          setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1))
          break
        }
        case 'k':
        case 'K': {
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break
        }
        // A (approve), E (edit), R (reject) are handled inside ReviewCard / ReviewActions
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [items.length])

  // ---- derived state -----------------------------------------------

  const remainingCount = items.length
  const reviewedCount = initialItems.length - remainingCount

  // ---- render ------------------------------------------------------

  if (remainingCount === 0) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-6" aria-label="Review queue">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#181818]">Review Queue</h1>
            <p className="mt-0.5 text-sm text-[#6B6B6B]">
              {reviewedCount > 0
                ? `${reviewedCount} reviewed · 0 remaining`
                : 'Nothing pending'}
            </p>
          </div>
        </header>

        <EmptyState />
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-6" aria-label="Review queue">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#181818]">Review Queue</h1>
          <p className="mt-0.5 text-sm text-[#6B6B6B]">
            {reviewedCount + 1} of {initialItems.length} remaining
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="h-2 w-32 overflow-hidden rounded-full bg-[#E8E6E1] sm:w-48">
            <div
              className="h-full rounded-full bg-[#1F8A4C] transition-all duration-500"
              style={{
                width: `${initialItems.length > 0 ? (reviewedCount / initialItems.length) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="font-mono text-xs tabular-nums text-[#6B6B6B]">
            {reviewedCount}/{initialItems.length}
          </span>
        </div>
      </header>

      {/* Keyboard hint — desktop only */}
      <div className="mb-4 hidden items-center gap-4 text-xs text-[#A09B96] lg:flex">
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-[#E8E6E1] bg-white px-1.5 py-0.5 font-mono text-[10px]">J</kbd>
          <kbd className="rounded border border-[#E8E6E1] bg-white px-1.5 py-0.5 font-mono text-[10px]">K</kbd>
          Navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-[#E8E6E1] bg-white px-1.5 py-0.5 font-mono text-[10px]">A</kbd>
          Approve
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-[#E8E6E1] bg-white px-1.5 py-0.5 font-mono text-[10px]">E</kbd>
          Edit
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-[#E8E6E1] bg-white px-1.5 py-0.5 font-mono text-[10px]">R</kbd>
          Reject
        </span>
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:block">
        <DesktopLayout
          items={items}
          allEntities={allEntities}
          fileUrls={fileUrls}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onRemove={handleRemove}
          onSaveEdit={onSaveEdit}
        />
      </div>

      {/* Mobile layout */}
      <div className="block lg:hidden">
        <MobileLayout
          items={items}
          allEntities={allEntities}
          fileUrls={fileUrls}
          onRemove={handleRemove}
          onSaveEdit={onSaveEdit}
        />
      </div>
    </section>
  )
}
