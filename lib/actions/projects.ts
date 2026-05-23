/**
 * ============================================================================
 * JK Zentra Finance Cockpit — Project Server Actions
 * ============================================================================
 *
 * Server-side CRUD operations for the projects table plus computed financial
 * fields calculated from linked transactions.
 *
 * Computed fields (server-side):
 *   - received_minor:     SUM of linked income transactions with status='active'
 *   - outstanding_minor:  total_value_minor - received_minor
 *   - pct_paid:           (received_minor / total_value_minor) * 100
 *
 * Status transitions are validated against a directed graph. Invalid
 * transitions are rejected before reaching the database.
 *
 * Every column referenced below exists in schema.sql section 3.4 and in
 * database.types.ts -> Database['public']['Tables']['projects'].
 */

'use server'

import { createActionClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Database,
  ProjectRow,
  ProjectInsert,
  ProjectUpdate,
  ProjectStatus,
  TransactionRow,
} from '@/lib/supabase/database.types'

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

/**
 * A project row augmented with server-computed financial fields derived
 * from linked income transactions.
 */
export interface ProjectWithComputed extends ProjectRow {
  /** Sum of all active income transactions linked to this project (minor units). */
  received_minor: number
  /** Remaining amount yet to be received (minor units). Never negative. */
  outstanding_minor: number
  /** Percentage of total value that has been received (0–100). */
  pct_paid: number
}

/**
 * A project with its full transaction history and computed fields.
 */
export interface ProjectWithTransactions extends ProjectWithComputed {
  /** All active transactions linked to this project. */
  transactions: TransactionRow[]
}

/** Filter options for listing projects. */
export interface ProjectListFilters {
  /** Filter by project status. */
  status?: ProjectStatus
  /** Filter by owning entity ID. */
  entityId?: string
  /** Search by name or client (case-insensitive partial match). */
  search?: string
}

/** Sortable columns for the project list. */
export type ProjectSortColumn =
  | 'name'
  | 'client'
  | 'pct_paid'
  | 'outstanding_minor'
  | 'expected_delivery_date'

/** Sort direction. */
export type SortDirection = 'asc' | 'desc'

/** Sort configuration for project lists. */
export interface ProjectSort {
  column: ProjectSortColumn
  direction: SortDirection
}

// ---------------------------------------------------------------------------
// Status transition graph
// ---------------------------------------------------------------------------

/**
 * Valid status transitions. Keys are source statuses; values are the set of
 * statuses that can be reached directly from that source.
 *
 * Terminal statuses (fully_paid, cancelled, cancelled_with_deposit_kept,
 * cancelled_partial, closed_short_paid, archived) have no forward transitions.
 * Any non-terminal status can transition to 'disputed'.
 */
const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  quoted: ['deposit_received', 'cancelled', 'disputed', 'archived'],
  deposit_received: ['in_progress', 'cancelled_with_deposit_kept', 'cancelled', 'disputed', 'archived'],
  in_progress: ['delivered', 'cancelled_partial', 'cancelled', 'disputed', 'archived'],
  delivered: ['fully_paid', 'closed_short_paid', 'disputed', 'archived'],
  fully_paid: ['archived'],
  disputed: ['in_progress', 'delivered', 'fully_paid', 'closed_short_paid', 'cancelled', 'archived'],
  cancelled: ['archived'],
  cancelled_with_deposit_kept: ['archived'],
  cancelled_partial: ['archived'],
  closed_short_paid: ['archived'],
  archived: [],
}

/**
 * Check whether a status transition is valid.
 *
 * @param from - Current project status
 * @param to - Desired new status
 * @returns True if the transition is allowed
 */
function isValidTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  if (from === to) return true
  const allowed = VALID_TRANSITIONS[from] ?? []
  return allowed.includes(to)
}

/** Human-readable labels for project statuses. */
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  quoted: 'Quoted',
  deposit_received: 'Deposit Received',
  in_progress: 'In Progress',
  delivered: 'Delivered',
  fully_paid: 'Fully Paid',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
  cancelled_with_deposit_kept: 'Cancelled (Deposit Kept)',
  cancelled_partial: 'Cancelled (Partial)',
  closed_short_paid: 'Closed (Short Paid)',
  archived: 'Archived',
}

/** CSS colour classes for status pills. */
export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  quoted: '#3B82F6',
  deposit_received: '#F59E0B',
  in_progress: '#F59E0B',
  delivered: '#8B5CF6',
  fully_paid: '#1F8A4C',
  disputed: '#EF4444',
  cancelled: '#9CA3AF',
  cancelled_with_deposit_kept: '#9CA3AF',
  cancelled_partial: '#9CA3AF',
  closed_short_paid: '#9CA3AF',
  archived: '#D1D5DB',
}

