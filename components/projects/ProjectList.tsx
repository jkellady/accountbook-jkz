/**
 * ============================================================================
 * JK Zentra Finance Cockpit — Project List
 * ============================================================================
 *
 * Main projects listing view with filter tabs, sortable columns, progress
 * bars, and mobile-responsive layout (card list on small screens, table
 * on desktop).
 *
 * Filter tabs: Active (default) | Completed | Disputed | Cancelled | All
 * Sortable columns: name, client, pct_paid, outstanding, due date
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import { formatAmount } from '@/lib/utils/currency'
import type { ProjectWithComputed } from '@/lib/actions/projects'
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  ACTIVE_STATUSES,
  COMPLETED_STATUSES,
  CANCELLED_STATUSES,
} from '@/lib/actions/projects'
import type { ProjectStatus } from '@/lib/supabase/database.types'
import { ProjectCard } from './ProjectCard'
import type { ProjectSortColumn, SortDirection } from '@/lib/actions/projects'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterTab = 'active' | 'completed' | 'disputed' | 'cancelled' | 'all'

interface ProjectListProps {
  /** Pre-fetched project rows with computed fields. */
  projects: ProjectWithComputed[]
  /** Callback when a project row/card is clicked. */
  onProjectClick: (projectId: string) => void
  /** Callback when the "New Project" button is clicked. */
  onNewProject: () => void
  /** Optional counts for the filter tabs. */
  counts?: {
    active: number
    completed: number
    disputed: number
    cancelled: number
    all: number
  }
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
 * Check if a project is overdue.
 *
 * @param dateStr - ISO-8601 date string
 * @returns True if the due date has passed
 */
function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const due = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

/** Map filter tab to the statuses it includes. */
const TAB_STATUS_MAP: Record<FilterTab, ProjectStatus[]> = {
  active: ACTIVE_STATUSES,
  completed: COMPLETED_STATUSES,
  disputed: ['disputed'],
  cancelled: CANCELLED_STATUSES,
  all: [],
}

// ---------------------------------------------------------------------------
// Sort indicator icon
// ---------------------------------------------------------------------------

/**
 * A small up/down arrow indicating the current sort direction.
 */
