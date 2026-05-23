// =============================================================================
// JK Zentra Finance Cockpit — SINGLE SOURCE OF TRUTH TYPE CONTRACT
// =============================================================================
// Next.js 15 + TypeScript + Supabase | Cash Basis Accounting | MYR/USD
// ALL monetary amounts are INTEGER minor units (sen for MYR, cents for USD) — NEVER float
// =============================================================================

import { z } from 'zod';

// =============================================================================
// 1. PRIMITIVE TYPES & ENUMS
// =============================================================================

/** Supported currency codes throughout the application. MYR is primary; others are secondary. */
export type CurrencyCode = 'MYR' | 'USD' | 'SGD' | 'EUR' | 'GBP';

/** All currencies supported by the system as a const array for runtime use. */
export const CURRENCY_CODES: readonly CurrencyCode[] = [
  'MYR',
  'USD',
  'SGD',
  'EUR',
  'GBP',
] as const;

/** Primary accounting currency. All tax calculations and reports are in MYR. */
export type PrimaryCurrency = 'MYR';

/** Classification of a ledger transaction. Determines how the entry is treated in reports and tax calculations. */
export type TransactionType =
  | 'income'
  | 'expense'
  | 'tax_prepayment'
  | 'tax_payment_final'
  | 'tax_reserve_transfer';

/** Runtime const array of all transaction types. */
export const TRANSACTION_TYPES: readonly TransactionType[] = [
  'income',
  'expense',
  'tax_prepayment',
  'tax_payment_final',
  'tax_reserve_transfer',
] as const;

/** Lifecycle status of a transaction within the review workflow. */
export type TransactionStatus = 'pending_review' | 'active' | 'archived';

/** Runtime const array of transaction statuses. */
export const TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  'pending_review',
  'active',
  'archived',
] as const;

/** Whether an accounting period (month) is open for new entries or closed/frozen. */
export type PeriodStatus = 'open' | 'closed';

/** Runtime const array of period statuses. */
export const PERIOD_STATUSES: readonly PeriodStatus[] = ['open', 'closed'] as const;

/** Billing cadence for a subscription or recurring charge. */
export type BillingCycle = 'monthly' | 'yearly' | 'quarterly' | 'trial' | 'one_time';

/** Runtime const array of billing cycles. */
export const BILLING_CYCLES: readonly BillingCycle[] = [
  'monthly',
  'yearly',
  'quarterly',
  'trial',
  'one_time',
] as const;

/** Lifecycle status of a software subscription. */
export type SubscriptionStatus = 'active' | 'trial' | 'cancelled' | 'paused' | 'expired';

/** Runtime const array of subscription statuses. */
export const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  'active',
  'trial',
  'cancelled',
  'paused',
  'expired',
] as const;

/** Classification of what triggered a reminder. */
export type ReminderType =
  | 'subscription_renewal'
  | 'cp500_instalment'
  | 'tax_position_check'
  | 'tax_reserve_transfer'
  | 'year_end_planning';

/** Runtime const array of reminder types. */
export const REMINDER_TYPES: readonly ReminderType[] = [
  'subscription_renewal',
  'cp500_instalment',
  'tax_position_check',
  'tax_reserve_transfer',
  'year_end_planning',
] as const;

/** Delivery channel for a reminder notification. */
export type ReminderChannel = 'in_app' | 'email' | 'gcal';

/** Runtime const array of reminder channels. */
export const REMINDER_CHANNELS: readonly ReminderChannel[] = [
  'in_app',
  'email',
  'gcal',
] as const;

/** Delivery status of an individual reminder. */
export type ReminderStatus = 'pending' | 'sent' | 'dismissed' | 'failed';

/** Runtime const array of reminder statuses. */
export const REMINDER_STATUSES: readonly ReminderStatus[] = [
  'pending',
  'sent',
  'dismissed',
  'failed',
] as const;

/** What domain object a reminder is linked to. */
export type RefType = 'subscription' | 'cp500_schedule' | 'system';

/** Runtime const array of reference types. */
export const REF_TYPES: readonly RefType[] = [
  'subscription',
  'cp500_schedule',
  'system',
] as const;

/** Full lifecycle of a client project from quote to closure. */
export type ProjectStatus =
  | 'quoted'
  | 'deposit_received'
  | 'in_progress'
  | 'delivered'
  | 'fully_paid'
  | 'disputed'
  | 'cancelled'
  | 'cancelled_with_deposit_kept'
  | 'cancelled_partial'
  | 'closed_short_paid';

/** Runtime const array of project statuses. */
export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  'quoted',
  'deposit_received',
  'in_progress',
  'delivered',
  'fully_paid',
  'disputed',
  'cancelled',
  'cancelled_with_deposit_kept',
  'cancelled_partial',
  'closed_short_paid',
] as const;

/** Audit log action describing what operation was performed. */
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'soft_delete'
  | 'restore'
  | 'close_month'
  | 'reopen_month'
  | 'bulk_update'
  | 'export'
  | 'import'
  | 'login'
  | 'logout'
  | 'settings_change'
  | 'tax_reserve_transfer'
  | 'reminder_sent'
  | 'reminder_dismissed';

/** Runtime const array of audit actions. */
export const AUDIT_ACTIONS: readonly AuditAction[] = [
  'create',
  'update',
  'delete',
  'soft_delete',
  'restore',
  'close_month',
  'reopen_month',
  'bulk_update',
  'export',
  'import',
  'login',
  'logout',
  'settings_change',
  'tax_reserve_transfer',
  'reminder_sent',
  'reminder_dismissed',
] as const;

/** The source through which a file was uploaded to the system. */
export type FileSource = 'manual_upload' | 'ai_extraction' | 'email_forward' | 'bulk_import' | 'api';

/** Runtime const array of file sources. */
export const FILE_SOURCES: readonly FileSource[] = [
  'manual_upload',
  'ai_extraction',
  'email_forward',
  'bulk_import',
  'api',
] as const;

/** The AI model used for receipt/document extraction. */
export type ExtractionModel = 'gpt-4o' | 'gpt-4o-mini' | 'claude-sonnet' | 'gemini-pro';

/** Runtime const array of extraction models. */
export const EXTRACTION_MODELS: readonly ExtractionModel[] = [
  'gpt-4o',
  'gpt-4o-mini',
  'claude-sonnet',
  'gemini-pro',
] as const;

/** How FX (foreign exchange) rates should be handled for non-MYR transactions. */
export type FXPreference = 'manual_entry' | 'auto_daily_rate' | 'use_bank_statement';

/** Runtime const array of FX preference options. */
export const FX_PREFERENCES: readonly FXPreference[] = [
  'manual_entry',
  'auto_daily_rate',
  'use_bank_statement',
] as const;

/** Strategy for how tax reserves are managed and transferred. */
export type TaxReserveStrategy = 'manual' | 'auto_percentage' | 'cp500_aligned';

/** Runtime const array of tax reserve strategies. */
export const TAX_RESERVE_STRATEGIES: readonly TaxReserveStrategy[] = [
  'manual',
  'auto_percentage',
  'cp500_aligned',
] as const;

/** The type of entity being recorded in the audit log. */
export type AuditEntityType =
  | 'transaction'
  | 'subscription'
  | 'project'
  | 'file'
  | 'extraction'
  | 'reminder'
  | 'month_close'
  | 'user_settings'
  | 'entity';

/** Runtime const array of audit entity types. */
export const AUDIT_ENTITY_TYPES: readonly AuditEntityType[] = [
  'transaction',
  'subscription',
  'project',
  'file',
  'extraction',
  'reminder',
  'month_close',
  'user_settings',
  'entity',
] as const;

/** Mime types accepted for file upload. */
export type AcceptedMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/heic'
  | 'image/webp'
  | 'application/pdf'
  | 'text/csv';

/** Runtime const array of accepted mime types. */
export const ACCEPTED_MIME_TYPES: readonly AcceptedMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'application/pdf',
  'text/csv',
] as const;

/** File extensions corresponding to accepted mime types. */
export type AcceptedFileExtension = '.jpg' | '.jpeg' | '.png' | '.heic' | '.webp' | '.pdf' | '.csv';

/** Human-readable labels for file extensions. */
export const FILE_EXTENSION_LABELS: Readonly<Record<AcceptedFileExtension, string>> = {
  '.jpg': 'JPEG Image',
  '.jpeg': 'JPEG Image',
  '.png': 'PNG Image',
  '.heic': 'HEIC Image',
  '.webp': 'WebP Image',
  '.pdf': 'PDF Document',
  '.csv': 'CSV Spreadsheet',
} as const;

// =============================================================================
// CATEGORY TAXONOMY
// =============================================================================

/** Top-level expense categories for JK Zentra. Used for consistent categorisation across all transactions. */
export const EXPENSE_CATEGORIES = [
  'Software & Tools',
  'AI Services',
  'Hosting & Infrastructure',
  'Domain & SSL',
  'Professional Services',
  'Hardware & Equipment',
  'Office & Workspace',
  'Travel & Accommodation',
  'Meals & Entertainment',
  'Marketing & Advertising',
  'Education & Training',
  'Banking & Finance Fees',
  'Insurance',
  'Tax & Compliance',
  'Communication',
  'Utilities',
  'Transportation',
  'Staff & Contractors',
  'Miscellaneous',
] as const;

/** Expense category as a type — derived from the taxonomy array. */
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Income categories for revenue classification. */
export const INCOME_CATEGORIES = [
  'Client Project',
  'Retainer',
  'Consulting',
  'Product Sale',
  'Referral Commission',
  'Interest Income',
  'Refund Received',
  'Other Income',
] as const;

/** Income category as a type — derived from the taxonomy array. */
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

/** Combined category type — used where either income or expense categories are acceptable. */
export type TransactionCategory = ExpenseCategory | IncomeCategory;

/** Subcategory mapping for software & tools expenses. */
export const SOFTWARE_SUBCATEGORIES = [
  'Code Editor / IDE',
  'Design Tools',
  'Project Management',
  'Communication',
  'Version Control',
  'Database Tooling',
  'Testing & QA',
  'Security Tools',
  'Other Software',
] as const;

/** Subcategory mapping for AI services expenses. */
export const AI_SERVICES_SUBCATEGORIES = [
  'LLM API (OpenAI)',
  'LLM API (Anthropic)',
  'LLM API (Google)',
  'LLM API (Other)',
  'Image Generation',
  'Voice / Speech',
  'Embedding / Vector',
  'Fine-tuning',
  'Other AI Service',
] as const;

/** Subcategory mapping for hosting & infrastructure expenses. */
export const HOSTING_SUBCATEGORIES = [
  'Cloud Compute (AWS)',
  'Cloud Compute (GCP)',
  'Cloud Compute (Azure)',
  'VPS / Dedicated',
  'CDN',
  'Serverless',
  'Database Hosting',
  'Other Infrastructure',
] as const;

/** Subcategory mapping for professional services expenses. */
export const PROFESSIONAL_SERVICES_SUBCATEGORIES = [
  'Accounting',
  'Legal',
  'Consulting',
  'Audit',
  'Company Secretary',
  'Other Professional',
] as const;

/** Subcategory mapping for tax & compliance expenses. */
export const TAX_COMPLIANCE_SUBCATEGORIES = [
  'Income Tax (LHDN)',
  'CP500 Instalment',
  'CP204 Instalment',
  'SST / Service Tax',
  'Penalty / Late Fee',
  'Tax Filing Fee',
  'Other Compliance',
] as const;

/** Combined subcategory type — all possible subcategories across all parent categories. */
export type TransactionSubcategory =
  | (typeof SOFTWARE_SUBCATEGORIES)[number]
  | (typeof AI_SERVICES_SUBCATEGORIES)[number]
  | (typeof HOSTING_SUBCATEGORIES)[number]
  | (typeof PROFESSIONAL_SERVICES_SUBCATEGORIES)[number]
  | (typeof TAX_COMPLIANCE_SUBCATEGORIES)[number]
  | string; // Allow custom subcategories not in the predefined lists

/** Mapping from parent category to its valid subcategories. */
export const CATEGORY_SUBCATEGORY_MAP: Readonly<
  Partial<Record<TransactionCategory, readonly string[]>>
> = {
  'Software & Tools': SOFTWARE_SUBCATEGORIES,
  'AI Services': AI_SERVICES_SUBCATEGORIES,
  'Hosting & Infrastructure': HOSTING_SUBCATEGORIES,
  'Professional Services': PROFESSIONAL_SERVICES_SUBCATEGORIES,
  'Tax & Compliance': TAX_COMPLIANCE_SUBCATEGORIES,
} as const;

// =============================================================================
// 2. ENTITY TYPES
// =============================================================================

/**
 * An Entity represents a distinct business unit or persona within the system.
 * For JK Zentra, this separates the company from personal transactions.
 * Each transaction, subscription, and file belongs to exactly one entity.
 */
export interface Entity {
  /** Unique identifier (UUID v4). */
  readonly id: string;

  /** Display name of the entity — shown throughout the UI. */
  readonly name: 'Personal' | 'JK Zentra';

  /** URL-safe identifier used in routing and API calls. */
  readonly slug: 'personal' | 'jk-zentra';

  /** Default currency for this entity's transactions and reports. */
  readonly default_currency: CurrencyCode;

  /** Brand colour for UI theming (hex code). */
  readonly color: string;

  /** Whether this entity is subject to income tax (business entity = true, personal = false). */
  readonly is_taxable: boolean;

  /** When the entity record was created. */
  readonly created_at: string;

  /** When the entity record was last modified. */
  readonly updated_at: string;
}

/** The two built-in entities for this single-user system. */
export type EntitySlug = 'personal' | 'jk-zentra';

/** Minimal entity reference used in related records. */
export interface EntityRef {
  /** Entity UUID. */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** URL-safe slug. */
  readonly slug: EntitySlug;
}

// =============================================================================
// 3. TRANSACTION TYPES (CORE LEDGER)
// =============================================================================