/** Statuses considered "active" — work is ongoing. */
export const ACTIVE_STATUSES: ProjectStatus[] = [
  'quoted',
  'deposit_received',
  'in_progress',
  'delivered',
]

/** Statuses considered "completed" — successfully finished. */
export const COMPLETED_STATUSES: ProjectStatus[] = [
  'fully_paid',
  'closed_short_paid',
]

/** Statuses considered "cancelled". */
export const CANCELLED_STATUSES: ProjectStatus[] = [
  'cancelled',
  'cancelled_with_deposit_kept',
  'cancelled_partial',
]

// ---------------------------------------------------------------------------
// Helper: compute financial fields from linked transactions
// ---------------------------------------------------------------------------

/**
 * Compute received_minor, outstanding_minor, and pct_paid from a list of
 * linked transactions.
 *
 * Only active income transactions are counted toward received_minor.
 *
 * @param transactions - Linked transaction rows
 * @param totalValueMinor - The project's total value in minor units
 * @returns Computed financial fields
 */
function computeProjectFields(
  transactions: TransactionRow[],
  totalValueMinor: number
): { received_minor: number; outstanding_minor: number; pct_paid: number } {
  const received_minor = transactions
    .filter((tx) => tx.type === 'income' && tx.status === 'active')
    .reduce((sum, tx) => sum + tx.amount_minor, 0)

  const outstanding_minor = Math.max(0, totalValueMinor - received_minor)
  const pct_paid = totalValueMinor > 0
    ? Math.min(100, Math.round((received_minor / totalValueMinor) * 100))
    : 0

  return { received_minor, outstanding_minor, pct_paid }
}

// ---------------------------------------------------------------------------
// Helper: fetch linked transactions for a project
// ---------------------------------------------------------------------------

/**
 * Fetch all active transactions linked to a given project.
 *
 * @param supabase - Typed Supabase client
 * @param projectId - Project UUID
 * @returns Array of transaction rows
 */
async function fetchLinkedTransactions(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<TransactionRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('project_id', projectId)
    .neq('status', 'archived')
    .order('occurred_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch linked transactions: ${error.message}`)
  }

  return data ?? []
}

// ---------------------------------------------------------------------------
// CRUD: Create
// ---------------------------------------------------------------------------

/**
 * Create a new project.
 *
 * @param data - Project insert data (must include entity_id, name, client, total_value_minor, currency, start_date)
 * @returns Object containing the new project ID
 * @throws Error if the insert fails
 */