function SortIcon({ direction }: { direction: SortDirection }): JSX.Element {
  return (
    <span className="ml-1 inline-block text-[#A0A0A0]">
      {direction === 'asc' ? '\u2191' : '\u2193'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Project list view with filter tabs, sortable columns, and responsive layout.
 *
 * @param props - ProjectListProps
 * @returns JSX.Element
 */
export function ProjectList({
  projects,
  onProjectClick,
  onNewProject,
  counts,
}: ProjectListProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<FilterTab>('active')
  const [sortColumn, setSortColumn] = useState<ProjectSortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [search, setSearch] = useState('')

  // -------------------------------------------------------------------------
  // Sorting
  // -------------------------------------------------------------------------

  /**
   * Toggle sort on a column. If already sorting by that column, flip
   * direction; otherwise set to ascending.
   */
  const handleSort = useCallback(
    (column: ProjectSortColumn) => {
      setSortColumn((prev) => {
        if (prev === column) {
          setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
          return prev
        }
        setSortDirection('asc')
        return column
      })
    },
    []
  )

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  const filteredProjects = useMemo(() => {
    let result = projects

    // Tab filter
    const tabStatuses = TAB_STATUS_MAP[activeTab]
    if (tabStatuses.length > 0) {
      result = result.filter((p) => tabStatuses.includes(p.status))
    }

    // Search filter
    if (search.trim()) {
      const term = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.client.toLowerCase().includes(term)
      )
    }

    return result
  }, [projects, activeTab, search])

  // -------------------------------------------------------------------------
  // Sorting (client-side post-filter)
  // -------------------------------------------------------------------------

  const sortedProjects = useMemo(() => {
    const sorted = [...filteredProjects]
    const dir = sortDirection === 'asc' ? 1 : -1

    sorted.sort((a, b) => {
      switch (sortColumn) {
        case 'name':
          return dir * a.name.localeCompare(b.name)
        case 'client':
          return dir * a.client.localeCompare(b.client)
        case 'pct_paid':
          return dir * (a.pct_paid - b.pct_paid)
        case 'outstanding_minor':
          return dir * (a.outstanding_minor - b.outstanding_minor)
        case 'expected_delivery_date': {
          const aDate = a.expected_delivery_date ?? '9999-12-31'
          const bDate = b.expected_delivery_date ?? '9999-12-31'
          return dir * aDate.localeCompare(bDate)
        }
        default:
          return 0
      }
    })

    return sorted
  }, [filteredProjects, sortColumn, sortDirection])

  // -------------------------------------------------------------------------
  // Tabs configuration
  // -------------------------------------------------------------------------

  const tabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'active', label: 'Active', count: counts?.active },
    { key: 'completed', label: 'Completed', count: counts?.completed },
    { key: 'disputed', label: 'Disputed', count: counts?.disputed },
    { key: 'cancelled', label: 'Cancelled', count: counts?.cancelled },
    { key: 'all', label: 'All', count: counts?.all },
  ]

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  if (projects.length === 0) {
    return (
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#181818]">Projects</h1>
          <button
            onClick={onNewProject}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F37002] text-white 
                       rounded-lg text-sm font-medium hover:bg-[#D95F00] 
                       transition-colors focus:outline-none focus:ring-2 
                       focus:ring-[#F37002] focus:ring-offset-1"
          >
            <span className="text-lg leading-none">+</span> New Project
          </button>
        </div>

        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-[#A0A0A0] text-lg mb-4">No projects yet.</p>
          <button
            onClick={onNewProject}
            className="text-[#F37002] font-medium hover:underline focus:outline-none"
          >
            + Create first project
          </button>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-[#181818]">Projects</h1>
        <button
          onClick={onNewProject}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 
                     bg-[#F37002] text-white rounded-lg text-sm font-medium 
                     hover:bg-[#D95F00] transition-colors focus:outline-none 
                     focus:ring-2 focus:ring-[#F37002] focus:ring-offset-1"
        >
          <span className="text-lg leading-none">+</span> New Project
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or client..."
          className="w-full max-w-md px-4 py-2 bg-white border border-[#E8E6E1] 
                     rounded-lg text-sm text-[#181818] placeholder-[#A0A0A0]
                     focus:outline-none focus:ring-2 focus:ring-[#F37002] 
                     focus:border-transparent"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg 
                       text-sm font-medium transition-colors focus:outline-none
                       focus:ring-2 focus:ring-[#F37002] focus:ring-offset-1
                       ${
                         activeTab === tab.key
                           ? 'bg-[#F37002] text-white'
                           : 'bg-white text-[#181818] border border-[#E8E6E1] hover:bg-[#F5F5F2]'
                       }`}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span
                className={`inline-flex items-center justify-center min-w-[20px] 
                           h-5 px-1 rounded-full text-xs font-semibold
                           ${
                             activeTab === tab.key
                               ? 'bg-white/20 text-white'
                               : 'bg-[#E5E5E5] text-[#181818]'
                           }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Mobile: Card List */}
      <div className="block md:hidden space-y-3">
        {sortedProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onClick={onProjectClick}
          />
        ))}
        {sortedProjects.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#A0A0A0]">No projects match this filter.</p>
          </div>
        )}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-white rounded-xl border border-[#E8E6E1] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8E6E1] bg-[#FAFAF7]">
              <th className="text-left px-4 py-3 font-semibold text-[#181818]">
                <button
                  onClick={() => handleSort('name')}
                  className="inline-flex items-center hover:text-[#F37002] 
                             transition-colors focus:outline-none"
                >
                  Name
                  {sortColumn === 'name' && <SortIcon direction={sortDirection} />}
                </button>
              </th>
              <th className="text-left px-4 py-3 font-semibold text-[#181818]">
                <button
                  onClick={() => handleSort('client')}
                  className="inline-flex items-center hover:text-[#F37002] 
                             transition-colors focus:outline-none"
                >
                  Client
                  {sortColumn === 'client' && <SortIcon direction={sortDirection} />}
                </button>
              </th>
              <th className="text-left px-4 py-3 font-semibold text-[#181818]">
                <button
                  onClick={() => handleSort('pct_paid')}
                  className="inline-flex items-center hover:text-[#F37002] 
                             transition-colors focus:outline-none"
                >
                  % Paid
                  {sortColumn === 'pct_paid' && <SortIcon direction={sortDirection} />}
                </button>
              </th>
              <th className="text-right px-4 py-3 font-semibold text-[#181818]">
                Received
              </th>
              <th className="text-right px-4 py-3 font-semibold text-[#181818]">
                <button
                  onClick={() => handleSort('outstanding_minor')}
                  className="inline-flex items-center ml-auto hover:text-[#F37002] 
                             transition-colors focus:outline-none"
                >
                  Outstanding
                  {sortColumn === 'outstanding_minor' && (
                    <SortIcon direction={sortDirection} />
                  )}
                </button>
              </th>
              <th className="text-left px-4 py-3 font-semibold text-[#181818]">
                <button
                  onClick={() => handleSort('expected_delivery_date')}
                  className="inline-flex items-center hover:text-[#F37002] 
                             transition-colors focus:outline-none"
                >
                  Due
                  {sortColumn === 'expected_delivery_date' && (
                    <SortIcon direction={sortDirection} />
                  )}
                </button>
              </th>
              <th className="text-left px-4 py-3 font-semibold text-[#181818]">
                Status
              </th>
              <th className="text-right px-4 py-3 font-semibold text-[#181818]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedProjects.map((project) => {
              const statusLabel =
                PROJECT_STATUS_LABELS[project.status as ProjectStatus] ??
                project.status
              const statusColor =
                PROJECT_STATUS_COLORS[project.status as ProjectStatus] ??
                '#9CA3AF'
              const overdue = isOverdue(project.expected_delivery_date)

              return (
                <tr
                  key={project.id}
                  className="border-b border-[#E8E6E1] last:border-b-0 
                             hover:bg-[#FAFAF7] transition-colors cursor-pointer"
                  onClick={() => onProjectClick(project.id)}
                >
                  <td className="px-4 py-3 font-medium text-[#181818]">
                    {project.name}
                  </td>
                  <td className="px-4 py-3 text-[#181818]">{project.client}</td>

                  {/* % Paid + Progress Bar */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-[#E5E5E5] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${project.pct_paid}%`,
                            backgroundColor: '#1F8A4C',
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-[#181818] min-w-[32px]">
                        {project.pct_paid}%
                      </span>
                    </div>
                  </td>

                  {/* Received */}
                  <td
                    className="px-4 py-3 text-right text-[#1F8A4C] font-medium"
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {formatAmount(project.received_minor, project.currency)}
                  </td>

                  {/* Outstanding */}
                  <td
                    className="px-4 py-3 text-right text-[#181818] font-medium"
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {formatAmount(project.outstanding_minor, project.currency)}
                  </td>

                  {/* Due Date */}
                  <td className="px-4 py-3">
                    <span className={overdue ? 'text-[#EF4444] font-medium' : 'text-[#181818]'}>
                      {formatShortDate(project.expected_delivery_date)}
                    </span>
                  </td>

                  {/* Status Pill */}
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${statusColor}18`,
                        color: statusColor,
                      }}
                    >
                      {statusLabel}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onProjectClick(project.id)
                      }}
                      className="text-sm text-[#F37002] font-medium 
                                 hover:underline focus:outline-none"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {sortedProjects.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#A0A0A0]">No projects match this filter.</p>
          </div>
        )}
      </div>
    </div>
  )
}