/**
 * A Transaction is the fundamental ledger entry in the system.
 * Every financial event — income, expense, tax payment, or internal transfer —
 * is recorded as a single Transaction row. Cash basis accounting means we record
 * when cash moves, not when obligations are created.
 *
 * Monetary amounts are ALWAYS stored as INTEGER minor units:
 * - MYR: sen (1 MYR = 100 sen)
 * - USD: cents (1 USD = 100 cents)
 * NEVER use float/decimal for money.
 */
export interface Transaction {
  /** Unique identifier (UUID v4). Primary key. */
  readonly id: string;

  /** The entity this transaction belongs to (FK → entities.id). */
  readonly entity_id: string;

  /** Classification determining how this entry is treated in reports and tax. */
  readonly type: TransactionType;

  /**
   * Transaction amount in INTEGER minor units (sen for MYR, cents for USD).
   * Always positive — the `type` field determines direction (income = inflow, expense = outflow).
   * @example 12500 = MYR 125.00
   */
  readonly amount_minor: number;

  /** Currency in which the transaction was originally denominated. */
  readonly currency: CurrencyCode;

  /**
   * MYR equivalent amount in sen. Computed at time of entry using the FX rate.
   * Null if currency is already MYR (redundant) or if FX conversion is pending.
   * @example 12500 = MYR 125.00
   */
  readonly myr_equiv_minor: number | null;

  /**
   * Foreign exchange rate used to convert the original currency to MYR.
   * Stored as the multiplier (1 foreign unit = X MYR).
   * Null for MYR-denominated transactions.
   * @example 4.720 means 1 USD = 4.72 MYR
   */
  readonly fx_rate: number | null;

  /** Date the transaction occurred (cash moved) in ISO 8601 format YYYY-MM-DD. */
  readonly occurred_at: string;

  /** Counterparty name — vendor for expenses, client for income. */
  readonly vendor: string;

  /** Top-level classification for grouping in reports and budgets. */
  readonly category: TransactionCategory;

  /** Optional finer-grained classification within the parent category. */
  readonly subcategory: TransactionSubcategory | null;

  /** Human-readable description of what this transaction was for. */
  readonly description: string | null;

  /** Free-form internal notes — not shown on external reports. */
  readonly notes: string | null;

  /** Array of searchable tags for quick filtering and grouping. */
  readonly tags: readonly string[];

  /** Current status in the review workflow. */
  readonly status: TransactionStatus;

  /** Whether the accounting period (month) this transaction falls in is open or closed. */
  readonly period_status: PeriodStatus;

  /**
   * Auto-generated human-readable reference code.
   * Format: {TYPE_PREFIX}_{SEQUENCE} — e.g. INC_001, EXP_042, TAX_007
   */
  readonly reference_code: string | null;

  /** If the month has been closed, the ISO timestamp when it was closed. Null if period is open. */
  readonly closed_at: string | null;

  /** If this transaction is linked to a subscription (e.g. auto-billed SaaS), the subscription ID. */
  readonly subscription_id: string | null;

  /** If this transaction is linked to a project (e.g. milestone payment), the project ID. */
  readonly project_id: string | null;

  /** If this transaction has a supporting document (receipt/invoice), the file ID. */
  readonly file_id: string | null;

  /** If this transaction is a refund/reversal of another transaction, the original transaction ID. */
  readonly refund_of_transaction_id: string | null;

  /** ISO 8601 timestamp when the record was created. */
  readonly created_at: string;

  /** ISO 8601 timestamp when the record was last modified. */
  readonly updated_at: string;
}

/** Summary of a transaction for list views — lighter than the full Transaction. */
export interface TransactionSummary {
  readonly id: string;
  readonly type: TransactionType;
  readonly amount_minor: number;
  readonly currency: CurrencyCode;
  readonly myr_equiv_minor: number | null;
  readonly occurred_at: string;
  readonly vendor: string;
  readonly category: TransactionCategory;
  readonly status: TransactionStatus;
  readonly reference_code: string | null;
  readonly description: string | null;
}

/** A line item within a transaction — used for multi-line transactions (invoices with multiple services). */
export interface TransactionLineItem {
  /** Description of this line item. */
  readonly description: string;
  /** Amount for this line in minor units. */
  readonly amount_minor: number;
  /** Category for this specific line (may differ from parent transaction). */
  readonly category: TransactionCategory;
  /** Subcategory for this line. */
  readonly subcategory: TransactionSubcategory | null;
}



// =============================================================================
// 4. SUBSCRIPTION TYPES (SOFTWARE STACK & RECURRING)
// =============================================================================

/**
 * A Subscription tracks a recurring software or service charge.
 * Used for Stack Radar burn calculations, renewal reminders, and cash flow forecasting.
 * Each subscription belongs to exactly one entity.
 */
export interface Subscription {
  /** Unique identifier (UUID v4). Primary key. */
  readonly id: string;

  /** The entity this subscription belongs to (FK → entities.id). */
  readonly entity_id: string;

  /** Human-readable name of the service — e.g. "OpenAI API", "GitHub Copilot". */
  readonly name: string;

  /** The company/vendor providing the service — e.g. "OpenAI", "GitHub", "Vercel". */
  readonly vendor: string;

  /** Specific plan tier — e.g. "Pro", "Team", "Pay-as-you-go". */
  readonly plan: string;

  /** Top-level category for grouping in reports — typically "Software & Tools" or "AI Services". */
  readonly category: TransactionCategory;

  /** Finer classification within the category. */
  readonly subcategory: TransactionSubcategory | null;

  /**
   * Recurring charge amount in INTEGER minor units (sen for MYR, cents for USD).
   * This is the per-billing-cycle amount.
   * @example 6800 = MYR 68.00 / month for Cursor Pro
   */
  readonly amount_minor: number;

  /** Currency in which the subscription is billed. */
  readonly currency: CurrencyCode;

  /** How often the subscription renews and is charged. */
  readonly billing_cycle: BillingCycle;

  /** ISO date YYYY-MM-DD when the subscription first started (or will start). */
  readonly start_date: string;

  /** ISO date YYYY-MM-DD when the trial period ends. Null if no trial or trial has ended. */
  readonly trial_end_date: string | null;

  /** ISO date YYYY-MM-DD of the next scheduled payment/renewal. Used for reminder triggers. */
  readonly next_payment_at: string;

  /** ISO date YYYY-MM-DD of the most recent successful payment. Null if never paid. */
  readonly last_paid_at: string | null;

  /** ISO date YYYY-MM-DD when the current billing period renews. Used for annual commitment calc. */
  readonly renewal_date: string;

  /** ISO date YYYY-MM-DD when the subscription ends or was cancelled. Null for ongoing subscriptions. */
  readonly end_date: string | null;

  /** How this subscription is paid — e.g. "Credit Card", "PayPal", "Bank Transfer", "Invoice". */
  readonly payment_method: string;

  /** Current lifecycle status of the subscription. */
  readonly status: SubscriptionStatus;

  /**
   * Days before renewal_date to trigger reminder notifications.
   * e.g. [30, 7, 1] sends reminders 30 days, 7 days, and 1 day before renewal.
   */
  readonly reminder_offsets: readonly number[];

  /** Which channels to send reminders through for this subscription. */
  readonly reminder_channels: readonly ReminderChannel[];

  /** Whether this subscription appears on the Stack Radar dashboard widget. */
  readonly is_stack_radar: boolean;

  /** Free-form notes about this subscription — e.g. "Team license for 3 seats", "Annual discount applied". */
  readonly notes: string | null;

  /** URL to the vendor's billing/cancellation page. */
  readonly billing_url: string | null;

  /** Whether this subscription auto-renews at the end of each billing cycle. */
  readonly auto_renew: boolean;

  /** ISO 8601 timestamp when the record was created. */
  readonly created_at: string;

  /** ISO 8601 timestamp when the record was last modified. */
  readonly updated_at: string;
}

/** Computed fields for subscription display — derived from the base subscription data. */
export interface SubscriptionComputedFields {
  /** Annualised cost in MYR minor units. Used for commitment calculations. */
  readonly annual_commitment_myr_minor: number;

  /** Monthly burn rate in MYR minor units. Normalised from any billing cycle. */
  readonly monthly_burn_myr_minor: number;

  /** Number of days until the next renewal. Negative if overdue. */
  readonly days_until_renewal: number;

  /** Whether the subscription is renewing within the next 7 days. */
  readonly renewing_soon: boolean;

  /** Whether the trial period is active. */
  readonly in_trial: boolean;

  /** Number of days remaining in trial. Negative or 0 if trial has ended. */
  readonly trial_days_remaining: number;
}

/** A subscription combined with its computed fields — used in dashboard and list views. */
export type SubscriptionWithComputed = Subscription & SubscriptionComputedFields;

/** Summary of a subscription for the Stack Radar widget. */
export interface SubscriptionRadarEntry {
  readonly id: string;
  readonly name: string;
  readonly vendor: string;
  readonly plan: string;
  readonly amount_minor: number;
  readonly currency: CurrencyCode;
  readonly billing_cycle: BillingCycle;
  readonly monthly_burn_myr_minor: number;
  readonly status: SubscriptionStatus;
  readonly days_until_renewal: number;
}

/** A subscription that is renewing soon — used for dashboard upcoming renewals. */
export interface UpcomingSubscription {
  readonly id: string;
  readonly name: string;
  readonly vendor: string;
  readonly renewal_date: string;
  readonly amount_minor: number;
  readonly currency: CurrencyCode;
  readonly myr_equiv_minor: number;
  readonly days_until_renewal: number;
}

// =============================================================================
// 5. PROJECT TYPES (CLIENT WORK TRACKING)
// =============================================================================

/**
 * A Project tracks a piece of client work from initial quote through to final payment.
 * Used for receivables forecasting, revenue recognition (cash basis), and client relationship management.
 */
export interface Project {
  /** Unique identifier (UUID v4). Primary key. */
  readonly id: string;

  /** The entity this project belongs to (FK → entities.id). */
  readonly entity_id: string;

  /** Internal project name — e.g. "E-Commerce Platform — ABC Sdn Bhd". */
  readonly name: string;

  /** Client or customer name. */
  readonly client: string;

  /**
   * Total agreed project value in INTEGER minor units.
   * This is the full amount quoted/contracted, not what has been paid.
   * @example 5000000 = MYR 50,000.00
   */
  readonly total_value_minor: number;

  /** Currency in which the project is denominated. */
  readonly currency: CurrencyCode;

  /**
   * Human-readable note describing the payment schedule.
   * e.g. "50% deposit, 25% milestone 1, 25% final delivery"
   */
  readonly payment_schedule_note: string | null;

  /** Current stage of the project lifecycle. */
  readonly status: ProjectStatus;

  /** ISO date YYYY-MM-DD when the project was quoted/agreed. */
  readonly quoted_at: string | null;

  /** ISO date YYYY-MM-DD when the deposit was received. */
  readonly deposit_received_at: string | null;

  /** ISO date YYYY-MM-DD when work commenced. */
  readonly started_at: string | null;

  /** ISO date YYYY-MM-DD when deliverables were handed over. */
  readonly delivered_at: string | null;

  /** ISO date YYYY-MM-DD when full payment was received. */
  readonly fully_paid_at: string | null;

  /** ISO date YYYY-MM-DD when the project was cancelled (if applicable). */
  readonly cancelled_at: string | null;

  /** Free-form internal notes about the project. */
  readonly notes: string | null;

  /** Tags for grouping and filtering — e.g. ["web-dev", "ecommerce", "kl-client"]. */
  readonly tags: readonly string[];

  /** ISO 8601 timestamp when the record was created. */
  readonly created_at: string;

  /** ISO 8601 timestamp when the record was last modified. */
  readonly updated_at: string;
}

/** A payment received against a project. Stored as a separate record for audit trail. */
export interface ProjectPayment {
  /** Unique identifier (UUID v4). */
  readonly id: string;

  /** The project this payment belongs to (FK → projects.id). */
  readonly project_id: string;

  /** The linked transaction that recorded this payment (FK → transactions.id). */
  readonly transaction_id: string;

  /** Payment amount in INTEGER minor units. */
  readonly amount_minor: number;

  /** Currency of the payment. */
  readonly currency: CurrencyCode;

  /** What this payment was for — e.g. "Deposit", "Milestone 1", "Final Payment". */
  readonly label: string;

  /** ISO date YYYY-MM-DD when the payment was received. */
  readonly received_at: string;

  /** ISO 8601 timestamp when the record was created. */
  readonly created_at: string;
}

/** Computed fields for project display — derived from linked payments. */
export interface ProjectComputedFields {
  /** Total amount received to date in project currency minor units. */
  readonly received_to_date_minor: number;

  /** Outstanding balance remaining in project currency minor units. */
  readonly outstanding_balance_minor: number;

  /** Percentage of total value that has been paid (0-100). */
  readonly pct_paid: number;

  /** Whether the project has overdue payments (delivered but not fully paid > 30 days). */
  readonly has_overdue_payment: boolean;

  /** Number of days since delivery if not fully paid. 0 if paid or not yet delivered. */
  readonly days_outstanding: number;
}

/** A project combined with its computed fields — used in dashboard and detail views. */
export type ProjectWithComputed = Project & ProjectComputedFields;

/** Summary of a project for list views. */
export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly client: string;
  readonly total_value_minor: number;
  readonly currency: CurrencyCode;
  readonly status: ProjectStatus;
  readonly received_to_date_minor: number;
  readonly outstanding_balance_minor: number;
  readonly pct_paid: number;
}

/** Outstanding receivable summary for the dashboard. */
export interface OutstandingReceivables {
  /** Total outstanding across all active projects in MYR minor units. */
  readonly total_outstanding_myr_minor: number;

  /** Number of projects with outstanding balances. */
  readonly project_count: number;

  /** Number of projects with overdue payments (> 30 days since delivery). */
  readonly overdue_count: number;

