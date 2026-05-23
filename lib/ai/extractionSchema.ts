/**
 * JK Zentra Finance Cockpit — AI Extraction Zod Schema
 * Sprint 1 — OCR/Extraction Pipeline
 *
 * Validates the structured JSON output from Gemini 2.5 Flash (and GPT-4o-mini
 * fallback) BEFORE it is inserted into the `extractions` table.
 *
 * Every field maps 1:1 to the JSONB `extracted_fields` column or is stored in
 * `raw_response` / `confidence_scores`.  No column exists in the database that
 * is not represented here.
 *
 * CRITICAL — Amounts are INTEGER minor units (sen / cents).  NEVER float.
 */

import { z } from 'zod'

// ----------------------------------------------------------------------------
// Predefined category taxonomy for the Malaysian context
// ----------------------------------------------------------------------------

/** Top-level expense categories used in the P&L and tax reporting. */
export const EXPENSE_CATEGORIES = [
  'Software',
  'Infrastructure',
  'Marketing',
  'Office',
  'Travel',
  'Meals',
  'Professional Services',
  'Banking Fees',
  'Insurance',
  'Utilities',
  'Telecommunications',
  'Transportation',
  'Education & Training',
  'Equipment',
  'Subscriptions',
  'Tax Preparation',
  'Government Filing Fees',
  'Miscellaneous',
] as const

/** Income categories used in P&L grouping. */
export const INCOME_CATEGORIES = [
  'Services Income',
  'Product Sales',
  'Consulting Income',
  'Project Income',
  'Licensing Income',
  'Referral Income',
  'Interest Income',
  'Refunds & Rebates',
  'Other Income',
] as const

/** All valid categories (expense + income). */
export const ALL_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
] as const

/** Entity classification extracted by AI.  Maps to `entities.slug` after
 *  human review — 'mixed' requires user clarification. */
export const ENTITY_OPTIONS = ['personal', 'business', 'mixed'] as const

/** Supported currencies — MYR primary, others for FX handling. */
export const CURRENCY_CODES = ['MYR', 'USD', 'SGD', 'EUR'] as const

/** Billing-cycle values.  Must match the `BillingCycle` CHECK constraint. */
export const BILLING_CYCLES = [
  'one_time',
  'monthly',
  'yearly',
  'quarterly',
  'trial',
] as const

/** Transaction type extracted by AI (only income/expense — tax types are
 *  created manually).  Must be a subset of the DB `TransactionType`. */
export const AI_TRANSACTION_TYPES = ['income', 'expense'] as const

// ----------------------------------------------------------------------------
// Confidence-score sub-schema (stored in `confidence_scores` JSONB)
// ----------------------------------------------------------------------------

export const confidenceSchema = z
  .object({
    vendor: z.number().min(0).max(1).describe(
      'Confidence that vendor name was read correctly (0.0–1.0)'
    ),
    amount: z.number().min(0).max(1).describe(
      'Confidence that the total amount is accurate (0.0–1.0)'
    ),
    date: z.number().min(0).max(1).describe(
      'Confidence that the transaction date is correct (0.0–1.0)'
    ),
    category: z.number().min(0).max(1).describe(
      'Confidence that category / subcategory assignment is correct (0.0–1.0)'
    ),
    overall: z.number().min(0).max(1).describe(
      'Overall confidence for this extraction (0.0–1.0)'
    ),
  })
  .describe('Per-field confidence scores returned by the AI model')

// ----------------------------------------------------------------------------
// Line-item sub-schema (embedded inside `extracted_fields` JSONB)
// ----------------------------------------------------------------------------

export const lineItemSchema = z
  .object({
    description: z.string().min(1).describe('Line-item description'),
    amount: z
      .number()
      .int()
      .describe('Line-item amount in minor currency units (sen / cents)'),
  })
  .describe('Individual line item from a receipt or invoice')

// ----------------------------------------------------------------------------
// Tax-details sub-schema (embedded inside `extracted_fields` JSONB)
// ----------------------------------------------------------------------------

export const taxDetailsSchema = z
  .object({
    sst_amount_minor: z
      .number()
      .int()
      .describe('Sales & Service Tax amount in minor units (sen / cents)'),
    tax_rate: z
      .number()
      .min(0)
      .max(100)
      .describe('Tax rate as a percentage (e.g. 6 for 6% SST)'),
  })
  .describe('Malaysian SST / tax breakdown extracted from receipt')

