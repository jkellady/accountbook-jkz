/**
 * ============================================================================
 * JK Zentra Finance Cockpit — Project Card (Mobile)
 * ============================================================================
 *
 * Mobile-optimized card view for a single project. Displays name, client,
 * financial progress, due date, and status pill.
 *
 * Tapping the card navigates to the detail view.
 */

'use client'

import { formatAmount } from '@/lib/utils/currency'
import type { ProjectWithComputed } from '@/lib/actions/projects'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/actions/projects'
import type { ProjectStatus } from '@/lib/supabase/database.types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProjectCardProps {
  /** Project data with computed financial fields. */
  project: ProjectWithComputed
  /** Callback when the card is tapped. */
  onClick: (projectId: string) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a date string as a readable short date.
 *
 * @param dateStr - ISO-8601 date string
 * @returns Formatted date (e.g. "Jun 30") or em-dash
 */
function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-MY', { month: 'short', day: 'numeric' })
}

/**
 * Determine if a due date is overdue.
 *
 * @param dateStr - ISO-8601 date string
 * @returns True if the date is in the past
 */
function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const due = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Mobile project card — a compact, tappable summary of a project's
 * financial standing and timeline.
 *
 * @param props - ProjectCardProps
 * @returns JSX.Element
 */
export function ProjectCard({ project, onClick }: ProjectCardProps): JSX.Element {
  const statusLabel = PROJECT_STATUS_LABELS[project.status as ProjectStatus] ?? project.status
  const statusColor = PROJECT_STATUS_COLORS[project.status as ProjectStatus] ?? '#9CA3AF'
  const overdue = isOverdue(project.expected_delivery_date)

  return (
    <button
      onClick={() => onClick(project.id)}
      className="w-full text-left bg-white rounded-xl border border-[#E8E6E1] p-4 
                 hover:shadow-md transition-shadow duration-200 
                 focus:outline-none focus:ring-2 focus:ring-[#F37002] focus:ring-offset-1"
      aria-label={`${project.name} — ${statusLabel}`}
    >
      {/* Header: Name + Status */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1 mr-2">
          <h3 className="font-semibold text-[#181818] text-base truncate">
            {project.name}
          </h3>
          <p className="text-sm text-[#A0A0A0] truncate">{project.client}</p>
        </div>
        <span
          className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
          style={{
            backgroundColor: `${statusColor}18`,
            color: statusColor,
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
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

      {/* Financial Row */}
      <div className="flex items-center justify-between text-sm mb-2">
        <div>
          <span className="text-[#A0A0A0]">Received</span>
          <p className="font-medium text-[#181818]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {formatAmount(project.received_minor, project.currency)}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[#A0A0A0]">Outstanding</span>
          <p className="font-medium text-[#181818]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {formatAmount(project.outstanding_minor, project.currency)}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[#A0A0A0]">Paid</span>
          <p className="font-semibold text-[#1F8A4C]">{project.pct_paid}%</p>
        </div>
      </div>

      {/* Due Date */}
      <div className="flex items-center justify-between pt-2 border-t border-[#E8E6E1]">
        <span className="text-xs text-[#A0A0A0]">
          Due:{' '}
          <span className={overdue ? 'text-[#EF4444] font-medium' : 'text-[#181818]'}>
            {formatShortDate(project.expected_delivery_date)}
          </span>
        </span>
        <span className="text-xs text-[#A0A0A0]">
          {formatAmount(project.total_value_minor, project.currency)} total
        </span>
      </div>
    </button>
  )
}