  /** Breakdown by project. */
  readonly projects: readonly {
    readonly id: string;
    readonly name: string;
    readonly client: string;
    readonly outstanding_minor: number;
    readonly currency: CurrencyCode;
    readonly days_outstanding: number;
  }[];
}

// =============================================================================
// 6. FILE TYPES (DOCUMENT STORAGE)
// =============================================================================

/**
 * A File record represents a stored document in the system — typically a receipt,
 * invoice, bank statement, or contract. The actual bytes are stored in Supabase Storage;
 * this record is the metadata and linking layer.
 */
export interface FileRecord {
  /** Unique identifier (UUID v4). Primary key. */
  readonly id: string;

  /** The entity this file belongs to (FK → entities.id). */
  readonly entity_id: string;

  /** Full storage path in Supabase Storage bucket — e.g. "jk-zentra/receipts/2024/05/abc123.pdf". */
  readonly storage_path: string;

  /** Original filename as provided by the user or source system. */
  readonly original_filename: string;

  /** User-editable display name — defaults to original_filename but can be renamed. */
  readonly display_filename: string;

  /** MIME type of the file for correct content-type headers. */
  readonly mime_type: AcceptedMimeType;

  /** File size in bytes. */
  readonly size_bytes: number;

  /** SHA-256 hash of the file contents for integrity verification and deduplication. */
  readonly sha256_hash: string;

  /** How this file entered the system. */
  readonly source: FileSource;

  /** The linked transaction, if this file is a receipt/invoice for a specific transaction. */
  readonly transaction_id: string | null;

  /** Whether the file has been processed by the AI extraction pipeline. */
  readonly extraction_status: 'pending' | 'processing' | 'completed' | 'failed' | 'not_applicable';

  /** ISO 8601 timestamp when the file was uploaded. */
  readonly uploaded_at: string;

  /** ISO 8601 timestamp when the record was created. */
  readonly created_at: string;

  /** ISO 8601 timestamp when the record was last modified. */
  readonly updated_at: string;
}

/** A presigned URL response for temporary file access. */
export interface FileSignedUrl {
  /** The presigned URL — valid for a limited time. */
  readonly url: string;

  /** When the URL expires (ISO 8601 timestamp). */
  readonly expires_at: string;

  /** The display filename for content-disposition. */
  readonly filename: string;
}

/** File upload metadata collected before the actual upload begins. */
export interface FileUploadMetadata {
  /** Entity the file belongs to. */
  readonly entity_id: string;

  /** Optional transaction to link this file to. */
  readonly transaction_id: string | null;

  /** User-provided display name (optional). */
  readonly display_filename: string | null;

  /** How the file entered the system. */
  readonly source: FileSource;
}



// =============================================================================
// 7. EXTRACTION TYPES (AI RECEIPT/INVOICE PARSING)
// =============================================================================

/**
 * An Extraction record stores the result of AI-powered document parsing.
 * When a receipt or invoice is uploaded, the AI model extracts structured fields
 * which can then be used to pre-fill a transaction entry. Each extraction is linked
 * to exactly one file.
 */
export interface Extraction {
  /** Unique identifier (UUID v4). Primary key. */
  readonly id: string;

  /** The file that was processed (FK → files.id). */
  readonly file_id: string;

  /** Which AI model performed the extraction. */
  readonly model_used: ExtractionModel;

  /** Raw JSON response from the AI model — stored for debugging and reprocessing. */
  readonly raw_response: Record<string, unknown>;

  /** The structured fields extracted from the document. */
  readonly extracted_fields: ExtractedFields;

  /** Per-field confidence scores (0.0 - 1.0) indicating extraction reliability. */
  readonly confidence_scores: FieldConfidenceScores;

  /**
   * Whether a human has reviewed and corrected the extracted fields.
   * Once true, the extraction is considered verified and won't be reprocessed.
   */
  readonly manually_corrected: boolean;

  /** Time taken to process the document in milliseconds. */
  readonly processing_time_ms: number;

  /** Number of tokens consumed by the AI model for this extraction. */
  readonly tokens_used: number;

  /** Cost of the extraction in MYR minor units (sen). Used for AI cost tracking. */
  readonly cost_myr_minor: number;

  /** Error message if extraction failed. Null on success. */
  readonly error_message: string | null;

  /** ISO 8601 timestamp when the extraction was completed. */
  readonly extracted_at: string;

  /** ISO 8601 timestamp when the record was created. */
  readonly created_at: string;
}

/**
 * The structured fields extracted from a receipt or invoice.
 * These fields map directly to Transaction fields for easy pre-fill.
 */
export interface ExtractedFields {
  /** Vendor/merchant name extracted from the document. */
  readonly vendor: string | null;

  /** Total amount in minor units extracted from the document. */
  readonly amount_minor: number | null;

  /** Currency code extracted from the document. */
  readonly currency: CurrencyCode | null;

  /** Date of the transaction extracted from the document (YYYY-MM-DD). */
  readonly date: string | null;

  /** Description of goods/services extracted from the document. */
  readonly description: string | null;

  /** Category suggestion based on vendor and description. */
  readonly suggested_category: TransactionCategory | null;

  /** Subcategory suggestion based on vendor and description. */
  readonly suggested_subcategory: TransactionSubcategory | null;

  /** Tax amount (GST/SST) in minor units if shown on the document. */
  readonly tax_amount_minor: number | null;

  /** Tax registration number of the vendor if present. */
  readonly tax_reg_number: string | null;

  /** Invoice or receipt number if present on the document. */
  readonly receipt_number: string | null;

  /** Line items extracted from the document (for itemised receipts). */
  readonly line_items: readonly ExtractedLineItem[];
}

/** A single line item extracted from an itemised receipt or invoice. */
export interface ExtractedLineItem {
  /** Description of the line item. */
  readonly description: string;

  /** Quantity of the item. */
  readonly quantity: number;

  /** Unit price in minor units. */
  readonly unit_price_minor: number;

  /** Total for this line in minor units (quantity * unit_price). */
  readonly total_minor: number;
}

/** Per-field confidence scores from the AI extraction. */
export interface FieldConfidenceScores {
  readonly vendor: number;
  readonly amount: number;
  readonly currency: number;
  readonly date: number;
  readonly description: number;
  readonly category: number;
  readonly subcategory: number;
  readonly tax_amount: number;
  readonly receipt_number: number;
  readonly overall: number;
}

/** The result returned by the AI extraction service — used before saving to the database. */
export interface ExtractionResult {
  /** Whether the extraction was successful. */
  readonly success: boolean;

  /** Extracted structured fields (only present on success). */
  readonly fields: ExtractedFields | null;

  /** Confidence scores (only present on success). */
  readonly confidence: FieldConfidenceScores | null;

  /** Error message (only present on failure). */
  readonly error: string | null;

  /** Number of tokens consumed. */
  readonly tokens_used: number;

  /** Processing time in milliseconds. */
  readonly processing_time_ms: number;
}

/** Cost tracking for AI extraction operations — aggregated per month. */
export interface ExtractionCostSummary {
  /** Year and month in YYYY-MM format. */
  readonly period: string;

  /** Total number of extractions performed. */
  readonly extraction_count: number;

  /** Total tokens consumed across all extractions. */
  readonly total_tokens: number;

  /** Total cost in MYR minor units (sen). */
  readonly total_cost_myr_minor: number;

  /** Average confidence score across all extractions (0.0 - 1.0). */
  readonly avg_confidence: number;
}

// =============================================================================
// 8. REMINDER TYPES (NOTIFICATION SYSTEM)
// =============================================================================

/**
 * A Reminder is a scheduled notification tied to a specific event —
 * subscription renewal, tax instalment due date, or system-generated alert.
 * Reminders can be delivered via in-app notification, email, or Google Calendar.
 */
export interface Reminder {
  /** Unique identifier (UUID v4). Primary key. */
  readonly id: string;

  /** What kind of event this reminder is for. */
  readonly reminder_type: ReminderType;

  /** What domain object this reminder is linked to. */
  readonly ref_type: RefType;

  /** ID of the linked object (subscription ID, CP500 schedule entry ID, or 'system'). */
  readonly ref_id: string;

  /** The entity this reminder belongs to (FK → entities.id). */
  readonly entity_id: string;

  /** ISO 8601 timestamp when the reminder should trigger/be sent. */
  readonly trigger_at: string;

  /** How many days before the event this reminder was configured to trigger. */
  readonly offset_days: number;

  /** Which channel(s) to deliver through. Stored as array for multi-channel reminders. */
  readonly channels: readonly ReminderChannel[];

  /** Current delivery status. */
  readonly status: ReminderStatus;

  /** Short title displayed in the notification. */
  readonly title: string;

  /** Detailed body text of the notification. */
  readonly body: string;

  /** Google Calendar event ID if a calendar event was created. Null otherwise. */
  readonly gcal_event_id: string | null;

  /** ISO 8601 timestamp when the reminder was actually sent. Null if pending or failed. */
  readonly sent_at: string | null;

  /** ISO 8601 timestamp when the user dismissed the reminder. Null if not dismissed. */
  readonly dismissed_at: string | null;

  /** Error message if delivery failed. Null on success or pending. */
  readonly error_message: string | null;

  /** ISO 8601 timestamp when the record was created. */
  readonly created_at: string;

  /** ISO 8601 timestamp when the record was last modified. */
  readonly updated_at: string;
}

/** A reminder combined with its linked entity reference for display. */
export interface ReminderWithRef {
  readonly id: string;
  readonly reminder_type: ReminderType;
  readonly ref_type: RefType;
  readonly ref_id: string;
  readonly trigger_at: string;
  readonly offset_days: number;
  readonly channels: readonly ReminderChannel[];
  readonly status: ReminderStatus;
  readonly title: string;
  readonly body: string;
  readonly gcal_event_id: string | null;
  readonly sent_at: string | null;
  readonly dismissed_at: string | null;

  /** The linked subscription details (if ref_type === 'subscription'). */
  readonly subscription: SubscriptionRadarEntry | null;

  /** Human-readable description of what this reminder is about. */
  readonly ref_description: string;
}

/** Settings for reminder configuration — stored within user_settings JSONB. */
export interface ReminderConfig {
  /** Default channels for all reminders. */
  readonly default_channels: readonly ReminderChannel[];

  /** Default reminder offsets in days before events. */
  readonly default_offsets: readonly number[];

  /** Whether Google Calendar integration is enabled for reminders. */
  readonly gcal_sync_enabled: boolean;

  /** Specific reminder preferences by type. */
  readonly by_type: Readonly<Partial<Record<ReminderType, {
    /** Override channels for this reminder type. */
    readonly channels: readonly ReminderChannel[];
    /** Override offsets for this reminder type. */
    readonly offsets: readonly number[];
  }>>>;
}

// =============================================================================
// 9. MONTH CLOSE TYPES (PERIOD END CLOSING)
// =============================================================================

/**
 * A MonthClose record represents a closed accounting period (month).
 * Once a month is closed, no new transactions can be added to that period,
 * and the closing balance is frozen for reporting and tax purposes.
 * A month can be reopened with audit trail logging.
 */
export interface MonthClose {
  /** Unique identifier (UUID v4). Primary key. */
  readonly id: string;

  /** The entity this month close belongs to (FK → entities.id). */
  readonly entity_id: string;

  /** Calendar year (e.g. 2024). */
  readonly year: number;

  /** Calendar month (1-12). */
  readonly month: number;

  /** ISO 8601 timestamp when the month was closed. */
  readonly closed_at: string;

  /** User who closed the month (FK → auth.users.id). */
  readonly closed_by: string;

  /** ISO 8601 timestamp when the month was reopened (if applicable). */
  readonly reopened_at: string | null;

  /** User who reopened the month (FK → auth.users.id). */
  readonly reopened_by: string | null;

  /** Reason provided when reopening the month — required for audit trail. */
  readonly reopen_reason: string | null;

  /**
   * Opening cash balance in MYR minor units (sen) at the start of the month.
   * Derived from previous month's closing balance.
   */
  readonly opening_balance_minor: number;

  /**
   * Closing cash balance in MYR minor units (sen) as manually confirmed by the user.
   * This is the "true" closing balance per bank statement or cash count.
   */
  readonly closing_balance_minor: number;

  /**
   * Closing balance computed from transactions in the system (sum of all MYR-equivalent
   * transaction amounts for the period). Used for reconciliation.
   */
  readonly computed_closing_minor: number;

  /**
   * Difference between manual closing_balance and computed_closing.
   * A non-zero value indicates a reconciliation discrepancy that needs investigation.
   * Positive = system has more than bank; Negative = bank has more than system.
   */
  readonly reconciliation_variance_minor: number;

  /** Explanation for any reconciliation variance — required if variance is non-zero. */
  readonly reconciliation_note: string | null;

  /**
   * Structured checklist results for month-end procedures.
   * Each key represents a checklist item; value is true if completed.
   */
  readonly checklist_results: Readonly<MonthEndChecklist>;

  /** Reference to the month-end pack file (PDF containing all statements and reports). */
  readonly pack_file_id: string | null;

  /** Transaction reference prefix for this month — e.g. "2024-05" produces INC_2024-05_001. */
  readonly reference_prefix: string;

  /** Free-form notes about the month close — e.g. "Missing 2 receipt photos from May 15-17". */
  readonly notes: string | null;

  /** ISO 8601 timestamp when the record was created. */
  readonly created_at: string;

  /** ISO 8601 timestamp when the record was last modified. */
  readonly updated_at: string;
}

/** Month-end closing checklist items — stored as JSONB in checklist_results. */
export interface MonthEndChecklist {
  /** All transactions for the period have been reviewed and categorised. */
  readonly all_transactions_reviewed: boolean;

  /** All receipts and supporting documents have been attached to transactions. */
  readonly all_receipts_attached: boolean;

  /** Bank statement has been reconciled against system transactions. */
  readonly bank_reconciled: boolean;

  /** Subscription charges have been verified against actual billing. */
  readonly subscriptions_verified: boolean;

