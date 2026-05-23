/**
 * JK Zentra Finance Cockpit — Supabase Database Types
 * Generated from schema.sql — Sprint 1 Migration
 *
 * This file is the TypeScript contract for the Supabase client.
 * Every table, column, CHECK constraint, and default value
 * mirrors the PostgreSQL schema EXACTLY.
 */

// ----------------------------------------------------------------------------
// Json helper type
// ----------------------------------------------------------------------------
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ----------------------------------------------------------------------------
// CHECK constraint literal unions
// ----------------------------------------------------------------------------

/** Transaction type — determines how the transaction is treated in P&L and tax calculations. */
export type TransactionType =
  | 'income'
  | 'expense'
  | 'tax_prepayment'
  | 'tax_payment_final'
  | 'tax_reserve_transfer'

/** Transaction row status — pending_review is the draft state, active is confirmed, archived is soft-delete. */
export type TransactionStatus = 'pending_review' | 'active' | 'archived'

/** Bookkeeping period lock — open allows editing, closed freezes the transaction. */
export type PeriodStatus = 'open' | 'closed'

/** Billing cycle for subscriptions. */
export type BillingCycle = 'monthly' | 'yearly' | 'quarterly' | 'trial' | 'one_time'

/** Subscription lifecycle status. */
export type SubscriptionStatus =
  | 'active'
  | 'trial'
  | 'cancelled'
  | 'paused'
  | 'expired'
  | 'archived'

/** Project lifecycle status from quote through closure. */
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
  | 'closed_short_paid'
  | 'archived'

/** What kind of event triggered the reminder. */
export type ReminderType =
  | 'subscription_renewal'
  | 'cp500_instalment'
  | 'tax_position_check'
  | 'tax_reserve_transfer'
  | 'year_end_planning'

/** Category of the object referenced by a reminder (polymorphic, no FK). */
export type ReminderRefType = 'subscription' | 'cp500_schedule' | 'system'

/** Delivery channel for reminders. */
export type ReminderChannel = 'in_app' | 'email' | 'gcal'

/** Reminder lifecycle status. */
export type ReminderStatus = 'pending' | 'sent' | 'dismissed' | 'failed' | 'archived'

/** Audit log action type — captures every mutation and special lifecycle events. */
export type AuditAction =
  | 'create'
  | 'update'
  | 'soft_delete'
  | 'month_reopen'
  | 'month_reclose'

/** Upload source for files. */
export type FileSource = 'web' | 'mobile' | 'email'

/** Entity display name — constrained to the two seeded entities. */
export type EntityName = 'Personal' | 'JK Zentra'

/** Entity URL-safe slug — constrained to the two seeded entities. */
export type EntitySlug = 'personal' | 'jk-zentra'