export async function createProject(
  data: ProjectInsert
): Promise<{ projectId: string }> {
  const supabase = await createActionClient()

  const { data: result, error } = await supabase
    .from('projects')
    .insert(data)
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to create project: ${error.message}`)
  }

  if (!result) {
    throw new Error('Project creation returned no data')
  }

  return { projectId: result.id }
}

// ---------------------------------------------------------------------------
// CRUD: List with computed fields
// ---------------------------------------------------------------------------

/**
 * List projects with server-computed financial fields.
 *
 * Supports filtering by status, entity, and text search. Also supports
 * sorting by any ProjectSortColumn.
 *
 * @param filters - Optional filters (status, entityId, search)
 * @param sort - Optional sort configuration (defaults to name ascending)
 * @returns Array of projects with computed financial fields
 * @throws Error if the query fails
 */
export async function listProjects(
  filters?: ProjectListFilters,
  sort?: ProjectSort
): Promise<ProjectWithComputed[]> {
  const supabase = await createActionClient()

  let query = supabase.from('projects').select('*')

  // Apply status filter
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  // Apply entity filter
  if (filters?.entityId) {
    query = query.eq('entity_id', filters.entityId)
  }

  // Exclude archived by default unless explicitly requested
  if (filters?.status !== 'archived') {
    query = query.neq('status', 'archived')
  }

  // Apply sorting
  const sortColumn = sort?.column ?? 'name'
  const sortDirection = sort?.direction ?? 'asc'
  query = query.order(sortColumn, { ascending: sortDirection === 'asc' })

  const { data: projects, error } = await query

  if (error) {
    throw new Error(`Failed to list projects: ${error.message}`)
  }

  const rows = projects ?? []

  // For each project, fetch linked transactions and compute fields
  const results: ProjectWithComputed[] = await Promise.all(
    rows.map(async (project) => {
      const transactions = await fetchLinkedTransactions(supabase, project.id)
      const computed = computeProjectFields(transactions, project.total_value_minor)

      return {
        ...project,
        ...computed,
      }
    })
  )

  // Apply text search post-query (searches name and client)
  if (filters?.search && filters.search.trim() !== '') {
    const term = filters.search.toLowerCase()
    return results.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.client.toLowerCase().includes(term)
    )
  }

  return results
}

// ---------------------------------------------------------------------------
// CRUD: Get single project with transactions
// ---------------------------------------------------------------------------

/**
 * Get a single project by ID, including computed financial fields and
 * all linked (non-archived) transactions.
 *
 * @param id - Project UUID
 * @returns Project with computed fields and transactions, or null if not found
 * @throws Error if the query fails
 */
export async function getProject(
  id: string
): Promise<ProjectWithTransactions | null> {
  const supabase = await createActionClient()

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // PostgREST "no rows" code
      return null
    }
    throw new Error(`Failed to get project: ${error.message}`)
  }

  if (!project) {
    return null
  }

  const transactions = await fetchLinkedTransactions(supabase, id)
  const computed = computeProjectFields(transactions, project.total_value_minor)

  return {
    ...project,
    ...computed,
    transactions,
  }
}

// ---------------------------------------------------------------------------
// CRUD: Update
// ---------------------------------------------------------------------------

/**
 * Update a project's fields.
 *
 * Does NOT allow updating status — use updateProjectStatus for that.
 *
 * @param id - Project UUID
 * @param data - Partial project update data
 * @throws Error if the update fails
 */
export async function updateProject(
  id: string,
  data: Omit<ProjectUpdate, 'id' | 'status'>
): Promise<void> {
  const supabase = await createActionClient()

  const { error } = await supabase
    .from('projects')
    .update(data)
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to update project: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// CRUD: Update status with transition validation
// ---------------------------------------------------------------------------

/**
 * Update a project's status, validating the transition against the
 * allowed transition graph.
 *
 * @param id - Project UUID
 * @param status - Target status
 * @throws Error if the transition is invalid or the update fails
 */
export async function updateProjectStatus(
  id: string,
  status: ProjectStatus
): Promise<void> {
  const supabase = await createActionClient()

  // Fetch current status to validate transition
  const { data: current, error: fetchError } = await supabase
    .from('projects')
    .select('status')
    .eq('id', id)
    .single()

  if (fetchError) {
    throw new Error(`Failed to fetch current status: ${fetchError.message}`)
  }

  if (!current) {
    throw new Error(`Project not found: ${id}`)
  }

  if (!isValidTransition(current.status, status)) {
    throw new Error(
      `Invalid status transition: ${current.status} -> ${status}`
    )
  }

  // Build update payload with relevant date fields
  const updateData: ProjectUpdate = { status }

  // Auto-set actual_delivery_date when transitioning to delivered
  if (status === 'delivered' && current.status !== 'delivered') {
    updateData.actual_delivery_date = new Date().toISOString().split('T')[0]
  }

  // Auto-set closed_date when transitioning to a terminal status
  const terminalStatuses: ProjectStatus[] = [
    'fully_paid',
    'cancelled',
    'cancelled_with_deposit_kept',
    'cancelled_partial',
    'closed_short_paid',
  ]
  if (terminalStatuses.includes(status)) {
    updateData.closed_date = new Date().toISOString().split('T')[0]
  }

  const { error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to update project status: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Summary: Count projects by status group
// ---------------------------------------------------------------------------

/**
 * Get counts of projects grouped by status category.
 *
 * @param entityId - Optional entity ID filter
 * @returns Counts for active, completed, disputed, cancelled, and all
 * @throws Error if the query fails
 */
export async function getProjectCounts(
  entityId?: string
): Promise<{
  active: number
  completed: number
  disputed: number
  cancelled: number
  all: number
}> {
  const supabase = await createActionClient()

  let query = supabase.from('projects').select('status', { count: 'exact' })

  if (entityId) {
    query = query.eq('entity_id', entityId)
  }

  // Get all non-archived projects
  const { data, error } = await query.neq('status', 'archived')

  if (error) {
    throw new Error(`Failed to count projects: ${error.message}`)
  }

  const rows = data ?? []

  return {
    active: rows.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
    completed: rows.filter((r) => COMPLETED_STATUSES.includes(r.status)).length,
    disputed: rows.filter((r) => r.status === 'disputed').length,
    cancelled: rows.filter((r) => CANCELLED_STATUSES.includes(r.status)).length,
    all: rows.length,
  }
}

// ---------------------------------------------------------------------------
// Delete (soft — sets status to archived)
// ---------------------------------------------------------------------------

/**
 * Soft-delete a project by setting its status to 'archived'.
 *
 * @param id - Project UUID
 * @throws Error if the archive operation fails
 */
export async function archiveProject(id: string): Promise<void> {
  await updateProjectStatus(id, 'archived')
}

// ---------------------------------------------------------------------------
// Update project notes
// ---------------------------------------------------------------------------

/**
 * Update the free-text notes field on a project.
 *
 * @param id - Project UUID
 * @param notes - New notes content (can be empty string)
 * @throws Error if the update fails
 */
export async function updateProjectNotes(
  id: string,
  notes: string
): Promise<void> {
  const supabase = await createActionClient()

  const { error } = await supabase
    .from('projects')
    .update({ notes })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to update project notes: ${error.message}`)
  }
}