  /** FX rates for foreign currency transactions have been verified. */
  readonly fx_rates_verified: boolean;

  /** Tax position for the period has been reviewed. */
  readonly tax_position_reviewed: boolean;

  /** Month-end pack has been generated and stored. */
  readonly pack_generated: boolean;

  /** All reminders for the next period have been reviewed. */
  readonly next_period_reminders_set: boolean;
}

/** A month that is ready to be closed — used in the month-end workflow UI. */
export interface MonthCloseCandidate {
  /** Year (e.g. 2024). */
  readonly year: number;

  /** Month (1-12). */
  readonly month: number;

  /** Display label — e.g. "May 2024". */
  readonly label: string;

  /** Number of transactions in this period. */
  readonly transaction_count: number;

  /** Number of transactions still pending review. */
  readonly pending_review_count: number;

  /** Number of transactions missing receipt attachments. */
  readonly missing_receipts_count: number;

  /** Whether all checklist items are complete. */
  readonly checklist_complete: boolean;

  /** Computed closing balance in MYR minor units. */
  readonly computed_closing_minor: number;
}



// =============================================================================
// 10. AUDIT LOG TYPES
// =============================================================================

/**
 * An AuditLog entry records every significant action in the system for compliance,
 * debugging, and accountability. Every create, update, delete, month close,
 * settings change, and reminder action is logged with full before/after state.
 */
export interface AuditLog {
  /** Unique identifier (UUID v4). Primary key. */
  readonly id: string;

  /** What type of entity was affected by this action. */
  readonly entity_type: AuditEntityType;

  /** ID of the entity record that was affected. */
  readonly entity_id: string;

  /** The action that was performed. */
  readonly action: AuditAction;

  /** Complete state of the entity BEFORE the action (null for create actions). */
  readonly before: Record<string, unknown> | null;

  /** Complete state of the entity AFTER the action (null for delete actions). */
  readonly after: Record<string, unknown> | null;

  /** Structured summary of what changed — human-readable key/value pairs of changed fields. */
  readonly change_summary: Readonly<Record<string, { readonly from: unknown; readonly to: unknown }>> | null;

  /** The user who performed the action (FK → auth.users.id). */
  readonly user_id: string;

  /** IP address of the user at the time of the action. */
  readonly ip_address: string | null;

  /** User agent string of the browser/client. */
  readonly user_agent: string | null;

  /** ISO 8601 timestamp when the action occurred. */
  readonly created_at: string;
}

/** A simplified audit log entry for list views. */
export interface AuditLogSummary {
  readonly id: string;
  readonly entity_type: AuditEntityType;
  readonly entity_id: string;
  readonly action: AuditAction;
  readonly change_summary: Readonly<Record<string, { readonly from: unknown; readonly to: unknown }>> | null;
  readonly user_id: string;
  readonly created_at: string;
}

/** Filter parameters for querying the audit log. */
export interface AuditLogFilter {
  /** Filter by entity type. */
  readonly entity_type?: AuditEntityType;

  /** Filter by specific entity ID. */
  readonly entity_id?: string;

  /** Filter by action type. */
  readonly action?: AuditAction;

  /** Filter by user ID. */
  readonly user_id?: string;

  /** Start of date range (ISO 8601). */
  readonly date_from?: string;

  /** End of date range (ISO 8601). */
  readonly date_to?: string;
}

// =============================================================================
// 11. USER SETTINGS TYPE
// =============================================================================

/**
 * CP500 instalment schedule entry — defines a single tax prepayment due date and amount.
 * CP500 is the Malaysian LHDN prepayment scheme where taxpayers pay 6 monthly instalments.
 */
export interface CP500ScheduleEntry {
  /** Instalment number (1-6). */
  readonly instalment_number: number;

  /** ISO date YYYY-MM-DD when this instalment is due. */
  readonly due_date: string;

  /** Amount due in MYR minor units (sen). */
  readonly amount_minor: number;

  /** Whether this instalment has been paid. */
  readonly is_paid: boolean;

  /** ID of the transaction that recorded the payment (FK → transactions.id). */
  readonly payment_transaction_id: string | null;
}

/**
 * UserSettings stores all configurable preferences for the sole user.
 * Stored as a single JSONB row in the database (id = user's UUID).
 * This is the central configuration for tax, reminders, FX, and AI behaviour.
 */
export interface UserSettings {
  /** Unique identifier — same as auth.users.id (single user system). */
  readonly id: string;

  /** Default entity to show on login and for new transactions. */
  readonly default_entity_id: string;

  /** Start month of the tax year (1-12). Malaysian tax year typically starts January (1). */
  readonly tax_year_start_month: number;

  /** The user's estimated effective income tax rate as a percentage (0-100).
   * Used for tax reserve calculations and forecasting.
   * @example 17.5 means 17.5% effective tax rate
   */
  readonly effective_tax_rate_percent: number;

  /**
   * Forecasted annual income in MYR minor units (sen) for CP500 estimation.
   * This is the user's best estimate of full-year chargeable income.
   */
  readonly lhdn_forecast_income_minor: number;

  /** The 6-month CP500 prepayment schedule derived from forecast income and tax rate. */
  readonly cp500_schedule: readonly CP500ScheduleEntry[];

  /** How tax reserves should be calculated and managed. */
  readonly tax_reserve_strategy: TaxReserveStrategy;

  /**
   * Percentage threshold for CP502 voluntary revision trigger.
   * If actual income varies by more than this percentage from forecast, a CP502 revision is suggested.
   * @example 30 means 30% variance triggers a CP502 recommendation
   */
  readonly cp502_threshold_percent: number;

  /** Default reminder channels for new subscriptions and system reminders. */
  readonly reminder_channels: readonly ReminderChannel[];

  /** Whether the user has connected their Google Calendar account. */
  readonly google_calendar_connected: boolean;

  /** Encrypted Google Calendar refresh token (stored securely, never exposed to client). */
  readonly gcal_refresh_token: string | null;

  /** The Google Calendar ID where reminder events are created. */
  readonly gcal_calendar_id: string | null;

  /** How FX rates should be handled for non-MYR transactions. */
  readonly fx_preference: FXPreference;

  /**
   * Monthly spending cap for AI extraction costs in MYR minor units (sen).
   * Extractions will be blocked if this cap would be exceeded.
   * @example 5000 = MYR 50.00 monthly cap
   */
  readonly monthly_ai_cost_cap_minor: number;

  /** Whether AI extraction is enabled for uploaded receipts. */
  readonly ai_extraction_enabled: boolean;

  /** Default AI model to use for extraction. */
  readonly default_extraction_model: ExtractionModel;

  /** Whether email forwarding is enabled for receipt ingestion. */
  readonly email_forwarding_enabled: boolean;

  /** The unique email address for forwarding receipts (e.g. receipts+abc123@jkzentra.finance). */
  readonly receipt_email_address: string | null;

  /** Whether to automatically categorise transactions based on vendor name. */
  readonly auto_categorisation_enabled: boolean;

  /** Whether the onboarding flow has been completed. */
  readonly onboarding_completed: boolean;

  /** Which onboarding step the user is currently on (0-10, 0 = not started, 10 = complete). */
  readonly onboarding_step: number;

  /** User's preferred date format for display. */
  readonly date_format: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';

  /** ISO 8601 timestamp when settings were last modified. */
  readonly updated_at: string;
}

/** The onboarding state machine — tracks progress through initial setup. */
export type OnboardingStep =
  | 'welcome'
  | 'entity_setup'
  | 'tax_profile'
  | 'cp500_schedule'
  | 'reminder_preferences'
  | 'calendar_connect'
  | 'receipt_upload_test'
  | 'first_transaction'
  | 'review_queue'
  | 'dashboard_tour'
  | 'complete';

/** Ordered list of onboarding steps for the progress tracker. */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  'welcome',
  'entity_setup',
  'tax_profile',
  'cp500_schedule',
  'reminder_preferences',
  'calendar_connect',
  'receipt_upload_test',
  'first_transaction',
  'review_queue',
  'dashboard_tour',
  'complete',
] as const;

// =============================================================================
// 12. ZOD VALIDATION SCHEMAS
// =============================================================================

// ---------------------------------------------------------------------------
// 12.1 Primitive Schemas (shared validators)
// ---------------------------------------------------------------------------

/** Zod schema for currency codes — strict literal union. */
export const currencyCodeSchema = z.enum(['MYR', 'USD', 'SGD', 'EUR', 'GBP']);

/** Zod schema for transaction types — strict literal union. */
export const transactionTypeSchema = z.enum([
  'income',
  'expense',
  'tax_prepayment',
  'tax_payment_final',
  'tax_reserve_transfer',
]);

/** Zod schema for transaction statuses — strict literal union. */
export const transactionStatusSchema = z.enum([
  'pending_review',
  'active',
  'archived',
]);

/** Zod schema for period status — strict literal union. */
export const periodStatusSchema = z.enum(['open', 'closed']);

/** Zod schema for billing cycles — strict literal union. */
export const billingCycleSchema = z.enum([
  'monthly',
  'yearly',
  'quarterly',
  'trial',
  'one_time',
]);

/** Zod schema for subscription statuses — strict literal union. */
export const subscriptionStatusSchema = z.enum([
  'active',
  'trial',
  'cancelled',
  'paused',
  'expired',
]);

/** Zod schema for project statuses — strict literal union. */
export const projectStatusSchema = z.enum([
  'quoted',
  'deposit_received',
  'in_progress',
  'delivered',
  'fully_paid',
  'disputed',
  'cancelled',
  'cancelled_with_deposit_kept',
  'cancelled_partial',
  'closed_short_paid',
]);

/** Zod schema for reminder types — strict literal union. */
export const reminderTypeSchema = z.enum([
  'subscription_renewal',
  'cp500_instalment',
  'tax_position_check',
  'tax_reserve_transfer',
  'year_end_planning',
]);

/** Zod schema for reminder channels — strict literal union. */
export const reminderChannelSchema = z.enum(['in_app', 'email', 'gcal']);

/** Zod schema for reminder statuses — strict literal union. */
export const reminderStatusSchema = z.enum([
  'pending',
  'sent',
  'dismissed',
  'failed',
]);

/** Zod schema for reference types — strict literal union. */
export const refTypeSchema = z.enum([
  'subscription',
  'cp500_schedule',
  'system',
]);

/** Zod schema for file sources — strict literal union. */
export const fileSourceSchema = z.enum([
  'manual_upload',
  'ai_extraction',
  'email_forward',
  'bulk_import',
  'api',
]);

/** Zod schema for extraction models — strict literal union. */
export const extractionModelSchema = z.enum([
  'gpt-4o',
  'gpt-4o-mini',
  'claude-sonnet',
  'gemini-pro',
]);

/** Zod schema for FX preference — strict literal union. */
export const fxPreferenceSchema = z.enum([
  'manual_entry',
  'auto_daily_rate',
  'use_bank_statement',
]);

/** Zod schema for tax reserve strategy — strict literal union. */
export const taxReserveStrategySchema = z.enum([
  'manual',
  'auto_percentage',
  'cp500_aligned',
]);

/** Zod schema for accepted MIME types. */
export const acceptedMimeTypeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'application/pdf',
  'text/csv',
]);

/** Zod schema for a valid ISO date string (YYYY-MM-DD). */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid ISO date (YYYY-MM-DD)');

/** Zod schema for a monetary amount in minor units — must be a non-negative integer. */
export const minorUnitsSchema = z
  .number()
  .int('Amount must be an integer (minor units)')
  .nonnegative('Amount cannot be negative');

/** Zod schema for a monetary amount that can be negative (e.g. adjustments). */
export const signedMinorUnitsSchema = z.number().int('Amount must be an integer (minor units)');

/** Zod schema for FX rate — positive number with reasonable bounds. */
export const fxRateSchema = z
  .number()
  .positive('FX rate must be positive')
  .max(50, 'FX rate exceeds reasonable bounds');

/** Zod schema for percentage (0-100). */
export const percentageSchema = z
  .number()
  .min(0, 'Percentage cannot be negative')
  .max(100, 'Percentage cannot exceed 100');

/** Zod schema for an array of non-empty strings (e.g. tags). */
export const tagsSchema = z.array(z.string().min(1, 'Tag cannot be empty').max(50, 'Tag too long')).max(20, 'Maximum 20 tags');

// ---------------------------------------------------------------------------
// 12.2 Transaction Schemas
// ---------------------------------------------------------------------------

/**
 * Full Zod validation schema for a Transaction.
 * Used for validating complete transaction records (e.g. from API responses or database rows).
 */