// ----------------------------------------------------------------------------
// Database interface
// ----------------------------------------------------------------------------
export interface Database {
  public: {
    /**
     * ===================================================================
     * TABLES (10)
     * ===================================================================
     */
    Tables: {
      /**
       * Extends Supabase Auth with app-specific profile and settings.
       */
      users: {
        Row: {
          /** References auth.users(id). Cascade delete when auth user is removed. */
          id: string
          /** User-friendly display name shown in the UI. */
          display_name: string | null
          /** JSONB settings: default_entity_id, tax_year_start, effective_tax_rate_percent, lhdn_forecast_income_minor, cp500_schedule, tax_reserve_strategy, cp502_threshold_percent, reminder_channels, google_calendar_connected, gcal_refresh_token, gcal_calendar_id, fx_preference, monthly_ai_cost_cap_minor (default 50000 = $5.00). */
          settings: Json
          /** Timestamp when the profile row was created. */
          created_at: string
          /** Timestamp when the profile row was last updated. */
          updated_at: string
        }
        Insert: {
          /** References auth.users(id). Cascade delete when auth user is removed. */
          id: string
          /** User-friendly display name shown in the UI. */
          display_name?: string | null
          /** JSONB settings: default_entity_id, tax_year_start, effective_tax_rate_percent, lhdn_forecast_income_minor, cp500_schedule, tax_reserve_strategy, cp502_threshold_percent, reminder_channels, google_calendar_connected, gcal_refresh_token, gcal_calendar_id, fx_preference, monthly_ai_cost_cap_minor (default 50000 = $5.00). */
          settings?: Json
          /** Timestamp when the profile row was created. */
          created_at?: string
          /** Timestamp when the profile row was last updated. */
          updated_at?: string
        }
        Update: {
          /** References auth.users(id). Cascade delete when auth user is removed. */
          id?: string
          /** User-friendly display name shown in the UI. */
          display_name?: string | null
          /** JSONB settings: default_entity_id, tax_year_start, effective_tax_rate_percent, lhdn_forecast_income_minor, cp500_schedule, tax_reserve_strategy, cp502_threshold_percent, reminder_channels, google_calendar_connected, gcal_refresh_token, gcal_calendar_id, fx_preference, monthly_ai_cost_cap_minor (default 50000 = $5.00). */
          settings?: Json
          /** Timestamp when the profile row was created. */
          created_at?: string
          /** Timestamp when the profile row was last updated. */
          updated_at?: string
        }
        Relationships: []
      }

      /**
       * Business entities: Personal and JK Zentra. Every transaction, subscription, project, etc. belongs to one entity.
       */
      entities: {
        Row: {
          /** Auto-generated UUID. */
          id: string
          /** Display name. Must be 'Personal' or 'JK Zentra'. */
          name: EntityName
          /** URL-safe slug. Must be 'personal' or 'jk-zentra'. Unique. */
          slug: EntitySlug
          /** Default currency for this entity (MYR for Personal, MYR for JK Zentra). */
          default_currency: string
          /** Hex colour code for UI theming. */
          color: string
          /** Whether this entity is subject to income tax reporting. */
          is_taxable: boolean
          /** Record creation timestamp. */
          created_at: string
          /** Record last-update timestamp. */
          updated_at: string
        }
        Insert: {
          /** Auto-generated UUID. */
          id?: string
          /** Display name. Must be 'Personal' or 'JK Zentra'. */
          name: EntityName
          /** URL-safe slug. Must be 'personal' or 'jk-zentra'. Unique. */
          slug: EntitySlug
          /** Default currency for this entity (MYR for Personal, MYR for JK Zentra). */
          default_currency?: string
          /** Hex colour code for UI theming. */
          color?: string
          /** Whether this entity is subject to income tax reporting. */
          is_taxable?: boolean
          /** Record creation timestamp. */
          created_at?: string
          /** Record last-update timestamp. */
          updated_at?: string
        }
        Update: {
          /** Auto-generated UUID. */
          id?: string
          /** Display name. Must be 'Personal' or 'JK Zentra'. */
          name?: EntityName
          /** URL-safe slug. Must be 'personal' or 'jk-zentra'. Unique. */
          slug?: EntitySlug
          /** Default currency for this entity (MYR for Personal, MYR for JK Zentra). */
          default_currency?: string
          /** Hex colour code for UI theming. */
          color?: string
          /** Whether this entity is subject to income tax reporting. */
          is_taxable?: boolean
          /** Record creation timestamp. */
          created_at?: string
          /** Record last-update timestamp. */
          updated_at?: string
        }
        Relationships: []
      }

      /**
       * Recurring subscriptions and one-time tool purchases tracked by the Stack Radar.
       */
      subscriptions: {
        Row: {
          /** Auto-generated UUID. */
          id: string
          /** Owning entity (FK → entities). */
          entity_id: string
          /** Subscription or product name (e.g. 'Supabase Pro'). */
          name: string
          /** Vendor or provider name (e.g. 'OpenAI'). */
          vendor: string
          /** Plan tier (e.g. 'Pro', 'Team'). Nullable. */
          plan: string | null
          /** Business category (e.g. 'Infrastructure', 'Design Tools'). */
          category: string
          /** Cost in minor currency units (sen/cents). INTEGER, never float. >= 0. */
          amount_minor: number
          /** Currency code (MYR, USD, etc.). */
          currency: string
          /** One of: monthly, yearly, quarterly, trial, one_time. */
          billing_cycle: BillingCycle
          /** Date the subscription started or was purchased. */
          start_date: string
          /** End date of trial period, if applicable. */
          trial_end_date: string | null
          /** Expected date of next billing cycle payment. */
          next_payment_at: string | null
          /** Date of most recent successful payment. */
          last_paid_at: string | null
          /** Annual or next major renewal date. */
          renewal_date: string | null
          /** Date the subscription ends or was cancelled. */
          end_date: string | null
          /** Payment method used (e.g. 'Credit Card', 'PayPal'). */
          payment_method: string | null
          /** One of: active, trial, cancelled, paused, expired. */
          status: SubscriptionStatus
          /** Array of days before renewal to trigger reminders. Default {7,3,1,0}. */
          reminder_offsets: number[]
          /** Array of reminder delivery channels. Default {in_app}. */
          reminder_channels: string[]
          /** Whether this subscription appears on the Stack Radar dashboard. */
          is_stack_radar: boolean
          /** Free-text notes. */
          notes: string | null
          /** Record creation timestamp. */
          created_at: string
          /** Record last-update timestamp. */
          updated_at: string
        }
        Insert: {
          /** Auto-generated UUID. */
          id?: string
          /** Owning entity (FK → entities). */
          entity_id: string
          /** Subscription or product name (e.g. 'Supabase Pro'). */
          name: string
          /** Vendor or provider name (e.g. 'OpenAI'). */
          vendor: string
          /** Plan tier (e.g. 'Pro', 'Team'). Nullable. */
          plan?: string | null
          /** Business category (e.g. 'Infrastructure', 'Design Tools'). */
          category: string
          /** Cost in minor currency units (sen/cents). INTEGER, never float. >= 0. */
          amount_minor: number
          /** Currency code (MYR, USD, etc.). */
          currency: string
          /** One of: monthly, yearly, quarterly, trial, one_time. */
          billing_cycle: BillingCycle
          /** Date the subscription started or was purchased. */
          start_date: string
          /** End date of trial period, if applicable. */
          trial_end_date?: string | null
          /** Expected date of next billing cycle payment. */
          next_payment_at?: string | null
          /** Date of most recent successful payment. */
          last_paid_at?: string | null
          /** Annual or next major renewal date. */
          renewal_date?: string | null
          /** Date the subscription ends or was cancelled. */
          end_date?: string | null
          /** Payment method used (e.g. 'Credit Card', 'PayPal'). */
          payment_method?: string | null
          /** One of: active, trial, cancelled, paused, expired. */
          status?: SubscriptionStatus
          /** Array of days before renewal to trigger reminders. Default {7,3,1,0}. */
          reminder_offsets?: number[]
          /** Array of reminder delivery channels. Default {in_app}. */
          reminder_channels?: string[]
          /** Whether this subscription appears on the Stack Radar dashboard. */
          is_stack_radar?: boolean
          /** Free-text notes. */
          notes?: string | null
          /** Record creation timestamp. */
          created_at?: string
          /** Record last-update timestamp. */
          updated_at?: string
        }
        Update: {
          /** Auto-generated UUID. */
          id?: string
          /** Owning entity (FK → entities). */
          entity_id?: string
          /** Subscription or product name (e.g. 'Supabase Pro'). */
          name?: string
          /** Vendor or provider name (e.g. 'OpenAI'). */
          vendor?: string
          /** Plan tier (e.g. 'Pro', 'Team'). Nullable. */
          plan?: string | null
          /** Business category (e.g. 'Infrastructure', 'Design Tools'). */
          category?: string
          /** Cost in minor currency units (sen/cents). INTEGER, never float. >= 0. */
          amount_minor?: number
          /** Currency code (MYR, USD, etc.). */
          currency?: string
          /** One of: monthly, yearly, quarterly, trial, one_time. */
          billing_cycle?: BillingCycle
          /** Date the subscription started or was purchased. */
          start_date?: string
          /** End date of trial period, if applicable. */
          trial_end_date?: string | null
          /** Expected date of next billing cycle payment. */
          next_payment_at?: string | null
          /** Date of most recent successful payment. */
          last_paid_at?: string | null
          /** Annual or next major renewal date. */
          renewal_date?: string | null
          /** Date the subscription ends or was cancelled. */
          end_date?: string | null
          /** Payment method used (e.g. 'Credit Card', 'PayPal'). */
          payment_method?: string | null
          /** One of: active, trial, cancelled, paused, expired. */
          status?: SubscriptionStatus
          /** Array of days before renewal to trigger reminders. Default {7,3,1,0}. */
          reminder_offsets?: number[]
          /** Array of reminder delivery channels. Default {in_app}. */
          reminder_channels?: string[]
          /** Whether this subscription appears on the Stack Radar dashboard. */
          is_stack_radar?: boolean
          /** Free-text notes. */
          notes?: string | null
          /** Record creation timestamp. */
          created_at?: string
          /** Record last-update timestamp. */
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_entity_id_fkey'
            columns: ['entity_id']
            isOneToOne: false
            referencedRelation: 'entities'
            referencedColumns: ['id']
          }
        ]
      }

      /**
       * Client projects with full lifecycle tracking from quote to closure.
       */
      projects: {
        Row: {
          /** Auto-generated UUID. */
          id: string
          /** Owning entity (FK → entities). */
          entity_id: string
          /** Project name or identifier. */
          name: string
          /** Client name or identifier. */
          client: string
          /** Total quoted / contract value in minor currency units. INTEGER >= 0. */
          total_value_minor: number
          /** Currency code for project value. */
          currency: string
          /** Free-text description of payment terms and milestones. */
          payment_schedule_note: string | null
          /** One of: quoted, deposit_received, in_progress, delivered, fully_paid, disputed, cancelled, cancelled_with_deposit_kept, cancelled_partial, closed_short_paid. */
          status: ProjectStatus
          /** Project start date. */
          start_date: string
          /** Expected completion / delivery date. */
          expected_delivery_date: string | null
          /** Actual date of delivery. */
          actual_delivery_date: string | null
          /** Date the project was fully closed. */
          closed_date: string | null
          /** Free-text notes. */
          notes: string | null
          /** Record creation timestamp. */
          created_at: string
          /** Record last-update timestamp. */
          updated_at: string
        }
        Insert: {
          /** Auto-generated UUID. */
          id?: string
          /** Owning entity (FK → entities). */
          entity_id: string
          /** Project name or identifier. */
          name: string
          /** Client name or identifier. */
          client: string
          /** Total quoted / contract value in minor currency units. INTEGER >= 0. */
          total_value_minor: number
          /** Currency code for project value. */
          currency: string
          /** Free-text description of payment terms and milestones. */
          payment_schedule_note?: string | null
          /** One of: quoted, deposit_received, in_progress, delivered, fully_paid, disputed, cancelled, cancelled_with_deposit_kept, cancelled_partial, closed_short_paid. */
          status?: ProjectStatus
          /** Project start date. */
          start_date: string
          /** Expected completion / delivery date. */
          expected_delivery_date?: string | null
          /** Actual date of delivery. */
          actual_delivery_date?: string | null
          /** Date the project was fully closed. */
          closed_date?: string | null
          /** Free-text notes. */
          notes?: string | null
          /** Record creation timestamp. */
          created_at?: string
          /** Record last-update timestamp. */
          updated_at?: string
        }
        Update: {
          /** Auto-generated UUID. */
          id?: string
          /** Owning entity (FK → entities). */
          entity_id?: string
          /** Project name or identifier. */
          name?: string
          /** Client name or identifier. */
          client?: string
          /** Total quoted / contract value in minor currency units. INTEGER >= 0. */
          total_value_minor?: number
          /** Currency code for project value. */
          currency?: string
          /** Free-text description of payment terms and milestones. */
          payment_schedule_note?: string | null
          /** One of: quoted, deposit_received, in_progress, delivered, fully_paid, disputed, cancelled, cancelled_with_deposit_kept, cancelled_partial, closed_short_paid. */
          status?: ProjectStatus
          /** Project start date. */
          start_date?: string
          /** Expected completion / delivery date. */
          expected_delivery_date?: string | null
          /** Actual date of delivery. */
          actual_delivery_date?: string | null
          /** Date the project was fully closed. */
          closed_date?: string | null
          /** Free-text notes. */
          notes?: string | null
          /** Record creation timestamp. */
          created_at?: string
          /** Record last-update timestamp. */
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'projects_entity_id_fkey'
            columns: ['entity_id']
            isOneToOne: false
            referencedRelation: 'entities'
            referencedColumns: ['id']
          }
        ]
      }

