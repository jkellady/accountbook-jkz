/**
 * Settings Server Actions
 * JK Zentra Finance Cockpit — Sprint 1
 *
 * Server-side mutations for user settings, profile, and data management.
 * All inputs validated with Zod. Every exported function has JSDoc.
 */

'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient, createActionClient } from '@/lib/supabase/server'
import type { UserSettings, CP500ScheduleItem } from '@/lib/supabase/database.types'

// ─────────────────────────────────────────────────────────────────────────────
// Zod Schemas — strict validation for all user inputs
// ─────────────────────────────────────────────────────────────────────────────

const cp500ItemSchema = z.object({
  instalment_no: z.number().int().min(1).max(6),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  amount_minor: z.number().int().min(0),
  status: z.enum(['pending', 'paid']).optional(),
  payment_method: z.string().max(100).optional(),
  file_id: z.string().uuid().nullable().optional(),
})

const taxReserveStrategySchema = z.object({
  enabled: z.boolean(),
  percent_of_income: z.number().min(0).max(100),
  target_account_name: z.string().min(1).max(100),
  reminder_day_of_month: z.number().int().min(1).max(31),
})

const userSettingsSchema = z.object({
  default_entity_id: z.string().uuid().nullable(),
  tax_year_start: z.string().regex(/^\d{2}-\d{2}$/),
  effective_tax_rate_percent: z.number().min(0).max(30),
  lhdn_forecast_income_minor: z.number().int().min(0),
  cp500_schedule: z.array(cp500ItemSchema),
  tax_reserve_strategy: taxReserveStrategySchema,
  cp502_threshold_percent: z.number().min(0).max(100),
  reminder_channels: z.array(z.enum(['in_app', 'email'])),
  google_calendar_connected: z.boolean(),
  fx_preference: z.enum(['latest_cached', 'realtime']),
  monthly_ai_cost_cap_minor: z.number().int().min(100).max(5000000),
})

// Partial schema for partial updates (all fields optional)
const partialUserSettingsSchema = userSettingsSchema.partial()

const displayNameSchema = z.string().min(1).max(100)

// ─────────────────────────────────────────────────────────────────────────────
// Defaults — used when settings JSONB key is missing
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: UserSettings = {
  default_entity_id: null,
  tax_year_start: '01-01',
  effective_tax_rate_percent: 12.4,
  lhdn_forecast_income_minor: 0,
  cp500_schedule: [],
  tax_reserve_strategy: {
    enabled: false,
    percent_of_income: 15,
    target_account_name: 'Tax Reserve',
    reminder_day_of_month: 25,
  },
  cp502_threshold_percent: 10.0,
  reminder_channels: ['in_app', 'email'],
  google_calendar_connected: false,
  fx_preference: 'latest_cached',
  monthly_ai_cost_cap_minor: 50000,
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merge stored settings with defaults so every key is guaranteed to exist.
 */
function mergeWithDefaults(stored: Record<string, unknown>): UserSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    tax_reserve_strategy: {
      ...DEFAULT_SETTINGS.tax_reserve_strategy,
      ...(stored.tax_reserve_strategy as Record<string, unknown> || {}),
    },
  } as UserSettings
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported Server Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's settings merged with defaults.
 *
 * @returns Object containing display_name and fully-hydrated UserSettings
 */
export async function getSettings(): Promise<{
  display_name: string | null
  settings: UserSettings
  entities: { id: string; name: string; slug: string }[]
}> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthorized: no authenticated user')
  }

  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('display_name, settings')
    .eq('id', user.id)
    .single()

  if (userError) {
    throw new Error(`Failed to load settings: ${userError.message}`)
  }

  const { data: entities, error: entitiesError } = await supabase
    .from('entities')
    .select('id, name, slug')
    .order('slug', { ascending: true })

  if (entitiesError) {
    throw new Error(`Failed to load entities: ${entitiesError.message}`)
  }

  const storedSettings = (userRow?.settings as Record<string, unknown>) || {}
  const settings = mergeWithDefaults(storedSettings)

  return {
    display_name: userRow?.display_name ?? null,
    settings,
    entities: entities ?? [],
  }
}