export const transactionSchema = z.object({
  id: z.string().uuid(),
  entity_id: z.string().uuid(),
  type: transactionTypeSchema,
  amount_minor: minorUnitsSchema,
  currency: currencyCodeSchema,
  myr_equiv_minor: minorUnitsSchema.nullable(),
  fx_rate: fxRateSchema.nullable(),
  occurred_at: isoDateSchema,
  vendor: z.string().min(1, 'Vendor is required').max(200, 'Vendor name too long'),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().max(200).nullable(),
  description: z.string().max(1000).nullable(),
  notes: z.string().max(5000).nullable(),
  tags: z.array(z.string()),
  status: transactionStatusSchema,
  period_status: periodStatusSchema,
  reference_code: z.string().max(50).nullable(),
  closed_at: z.string().datetime().nullable(),
  subscription_id: z.string().uuid().nullable(),
  project_id: z.string().uuid().nullable(),
  file_id: z.string().uuid().nullable(),
  refund_of_transaction_id: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/** Type inferred from the full transaction schema. */
export type TransactionSchema = z.infer<typeof transactionSchema>;

/**
 * Zod schema for creating a new Transaction.
 * Omits auto-generated fields (id, reference_code, created_at, updated_at, period_status, closed_at).
 * Sets sensible defaults for optional fields.
 */
export const createTransactionSchema = z.object({
  entity_id: z.string().uuid('Valid entity ID is required'),
  type: transactionTypeSchema,
  amount_minor: minorUnitsSchema,
  currency: currencyCodeSchema,
  myr_equiv_minor: minorUnitsSchema.nullable().default(null),
  fx_rate: fxRateSchema.nullable().default(null),
  occurred_at: isoDateSchema,
  vendor: z.string().min(1, 'Vendor is required').max(200),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().max(200).nullable().default(null),
  description: z.string().max(1000).nullable().default(null),
  notes: z.string().max(5000).nullable().default(null),
  tags: z.array(z.string().min(1).max(50)).max(20).default([]),
  status: transactionStatusSchema.default('pending_review'),
  subscription_id: z.string().uuid().nullable().default(null),
  project_id: z.string().uuid().nullable().default(null),
  file_id: z.string().uuid().nullable().default(null),
  refund_of_transaction_id: z.string().uuid().nullable().default(null),
});

/** Type inferred from the create transaction schema. */
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/**
 * Zod schema for updating an existing Transaction.
 * All fields are optional (partial). Includes refinement to prevent modification
 * of transactions in closed months.
 */
export const updateTransactionSchema = z
  .object({
    type: transactionTypeSchema.optional(),
    amount_minor: minorUnitsSchema.optional(),
    currency: currencyCodeSchema.optional(),
    myr_equiv_minor: minorUnitsSchema.nullable().optional(),
    fx_rate: fxRateSchema.nullable().optional(),
    occurred_at: isoDateSchema.optional(),
    vendor: z.string().min(1).max(200).optional(),
    category: z.string().min(1).optional(),
    subcategory: z.string().max(200).nullable().optional(),
    description: z.string().max(1000).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    tags: z.array(z.string()).max(20).optional(),
    status: transactionStatusSchema.optional(),
    subscription_id: z.string().uuid().nullable().optional(),
    project_id: z.string().uuid().nullable().optional(),
    file_id: z.string().uuid().nullable().optional(),
    refund_of_transaction_id: z.string().uuid().nullable().optional(),
  })
  .refine(
    (data) => {
      // At least one field must be provided for update
      return Object.keys(data).length > 0;
    },
    { message: 'At least one field must be provided for update' }
  );

/** Type inferred from the update transaction schema. */
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

// ---------------------------------------------------------------------------
// 12.3 Subscription Schemas
// ---------------------------------------------------------------------------

/**
 * Full Zod validation schema for a Subscription.
 * Comprehensive validation for all subscription fields.
 */
export const subscriptionSchema = z.object({
  id: z.string().uuid(),
  entity_id: z.string().uuid(),
  name: z.string().min(1, 'Subscription name is required').max(200),
  vendor: z.string().min(1, 'Vendor is required').max(200),
  plan: z.string().min(1, 'Plan is required').max(200),
  category: z.string().min(1),
  subcategory: z.string().max(200).nullable(),
  amount_minor: minorUnitsSchema,
  currency: currencyCodeSchema,
  billing_cycle: billingCycleSchema,
  start_date: isoDateSchema,
  trial_end_date: isoDateSchema.nullable(),
  next_payment_at: isoDateSchema,
  last_paid_at: isoDateSchema.nullable(),
  renewal_date: isoDateSchema,
  end_date: isoDateSchema.nullable(),
  payment_method: z.string().min(1).max(100),
  status: subscriptionStatusSchema,
  reminder_offsets: z.array(z.number().int().nonnegative()).max(5),
  reminder_channels: z.array(reminderChannelSchema),
  is_stack_radar: z.boolean(),
  notes: z.string().max(5000).nullable(),
  billing_url: z.string().url().max(1000).nullable(),
  auto_renew: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/** Type inferred from the full subscription schema. */
export type SubscriptionSchema = z.infer<typeof subscriptionSchema>;

/**
 * Zod schema for creating a new Subscription.
 * Omits auto-generated fields and sets sensible defaults.
 */
export const createSubscriptionSchema = z.object({
  entity_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  vendor: z.string().min(1).max(200),
  plan: z.string().min(1).max(200).default('Default'),
  category: z.string().min(1).default('Software & Tools'),
  subcategory: z.string().max(200).nullable().default(null),
  amount_minor: minorUnitsSchema,
  currency: currencyCodeSchema.default('MYR'),
  billing_cycle: billingCycleSchema,
  start_date: isoDateSchema,
  trial_end_date: isoDateSchema.nullable().default(null),
  next_payment_at: isoDateSchema,
  last_paid_at: isoDateSchema.nullable().default(null),
  renewal_date: isoDateSchema,
  end_date: isoDateSchema.nullable().default(null),
  payment_method: z.string().min(1).max(100).default('Credit Card'),
  status: subscriptionStatusSchema.default('active'),
  reminder_offsets: z.array(z.number().int().nonnegative()).max(5).default([30, 7, 1]),
  reminder_channels: z.array(reminderChannelSchema).default(['in_app']),
  is_stack_radar: z.boolean().default(true),
  notes: z.string().max(5000).nullable().default(null),
  billing_url: z.string().url().max(1000).nullable().default(null),
  auto_renew: z.boolean().default(true),
});

/** Type inferred from the create subscription schema. */
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

/**
 * Zod schema for updating an existing Subscription.
 * All fields are optional.
 */
export const updateSubscriptionSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    vendor: z.string().min(1).max(200).optional(),
    plan: z.string().min(1).max(200).optional(),
    category: z.string().min(1).optional(),
    subcategory: z.string().max(200).nullable().optional(),
    amount_minor: minorUnitsSchema.optional(),
    currency: currencyCodeSchema.optional(),
    billing_cycle: billingCycleSchema.optional(),
    start_date: isoDateSchema.optional(),
    trial_end_date: isoDateSchema.nullable().optional(),
    next_payment_at: isoDateSchema.optional(),
    last_paid_at: isoDateSchema.nullable().optional(),
    renewal_date: isoDateSchema.optional(),
    end_date: isoDateSchema.nullable().optional(),
    payment_method: z.string().min(1).max(100).optional(),
    status: subscriptionStatusSchema.optional(),
    reminder_offsets: z.array(z.number().int().nonnegative()).max(5).optional(),
    reminder_channels: z.array(reminderChannelSchema).optional(),
    is_stack_radar: z.boolean().optional(),
    notes: z.string().max(5000).nullable().optional(),
    billing_url: z.string().url().max(1000).nullable().optional(),
    auto_renew: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
  );

/** Type inferred from the update subscription schema. */
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

// ---------------------------------------------------------------------------
// 12.4 Project Schemas
// ---------------------------------------------------------------------------

/**
 * Full Zod validation schema for a Project.
 */
export const projectSchema = z.object({
  id: z.string().uuid(),
  entity_id: z.string().uuid(),
  name: z.string().min(1, 'Project name is required').max(300),
  client: z.string().min(1, 'Client name is required').max(200),
  total_value_minor: minorUnitsSchema,
  currency: currencyCodeSchema,
  payment_schedule_note: z.string().max(2000).nullable(),
  status: projectStatusSchema,
  quoted_at: isoDateSchema.nullable(),
  deposit_received_at: isoDateSchema.nullable(),
  started_at: isoDateSchema.nullable(),
  delivered_at: isoDateSchema.nullable(),
  fully_paid_at: isoDateSchema.nullable(),
  cancelled_at: isoDateSchema.nullable(),
  notes: z.string().max(5000).nullable(),
  tags: z.array(z.string().min(1).max(50)).max(20),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/** Type inferred from the full project schema. */
export type ProjectSchema = z.infer<typeof projectSchema>;

/**
 * Zod schema for creating a new Project.
 */
export const createProjectSchema = z.object({
  entity_id: z.string().uuid(),
  name: z.string().min(1).max(300),
  client: z.string().min(1).max(200),
  total_value_minor: minorUnitsSchema,
  currency: currencyCodeSchema.default('MYR'),
  payment_schedule_note: z.string().max(2000).nullable().default(null),
  status: projectStatusSchema.default('quoted'),
  quoted_at: isoDateSchema.nullable().default(null),
  deposit_received_at: isoDateSchema.nullable().default(null),
  started_at: isoDateSchema.nullable().default(null),
  notes: z.string().max(5000).nullable().default(null),
  tags: z.array(z.string().min(1).max(50)).max(20).default([]),
});

/** Type inferred from the create project schema. */
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/**
 * Zod schema for updating an existing Project.
 */
export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(300).optional(),
    client: z.string().min(1).max(200).optional(),
    total_value_minor: minorUnitsSchema.optional(),
    currency: currencyCodeSchema.optional(),
    payment_schedule_note: z.string().max(2000).nullable().optional(),
    status: projectStatusSchema.optional(),
    quoted_at: isoDateSchema.nullable().optional(),
    deposit_received_at: isoDateSchema.nullable().optional(),
    started_at: isoDateSchema.nullable().optional(),
    delivered_at: isoDateSchema.nullable().optional(),
    fully_paid_at: isoDateSchema.nullable().optional(),
    cancelled_at: isoDateSchema.nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
  );

/** Type inferred from the update project schema. */
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ---------------------------------------------------------------------------
// 12.5 Settings Schema
// ---------------------------------------------------------------------------

/** Zod schema for a single CP500 schedule entry. */
export const cp500ScheduleEntrySchema = z.object({
  instalment_number: z.number().int().min(1).max(6),
  due_date: isoDateSchema,
  amount_minor: minorUnitsSchema,
  is_paid: z.boolean(),
  payment_transaction_id: z.string().uuid().nullable(),
});

/**
 * Full Zod validation schema for UserSettings.
 * Validates all user-configurable preferences.
 */
export const settingsSchema = z.object({
  default_entity_id: z.string().uuid(),
  tax_year_start_month: z.number().int().min(1).max(12).default(1),
  effective_tax_rate_percent: percentageSchema.default(0),
  lhdn_forecast_income_minor: minorUnitsSchema.default(0),
  cp500_schedule: z.array(cp500ScheduleEntrySchema).max(6).default([]),
  tax_reserve_strategy: taxReserveStrategySchema.default('auto_percentage'),
  cp502_threshold_percent: z.number().int().min(0).max(100).default(30),
  reminder_channels: z.array(reminderChannelSchema).default(['in_app']),
  google_calendar_connected: z.boolean().default(false),
  gcal_refresh_token: z.string().nullable().default(null),
  gcal_calendar_id: z.string().nullable().default(null),
  fx_preference: fxPreferenceSchema.default('manual_entry'),
  monthly_ai_cost_cap_minor: minorUnitsSchema.default(5000),
  ai_extraction_enabled: z.boolean().default(true),
  default_extraction_model: extractionModelSchema.default('gpt-4o-mini'),
  email_forwarding_enabled: z.boolean().default(false),
  receipt_email_address: z.string().email().nullable().default(null),
  auto_categorisation_enabled: z.boolean().default(true),
  onboarding_completed: z.boolean().default(false),
  onboarding_step: z.number().int().min(0).max(10).default(0),
  date_format: z.enum(['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY']).default('YYYY-MM-DD'),
});

/** Type inferred from the settings schema. */
export type SettingsInput = z.infer<typeof settingsSchema>;

// ---------------------------------------------------------------------------
// 12.6 File Upload Schema
// ---------------------------------------------------------------------------

/**
 * Zod schema for file upload metadata validation.
 * Validates the metadata form before the actual file bytes are processed.
 */
export const uploadFileSchema = z.object({
  entity_id: z.string().uuid('Valid entity ID is required'),
  transaction_id: z.string().uuid().nullable().default(null),
  display_filename: z.string().max(255).nullable().default(null),
  source: fileSourceSchema.default('manual_upload'),
});

/** Type inferred from the upload file schema. */
export type UploadFileInput = z.infer<typeof uploadFileSchema>;

/**
 * Zod schema for the actual file being uploaded.
 * Validates file size, type, and extension.
 */
export const fileUploadPayloadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((f) => f.size > 0, 'File cannot be empty')
    .refine((f) => f.size <= 10 * 1024 * 1024, 'File size must not exceed 10MB')
    .refine(
      (f) =>
        [
          'image/jpeg',
          'image/png',
          'image/heic',
          'image/webp',
          'application/pdf',
          'text/csv',
        ].includes(f.type),
      'Unsupported file type. Accepted: JPEG, PNG, HEIC, WebP, PDF, CSV'
    ),
  metadata: uploadFileSchema,
});

/** Type inferred from the file upload payload schema. */
export type FileUploadPayload = z.infer<typeof fileUploadPayloadSchema>;

// ---------------------------------------------------------------------------
// 12.7 Extraction Result Schema
// ---------------------------------------------------------------------------

/**
 * Zod schema for the AI extraction result — the output from the AI model.
 * This validates the structured response before it is saved to the database.
 */
export const extractedFieldsSchema = z.object({
  vendor: z.string().max(200).nullable(),
  amount_minor: minorUnitsSchema.nullable(),
  currency: currencyCodeSchema.nullable(),
  date: isoDateSchema.nullable(),
  description: z.string().max(1000).nullable(),
  suggested_category: z.string().nullable(),
  suggested_subcategory: z.string().nullable(),
  tax_amount_minor: minorUnitsSchema.nullable(),
  tax_reg_number: z.string().max(50).nullable(),
  receipt_number: z.string().max(100).nullable(),
  line_items: z
    .array(
      z.object({
        description: z.string().max(500),
        quantity: z.number().int().positive(),
        unit_price_minor: minorUnitsSchema,
        total_minor: minorUnitsSchema,
      })
    )
    .default([]),
});

/** Zod schema for per-field confidence scores. */
export const confidenceScoresSchema = z.object({
  vendor: z.number().min(0).max(1),
  amount: z.number().min(0).max(1),
  currency: z.number().min(0).max(1),
  date: z.number().min(0).max(1),
  description: z.number().min(0).max(1),
  category: z.number().min(0).max(1),
  subcategory: z.number().min(0).max(1),
  tax_amount: z.number().min(0).max(1),
  receipt_number: z.number().min(0).max(1),
  overall: z.number().min(0).max(1),
});

/**
 * Zod schema for the complete extraction result from the AI service.
 */
export const extractionResultSchema = z.object({
  success: z.boolean(),
  fields: extractedFieldsSchema.nullable(),
  confidence: confidenceScoresSchema.nullable(),
  error: z.string().nullable(),
  tokens_used: z.number().int().nonnegative(),
  processing_time_ms: z.number().int().nonnegative(),
});

/** Type inferred from the extraction result schema. */
export type ExtractionResultSchema = z.infer<typeof extractionResultSchema>;

// ---------------------------------------------------------------------------
// 12.8 Reminder Schemas
// ---------------------------------------------------------------------------

/** Zod schema for creating a new Reminder. */
export const createReminderSchema = z.object({
  reminder_type: reminderTypeSchema,
  ref_type: refTypeSchema,
  ref_id: z.string().min(1),
  entity_id: z.string().uuid(),
  trigger_at: z.string().datetime(),
  offset_days: z.number().int().nonnegative(),
  channels: z.array(reminderChannelSchema).min(1, 'At least one channel is required'),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
});

/** Type inferred from the create reminder schema. */
export type CreateReminderInput = z.infer<typeof createReminderSchema>;

// ---------------------------------------------------------------------------
// 12.9 Month Close Schemas
// ---------------------------------------------------------------------------

/** Zod schema for the month-end checklist. */
export const monthEndChecklistSchema = z.object({
  all_transactions_reviewed: z.boolean(),
  all_receipts_attached: z.boolean(),
  bank_reconciled: z.boolean(),
  subscriptions_verified: z.boolean(),
  fx_rates_verified: z.boolean(),
  tax_position_reviewed: z.boolean(),
  pack_generated: z.boolean(),
  next_period_reminders_set: z.boolean(),
});

/**
 * Zod schema for closing a month.
 * Requires the user to confirm the manual closing balance and complete the checklist.
 */
export const closeMonthSchema = z.object({
  entity_id: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  closing_balance_minor: minorUnitsSchema,
  checklist_results: monthEndChecklistSchema,
  reconciliation_note: z.string().max(2000).nullable().default(null),
  notes: z.string().max(5000).nullable().default(null),
});

/** Type inferred from the close month schema. */
export type CloseMonthInput = z.infer<typeof closeMonthSchema>;

/**
 * Zod schema for reopening a closed month.
 * Requires a reason — this is an audit-sensitive operation.
 */
export const reopenMonthSchema = z.object({
  entity_id: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  reason: z.string().min(10, 'Please provide a detailed reason (min 10 characters)').max(2000),
});

/** Type inferred from the reopen month schema. */
export type ReopenMonthInput = z.infer<typeof reopenMonthSchema>;



// =============================================================================
// 13. API REQUEST/RESPONSE TYPES
// =============================================================================

// ---------------------------------------------------------------------------
// 13.1 Auth Types
// ---------------------------------------------------------------------------

/** Input for user sign-in via email/password. */
export interface SignInInput {
  /** User's email address. */
  readonly email: string;
  /** User's password. */
  readonly password: string;
}

/** Output from a successful sign-in. */
export interface SignInOutput {
  /** The authenticated user's details. */
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly display_name: string | null;
  };
  /** JWT access token for API authentication. */
  readonly access_token: string;
  /** Token expiry timestamp (ISO 8601). */
  readonly expires_at: string;
}

/** Input for user sign-out. */
export interface SignOutInput {
  /** Whether to sign out from all devices (global sign-out). */
  readonly global: boolean;
}

/** Output from sign-out — always returns success. */
export interface SignOutOutput {
  readonly success: boolean;
}

/** Input for password reset request. */
export interface ResetPasswordInput {
  readonly email: string;
}

/** Input for updating password after reset. */
export interface UpdatePasswordInput {
  readonly new_password: string;
  readonly confirm_password: string;
}

/** Current authentication state. */
export interface AuthState {
  readonly is_authenticated: boolean;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly display_name: string | null;
  } | null;
  readonly is_loading: boolean;
}