      /**
       * Uploaded files: receipts, invoices, close packs, attachments. Storage path points to Supabase Storage.
       */
      files: {
        Row: {
          /** Auto-generated UUID. */
          id: string
          /** Full path in Supabase Storage bucket. Unique. */
          storage_path: string
          /** Original filename as uploaded by user. */
          original_filename: string
          /** User-editable display / friendly filename. */
          display_filename: string | null
          /** MIME type of the file (e.g. application/pdf). */
          mime_type: string
          /** File size in bytes. INTEGER >= 0. */
          size_bytes: number
          /** SHA-256 hash for deduplication and integrity. Unique. */
          sha256_hash: string
          /** Upload source: web, mobile, or email. */
          source: FileSource
          /** Optional owning entity. NULL for unfiled uploads. */
          entity_id: string | null
          /** Timestamp when the file was uploaded. */
          uploaded_at: string
          /** Record creation timestamp. */
          created_at: string
          /** Record last-update timestamp. */
          updated_at: string
        }
        Insert: {
          /** Auto-generated UUID. */
          id?: string
          /** Full path in Supabase Storage bucket. Unique. */
          storage_path: string
          /** Original filename as uploaded by user. */
          original_filename: string
          /** User-editable display / friendly filename. */
          display_filename?: string | null
          /** MIME type of the file (e.g. application/pdf). */
          mime_type: string
          /** File size in bytes. INTEGER >= 0. */
          size_bytes: number
          /** SHA-256 hash for deduplication and integrity. Unique. */
          sha256_hash: string
          /** Upload source: web, mobile, or email. */
          source?: FileSource
          /** Optional owning entity. NULL for unfiled uploads. */
          entity_id?: string | null
          /** Timestamp when the file was uploaded. */
          uploaded_at?: string
          /** Record creation timestamp. */
          created_at?: string
          /** Record last-update timestamp. */
          updated_at?: string
        }
        Update: {
          /** Auto-generated UUID. */
          id?: string
          /** Full path in Supabase Storage bucket. Unique. */
          storage_path?: string
          /** Original filename as uploaded by user. */
          original_filename?: string
          /** User-editable display / friendly filename. */
          display_filename?: string | null
          /** MIME type of the file (e.g. application/pdf). */
          mime_type?: string
          /** File size in bytes. INTEGER >= 0. */
          size_bytes?: number
          /** SHA-256 hash for deduplication and integrity. Unique. */
          sha256_hash?: string
          /** Upload source: web, mobile, or email. */
          source?: FileSource
          /** Optional owning entity. NULL for unfiled uploads. */
          entity_id?: string | null
          /** Timestamp when the file was uploaded. */
          uploaded_at?: string
          /** Record creation timestamp. */
          created_at?: string
          /** Record last-update timestamp. */
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'files_entity_id_fkey'
            columns: ['entity_id']
            isOneToOne: false
            referencedRelation: 'entities'
            referencedColumns: ['id']
          }
        ]
      }

      /**
       * CORE financial ledger. Cash basis. Every income, expense, and tax movement is recorded here.
       */
      transactions: {
        Row: {
          /** Auto-generated UUID. */
          id: string
          /** Owning entity (FK → entities). */
          entity_id: string
          /** Transaction type: income, expense, tax_prepayment, tax_payment_final, tax_reserve_transfer. */
          type: TransactionType
          /** Transaction amount in minor currency units (sen/cents). INTEGER >= 0. NEVER FLOAT. */
          amount_minor: number
          /** Transaction currency code (MYR, USD). */
          currency: string
          /** Equivalent value in MYR minor units (sen). Populated for multi-currency reporting. INTEGER >= 0. */
          myr_equiv_minor: number | null
          /** Foreign exchange rate used for MYR conversion. DECIMAL(10,6). */
          fx_rate: number | null
          /** Date the transaction occurred (cash basis date). */
          occurred_at: string
          /** Counterparty name (e.g. 'OpenAI', 'Client ABC'). */
          vendor: string
          /** Primary category for P&L grouping (e.g. 'Software', 'Services Income'). */
          category: string
          /** Secondary categorisation (e.g. 'AI/ML', 'Web Design'). */
          subcategory: string | null
          /** Brief description of the transaction. */
          description: string | null
          /** Internal notes. */
          notes: string | null
          /** Array of tags for flexible filtering. GIN indexed. */
          tags: string[]
          /** Row status: pending_review, active, archived (soft delete). */
          status: TransactionStatus
          /** Bookkeeping period lock: open (editable) or closed (locked). */
          period_status: PeriodStatus
          /** External reference (invoice number, receipt ID, etc.). */
          reference_code: string | null
          /** Timestamp when this transaction was reconciled / closed. */
          closed_at: string | null
          /** Links to a subscription if this is a subscription payment. FK → subscriptions, SET NULL on delete. */
          subscription_id: string | null
          /** Links to a project if this is project-related. FK → projects, SET NULL on delete. */
          project_id: string | null
          /** Links to an uploaded receipt/invoice file. FK → files, SET NULL on delete. */
          file_id: string | null
          /** Self-referencing FK: this transaction is a refund of the referenced transaction. SET NULL on delete. */
          refund_of_transaction_id: string | null
          /** Record creation timestamp. */
          created_at: string
          /** Record last-update timestamp. */
          updated_at: string
        }
        Insert: {
          /** Auto-generated UUID. */
          id?: string
          /** Owning entity (FK → entities). */
          entity_id: string
          /** Transaction type: income, expense, tax_prepayment, tax_payment_final, tax_reserve_transfer. */
          type: TransactionType
          /** Transaction amount in minor currency units (sen/cents). INTEGER >= 0. NEVER FLOAT. */
          amount_minor: number
          /** Transaction currency code (MYR, USD). */
          currency: string
          /** Equivalent value in MYR minor units (sen). Populated for multi-currency reporting. INTEGER >= 0. */
          myr_equiv_minor?: number | null
          /** Foreign exchange rate used for MYR conversion. DECIMAL(10,6). */
          fx_rate?: number | null
          /** Date the transaction occurred (cash basis date). */
          occurred_at: string
          /** Counterparty name (e.g. 'OpenAI', 'Client ABC'). */
          vendor: string
          /** Primary category for P&L grouping (e.g. 'Software', 'Services Income'). */
          category: string
          /** Secondary categorisation (e.g. 'AI/ML', 'Web Design'). */
          subcategory?: string | null
          /** Brief description of the transaction. */
          description?: string | null
          /** Internal notes. */
          notes?: string | null
          /** Array of tags for flexible filtering. GIN indexed. */
          tags?: string[]
          /** Row status: pending_review, active, archived (soft delete). */
          status?: TransactionStatus
          /** Bookkeeping period lock: open (editable) or closed (locked). */
          period_status?: PeriodStatus
          /** External reference (invoice number, receipt ID, etc.). */
          reference_code?: string | null
          /** Timestamp when this transaction was reconciled / closed. */
          closed_at?: string | null
          /** Links to a subscription if this is a subscription payment. FK → subscriptions, SET NULL on delete. */
          subscription_id?: string | null
          /** Links to a project if this is project-related. FK → projects, SET NULL on delete. */
          project_id?: string | null
          /** Links to an uploaded receipt/invoice file. FK → files, SET NULL on delete. */
          file_id?: string | null
          /** Self-referencing FK: this transaction is a refund of the referenced transaction. SET NULL on delete. */
          refund_of_transaction_id?: string | null
          /** Record creation timestamp. */
          created_at?: string
          /** Record last-update timestamp. */
          updated_at?: string
        }
        Update: {
          /** Auto-generated UUID. */
          id?: string
          /** Owning entity (FK → entities). */
          entity_id?: string
          /** Transaction type: income, expense, tax_prepayment, tax_payment_final, tax_reserve_transfer. */
          type?: TransactionType
          /** Transaction amount in minor currency units (sen/cents). INTEGER >= 0. NEVER FLOAT. */
          amount_minor?: number
          /** Transaction currency code (MYR, USD). */
          currency?: string
          /** Equivalent value in MYR minor units (sen). Populated for multi-currency reporting. INTEGER >= 0. */
          myr_equiv_minor?: number | null
          /** Foreign exchange rate used for MYR conversion. DECIMAL(10,6). */
          fx_rate?: number | null
          /** Date the transaction occurred (cash basis date). */
          occurred_at?: string
          /** Counterparty name (e.g. 'OpenAI', 'Client ABC'). */
          vendor?: string
          /** Primary category for P&L grouping (e.g. 'Software', 'Services Income'). */
          category?: string
          /** Secondary categorisation (e.g. 'AI/ML', 'Web Design'). */
          subcategory?: string | null
          /** Brief description of the transaction. */
          description?: string | null
          /** Internal notes. */
          notes?: string | null
          /** Array of tags for flexible filtering. GIN indexed. */
          tags?: string[]
          /** Row status: pending_review, active, archived (soft delete). */
          status?: TransactionStatus
          /** Bookkeeping period lock: open (editable) or closed (locked). */
          period_status?: PeriodStatus
          /** External reference (invoice number, receipt ID, etc.). */
          reference_code?: string | null
          /** Timestamp when this transaction was reconciled / closed. */
          closed_at?: string | null
          /** Links to a subscription if this is a subscription payment. FK → subscriptions, SET NULL on delete. */
          subscription_id?: string | null
          /** Links to a project if this is project-related. FK → projects, SET NULL on delete. */
          project_id?: string | null
          /** Links to an uploaded receipt/invoice file. FK → files, SET NULL on delete. */
          file_id?: string | null
          /** Self-referencing FK: this transaction is a refund of the referenced transaction. SET NULL on delete. */
          refund_of_transaction_id?: string | null
          /** Record creation timestamp. */
          created_at?: string
          /** Record last-update timestamp. */
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'transactions_entity_id_fkey'
            columns: ['entity_id']
            isOneToOne: false
            referencedRelation: 'entities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transactions_subscription_id_fkey'
            columns: ['subscription_id']
            isOneToOne: false
            referencedRelation: 'subscriptions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transactions_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transactions_file_id_fkey'
            columns: ['file_id']
            isOneToOne: false
            referencedRelation: 'files'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transactions_refund_of_transaction_id_fkey'
            columns: ['refund_of_transaction_id']
            isOneToOne: false
            referencedRelation: 'transactions'
            referencedColumns: ['id']
          }
        ]
      }

      /**
       * AI OCR extraction results for uploaded files. One extraction per file.
       */
      extractions: {
        Row: {
          /** Auto-generated UUID. */
          id: string
          /** Linked file (FK → files). CASCADE delete. Unique — one extraction per file. */
          file_id: string
          /** Name/identifier of the AI model used (e.g. 'gpt-4o-2024-08'). */
          model_used: string
          /** Raw JSON response from the AI model. */
          raw_response: Json | null
          /** Structured extracted fields (vendor, amount, date, etc.). */
          extracted_fields: Json | null
          /** Per-field confidence scores (0.0–1.0). */
          confidence_scores: Json | null
          /** Whether a human has reviewed and corrected the extraction. */
          manually_corrected: boolean
          /** Time taken to process the file in milliseconds. INTEGER >= 0. */
          processing_time_ms: number | null
          /** Record creation timestamp. */
          created_at: string
          /** Record last-update timestamp. */
          updated_at: string
        }
        Insert: {
          /** Auto-generated UUID. */
          id?: string
          /** Linked file (FK → files). CASCADE delete. Unique — one extraction per file. */
          file_id: string
          /** Name/identifier of the AI model used (e.g. 'gpt-4o-2024-08'). */
          model_used: string
          /** Raw JSON response from the AI model. */
          raw_response?: Json | null
          /** Structured extracted fields (vendor, amount, date, etc.). */
          extracted_fields?: Json | null
          /** Per-field confidence scores (0.0–1.0). */
          confidence_scores?: Json | null
          /** Whether a human has reviewed and corrected the extraction. */
          manually_corrected?: boolean
          /** Time taken to process the file in milliseconds. INTEGER >= 0. */
          processing_time_ms?: number | null
          /** Record creation timestamp. */
          created_at?: string
          /** Record last-update timestamp. */
          updated_at?: string
        }
        Update: {
          /** Auto-generated UUID. */
          id?: string
          /** Linked file (FK → files). CASCADE delete. Unique — one extraction per file. */
          file_id?: string
          /** Name/identifier of the AI model used (e.g. 'gpt-4o-2024-08'). */
          model_used?: string
          /** Raw JSON response from the AI model. */
          raw_response?: Json | null
          /** Structured extracted fields (vendor, amount, date, etc.). */
          extracted_fields?: Json | null
          /** Per-field confidence scores (0.0–1.0). */
          confidence_scores?: Json | null
          /** Whether a human has reviewed and corrected the extraction. */
          manually_corrected?: boolean
          /** Time taken to process the file in milliseconds. INTEGER >= 0. */
          processing_time_ms?: number | null
          /** Record creation timestamp. */
          created_at?: string
          /** Record last-update timestamp. */
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'extractions_file_id_fkey'
            columns: ['file_id']
            isOneToOne: true
            referencedRelation: 'files'
            referencedColumns: ['id']
          }
        ]
      }

      /**
       * Notification and calendar reminders for subscriptions, tax instalments, and planning events.
       */
      reminders: {
        Row: {
          /** Auto-generated UUID. */
          id: string
          /** Type of reminder: subscription_renewal, cp500_instalment, tax_position_check, tax_reserve_transfer, year_end_planning. */
          reminder_type: ReminderType
          /** Type of referenced object: subscription, cp500_schedule, system. */
          ref_type: ReminderRefType
          /** UUID of the referenced object. Polymorphic — interpreted with ref_type. No FK constraint. */
          ref_id: string | null
          /** UTC timestamp when the reminder should fire. */
          trigger_at: string
          /** Number of days before the event date this reminder was created for. */
          offset_days: number
          /** Delivery channel: in_app, email, or gcal. */
          channel: ReminderChannel
          /** Reminder status: pending, sent, dismissed, failed. */
          status: ReminderStatus
          /** Short title shown to the user. */
          title: string
          /** Detailed reminder message body. */
          body: string | null
          /** Google Calendar event ID if synced to Google Calendar. */
          gcal_event_id: string | null
          /** Timestamp when the reminder was actually sent. */
          sent_at: string | null
          /** Timestamp when the user dismissed the reminder. */
          dismissed_at: string | null
          /** Record creation timestamp. */
          created_at: string
          /** Record last-update timestamp. */
          updated_at: string
        }
        Insert: {
          /** Auto-generated UUID. */
          id?: string
          /** Type of reminder: subscription_renewal, cp500_instalment, tax_position_check, tax_reserve_transfer, year_end_planning. */
          reminder_type: ReminderType
          /** Type of referenced object: subscription, cp500_schedule, system. */
          ref_type: ReminderRefType
          /** UUID of the referenced object. Polymorphic — interpreted with ref_type. No FK constraint. */
          ref_id?: string | null
          /** UTC timestamp when the reminder should fire. */
          trigger_at: string
          /** Number of days before the event date this reminder was created for. */
          offset_days: number
          /** Delivery channel: in_app, email, or gcal. */
          channel?: ReminderChannel
          /** Reminder status: pending, sent, dismissed, failed. */
          status?: ReminderStatus
          /** Short title shown to the user. */
          title: string
          /** Detailed reminder message body. */
          body?: string | null
          /** Google Calendar event ID if synced to Google Calendar. */
          gcal_event_id?: string | null
          /** Timestamp when the reminder was actually sent. */
          sent_at?: string | null
          /** Timestamp when the user dismissed the reminder. */
          dismissed_at?: string | null
          /** Record creation timestamp. */
          created_at?: string
          /** Record last-update timestamp. */
          updated_at?: string
        }
        Update: {
          /** Auto-generated UUID. */
          id?: string
          /** Type of reminder: subscription_renewal, cp500_instalment, tax_position_check, tax_reserve_transfer, year_end_planning. */
          reminder_type?: ReminderType
          /** Type of referenced object: subscription, cp500_schedule, system. */
          ref_type?: ReminderRefType
          /** UUID of the referenced object. Polymorphic — interpreted with ref_type. No FK constraint. */
          ref_id?: string | null
          /** UTC timestamp when the reminder should fire. */
          trigger_at?: string
          /** Number of days before the event date this reminder was created for. */
          offset_days?: number
          /** Delivery channel: in_app, email, or gcal. */
          channel?: ReminderChannel
          /** Reminder status: pending, sent, dismissed, failed. */
          status?: ReminderStatus
          /** Short title shown to the user. */
          title?: string
          /** Detailed reminder message body. */
          body?: string | null
          /** Google Calendar event ID if synced to Google Calendar. */
          gcal_event_id?: string | null
          /** Timestamp when the reminder was actually sent. */
          sent_at?: string | null
          /** Timestamp when the user dismissed the reminder. */
          dismissed_at?: string | null
          /** Record creation timestamp. */
          created_at?: string
          /** Record last-update timestamp. */
          updated_at?: string
        }
        Relationships: []
      }

      /**
       * Monthly bookkeeping close records. Once closed, transactions in that period are locked (period_status = closed).
       */
      month_closes: {
        Row: {
          /** Auto-generated UUID. */
          id: string
          /** Owning entity (FK → entities). */
          entity_id: string
          /** Calendar year of the close (e.g. 2026). */
          year: number
          /** Calendar month (1–12). */
          month: number
          /** Timestamp when the month was first closed. */
          closed_at: string | null
          /** Timestamp when the month was reopened (null if never reopened). */
          reopened_at: string | null
          /** Reason provided when reopening a closed month. */
          reopen_reason: string | null
          /** Opening bank balance in minor units at month start. */
          opening_balance_minor: number | null
          /** Actual closing bank balance in minor units at month end. */
          closing_balance_minor: number | null
          /** Computed closing balance from transactions (opening + income − expenses). */
          computed_closing_minor: number | null
          /** Difference between actual and computed closing balance. */
          reconciliation_variance_minor: number | null
          /** Explanation for any reconciliation variance. */
          reconciliation_note: string | null
          /** JSONB checklist of close steps completed (e.g. receipts filed, bank reconciled). */
          checklist_results: Json
          /** Reference to the generated close pack PDF (FK → files, SET NULL). */
          pack_file_id: string | null
          /** Reference prefix for the close (e.g. 'MC-2026-06'). */
          reference_prefix: string
          /** Free-text notes for the month close. */
          notes: string | null
          /** Record creation timestamp. */
          created_at: string
          /** Record last-update timestamp. */
          updated_at: string
        }
        Insert: {
          /** Auto-generated UUID. */
          id?: string
          /** Owning entity (FK → entities). */
          entity_id: string
          /** Calendar year of the close (e.g. 2026). */
          year: number
          /** Calendar month (1–12). */
          month: number
          /** Timestamp when the month was first closed. */
          closed_at?: string | null
          /** Timestamp when the month was reopened (null if never reopened). */
          reopened_at?: string | null
          /** Reason provided when reopening a closed month. */
          reopen_reason?: string | null
          /** Opening bank balance in minor units at month start. */
          opening_balance_minor?: number | null
          /** Actual closing bank balance in minor units at month end. */
          closing_balance_minor?: number | null
          /** Computed closing balance from transactions (opening + income − expenses). */
          computed_closing_minor?: number | null
          /** Difference between actual and computed closing balance. */
          reconciliation_variance_minor?: number | null
          /** Explanation for any reconciliation variance. */
          reconciliation_note?: string | null
          /** JSONB checklist of close steps completed (e.g. receipts filed, bank reconciled). */
          checklist_results?: Json
          /** Reference to the generated close pack PDF (FK → files, SET NULL). */
          pack_file_id?: string | null
          /** Reference prefix for the close (e.g. 'MC-2026-06'). */
          reference_prefix: string
          /** Free-text notes for the month close. */
          notes?: string | null
          /** Record creation timestamp. */
          created_at?: string
          /** Record last-update timestamp. */
          updated_at?: string
        }
        Update: {
          /** Auto-generated UUID. */
          id?: string
          /** Owning entity (FK → entities). */
          entity_id?: string
          /** Calendar year of the close (e.g. 2026). */
          year?: number
          /** Calendar month (1–12). */
          month?: number
          /** Timestamp when the month was first closed. */
          closed_at?: string | null
          /** Timestamp when the month was reopened (null if never reopened). */
          reopened_at?: string | null
          /** Reason provided when reopening a closed month. */
          reopen_reason?: string | null
          /** Opening bank balance in minor units at month start. */
          opening_balance_minor?: number | null
          /** Actual closing bank balance in minor units at month end. */
          closing_balance_minor?: number | null
          /** Computed closing balance from transactions (opening + income − expenses). */
          computed_closing_minor?: number | null
          /** Difference between actual and computed closing balance. */
          reconciliation_variance_minor?: number | null
          /** Explanation for any reconciliation variance. */
          reconciliation_note?: string | null
          /** JSONB checklist of close steps completed (e.g. receipts filed, bank reconciled). */
          checklist_results?: Json
          /** Reference to the generated close pack PDF (FK → files, SET NULL). */
          pack_file_id?: string | null
          /** Reference prefix for the close (e.g. 'MC-2026-06'). */
          reference_prefix?: string
          /** Free-text notes for the month close. */
          notes?: string | null
          /** Record creation timestamp. */
          created_at?: string
          /** Record last-update timestamp. */
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'month_closes_entity_id_fkey'
            columns: ['entity_id']
            isOneToOne: false
            referencedRelation: 'entities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'month_closes_pack_file_id_fkey'
            columns: ['pack_file_id']
            isOneToOne: false
            referencedRelation: 'files'
            referencedColumns: ['id']
          }
        ]
      }

      /**
       * Immutable audit trail. Every CREATE, UPDATE, soft-delete, month_reopen, and month_reclose is logged here automatically.
       */
      audit_log: {
        Row: {
          /** Auto-incrementing bigint ID. */
          id: number
          /** Name of the table that was modified (e.g. 'transactions'). */
          entity_type: string
          /** UUID of the specific row that was modified. */
          entity_id: string
          /** Action type: create, update, soft_delete, month_reopen, month_reclose. */
          action: AuditAction
          /** Complete JSONB snapshot of the row before the change. NULL for INSERT. */
          before: Json | null
          /** Complete JSONB snapshot of the row after the change. NULL for DELETE. */
          after: Json | null
          /** JSONB diff showing only changed fields: {field: {from, to}}. */
          change_summary: Json | null
          /** UUID of the user who made the change (from auth.uid()). */
          user_id: string
          /** Client IP address at time of change. */
          ip_address: string | null
          /** Timestamp when the audit entry was created. */
          created_at: string
        }
        Insert: {
          /** Auto-incrementing bigint ID. */
          id?: number
          /** Name of the table that was modified (e.g. 'transactions'). */
          entity_type: string
          /** UUID of the specific row that was modified. */
          entity_id: string
          /** Action type: create, update, soft_delete, month_reopen, month_reclose. */
          action: AuditAction
          /** Complete JSONB snapshot of the row before the change. NULL for INSERT. */
          before?: Json | null
          /** Complete JSONB snapshot of the row after the change. NULL for DELETE. */
          after?: Json | null
          /** JSONB diff showing only changed fields: {field: {from, to}}. */
          change_summary?: Json | null
          /** UUID of the user who made the change (from auth.uid()). */
          user_id: string
          /** Client IP address at time of change. */
          ip_address?: string | null
          /** Timestamp when the audit entry was created. */
          created_at?: string
        }
        Update: {
          /** Auto-incrementing bigint ID. */
          id?: number
          /** Name of the table that was modified (e.g. 'transactions'). */
          entity_type?: string
          /** UUID of the specific row that was modified. */
          entity_id?: string
          /** Action type: create, update, soft_delete, month_reopen, month_reclose. */
          action?: AuditAction
          /** Complete JSONB snapshot of the row before the change. NULL for INSERT. */
          before?: Json | null
          /** Complete JSONB snapshot of the row after the change. NULL for DELETE. */
          after?: Json | null
          /** JSONB diff showing only changed fields: {field: {from, to}}. */
          change_summary?: Json | null
          /** UUID of the user who made the change (from auth.uid()). */
          user_id?: string
          /** Client IP address at time of change. */
          ip_address?: string | null
          /** Timestamp when the audit entry was created. */
          created_at?: string
        }
        Relationships: []
      }
    }

    /**
     * ===================================================================
     * VIEWS (none)
     * ===================================================================
     */
    Views: {
      [_ in never]: never
    }

    /**
     * ===================================================================
     * FUNCTIONS (none)
     * ===================================================================
     */
    Functions: {
      [_ in never]: never
    }

    /**
     * ===================================================================
     * ENUMS (none — we use CHECK constraints)
     * ===================================================================
     */
    Enums: {
      [_ in never]: never
    }

    /**
     * ===================================================================
     * COMPOSITE TYPES (none)
     * ===================================================================
     */
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ============================================================================
// JSONB sub-type helpers — users.settings schema
// ============================================================================

