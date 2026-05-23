/**
 * ============================================================================
 * JK Zentra Finance Cockpit — Project Detail
 * ============================================================================
 *
 * Full project detail view showing financial summary with progress bar,
 * payment schedule notes, linked transactions, editable notes, and
 * context-aware status action buttons.
 *
 * Status transitions are validated server-side; the UI shows only
 * valid next statuses as action buttons.
 */

'use client'

import { useState, useCallback } from 'react'
import { formatAmount } from '@/lib/utils/currency'
import type { ProjectWithTransactions } from '@/lib/actions/projects'
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
} from '@/lib/actions/projects'
import type { ProjectStatus } from '@/lib/supabase/database.types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectDetailProps {
  /** Project data with computed fields and linked transactions. */
  project: ProjectWithTransactions
  /** Called when the user requests a status change. */
  onStatusChange: (projectId: string, newStatus: ProjectStatus) => void
  /** Called when notes are saved. */
  onNotesSave: (projectId: string, notes: string) => void
  /** Called when the user clicks Edit. */
  onEdit: (projectId: string) => void
  /** Called when the user navigates back. */
  onBack: () => void
}

// ---------------------------------------------------------------------------
// Status transition button config
// ---------------------------------------------------------------------------

/** Valid forward transitions shown as action buttons. */
const NEXT_STATUS_BUTTONS: Record<ProjectStatus, { target: ProjectStatus; label: string; variant: 'primary' | 'danger' | 'neutral' }[]> = {
  quoted: [
    { target: 'deposit_received', label: 'Mark Deposit Received', variant: 'primary' },
  ],
  deposit_received: [
    { target: 'in_progress', label: 'Mark In Progress', variant: 'primary' },
  ],
  in_progress: [
    { target: 'delivered', label: 'Mark Delivered', variant: 'primary' },
  ],
  delivered: [
    { target: 'fully_paid', label: 'Mark Fully Paid', variant: 'primary' },
  ],
  fully_paid: [],
  disputed: [
    { target: 'in_progress', label: 'Resume Work', variant: 'primary' },
    { target: 'delivered', label: 'Mark Delivered', variant: 'primary' },
    { target: 'fully_paid', label: 'Mark Fully Paid', variant: 'primary' },
    { target: 'closed_short_paid', label: 'Close (Short Paid)', variant: 'neutral' },
    { target: 'cancelled', label: 'Cancel Project', variant: 'danger' },
  ],
  cancelled: [],
  cancelled_with_deposit_kept: [],
  cancelled_partial: [],
  closed_short_paid: [],
  archived: [],
}

/** Common cancel buttons available from most non-terminal statuses. */
function getCancelButtons(current: ProjectStatus): { target: ProjectStatus; label: string; variant: 'danger' }[] {
  const hasCancel: ProjectStatus[] = ['quoted', 'deposit_received', 'in_progress', 'delivered']
  if (!hasCancel.includes(current)) return []

  if (current === 'quoted') {
    return [{ target: 'cancelled', label: 'Cancel', variant: 'danger' }]
  }
  if (current === 'deposit_received') {
    return [
      { target: 'cancelled_with_deposit_kept', label: 'Cancel (Keep Deposit)', variant: 'danger' },
      { target: 'cancelled', label: 'Cancel (Refund Deposit)', variant: 'danger' },
    ]
  }
  if (current === 'in_progress') {
    return [
      { target: 'cancelled_partial', label: 'Cancel (Partial)', variant: 'danger' },
      { target: 'cancelled', label: 'Cancel', variant: 'danger' },
    ]
  }
  // delivered
  return [
    { target: 'closed_short_paid', label: 'Close (Short Paid)', variant: 'danger' },
    { target: 'cancelled', label: 'Cancel', variant: 'danger' },
  ]
}