// ---------------------------------------------------------------------------
// 13.2 Transaction API Types
// ---------------------------------------------------------------------------

/** Sort options for transaction list queries. */
export type TransactionSortField = 'occurred_at' | 'created_at' | 'amount_minor' | 'vendor';
export type SortDirection = 'asc' | 'desc';

/** Filter parameters for listing transactions. */
export interface ListTransactionsInput {
  /** Entity to filter by (required). */
  readonly entity_id: string;

  /** Filter by transaction type. */
  readonly type?: TransactionType;

  /** Filter by status. */
  readonly status?: TransactionStatus;

  /** Filter by period status. */
  readonly period_status?: PeriodStatus;

  /** Start date filter (ISO YYYY-MM-DD, inclusive). */
  readonly date_from?: string;

  /** End date filter (ISO YYYY-MM-DD, inclusive). */
  readonly date_to?: string;

  /** Filter by vendor name (partial match, case-insensitive). */
  readonly vendor?: string;

  /** Filter by category. */
  readonly category?: TransactionCategory;

  /** Filter by subcategory. */
  readonly subcategory?: string;

  /** Filter by tags (must have all specified tags). */
  readonly tags?: readonly string[];

  /** Filter by currency. */
  readonly currency?: CurrencyCode;

  /** Filter by subscription ID. */
  readonly subscription_id?: string;

  /** Filter by project ID. */
  readonly project_id?: string;

  /** Search across vendor, description, and notes (full-text search). */
  readonly search?: string;

  /** Sort field. */
  readonly sort_by?: TransactionSortField;

  /** Sort direction. */
  readonly sort_dir?: SortDirection;

  /** Page number (1-based). */
  readonly page?: number;

  /** Items per page (max 100). */
  readonly per_page?: number;
}

/** Paginated response for transaction list queries. */
export interface ListTransactionsOutput {
  /** The transactions matching the query. */
  readonly items: readonly TransactionSummary[];

  /** Total number of matching transactions (for pagination). */
  readonly total: number;

  /** Current page number. */
  readonly page: number;

  /** Items per page. */
  readonly per_page: number;

  /** Total number of pages. */
  readonly total_pages: number;

  /** Whether there is a next page. */
  readonly has_next: boolean;

  /** Whether there is a previous page. */
  readonly has_prev: boolean;
}

/** Output for a single transaction fetch. */
export interface GetTransactionOutput {
  readonly transaction: Transaction;
  /** The linked subscription details, if any. */
  readonly subscription: Subscription | null;
  /** The linked project details, if any. */
  readonly project: Project | null;
  /** The linked file details, if any. */
  readonly file: FileRecord | null;
  /** The original transaction if this is a refund. */
  readonly refunded_transaction: Transaction | null;
}

/** Input for deleting (soft-deleting) a transaction. */
export interface DeleteTransactionInput {
  readonly id: string;
  readonly reason?: string;
}

/** Input for bulk updating transactions. */
export interface BulkUpdateTransactionsInput {
  /** IDs of transactions to update. */
  readonly ids: readonly string[];
  /** Fields to update on all selected transactions. */
  readonly updates: {
    readonly category?: TransactionCategory;
    readonly subcategory?: string;
    readonly status?: TransactionStatus;
    readonly tags?: readonly string[];
  };
}

/** Input for bulk deleting transactions. */
export interface BulkDeleteTransactionsInput {
  readonly ids: readonly string[];
  readonly reason?: string;
}

/** Output for bulk operation results. */
export interface BulkOperationOutput {
  /** Number of records successfully processed. */
  readonly success_count: number;
  /** Number of records that failed. */
  readonly failure_count: number;
  /** Details of failures (id + error message). */
  readonly failures: readonly { readonly id: string; readonly error: string }[];
}

// ---------------------------------------------------------------------------
// 13.3 Subscription API Types
// ---------------------------------------------------------------------------

/** Filter parameters for listing subscriptions. */
export interface ListSubscriptionsInput {
  readonly entity_id: string;
  readonly status?: SubscriptionStatus;
  readonly is_stack_radar?: boolean;
  readonly vendor?: string;
  readonly sort_by?: 'name' | 'vendor' | 'amount_minor' | 'next_payment_at' | 'renewal_date';
  readonly sort_dir?: SortDirection;
  readonly page?: number;
  readonly per_page?: number;
}

/** Paginated response for subscription list queries. */
export interface ListSubscriptionsOutput {
  readonly items: readonly SubscriptionWithComputed[];
  readonly total: number;
  readonly page: number;
  readonly per_page: number;
  readonly total_pages: number;
  readonly has_next: boolean;
  readonly has_prev: boolean;

  /** Aggregated summary of all subscriptions. */
  readonly summary: {
    readonly total_monthly_burn_myr_minor: number;
    readonly total_annual_commitment_myr_minor: number;
    readonly active_count: number;
    readonly trial_count: number;
    readonly renewing_soon_count: number;
  };
}

/** Output for a single subscription fetch. */
export interface GetSubscriptionOutput {
  readonly subscription: SubscriptionWithComputed;
  /** Linked transactions (payment history). */
  readonly payment_history: readonly TransactionSummary[];
  /** Upcoming reminders for this subscription. */
  readonly upcoming_reminders: readonly Reminder[];
}

/** Input for deleting a subscription. */
export interface DeleteSubscriptionInput {
  readonly id: string;
  readonly also_cancel_vendor?: boolean;
}

// ---------------------------------------------------------------------------
// 13.4 File API Types
// ---------------------------------------------------------------------------

/** Filter parameters for listing files. */
export interface ListFilesInput {
  readonly entity_id: string;
  readonly source?: FileSource;
  readonly mime_type?: AcceptedMimeType;
  readonly extraction_status?: FileRecord['extraction_status'];
  readonly search?: string;
  readonly sort_by?: 'uploaded_at' | 'display_filename' | 'size_bytes';
  readonly sort_dir?: SortDirection;
  readonly page?: number;
  readonly per_page?: number;
}

/** Paginated response for file list queries. */
export interface ListFilesOutput {
  readonly items: readonly FileRecord[];
  readonly total: number;
  readonly page: number;
  readonly per_page: number;
  readonly total_pages: number;
  readonly has_next: boolean;
  readonly has_prev: boolean;
}

/** Input for requesting a presigned URL to view/download a file. */
export interface GetSignedUrlInput {
  readonly file_id: string;
  /** How long the URL should be valid for, in seconds (max 3600). */
  readonly expiry_seconds?: number;
}

/** Output for presigned URL request. */
export interface GetSignedUrlOutput {
  readonly url: string;
  readonly expires_at: string;
  readonly filename: string;
  readonly mime_type: AcceptedMimeType;
  readonly size_bytes: number;
}

/** Input for deleting a file. */
export interface DeleteFileInput {
  readonly file_id: string;
}

/** Output from the AI extraction trigger. */
export interface TriggerExtractionInput {
  readonly file_id: string;
  readonly model?: ExtractionModel;
}

export interface TriggerExtractionOutput {
  readonly extraction_id: string;
  readonly status: 'processing' | 'completed' | 'failed';
  readonly result: ExtractionResult | null;
}

// ---------------------------------------------------------------------------
// 13.5 Tax Position API Types
// ---------------------------------------------------------------------------

/** Input for retrieving the current tax position. */
export interface GetTaxPositionInput {
  readonly entity_id: string;
  readonly as_of_date?: string; // Defaults to today
}

/** Output containing the complete tax position analysis. */
export interface GetTaxPositionOutput {
  /** The tax year this position applies to. */
  readonly tax_year: number;

  /** Start date of the tax year (ISO YYYY-MM-DD). */
  readonly tax_year_start: string;

  /** End date of the tax year (ISO YYYY-MM-DD). */
  readonly tax_year_end: string;

  /** Number of days remaining in the tax year. */
  readonly days_remaining: number;

  /** Total income received YTD in MYR minor units. */
  readonly income_ytd_myr_minor: number;

  /** Total expenses claimed YTD in MYR minor units. */
  readonly expenses_ytd_myr_minor: number;

  /** Net chargeable income YTD in MYR minor units (income - expenses). */
  readonly net_chargeable_income_myr_minor: number;

  /** Tax on net chargeable income using the effective rate, in MYR minor units. */
  readonly estimated_tax_myr_minor: number;

  /** Total CP500 prepayments made YTD in MYR minor units. */
  readonly cp500_paid_ytd_myr_minor: number;

  /** Net tax position: positive = owe more, negative = overpaid. */
  readonly tax_position_myr_minor: number;

  /** Whether the tax position is an underpayment (true) or overpayment (false). */
  readonly is_underpaid: boolean;

  /** Recommended monthly tax reserve transfer in MYR minor units. */
  readonly recommended_monthly_reserve_myr_minor: number;

  /** The CP500 schedule for the tax year. */
  readonly cp500_schedule: readonly CP500ScheduleEntry[];

  /** Variance between actual income and LHDN forecast (percentage). */
  readonly forecast_variance_percent: number;

  /** Whether CP502 revision is recommended based on variance. */
  readonly cp502_recommended: boolean;

  /** Detailed breakdown by month. */
  readonly monthly_breakdown: readonly {
    readonly year: number;
    readonly month: number;
    readonly label: string;
    readonly income_myr_minor: number;
    readonly expenses_myr_minor: number;
    readonly net_myr_minor: number;
    readonly cp500_paid_myr_minor: number;
  }[];

  /** The user's tax settings used for this calculation. */
  readonly settings: {
    readonly effective_tax_rate_percent: number;
    readonly lhdn_forecast_income_minor: number;
    readonly tax_reserve_strategy: TaxReserveStrategy;
    readonly cp502_threshold_percent: number;
  };
}

// ---------------------------------------------------------------------------
// 13.6 Project API Types
// ---------------------------------------------------------------------------

/** Filter parameters for listing projects. */
export interface ListProjectsInput {
  readonly entity_id: string;
  readonly status?: ProjectStatus;
  readonly client?: string;
  readonly search?: string;
  readonly sort_by?: 'name' | 'client' | 'total_value_minor' | 'created_at';
  readonly sort_dir?: SortDirection;
  readonly page?: number;
  readonly per_page?: number;
}

