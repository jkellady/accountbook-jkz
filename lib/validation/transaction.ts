/**
 * JK Zentra Finance Cockpit — Transaction Form Validation Schema
 *
 * Zod schema for the transaction form. Validates all user-editable fields
 * before submission to Supabase. Mirrors the database CHECK constraints
 * exactly — never invents a column or value not in schema.sql.
 */

import { z } from 'zod'

// ----------------------------------------------------------------------------
// Currency helpers
// ----------------------------------------------------------------------------

/** Supported currency codes — must match schema.sql CHECK constraint. */
export const SUPPORTED_CURRENCIES = ['MYR', 'USD', 'SGD', 'EUR', 'GBP'] as const

/** Currency display helpers for the UI. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  MYR: 'RM',
  USD: '$',
  SGD: 'S$',
  EUR: '\u20AC',
  GBP: '\u00A3',
}

/** Converts a major-unit amount (e.g. 12.50) to minor units (1250). */
export function toMinorUnits(major: number): number {
  return Math.round(major * 100)
}

/** Converts minor units (e.g. 1250) to a displayable major amount (12.50). */
export function fromMinorUnits(minor: number): number {
  return minor / 100
}

/** Formats minor units into a human-readable currency string. */
export function formatMinor(minor: number | null, currency: string): string {
  if (minor === null || minor === undefined) return ''
  const major = fromMinorUnits(minor)
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency
  // Use 2 decimal places for all currencies in this app
  const formatted = major.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${symbol} ${formatted}`
}

// ----------------------------------------------------------------------------
// Category taxonomy
// ----------------------------------------------------------------------------

/** Primary category with its subcategories. */
export interface CategoryGroup {
  readonly category: string
  readonly subcategories: readonly string[]
}

/** Full category taxonomy — 16 primary groups with subcategories. */
export const CATEGORY_TAXONOMY: readonly CategoryGroup[] = [
  {
    category: 'AI & Software',
    subcategories: ['AI Tools', 'SaaS Subscriptions', 'Software Licenses', 'Cloud/Hosting', 'Domains'],
  },
  {
    category: 'Hardware & Equipment',
    subcategories: ['Computers', 'Phones', 'Cameras', 'Accessories', 'Office Equipment'],
  },
  {
    category: 'Connectivity',
    subcategories: ['Internet', 'Mobile Plans', 'VPN'],
  },
  {
    category: 'Transport',
    subcategories: ['Grab/Ride-hailing', 'Fuel', 'Parking', 'Tolls', 'Public Transit', 'Vehicle Maintenance'],
  },
  {
    category: 'Meals',
    subcategories: ['Client Meals', 'Personal Meals', 'Groceries', 'Coffee'],
  },
  {
    category: 'Travel',
    subcategories: ['Flights', 'Hotels', 'Per Diem', 'Travel Insurance'],
  },
  {
    category: 'Marketing',
    subcategories: ['Ads', 'Content', 'Branding', 'Print'],
  },
  {
    category: 'Education',
    subcategories: ['Courses', 'Books', 'Conferences', 'Memberships'],
  },
  {
    category: 'Client / Project',
    subcategories: ['Project Supplies', 'Subcontractors', 'Talent Fees', 'Production Costs'],
  },
  {
    category: 'Office / Workspace',
    subcategories: ['Coworking', 'Rent', 'Utilities', 'Stationery'],
  },
  {
    category: 'Personal',
    subcategories: ['Household', 'Family', 'Health', 'Entertainment', 'Gifts'],
  },
  {
    category: 'Tax / Admin',
    subcategories: ['Accounting Fees', 'Government Fees', 'Licenses', 'Insurance'],
  },
  {
    category: 'Banking / Fees',
    subcategories: ['Bank Charges', 'Card Fees', 'FX Fees', 'Payment Processor Fees'],
  },
  {
    category: 'Income',
    subcategories: ['Client Payment', 'Product Sale', 'Refund', 'Other Income'],
  },
  {
    category: 'Transfer',
    subcategories: ['Internal Transfer'],
  },
  {
    category: 'Other',
    subcategories: ['(review if >5%)'],
  },
] as const

/** Flat list of all primary category names. */
export const PRIMARY_CATEGORIES = CATEGORY_TAXONOMY.map((g) => g.category)

/** Gets subcategories for a given primary category. */
export function getSubcategories(category: string): readonly string[] {
  const group = CATEGORY_TAXONOMY.find((g) => g.category === category)
  return group?.subcategories ?? []
}

// ----------------------------------------------------------------------------
// Zod validation schema
// ----------------------------------------------------------------------------

/**
 * Zod schema for the transaction form.
 *
 * Every field maps 1:1 to the transactions table. The form status field
 * controls whether the transaction is saved as 'pending_review' (queue)
 * or 'active' (direct save). The schema is permissive on optional/nullable
 * columns and strict on required columns with CHECK constraints.
 */
export const transactionFormSchema = z.object({
  /** Owning entity — must be a valid UUID referencing entities.id. */
  entity_id: z.string().uuid('Please select an entity'),

  /** Transaction type — one of the five CHECK-constrained values. */
  type: z.enum(['income', 'expense', 'tax_prepayment', 'tax_payment_final', 'tax_reserve_transfer']),

  /** Amount in minor currency units (sen/cents). Must be a positive integer. */
  amount_minor: z.number({
    required_error: 'Amount is required',
    invalid_type_error: 'Amount must be a number',
  }).int('Amount must be a whole number').min(1, 'Amount must be greater than 0'),

  /** Currency code — one of the five supported currencies. */
  currency: z.enum(['MYR', 'USD', 'SGD', 'EUR', 'GBP']),

  /** Date the transaction occurred — ISO 8601 date string YYYY-MM-DD. */
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD'),

  /** Counterparty/vendor name — max 128 chars to match reasonable DB limits. */
  vendor: z.string().min(1, 'Vendor is required').max(128, 'Vendor name too long (max 128 characters)'),

  /** Primary category — must be from the taxonomy. */
  category: z.string().min(1, 'Category is required'),

  /** Secondary categorisation — optional. */
  subcategory: z.string().nullable(),

  /** Brief description — optional, max 500 chars. */
  description: z.string().max(500, 'Description too long (max 500 characters)').nullable(),

  /** Internal notes — optional, max 500 chars. */
  notes: z.string().max(500, 'Notes too long (max 500 characters)').nullable(),

  /** Array of tags for flexible filtering — no empty strings allowed. */
  tags: z.array(z.string().min(1)).default([]),

  /** Optional linked file (receipt/invoice) — FK to files.id. */
  file_id: z.string().uuid().nullable(),

  /** Optional linked subscription — FK to subscriptions.id. */
  subscription_id: z.string().uuid().nullable(),

  /** Optional linked project — FK to projects.id. */
  project_id: z.string().uuid().nullable(),

  /**
   * Form status — controls the transaction.status field on submit.
   * 'pending_review' = save to queue (manual entry)
   * 'active' = save directly (review queue edit or direct save)
   */
  status: z.enum(['pending_review', 'active']).default('pending_review'),
})

/** Inferred TypeScript type from the Zod schema — use this for form data. */
export type TransactionFormData = z.infer<typeof transactionFormSchema>

// ----------------------------------------------------------------------------
// Form → DB type helpers
// ----------------------------------------------------------------------------

/**
 * Converts validated form data into a shape suitable for Supabase Insert.
 * Adds defaults for fields the form does not control (period_status, etc.).
 */
export function formDataToInsert(
  data: TransactionFormData,
): Record<string, string | number | null | string[]> {
  return {
    entity_id: data.entity_id,
    type: data.type,
    amount_minor: data.amount_minor,
    currency: data.currency,
    occurred_at: data.occurred_at,
    vendor: data.vendor,
    category: data.category,
    subcategory: data.subcategory,
    description: data.description,
    notes: data.notes,
    tags: data.tags,
    file_id: data.file_id,
    subscription_id: data.subscription_id,
    project_id: data.project_id,
    status: data.status,
    // Server-managed defaults:
    // period_status defaults to 'open' in DB
    // myr_equiv_minor is computed server-side or via trigger
    // fx_rate is computed server-side
  }
}