/** Dispute button — available from any non-terminal, non-disputed status. */
function getDisputeButton(current: ProjectStatus): { target: 'disputed'; label: string; variant: 'danger' } | null {
  const canDispute: ProjectStatus[] = ['quoted', 'deposit_received', 'in_progress', 'delivered']
  if (!canDispute.includes(current)) return null
  return { target: 'disputed', label: 'Mark Disputed', variant: 'danger' }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a date string for display.
 *
 * @param dateStr - ISO-8601 date string
 * @returns Formatted date (e.g. "Jan 15, 2026") or em-dash
 */
function formatDisplayDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Full project detail view with financial summary, transactions, and
 * status action buttons.
 *
 * @param props - ProjectDetailProps
 * @returns JSX.Element
 */
export function ProjectDetail({
  project,
  onStatusChange,
  onNotesSave,
  onEdit,
  onBack,
}: ProjectDetailProps): JSX.Element {
  const [notesDraft, setNotesDraft] = useState(project.notes ?? '')
  const [notesSaving, setNotesSaving] = useState(false)

  const statusLabel = PROJECT_STATUS_LABELS[project.status] ?? project.status
  const statusColor = PROJECT_STATUS_COLORS[project.status] ?? '#9CA3AF'

  // -------------------------------------------------------------------------
  // Status action buttons
  // -------------------------------------------------------------------------

  const forwardButtons = NEXT_STATUS_BUTTONS[project.status] ?? []
  const cancelButtons = getCancelButtons(project.status)
  const disputeButton = getDisputeButton(project.status)

  // -------------------------------------------------------------------------
  // Notes save handler
  // -------------------------------------------------------------------------

  const handleNotesSave = useCallback(() => {
    setNotesSaving(true)
    onNotesSave(project.id, notesDraft)
    // Parent should call us back or we assume success after a brief delay
    setTimeout(() => setNotesSaving(false), 300)
  }, [project.id, notesDraft, onNotesSave])

  // -------------------------------------------------------------------------
  // Button style helper
  // -------------------------------------------------------------------------

  const getButtonClass = (variant: 'primary' | 'danger' | 'neutral'): string => {
    const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 '
    switch (variant) {
      case 'primary':
        return base + 'bg-[#1F8A4C] text-white hover:bg-[#166638] focus:ring-[#1F8A4C]'
      case 'danger':
        return base + 'bg-[#EF4444] text-white hover:bg-[#DC2626] focus:ring-[#EF4444]'
      case 'neutral':
        return base + 'bg-[#E5E5E5] text-[#181818] hover:bg-[#D1D5DB] focus:ring-[#E5E5E5]'
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Back + Actions Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-[#F37002] 
                     font-medium hover:underline focus:outline-none"
        >
          <span>&larr;</span> Back to Projects
        </button>
        <button
          onClick={() => onEdit(project.id)}
          className="px-4 py-2 bg-white border border-[#E8E6E1] rounded-lg 
                     text-sm font-medium text-[#181818] hover:bg-[#FAFAF7] 
                     transition-colors focus:outline-none focus:ring-2 
                     focus:ring-[#F37002] focus:ring-offset-1"
        >
          Edit Project
        </button>
      </div>

      {/* Project Header Card */}
      <div className="bg-white rounded-xl border border-[#E8E6E1] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#181818]">{project.name}</h1>
            <p className="text-[#A0A0A0] text-sm">{project.client}</p>
          </div>
          <span
            className="self-start inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
            style={{
              backgroundColor: `${statusColor}18`,
              color: statusColor,
            }}
          >
            {statusLabel}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#A0A0A0]">
          <span>
            Started:{' '}
            <span className="text-[#181818] font-medium">
              {formatDisplayDate(project.start_date)}
            </span>
          </span>
          {project.expected_delivery_date && (
            <span>
              Due:{' '}
              <span className="text-[#181818] font-medium">
                {formatDisplayDate(project.expected_delivery_date)}
              </span>
            </span>
          )}
          {project.actual_delivery_date && (
            <span>
              Delivered:{' '}
              <span className="text-[#1F8A4C] font-medium">
                {formatDisplayDate(project.actual_delivery_date)}
              </span>
            </span>
          )}
          {project.closed_date && (
            <span>
              Closed:{' '}
              <span className="text-[#181818] font-medium">
                {formatDisplayDate(project.closed_date)}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Financial Summary Card */}
      <div className="bg-white rounded-xl border border-[#E8E6E1] p-6">
        <h2 className="text-lg font-semibold text-[#181818] mb-4">Financial Summary</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          {/* Total Value */}
          <div>
            <p className="text-sm text-[#A0A0A0] mb-1">Total Value</p>
            <p
              className="text-xl font-bold text-[#181818]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {formatAmount(project.total_value_minor, project.currency)}
            </p>
          </div>

          {/* Received */}
          <div>
            <p className="text-sm text-[#A0A0A0] mb-1">Received</p>
            <p
              className="text-xl font-bold text-[#1F8A4C]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {formatAmount(project.received_minor, project.currency)}
            </p>
          </div>

          {/* Outstanding */}
          <div>
            <p className="text-sm text-[#A0A0A0] mb-1">Outstanding</p>
            <p
              className="text-xl font-bold text-[#181818]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {formatAmount(project.outstanding_minor, project.currency)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#A0A0A0]">Progress</span>
            <span className="text-sm font-semibold text-[#1F8A4C]">
              {project.pct_paid}%
            </span>
          </div>
          <div className="w-full h-2 bg-[#E5E5E5] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${project.pct_paid}%`,
                backgroundColor: '#1F8A4C',
              }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {/* Payment Schedule */}
      {project.payment_schedule_note && (
        <div className="bg-white rounded-xl border border-[#E8E6E1] p-6">
          <h2 className="text-lg font-semibold text-[#181818] mb-3">
            Payment Schedule
          </h2>
          <p className="text-sm text-[#181818] whitespace-pre-wrap">
            {project.payment_schedule_note}
          </p>
        </div>
      )}

      {/* Linked Transactions */}
      <div className="bg-white rounded-xl border border-[#E8E6E1] p-6">
        <h2 className="text-lg font-semibold text-[#181818] mb-4">
          Linked Transactions
          {project.transactions.length > 0 && (
            <span className="ml-2 text-sm font-normal text-[#A0A0A0]">
              ({project.transactions.length})
            </span>
          )}
        </h2>

        {project.transactions.length === 0 ? (
          <p className="text-sm text-[#A0A0A0]">
            No transactions linked to this project yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E6E1] text-[#A0A0A0]">
                  <th className="text-left px-3 py-2 font-medium">Ref</th>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">Vendor</th>
                  <th className="text-left px-3 py-2 font-medium">Description</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {project.transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-[#E8E6E1] last:border-b-0 hover:bg-[#FAFAF7]"
                  >
                    <td className="px-3 py-2 text-[#A0A0A0]">
                      {tx.reference_code ?? tx.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-[#181818]">
                      {formatDisplayDate(tx.occurred_at)}
                    </td>
                    <td className="px-3 py-2 text-[#181818]">{tx.vendor}</td>
                    <td className="px-3 py-2 text-[#181818]">
                      {tx.description ?? tx.category}
                    </td>
                    <td
                      className="px-3 py-2 text-right font-medium"
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        color: tx.type === 'income' ? '#1F8A4C' : '#EF4444',
                      }}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatAmount(tx.amount_minor, tx.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-[#E8E6E1] p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-[#181818]">Notes</h2>
          <button
            onClick={handleNotesSave}
            disabled={notesSaving}
            className="px-3 py-1.5 text-xs font-medium text-white bg-[#F37002] 
                       rounded-lg hover:bg-[#D95F00] transition-colors 
                       focus:outline-none focus:ring-2 focus:ring-[#F37002] 
                       focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {notesSaving ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          placeholder="Add notes about this project..."
          rows={4}
          className="w-full px-3 py-2 bg-[#FAFAF7] border border-[#E8E6E1] 
                     rounded-lg text-sm text-[#181818] placeholder-[#A0A0A0]
                     focus:outline-none focus:ring-2 focus:ring-[#F37002] 
                     focus:border-transparent resize-y"
        />
      </div>

      {/* Status Actions */}
      {(forwardButtons.length > 0 ||
        cancelButtons.length > 0 ||
        disputeButton) && (
        <div className="bg-white rounded-xl border border-[#E8E6E1] p-6">
          <h2 className="text-lg font-semibold text-[#181818] mb-4">Actions</h2>

          <div className="flex flex-wrap gap-3">
            {/* Forward transitions */}
            {forwardButtons.map((btn) => (
              <button
                key={btn.target}
                onClick={() => onStatusChange(project.id, btn.target)}
                className={getButtonClass(btn.variant)}
              >
                {btn.label}
              </button>
            ))}

            {/* Dispute */}
            {disputeButton && (
              <button
                onClick={() => onStatusChange(project.id, disputeButton.target)}
                className={getButtonClass(disputeButton.variant)}
              >
                {disputeButton.label}
              </button>
            )}

            {/* Cancel variants */}
            {cancelButtons.map((btn) => (
              <button
                key={btn.target}
                onClick={() => onStatusChange(project.id, btn.target)}
                className={getButtonClass(btn.variant)}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