/**
 * Update a subset of the user's settings JSONB column.
 * Validates the input with Zod before writing to the database.
 *
 * @param partial — Partial UserSettings object containing only changed keys
 */
export async function updateSettings(
  partial: Partial<UserSettings>
): Promise<void> {
  const supabase = await createActionClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthorized: no authenticated user')
  }

  // Validate the partial input
  const parseResult = partialUserSettingsSchema.safeParse(partial)
  if (!parseResult.success) {
    throw new Error(
      `Validation failed: ${parseResult.error.errors.map((e) => e.message).join(', ')}`
    )
  }

  // Fetch current settings to merge
  const { data: currentRow, error: fetchError } = await supabase
    .from('users')
    .select('settings')
    .eq('id', user.id)
    .single()

  if (fetchError) {
    throw new Error(`Failed to fetch current settings: ${fetchError.message}`)
  }

  const currentSettings = (currentRow?.settings as Record<string, unknown>) || {}
  const merged = mergeWithDefaults(currentSettings)

  // Deep-merge the partial update
  const updated: UserSettings = {
    ...merged,
    ...partial,
    tax_reserve_strategy: {
      ...merged.tax_reserve_strategy,
      ...(partial.tax_reserve_strategy || {}),
    },
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ settings: updated as unknown as Record<string, unknown> })
    .eq('id', user.id)

  if (updateError) {
    throw new Error(`Failed to save settings: ${updateError.message}`)
  }

  revalidatePath('/settings')
}

/**
 * Update the user's display name.
 *
 * @param name — New display name, 1–100 characters
 */
export async function updateDisplayName(name: string): Promise<void> {
  const supabase = await createActionClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthorized: no authenticated user')
  }

  const parseResult = displayNameSchema.safeParse(name)
  if (!parseResult.success) {
    throw new Error(
      `Invalid display name: ${parseResult.error.errors.map((e) => e.message).join(', ')}`
    )
  }

  const { error } = await supabase
    .from('users')
    .update({ display_name: name })
    .eq('id', user.id)

  if (error) {
    throw new Error(`Failed to update display name: ${error.message}`)
  }

  revalidatePath('/settings')
}

/**
 * Generate default CP500 instalment schedule for the given tax year.
 * Malaysia CP500: 6 instalments due on the 30th of months 4–9 (YA basis).
 *
 * @param year — Tax year (e.g. 2026)
 * @param estimatedTaxMinor — Estimated annual tax in minor units (sen)
 * @returns Array of 6 CP500ScheduleItem objects
 */
export async function generateDefaultCP500Schedule(
  year: number,
  estimatedTaxMinor: number
): Promise<CP500ScheduleItem[]> {
  const amountPerInstalment = Math.round(estimatedTaxMinor / 6)

  const schedule: CP500ScheduleItem[] = Array.from({ length: 6 }, (_, i) => ({
    instalment_no: i + 1,
    due_date: `${year}-${String(i + 4).padStart(2, '0')}-30`,
    amount_minor: amountPerInstalment,
    status: 'pending',
    payment_method: '',
    file_id: null,
  }))

  // Adjust last instalment to absorb rounding remainder
  const totalScheduled = amountPerInstalment * 6
  if (totalScheduled !== estimatedTaxMinor) {
    schedule[5].amount_minor += estimatedTaxMinor - totalScheduled
  }

  return schedule
}

/**
 * Trigger a manual backup of all user data.
 * Returns the file ID and a temporary download URL.
 */
export async function backupNow(): Promise<{
  fileId: string
  downloadUrl: string
}> {
  const supabase = await createActionClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthorized: no authenticated user')
  }

  // Placeholder: in production this would trigger a background job
  // that exports all tables to CSV, zips them, and stores in Supabase Storage.
  const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  const downloadUrl = `/api/backup/download/${fileId}`

  return { fileId, downloadUrl }
}

/**
 * Export all user data as a combined CSV archive.
 * Returns a temporary signed URL for the download.
 */
export async function exportAllData(): Promise<{ csvUrl: string }> {
  const supabase = await createActionClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthorized: no authenticated user')
  }

  // Placeholder: in production this queries all tables,
  // serialises to CSV, and returns a signed Supabase Storage URL.
  const csvUrl = `/api/export/all?user=${user.id}`

  return { csvUrl }
}