// ----------------------------------------------------------------------------
// Main extraction-result schema
// ----------------------------------------------------------------------------

/**
 * Zod schema for the AI model's structured JSON output.
 *
 * After validation, the object is decomposed for storage:
 *   • `confidence`          → `extractions.confidence_scores` (JSONB)
 *   • All remaining fields  → `extractions.extracted_fields`  (JSONB)
 *   • Raw JSON string       → `extractions.raw_response`      (JSONB)
 */
export const extractionResultSchema = z
  .object({
    vendor: z
      .string()
      .max(128)
      .describe('Normalized vendor / counterparty name (e.g. "OpenAI")'),

    amount: z
      .number()
      .int()
      .describe('Total amount in minor currency units (sen / cents).  ALWAYS integer.'),

    currency: z
      .enum(CURRENCY_CODES)
      .describe('ISO-4217 currency code (MYR, USD, SGD, EUR)'),

    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe('Transaction date in ISO-8601 YYYY-MM-DD format'),

    type: z
      .enum(AI_TRANSACTION_TYPES)
      .describe("'income' for money received, 'expense' for money paid out"),

    category: z
      .string()
      .describe('Primary P&L category (from predefined taxonomy)'),

    subcategory: z
      .string()
      .nullable()
      .describe('Secondary categorisation (e.g. "AI/ML", "Web Design")'),

    entity: z
      .enum(ENTITY_OPTIONS)
      .describe(
        "Entity classification: 'personal' → Personal, " +
          "'business' → JK Zentra, 'mixed' → requires user clarification"
      ),

    is_subscription: z
      .boolean()
      .describe(
        'Whether this document represents a recurring subscription payment'
      ),

    subscription_name: z
      .string()
      .max(128)
      .nullable()
      .describe('Name of the subscription (e.g. "Supabase Pro").  Null if not a subscription.'),

    billing_cycle: z
      .enum(BILLING_CYCLES)
      .describe(
        "Billing frequency: 'one_time' | 'monthly' | 'yearly' | 'quarterly' | 'trial'"
      ),

    description: z
      .string()
      .describe('Human-readable summary of line items or purpose'),

    raw_text: z
      .string()
      .describe('Full OCR text captured from the document for search indexing'),

    confidence: confidenceSchema,

    detected_language: z
      .string()
      .describe('Detected document language (en, ms, zh, mixed)'),

    payment_method: z
      .string()
      .nullable()
      .describe('Payment method: Credit Card, Debit Card, Bank Transfer, FPX, Touch n Go, GrabPay, Cash, etc.'),

    vendor_registration: z
      .string()
      .nullable()
      .describe(
        'TIN (Tax Identification Number) or SSM registration number for MyInvois / e-invoicing readiness'
      ),

    line_items: z
      .array(lineItemSchema)
      .optional()
      .describe('Individual line items from receipts or invoices'),

    tax_details: taxDetailsSchema.optional().describe('Malaysian SST / tax breakdown'),
  })
  .describe('Structured extraction output from the AI OCR model')

// ----------------------------------------------------------------------------
// Inferred TypeScript types (used downstream — ZERO `any`)
// ----------------------------------------------------------------------------

export type ExtractionResult = z.infer<typeof extractionResultSchema>
export type ConfidenceScores = z.infer<typeof confidenceSchema>
export type LineItem = z.infer<typeof lineItemSchema>
export type TaxDetails = z.infer<typeof taxDetailsSchema>

// ----------------------------------------------------------------------------
// Safe parser helper — never throws, always returns a discriminated result
// ----------------------------------------------------------------------------

export type ParseResult =
  | { success: true; data: ExtractionResult }
  | { success: false; error: z.ZodError }

/**
 * Safely parse an AI model's JSON output against the extraction schema.
 * @param raw — The parsed JSON object from the AI model (already JSON.parse'd)
 * @returns Discriminated union — check `success` before accessing `data`
 */
export function safeParseExtraction(raw: unknown): ParseResult {
  const parsed = extractionResultSchema.safeParse(raw)
  if (parsed.success) {
    return { success: true, data: parsed.data }
  }
  return { success: false, error: parsed.error }
}