/** Paginated response for project list queries. */
export interface ListProjectsOutput {
  readonly items: readonly ProjectSummary[];
  readonly total: number;
  readonly page: number;
  readonly per_page: number;
  readonly total_pages: number;
  readonly has_next: boolean;
  readonly has_prev: boolean;
}

/** Output for a single project fetch. */
export interface GetProjectOutput {
  readonly project: ProjectWithComputed;
  /** Payment history linked to this project. */
  readonly payments: readonly ProjectPayment[];
  /** Linked transactions. */
  readonly transactions: readonly TransactionSummary[];
}

/** Input for recording a payment against a project. */
export interface RecordProjectPaymentInput {
  readonly project_id: string;
  readonly transaction_id: string;
  readonly amount_minor: number;
  readonly currency: CurrencyCode;
  readonly label: string;
  readonly received_at: string;
}

// ---------------------------------------------------------------------------
// 13.7 Dashboard API Types
// ---------------------------------------------------------------------------

/** Input for fetching dashboard data. */
export interface GetDashboardInput {
  readonly entity_id: string;
  /** The date to compute the dashboard for (defaults to today). */
  readonly as_of_date?: string;
}

/** Complete dashboard data response. */
export interface GetDashboardOutput {
  readonly kpis: DashboardKPIs;
  readonly upcoming_subscriptions: readonly UpcomingSubscription[];
  readonly tax_position_glance: TaxPositionGlance;
  readonly outstanding_receivables: OutstandingReceivables;
  readonly top_categories: readonly CategorySpend[];
  readonly top_vendors: readonly VendorSpend[];
  readonly recent_transactions: readonly TransactionSummary[];
  readonly pending_review: readonly TransactionSummary[];
  readonly reminders: readonly ReminderWithRef[];
}

// ---------------------------------------------------------------------------
// 13.8 Reminder API Types
// ---------------------------------------------------------------------------

/** Filter parameters for listing reminders. */
export interface ListRemindersInput {
  readonly entity_id: string;
  readonly status?: ReminderStatus;
  readonly reminder_type?: ReminderType;
  readonly date_from?: string;
  readonly date_to?: string;
  readonly page?: number;
  readonly per_page?: number;
}

/** Paginated response for reminder list queries. */
export interface ListRemindersOutput {
  readonly items: readonly ReminderWithRef[];
  readonly total: number;
  readonly page: number;
  readonly per_page: number;
  readonly total_pages: number;
  readonly has_next: boolean;
  readonly has_prev: boolean;
}

/** Input for dismissing a reminder. */
export interface DismissReminderInput {
  readonly reminder_id: string;
}

/** Input for manually triggering a reminder. */
export interface TriggerReminderInput {
  readonly reminder_id: string;
  readonly channels?: readonly ReminderChannel[];
}

// ---------------------------------------------------------------------------
// 13.9 Audit Log API Types
// ---------------------------------------------------------------------------

/** Input for querying audit logs. */
export interface ListAuditLogsInput extends AuditLogFilter {
  readonly page?: number;
  readonly per_page?: number;
}

/** Paginated response for audit log queries. */
export interface ListAuditLogsOutput {
  readonly items: readonly AuditLogSummary[];
  readonly total: number;
  readonly page: number;
  readonly per_page: number;
  readonly total_pages: number;
  readonly has_next: boolean;
  readonly has_prev: boolean;
}

// ---------------------------------------------------------------------------
// 13.10 Settings API Types
// ---------------------------------------------------------------------------

/** Input for updating user settings. */
export interface UpdateSettingsInput {
  readonly default_entity_id?: string;
  readonly tax_year_start_month?: number;
  readonly effective_tax_rate_percent?: number;
  readonly lhdn_forecast_income_minor?: number;
  readonly tax_reserve_strategy?: TaxReserveStrategy;
  readonly cp502_threshold_percent?: number;
  readonly reminder_channels?: readonly ReminderChannel[];
  readonly fx_preference?: FXPreference;
  readonly monthly_ai_cost_cap_minor?: number;
  readonly ai_extraction_enabled?: boolean;
  readonly default_extraction_model?: ExtractionModel;
  readonly email_forwarding_enabled?: boolean;
  readonly auto_categorisation_enabled?: boolean;
  readonly date_format?: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
}

/** Output for settings fetch/update. */
export interface SettingsOutput {
  readonly settings: UserSettings;
}

/** Input for Google Calendar connection. */
export interface ConnectCalendarInput {
  /** The OAuth authorization code from Google. */
  readonly code: string;
  /** The calendar ID to sync reminders to. */
  readonly calendar_id: string;
}

/** Output for calendar connection. */
export interface ConnectCalendarOutput {
  readonly success: boolean;
  readonly calendar_id: string;
  readonly calendar_name: string;
}

/** Input for disconnecting Google Calendar. */
export interface DisconnectCalendarInput {
  readonly revoke_token: boolean;
}

// =============================================================================
// 14. DASHBOARD TYPES
// =============================================================================

/**
 * Key Performance Indicators for the main dashboard.
 * All monetary values are in MYR minor units (sen) unless otherwise noted.
 */
export interface DashboardKPIs {
  /** Total spending month-to-date in MYR minor units. */
  readonly spend_mtd_myr_minor: number;

  /** Total income month-to-date in MYR minor units. */
  readonly income_mtd_myr_minor: number;

  /** Net cash flow month-to-date (income - expenses) in MYR minor units. */
  readonly net_cash_flow_myr_minor: number;

  /** Number of transactions pending review. */
  readonly pending_review_count: number;

  /** Monthly subscription burn rate in MYR minor units (normalised from all billing cycles). */
  readonly monthly_sub_burn_myr_minor: number;

  /** Total annual subscription commitment in MYR minor units. */
  readonly annual_sub_commitment_myr_minor: number;

  /** Number of subscriptions renewing in the next 7 days. */
  readonly subs_renewing_in_7d: number;

  /** Number of items in the review queue (same as pending_review_count, shown for emphasis). */
  readonly review_queue_count: number;

  /** Number of active projects with outstanding receivables. */
  readonly active_receivables_count: number;

  /** Total outstanding receivables in MYR minor units. */
  readonly total_receivables_myr_minor: number;
}

/** A quick-glance summary of the tax position for the dashboard. */
export interface TaxPositionGlance {
  /** Current tax year (e.g. 2024). */
  readonly tax_year: number;

  /** Days remaining in the tax year. */
  readonly days_remaining: number;

  /** Net chargeable income year-to-date in MYR minor units. */
  readonly net_chargeable_ytd_myr_minor: number;

  /** Estimated tax liability in MYR minor units. */
  readonly estimated_tax_myr_minor: number;

  /** CP500 prepayments made year-to-date in MYR minor units. */
  readonly cp500_paid_ytd_myr_minor: number;

  /** Current tax position: positive = owe more, negative = overpaid. */
  readonly tax_position_myr_minor: number;

  /** Whether there is an underpayment. */
  readonly is_underpaid: boolean;

  /** Next CP500 instalment details. */
  readonly next_cp500: {
    readonly instalment_number: number;
    readonly due_date: string;
    readonly amount_minor: number;
    readonly days_until_due: number;
  } | null;

  /** Recommended monthly tax reserve in MYR minor units. */
  readonly recommended_reserve_myr_minor: number;

  /** Variance from LHDN forecast as a percentage. */
  readonly forecast_variance_percent: number;

  /** Whether CP502 revision is recommended. */
  readonly cp502_recommended: boolean;
}

/** Category spending summary for the dashboard. */
export interface CategorySpend {
  /** The category name. */
  readonly category: TransactionCategory;

  /** Total spend in this category in MYR minor units. */
  readonly total_myr_minor: number;

  /** Percentage of total spend (0-100). */
  readonly pct_of_total: number;

  /** Number of transactions in this category. */
  readonly transaction_count: number;

  /** Month-over-month change percentage (can be negative). */
  readonly mom_change_percent: number | null;
}

/** Vendor spending summary for the dashboard. */
export interface VendorSpend {
  /** The vendor name. */
  readonly vendor: string;

  /** Total spend with this vendor in MYR minor units. */
  readonly total_myr_minor: number;

  /** Percentage of total spend (0-100). */
  readonly pct_of_total: number;

  /** Number of transactions with this vendor. */
  readonly transaction_count: number;

  /** Primary category for this vendor. */
  readonly primary_category: TransactionCategory;
}

/** Complete dashboard data — combines all dashboard sections. */
export interface DashboardData {
  /** Key performance indicators. */
  readonly kpis: DashboardKPIs;

  /** Subscriptions renewing in the next 30 days. */
  readonly upcoming_subscriptions: readonly UpcomingSubscription[];

  /** Tax position at a glance. */
  readonly tax_position_glance: TaxPositionGlance;

  /** Outstanding client receivables. */
  readonly outstanding_receivables: OutstandingReceivables;

  /** Top spending categories. */
  readonly top_categories: readonly CategorySpend[];

  /** Top vendors by spend. */
  readonly top_vendors: readonly VendorSpend[];

  /** Most recent transactions across all types. */
  readonly recent_transactions: readonly TransactionSummary[];

  /** Transactions awaiting review. */
  readonly pending_review: readonly TransactionSummary[];

  /** Upcoming reminders. */
  readonly reminders: readonly ReminderWithRef[];
}



// =============================================================================
// 15. TAX POSITION TYPES
// =============================================================================

/**
 * Malaysian income tax brackets for YA 2024 (Year of Assessment).
 * Chargeable income is taxed at progressive rates.
 * Used for tax estimation when the user has not provided an effective rate.
 */
export const TAX_BRACKETS_2024: readonly {
  readonly min: number;
  readonly max: number | null;
  readonly rate_percent: number;
  readonly base_tax: number;
}[] = [
  { min: 0, max: 5000, rate_percent: 0, base_tax: 0 },
  { min: 5001, max: 20000, rate_percent: 1, base_tax: 0 },
  { min: 20001, max: 35000, rate_percent: 3, base_tax: 150 },
  { min: 35001, max: 50000, rate_percent: 6, base_tax: 600 },
  { min: 50001, max: 70000, rate_percent: 11, base_tax: 1500 },
  { min: 70001, max: 100000, rate_percent: 19, base_tax: 3700 },
  { min: 100001, max: 400000, rate_percent: 25, base_tax: 9400 },
  { min: 400001, max: 600000, rate_percent: 26, base_tax: 84400 },
  { min: 600001, max: 1000000, rate_percent: 28, base_tax: 136400 },
  { min: 1000001, max: null, rate_percent: 30, base_tax: 248400 },
] as const;

/**
 * CP500 (Borang CP500) is Malaysia's income tax prepayment scheme.
 * Taxpayers with prior-year tax liability > RM0 must make 6 equal monthly instalments.
 * Each instalment is due on the 15th of each month starting from the tax year start month.
 */
export interface CP500Schedule {
  /** The tax year this schedule applies to. */
  readonly tax_year: number;

  /** Total estimated tax for the year in MYR minor units. */
  readonly total_estimated_tax_minor: number;

  /** The 6 instalments making up the schedule. */
  readonly instalments: readonly CP500ScheduleEntry[];

  /** Total amount paid so far in MYR minor units. */
  readonly total_paid_minor: number;

  /** Total amount remaining to be paid in MYR minor units. */
  readonly total_remaining_minor: number;

  /** Whether all instalments have been paid. */
  readonly is_fully_paid: boolean;

  /** The next upcoming instalment, if any remain unpaid. */
  readonly next_instalment: CP500ScheduleEntry | null;
}

/**
 * CP502 (Borang CP502) is the form for revising tax estimates mid-year.
 * If actual income varies by more than the threshold from the original forecast,
 * a voluntary revision should be filed with LHDN.
 */
export interface CP502Analysis {
  /** Whether a CP502 revision is recommended based on current income vs forecast. */
  readonly revision_recommended: boolean;

  /** The percentage variance that triggered the recommendation (if applicable). */
  readonly variance_percent: number;

  /** The threshold percentage for triggering a revision recommendation. */
  readonly threshold_percent: number;

  /** Original forecast income in MYR minor units. */
  readonly original_forecast_minor: number;

  /** Projected actual income based on YTD run-rate in MYR minor units. */
  readonly projected_actual_minor: number;

  /** Revised tax estimate based on projected actual income in MYR minor units. */
  readonly revised_tax_estimate_minor: number;

  /** The due date for filing CP502 (30 days from revision trigger date). */
  readonly filing_deadline: string | null;

  /** Number of remaining instalments after revision (if CP502 is filed). */
  readonly remaining_instalments: number;

  /** New per-instalment amount if CP502 is filed in MYR minor units. */
  readonly revised_instalment_amount_minor: number;
}

/**
 * Tax reserve recommendation — guides how much to set aside each month.
 * This is based on the user's selected tax_reserve_strategy.
 */
export interface TaxReserveRecommendation {
  /** The strategy used for this recommendation. */
  readonly strategy: TaxReserveStrategy;

  /** Recommended monthly transfer amount in MYR minor units. */
  readonly monthly_reserve_minor: number;

  /** Recommended percentage of monthly net income to reserve (0-100). */
  readonly reserve_percent: number;

  /** Current accumulated tax reserve in MYR minor units. */
  readonly accumulated_reserve_minor: number;

  /** Whether the accumulated reserve is sufficient to cover estimated tax. */
  readonly is_reserve_sufficient: boolean;

  /** Shortfall if reserve is insufficient in MYR minor units. */
  readonly shortfall_minor: number;

  /** Excess if reserve is more than needed in MYR minor units. */
  readonly excess_minor: number;
}

/**
 * Complete tax analysis for a tax year — used in the tax position page.
 * Combines income, expenses, CP500 schedule, CP502 analysis, and reserve recommendations.
 */