/** One CP500 tax instalment scheduled by LHDN. */
export interface CP500ScheduleItem {
  /** Instalment number (1–6). */
  instalment_no: number
  /** ISO-8601 due date (e.g. '2026-04-30'). */
  due_date: string
  /** Amount due in minor units (sen). */
  amount_minor: number
  /** Optional status tracking (e.g. 'pending', 'paid'). */
  status?: string
  /** Optional payment method used. */
  payment_method?: string
  /** Optional linked receipt file. */
  file_id?: string | null
}

/** Strategy for automatically reserving a percentage of income for tax obligations. */
export interface TaxReserveStrategy {
  /** Whether the auto-reserve strategy is active. */
  enabled: boolean
  /** Percentage of gross income to reserve (e.g. 15 for 15%). */
  percent_of_income: number
  /** Descriptive name for the target reserve account/tracking category. */
  target_account_name: string
  /** Day of each month (1–28) on which the reserve transfer reminder fires. */
  reminder_day_of_month: number
}

/**
 * Shape of the `users.settings` JSONB column.
 * Stored per-user and drives tax calculations, reminders, and preferences.
 */
export interface UserSettings {
  /** UUID of the entity selected by default in the UI. */
  default_entity_id: string | null
  /** ISO-8601 date string for the start of the tax year (e.g. '2026-01-01'). */
  tax_year_start: string
  /** Effective income tax rate as a percentage (e.g. 15 for 15%). */
  effective_tax_rate_percent: number
  /** Forecast annual taxable income in minor units (sen), used for CP500 projection. */
  lhdn_forecast_income_minor: number
  /** Array of CP500 instalments for the current tax year. */
  cp500_schedule: CP500ScheduleItem[]
  /** Configuration for automatic tax-reserve transfers. */
  tax_reserve_strategy: TaxReserveStrategy
  /** CP-502 voluntary top-up threshold as a percentage (e.g. 80). */
  cp502_threshold_percent: number
  /** Channels through which the user receives reminders. */
  reminder_channels: ('in_app' | 'email')[]
  /** Whether the user has connected Google Calendar for reminder sync. */
  google_calendar_connected: boolean
  /** Google Calendar OAuth refresh token (stored encrypted at rest). */
  gcal_refresh_token?: string
  /** Google Calendar ID used for syncing reminders. */
  gcal_calendar_id?: string
  /** FX rate preference: use the latest cached rate or fetch a real-time rate. */
  fx_preference: 'latest_cached' | 'realtime'
  /** Monthly AI-services cost cap in minor units (default 50000 = $5.00). */
  monthly_ai_cost_cap_minor: number
}