export interface TaxYearAnalysis {
  /** The tax year being analysed. */
  readonly tax_year: number;

  /** Start date of the tax year. */
  readonly tax_year_start: string;

  /** End date of the tax year. */
  readonly tax_year_end: string;

  /** Current progress through the tax year (0.0 - 1.0). */
  readonly year_progress_percent: number;

  /** Income breakdown. */
  readonly income: {
    readonly total_minor: number;
    readonly by_month: readonly { readonly month: number; readonly label: string; readonly amount_minor: number }[];
    readonly by_category: readonly { readonly category: IncomeCategory; readonly amount_minor: number }[];
  };

  /** Expense breakdown. */
  readonly expenses: {
    readonly total_minor: number;
    readonly deductible_minor: number;
    readonly by_month: readonly { readonly month: number; readonly label: string; readonly amount_minor: number }[];
    readonly by_category: readonly { readonly category: ExpenseCategory; readonly amount_minor: number }[];
  };

  /** Tax computation. */
  readonly tax: {
    readonly net_chargeable_minor: number;
    readonly estimated_tax_minor: number;
    readonly effective_rate_percent: number;
    readonly marginal_rate_percent: number;
  };

  /** CP500 prepayment schedule and status. */
  readonly cp500: CP500Schedule;

  /** CP502 revision analysis. */
  readonly cp502: CP502Analysis;

  /** Tax reserve recommendation. */
  readonly reserve: TaxReserveRecommendation;

  /** Tax payment history. */
  readonly payment_history: readonly {
    readonly date: string;
    readonly type: 'cp500' | 'cp204' | 'final_settlement' | 'tax_reserve_transfer';
    readonly description: string;
    readonly amount_minor: number;
  }[];
}

/** Verdict summary for the tax position — a simplified view for quick decisions. */
export interface TaxVerdict {
  /** Overall status: healthy, warning, or critical. */
  readonly status: 'healthy' | 'warning' | 'critical';

  /** One-line summary of the tax position. */
  readonly headline: string;

  /** List of actionable items or concerns. */
  readonly actions: readonly {
    readonly priority: 'high' | 'medium' | 'low';
    readonly message: string;
    readonly action_type: 'pay_cp500' | 'file_cp502' | 'increase_reserve' | 'review_expenses' | 'none';
    readonly due_date: string | null;
  }[];

  /** Key numbers for quick reference. */
  readonly key_numbers: {
    readonly ytd_income_myr: string;
    readonly ytd_expenses_myr: string;
    readonly estimated_tax_myr: string;
    readonly cp500_paid_myr: string;
    readonly tax_position_myr: string;
    readonly recommended_monthly_reserve_myr: string;
  };
}

// =============================================================================
// 16. UTILITY TYPES
// =============================================================================

/** Makes all properties of T nullable (for partial/empty forms). */
export type Nullable<T> = { [K in keyof T]: T[K] | null };

/** Adds timestamp fields to a base type — used for database row types. */
export type WithTimestamps<T> = T & {
  readonly created_at: string;
  readonly updated_at: string;
};

/** Removes readonly modifiers from all properties — useful for form state before submission. */
export type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

/** Makes all properties optional except the specified keys. */
export type PartialExcept<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>;

/** Database row lookup — maps table names to their TypeScript types. */
export type DbRow<TableName extends string> =
  TableName extends 'transactions' ? Transaction :
  TableName extends 'subscriptions' ? Subscription :
  TableName extends 'projects' ? Project :
  TableName extends 'files' ? FileRecord :
  TableName extends 'extractions' ? Extraction :
  TableName extends 'reminders' ? Reminder :
  TableName extends 'month_closes' ? MonthClose :
  TableName extends 'audit_logs' ? AuditLog :
  TableName extends 'user_settings' ? UserSettings :
  TableName extends 'entities' ? Entity :
  TableName extends 'project_payments' ? ProjectPayment :
  never;

/** Database insert type — omits auto-generated fields (id, timestamps). */
export type DbInsert<T> = Omit<T, 'id' | 'created_at' | 'updated_at'>;

/** Database update type — makes all fields optional except id. */
export type DbUpdate<T> = Partial<Omit<T, 'id'>> & { readonly id: string };

/** Pagination metadata — included in all list responses. */
export interface PaginationMeta {
  readonly page: number;
  readonly per_page: number;
  readonly total: number;
  readonly total_pages: number;
  readonly has_next: boolean;
  readonly has_prev: boolean;
}

/** Generic paginated response wrapper. */
export interface PaginatedResponse<T> extends PaginationMeta {
  readonly items: readonly T[];
}

/** API response wrapper — standardises all API responses. */
export interface ApiResponse<T> {
  /** Whether the request was successful. */
  readonly success: boolean;

  /** The response data (only present on success). */
  readonly data: T | null;

  /** Error message (only present on failure). */
  readonly error: string | null;

  /** Error code for programmatic handling (only present on failure). */
  readonly error_code: string | null;

  /** ISO 8601 timestamp of the response. */
  readonly timestamp: string;

  /** Request ID for tracing and debugging. */
  readonly request_id: string;
}

/** Type guard for successful API responses. */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { readonly data: T; readonly success: true } {
  return response.success === true && response.data !== null;
}

/** Type guard for failed API responses. */
export function isErrorResponse<T>(response: ApiResponse<T>): response is ApiResponse<never> & { readonly success: false; readonly error: string } {
  return response.success === false && response.error !== null;
}

/** Server action result type — used for all server actions in Next.js. */
export type ServerActionResult<T> =
  | { readonly success: true; readonly data: T; readonly message?: string }
  | { readonly success: false; readonly error: string; readonly error_code?: string; readonly field_errors?: Readonly<Record<string, string[]>> };

/** Helper to create a successful server action result. */
export function successResult<T>(data: T, message?: string): Extract<ServerActionResult<T>, { success: true }> {
  return { success: true as const, data, message };
}

/** Helper to create an error server action result. */
export function errorResult(error: string, error_code?: string, field_errors?: Readonly<Record<string, string[]>>): Extract<ServerActionResult<never>, { success: false }> {
  return { success: false as const, error, error_code, field_errors };
}

/** Form field error mapping — used to display validation errors next to fields. */
export type FieldErrors<T> = Partial<Record<keyof T, string[]>>;

/** Filter operator types for advanced filtering. */
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'between' | 'is_null' | 'is_not_null';

/** A single filter condition. */
export interface FilterCondition {
  readonly field: string;
  readonly operator: FilterOperator;
  readonly value: unknown;
}

/** Sort configuration for list queries. */
export interface SortConfig<TField extends string = string> {
  readonly field: TField;
  readonly direction: SortDirection;
}

/** Date range for period-based queries. */
export interface DateRange {
  readonly from: string; // ISO YYYY-MM-DD
  readonly to: string;   // ISO YYYY-MM-DD
}

/** A month-year identifier used throughout the app for period references. */
export interface MonthYear {
  readonly year: number;
  readonly month: number;
}

/** Converts a MonthYear to a display label — e.g. "May 2024". */
export function formatMonthYear(my: MonthYear): string {
  const date = new Date(my.year, my.month - 1, 1);
  return date.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' });
}

/** Converts a MonthYear to an ISO month string — e.g. "2024-05". */
export function monthYearToIso(my: MonthYear): string {
  return `${my.year}-${String(my.month).padStart(2, '0')}`;
}

/** Converts an ISO month string to a MonthYear. */
export function isoToMonthYear(iso: string): MonthYear {
  const [year, month] = iso.split('-').map(Number);
  return { year, month };
}

/** Format a minor units amount to a display string — e.g. 12500 -> "MYR 125.00". */
export function formatMinorUnits(minor: number, currency: CurrencyCode): string {
  const major = (minor / 100).toFixed(2);
  return `${currency} ${major}`;
}

/** Parse a display string or number input into minor units — e.g. "125.00" -> 12500. */
export function parseToMinorUnits(input: string | number): number {
  if (typeof input === 'number') {
    return Math.round(input * 100);
  }
  const cleaned = input.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

// =============================================================================
// CATEGORY CONSTANTS FOR RUNTIME USE
// =============================================================================

/** All expense categories as a runtime array with typed elements. */
export const EXPENSE_CATEGORY_VALUES: readonly ExpenseCategory[] = EXPENSE_CATEGORIES as readonly ExpenseCategory[];

/** All income categories as a runtime array with typed elements. */
export const INCOME_CATEGORY_VALUES: readonly IncomeCategory[] = INCOME_CATEGORIES as readonly IncomeCategory[];

/** All transaction categories (income + expense) as a runtime array. */
export const ALL_CATEGORIES: readonly TransactionCategory[] = [
  ...EXPENSE_CATEGORY_VALUES,
  ...INCOME_CATEGORY_VALUES,
] as const;

// =============================================================================
// TYPE GUARDS
// =============================================================================

/** Type guard: checks if a value is a valid CurrencyCode. */
export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && CURRENCY_CODES.includes(value as CurrencyCode);
}

/** Type guard: checks if a value is a valid TransactionType. */
export function isTransactionType(value: unknown): value is TransactionType {
  return typeof value === 'string' && TRANSACTION_TYPES.includes(value as TransactionType);
}

/** Type guard: checks if a value is a valid TransactionStatus. */
export function isTransactionStatus(value: unknown): value is TransactionStatus {
  return typeof value === 'string' && TRANSACTION_STATUSES.includes(value as TransactionStatus);
}

/** Type guard: checks if a value is a valid BillingCycle. */
export function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === 'string' && BILLING_CYCLES.includes(value as BillingCycle);
}

/** Type guard: checks if a value is a valid SubscriptionStatus. */
export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return typeof value === 'string' && SUBSCRIPTION_STATUSES.includes(value as SubscriptionStatus);
}

/** Type guard: checks if a value is a valid ProjectStatus. */
export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === 'string' && PROJECT_STATUSES.includes(value as ProjectStatus);
}

/** Type guard: checks if a value is a valid ReminderType. */
export function isReminderType(value: unknown): value is ReminderType {
  return typeof value === 'string' && REMINDER_TYPES.includes(value as ReminderType);
}

/** Type guard: checks if a value is a valid ReminderChannel. */
export function isReminderChannel(value: unknown): value is ReminderChannel {
  return typeof value === 'string' && REMINDER_CHANNELS.includes(value as ReminderChannel);
}

/** Type guard: checks if a value is a valid ReminderStatus. */
export function isReminderStatus(value: unknown): value is ReminderStatus {
  return typeof value === 'string' && REMINDER_STATUSES.includes(value as ReminderStatus);
}

/** Type guard: checks if a value is a valid FileSource. */
export function isFileSource(value: unknown): value is FileSource {
  return typeof value === 'string' && FILE_SOURCES.includes(value as FileSource);
}

/** Type guard: checks if a value is a valid ExtractionModel. */
export function isExtractionModel(value: unknown): value is ExtractionModel {
  return typeof value === 'string' && EXTRACTION_MODELS.includes(value as ExtractionModel);
}

/** Type guard: checks if a value is a valid FXPreference. */
export function isFXPreference(value: unknown): value is FXPreference {
  return typeof value === 'string' && FX_PREFERENCES.includes(value as FXPreference);
}

/** Type guard: checks if a value is a valid TaxReserveStrategy. */
export function isTaxReserveStrategy(value: unknown): value is TaxReserveStrategy {
  return typeof value === 'string' && TAX_RESERVE_STRATEGIES.includes(value as TaxReserveStrategy);
}

/** Type guard: checks if a value is a valid AcceptedMimeType. */
export function isAcceptedMimeType(value: unknown): value is AcceptedMimeType {
  return typeof value === 'string' && ACCEPTED_MIME_TYPES.includes(value as AcceptedMimeType);
}

// =============================================================================
// EMPTY/NULL OBJECT CONSTANTS (for form initialisation)
// =============================================================================

/** Empty transaction for form initialisation — all fields set to null/empty/defaults. */
export const EMPTY_TRANSACTION: Nullable<Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'period_status' | 'reference_code' | 'closed_at'>> = {
  entity_id: null,
  type: null,
  amount_minor: null,
  currency: null,
  myr_equiv_minor: null,
  fx_rate: null,
  occurred_at: null,
  vendor: null,
  category: null,
  subcategory: null,
  description: null,
  notes: null,
  tags: null,
  status: null,
  subscription_id: null,
  project_id: null,
  file_id: null,
  refund_of_transaction_id: null,
};

/** Empty subscription for form initialisation. */
export const EMPTY_SUBSCRIPTION: Nullable<Omit<Subscription, 'id' | 'created_at' | 'updated_at'>> = {
  entity_id: null,
  name: null,
  vendor: null,
  plan: null,
  category: null,
  subcategory: null,
  amount_minor: null,
  currency: null,
  billing_cycle: null,
  start_date: null,
  trial_end_date: null,
  next_payment_at: null,
  last_paid_at: null,
  renewal_date: null,
  end_date: null,
  payment_method: null,
  status: null,
  reminder_offsets: null,
  reminder_channels: null,
  is_stack_radar: null,
  notes: null,
  billing_url: null,
  auto_renew: null,
};

/** Empty project for form initialisation. */
export const EMPTY_PROJECT: Nullable<Omit<Project, 'id' | 'created_at' | 'updated_at'>> = {
  entity_id: null,
  name: null,
  client: null,
  total_value_minor: null,
  currency: null,
  payment_schedule_note: null,
  status: null,
  quoted_at: null,
  deposit_received_at: null,
  started_at: null,
  delivered_at: null,
  fully_paid_at: null,
  cancelled_at: null,
  notes: null,
  tags: null,
};

// =============================================================================
// EXPORT SANITY CHECK
// =============================================================================

/** Total number of named exports from this file (approximate count for verification). */
export const TYPE_CONTRACT_VERSION = '1.0.0';

/** Last updated timestamp for this type contract. */
export const TYPE_CONTRACT_DATE = '2025-01-15';

// =============================================================================
// END OF TYPE CONTRACT
// =============================================================================