// ============================================================================
// Convenience type exports — one per table
// ============================================================================

export type UserRow = Database['public']['Tables']['users']['Row']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export type EntityRow = Database['public']['Tables']['entities']['Row']
export type EntityInsert = Database['public']['Tables']['entities']['Insert']
export type EntityUpdate = Database['public']['Tables']['entities']['Update']

export type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']
export type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert']
export type SubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update']

export type ProjectRow = Database['public']['Tables']['projects']['Row']
export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']

export type FileRow = Database['public']['Tables']['files']['Row']
export type FileInsert = Database['public']['Tables']['files']['Insert']
export type FileUpdate = Database['public']['Tables']['files']['Update']

export type TransactionRow = Database['public']['Tables']['transactions']['Row']
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert']
export type TransactionUpdate = Database['public']['Tables']['transactions']['Update']

export type ExtractionRow = Database['public']['Tables']['extractions']['Row']
export type ExtractionInsert = Database['public']['Tables']['extractions']['Insert']
export type ExtractionUpdate = Database['public']['Tables']['extractions']['Update']

export type ReminderRow = Database['public']['Tables']['reminders']['Row']
export type ReminderInsert = Database['public']['Tables']['reminders']['Insert']
export type ReminderUpdate = Database['public']['Tables']['reminders']['Update']

export type MonthCloseRow = Database['public']['Tables']['month_closes']['Row']
export type MonthCloseInsert = Database['public']['Tables']['month_closes']['Insert']
export type MonthCloseUpdate = Database['public']['Tables']['month_closes']['Update']

export type AuditLogRow = Database['public']['Tables']['audit_log']['Row']
export type AuditLogInsert = Database['public']['Tables']['audit_log']['Insert']
export type AuditLogUpdate = Database['public']['Tables']['audit_log']['Update']
