-- ============================================================================
-- JK ZENTRA FINANCE COCKPIT — Complete Database Schema
-- Sprint 1 Migration
-- Supabase / PostgreSQL 15+
-- ============================================================================
-- DESIGN PRINCIPLES
--   • Cash basis accounting
--   • All monetary amounts as INTEGER minor units (sen/cents). NEVER FLOAT.
--   • Soft delete only: status = 'archived'. No hard deletes.
--   • Audit log on every mutation.
--   • Row Level Security from day one.
--   • Idempotent: safe to run multiple times.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- ============================================================================
-- 2. FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Auto-update updated_at timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.set_updated_at() IS 'Automatically sets updated_at to current timestamp on every UPDATE.';

-- ----------------------------------------------------------------------------
-- Generic audit logging trigger
--   Fires AFTER INSERT / UPDATE / DELETE. Captures before/after state.
--   Handles soft-delete detection (status → ''archived'') and month-close
--   lifecycle actions (month_reopen, month_reclose).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_action         TEXT;
    v_before         JSONB := NULL;
    v_after          JSONB := NULL;
    v_change_summary JSONB := NULL;
    v_row_id         UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'create';
        v_after  := to_jsonb(NEW);
        v_row_id := NEW.id;

    ELSIF TG_OP = 'UPDATE' THEN
        v_before := to_jsonb(OLD);
        v_after  := to_jsonb(NEW);
        v_row_id := NEW.id;

        -- Determine action type based on table and column changes
        IF TG_TABLE_NAME = 'month_closes' THEN
            IF OLD.reopened_at IS NULL AND NEW.reopened_at IS NOT NULL THEN
                v_action := 'month_reopen';
            ELSIF OLD.reopened_at IS NOT NULL AND NEW.reopened_at IS NULL THEN
                v_action := 'month_reclose';
            ELSE
                v_action := 'update';
            END IF;
        ELSIF (v_after ? 'status')
          AND (v_before ? 'status')
          AND NEW.status = 'archived'
          AND OLD.status IS DISTINCT FROM 'archived' THEN
            v_action := 'soft_delete';
        ELSE
            v_action := 'update';
        END IF;

        -- Compute diff: only changed fields
        SELECT jsonb_object_agg(
                   key,
                   jsonb_build_object('from', value, 'to', v_after -> key)
               )
        INTO v_change_summary
        FROM jsonb_each(v_before) AS t(key, value)
        WHERE v_after -> key IS DISTINCT FROM value;

    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'soft_delete';
        v_before := to_jsonb(OLD);
        v_row_id := OLD.id;
    END IF;

    INSERT INTO public.audit_log (
        entity_type,
        entity_id,
        action,
        before,
        after,
        change_summary,
        user_id,
        ip_address
    ) VALUES (
        TG_TABLE_NAME,
        v_row_id,
        v_action,
        v_before,
        v_after,
        v_change_summary,
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
        inet_client_addr()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.log_audit() IS 'Generic audit trigger. Logs every INSERT/UPDATE/DELETE to audit_log. Detects soft-delete (status→archived) and month-close lifecycle actions.';

-- ============================================================================
-- 3. TABLES (dependency order)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 users — extends Supabase Auth
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    settings   JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3.2 entities — business entities (Personal + JK Zentra)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entities (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT NOT NULL CHECK (name IN ('Personal', 'JK Zentra')),
    slug             TEXT NOT NULL UNIQUE CHECK (slug IN ('personal', 'jk-zentra')),
    default_currency TEXT NOT NULL DEFAULT 'MYR',
    color            TEXT NOT NULL DEFAULT '#181818',
    is_taxable       BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3.3 subscriptions — recurring SaaS / tool subscriptions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id         UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    vendor            TEXT NOT NULL,
    plan              TEXT,
    category          TEXT NOT NULL,
    amount_minor      INTEGER NOT NULL CHECK (amount_minor >= 0),
    currency          TEXT NOT NULL,
    billing_cycle     TEXT NOT NULL
                      CHECK (billing_cycle IN ('monthly', 'yearly', 'quarterly', 'trial', 'one_time')),
    start_date        DATE NOT NULL,
    trial_end_date    DATE,
    next_payment_at   DATE,
    last_paid_at      DATE,
    renewal_date      DATE,
    end_date          DATE,
    payment_method    TEXT,
    status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'trial', 'cancelled', 'paused', 'expired', 'archived')),
    reminder_offsets  INTEGER[] NOT NULL DEFAULT '{7,3,1,0}',
    reminder_channels TEXT[] NOT NULL DEFAULT '{in_app}',
    is_stack_radar    BOOLEAN NOT NULL DEFAULT true,
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3.4 projects — client project tracker
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id             UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    name                  TEXT NOT NULL,
    client                TEXT NOT NULL,
    total_value_minor     INTEGER NOT NULL CHECK (total_value_minor >= 0),
    currency              TEXT NOT NULL,
    payment_schedule_note TEXT,
    status                TEXT NOT NULL DEFAULT 'quoted'
                          CHECK (status IN (
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
                              'archived'
                          )),
    start_date            DATE NOT NULL,
    expected_delivery_date DATE,
    actual_delivery_date  DATE,
    closed_date           DATE,
    notes                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3.5 files — uploaded documents / receipts / packs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.files (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_path      TEXT NOT NULL UNIQUE,
    original_filename TEXT NOT NULL,
    display_filename  TEXT,
    mime_type         TEXT NOT NULL,
    size_bytes        INTEGER NOT NULL CHECK (size_bytes >= 0),
    sha256_hash       TEXT NOT NULL UNIQUE,
    source            TEXT NOT NULL DEFAULT 'web'
                      CHECK (source IN ('web', 'mobile', 'email')),
    entity_id         UUID REFERENCES public.entities(id) ON DELETE SET NULL,
    uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3.6 transactions — CORE financial ledger (cash basis)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id                 UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    type                      TEXT NOT NULL
                              CHECK (type IN (
                                  'income',
                                  'expense',
                                  'tax_prepayment',
                                  'tax_payment_final',
                                  'tax_reserve_transfer'
                              )),
    amount_minor              INTEGER NOT NULL CHECK (amount_minor >= 0),
    currency                  TEXT NOT NULL,
    myr_equiv_minor           INTEGER CHECK (myr_equiv_minor IS NULL OR myr_equiv_minor >= 0),
    fx_rate                   DECIMAL(10,6),
    occurred_at               DATE NOT NULL,
    vendor                    TEXT NOT NULL,
    category                  TEXT NOT NULL,
    subcategory               TEXT,
    description               TEXT,
    notes                     TEXT,
    tags                      TEXT[] NOT NULL DEFAULT '{}',
    status                    TEXT NOT NULL DEFAULT 'pending_review'
                              CHECK (status IN ('pending_review', 'active', 'archived')),
    period_status             TEXT NOT NULL DEFAULT 'open'
                              CHECK (period_status IN ('open', 'closed')),
    reference_code            TEXT,
    closed_at                 TIMESTAMPTZ,
    subscription_id           UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    project_id                UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    file_id                   UUID REFERENCES public.files(id) ON DELETE SET NULL,
    refund_of_transaction_id  UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3.7 extractions — AI OCR extraction results per file
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extractions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id            UUID NOT NULL UNIQUE REFERENCES public.files(id) ON DELETE CASCADE,
    model_used         TEXT NOT NULL,
    raw_response       JSONB,
    extracted_fields   JSONB,
    confidence_scores  JSONB,
    manually_corrected BOOLEAN NOT NULL DEFAULT false,
    processing_time_ms INTEGER CHECK (processing_time_ms IS NULL OR processing_time_ms >= 0),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3.8 reminders — notification / calendar reminders
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminders (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reminder_type  TEXT NOT NULL
                   CHECK (reminder_type IN (
                       'subscription_renewal',
                       'cp500_instalment',
                       'tax_position_check',
                       'tax_reserve_transfer',
                       'year_end_planning'
                   )),
    ref_type       TEXT NOT NULL
                   CHECK (ref_type IN ('subscription', 'cp500_schedule', 'system')),
    ref_id         UUID,
    trigger_at     TIMESTAMPTZ NOT NULL,
    offset_days    INTEGER NOT NULL,
    channel        TEXT NOT NULL DEFAULT 'in_app'
                   CHECK (channel IN ('in_app', 'email', 'gcal')),
    status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sent', 'dismissed', 'failed', 'archived')),
    title          TEXT NOT NULL,
    body           TEXT,
    gcal_event_id  TEXT,
    sent_at        TIMESTAMPTZ,
    dismissed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3.9 month_closes — monthly bookkeeping close records
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.month_closes (
    id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id                    UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    year                         INTEGER NOT NULL,
    month                        INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    closed_at                    TIMESTAMPTZ DEFAULT now(),
    reopened_at                  TIMESTAMPTZ,
    reopen_reason                TEXT,
    opening_balance_minor        INTEGER,
    closing_balance_minor        INTEGER,
    computed_closing_minor       INTEGER,
    reconciliation_variance_minor INTEGER,
    reconciliation_note          TEXT,
    checklist_results            JSONB NOT NULL DEFAULT '{}',
    pack_file_id                 UUID REFERENCES public.files(id) ON DELETE SET NULL,
    reference_prefix             TEXT NOT NULL,
    notes                        TEXT,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (entity_id, year, month)
);

-- ----------------------------------------------------------------------------
-- 3.10 audit_log — immutable audit trail
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
    id              BIGSERIAL PRIMARY KEY,
    entity_type     TEXT NOT NULL,
    entity_id       UUID NOT NULL,
    action          TEXT NOT NULL
                    CHECK (action IN (
                        'create',
                        'update',
                        'soft_delete',
                        'month_reopen',
                        'month_reclose'
                    )),
    before          JSONB,
    after           JSONB,
    change_summary  JSONB,
    user_id         UUID NOT NULL,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. COMMENTS ON TABLES AND COLUMNS
-- ============================================================================

-- 4.1 users
COMMENT ON TABLE  public.users IS 'Extends Supabase Auth with app-specific profile and settings.';
COMMENT ON COLUMN public.users.id IS 'References auth.users(id). Cascade delete when auth user is removed.';
COMMENT ON COLUMN public.users.display_name IS 'User-friendly display name shown in the UI.';
COMMENT ON COLUMN public.users.settings IS 'JSONB settings: default_entity_id, tax_year_start, effective_tax_rate_percent, lhdn_forecast_income_minor, cp500_schedule, tax_reserve_strategy, cp502_threshold_percent, reminder_channels, google_calendar_connected, gcal_refresh_token, gcal_calendar_id, fx_preference, monthly_ai_cost_cap_minor (default 50000 = $5.00).';
COMMENT ON COLUMN public.users.created_at IS 'Timestamp when the profile row was created.';
COMMENT ON COLUMN public.users.updated_at IS 'Timestamp when the profile row was last updated.';

-- 4.2 entities
COMMENT ON TABLE  public.entities IS 'Business entities: Personal and JK Zentra. Every transaction, subscription, project, etc. belongs to one entity.';
COMMENT ON COLUMN public.entities.id IS 'Auto-generated UUID.';
COMMENT ON COLUMN public.entities.name IS 'Display name. Must be ''Personal'' or ''JK Zentra''.';
COMMENT ON COLUMN public.entities.slug IS 'URL-safe slug. Must be ''personal'' or ''jk-zentra''. Unique.';
COMMENT ON COLUMN public.entities.default_currency IS 'Default currency for this entity (MYR for Personal, MYR for JK Zentra).';
COMMENT ON COLUMN public.entities.color IS 'Hex colour code for UI theming.';
COMMENT ON COLUMN public.entities.is_taxable IS 'Whether this entity is subject to income tax reporting.';
COMMENT ON COLUMN public.entities.created_at IS 'Record creation timestamp.';
COMMENT ON COLUMN public.entities.updated_at IS 'Record last-update timestamp.';

-- 4.3 subscriptions
COMMENT ON TABLE  public.subscriptions IS 'Recurring subscriptions and one-time tool purchases tracked by the Stack Radar.';
COMMENT ON COLUMN public.subscriptions.id IS 'Auto-generated UUID.';
COMMENT ON COLUMN public.subscriptions.entity_id IS 'Owning entity (FK → entities).';
COMMENT ON COLUMN public.subscriptions.name IS 'Subscription or product name (e.g. ''Supabase Pro'').';
COMMENT ON COLUMN public.subscriptions.vendor IS 'Vendor or provider name (e.g. ''OpenAI'').';
COMMENT ON COLUMN public.subscriptions.plan IS 'Plan tier (e.g. ''Pro'', ''Team''). Nullable.';
COMMENT ON COLUMN public.subscriptions.category IS 'Business category (e.g. ''Infrastructure'', ''Design Tools'').';
COMMENT ON COLUMN public.subscriptions.amount_minor IS 'Cost in minor currency units (sen/cents). INTEGER, never float. >= 0.';
COMMENT ON COLUMN public.subscriptions.currency IS 'Currency code (MYR, USD, etc.).';
COMMENT ON COLUMN public.subscriptions.billing_cycle IS 'One of: monthly, yearly, quarterly, trial, one_time.';
COMMENT ON COLUMN public.subscriptions.start_date IS 'Date the subscription started or was purchased.';
COMMENT ON COLUMN public.subscriptions.trial_end_date IS 'End date of trial period, if applicable.';
COMMENT ON COLUMN public.subscriptions.next_payment_at IS 'Expected date of next billing cycle payment.';
COMMENT ON COLUMN public.subscriptions.last_paid_at IS 'Date of most recent successful payment.';
COMMENT ON COLUMN public.subscriptions.renewal_date IS 'Annual or next major renewal date.';
COMMENT ON COLUMN public.subscriptions.end_date IS 'Date the subscription ends or was cancelled.';
COMMENT ON COLUMN public.subscriptions.payment_method IS 'Payment method used (e.g. ''Credit Card'', ''PayPal'').';
COMMENT ON COLUMN public.subscriptions.status IS 'One of: active, trial, cancelled, paused, expired, archived.';
COMMENT ON COLUMN public.subscriptions.reminder_offsets IS 'Array of days before renewal to trigger reminders. Default {7,3,1,0}.';
COMMENT ON COLUMN public.subscriptions.reminder_channels IS 'Array of reminder delivery channels. Default {in_app}.';
COMMENT ON COLUMN public.subscriptions.is_stack_radar IS 'Whether this subscription appears on the Stack Radar dashboard.';
COMMENT ON COLUMN public.subscriptions.notes IS 'Free-text notes.';
COMMENT ON COLUMN public.subscriptions.created_at IS 'Record creation timestamp.';
COMMENT ON COLUMN public.subscriptions.updated_at IS 'Record last-update timestamp.';

-- 4.4 projects
COMMENT ON TABLE  public.projects IS 'Client projects with full lifecycle tracking from quote to closure.';
COMMENT ON COLUMN public.projects.id IS 'Auto-generated UUID.';
COMMENT ON COLUMN public.projects.entity_id IS 'Owning entity (FK → entities).';
COMMENT ON COLUMN public.projects.name IS 'Project name or identifier.';
COMMENT ON COLUMN public.projects.client IS 'Client name or identifier.';
COMMENT ON COLUMN public.projects.total_value_minor IS 'Total quoted / contract value in minor currency units. INTEGER >= 0.';
COMMENT ON COLUMN public.projects.currency IS 'Currency code for project value.';
COMMENT ON COLUMN public.projects.payment_schedule_note IS 'Free-text description of payment terms and milestones.';
COMMENT ON COLUMN public.projects.status IS 'One of: quoted, deposit_received, in_progress, delivered, fully_paid, disputed, cancelled, cancelled_with_deposit_kept, cancelled_partial, closed_short_paid, archived.';
COMMENT ON COLUMN public.projects.start_date IS 'Project start date.';
COMMENT ON COLUMN public.projects.expected_delivery_date IS 'Expected completion / delivery date.';
COMMENT ON COLUMN public.projects.actual_delivery_date IS 'Actual date of delivery.';
COMMENT ON COLUMN public.projects.closed_date IS 'Date the project was fully closed.';
COMMENT ON COLUMN public.projects.notes IS 'Free-text notes.';
COMMENT ON COLUMN public.projects.created_at IS 'Record creation timestamp.';
COMMENT ON COLUMN public.projects.updated_at IS 'Record last-update timestamp.';

-- 4.5 files
COMMENT ON TABLE  public.files IS 'Uploaded files: receipts, invoices, close packs, attachments. Storage path points to Supabase Storage.';
COMMENT ON COLUMN public.files.id IS 'Auto-generated UUID.';
COMMENT ON COLUMN public.files.storage_path IS 'Full path in Supabase Storage bucket. Unique.';
COMMENT ON COLUMN public.files.original_filename IS 'Original filename as uploaded by user.';
COMMENT ON COLUMN public.files.display_filename IS 'User-editable display / friendly filename.';
COMMENT ON COLUMN public.files.mime_type IS 'MIME type of the file (e.g. application/pdf).';
COMMENT ON COLUMN public.files.size_bytes IS 'File size in bytes. INTEGER >= 0.';
COMMENT ON COLUMN public.files.sha256_hash IS 'SHA-256 hash for deduplication and integrity. Unique.';
COMMENT ON COLUMN public.files.source IS 'Upload source: web, mobile, or email.';
COMMENT ON COLUMN public.files.entity_id IS 'Optional owning entity. NULL for unfiled uploads.';
COMMENT ON COLUMN public.files.uploaded_at IS 'Timestamp when the file was uploaded.';
COMMENT ON COLUMN public.files.created_at IS 'Record creation timestamp.';
COMMENT ON COLUMN public.files.updated_at IS 'Record last-update timestamp.';

-- 4.6 transactions
COMMENT ON TABLE  public.transactions IS 'CORE financial ledger. Cash basis. Every income, expense, and tax movement is recorded here.';
COMMENT ON COLUMN public.transactions.id IS 'Auto-generated UUID.';
COMMENT ON COLUMN public.transactions.entity_id IS 'Owning entity (FK → entities).';
COMMENT ON COLUMN public.transactions.type IS 'Transaction type: income, expense, tax_prepayment, tax_payment_final, tax_reserve_transfer.';
COMMENT ON COLUMN public.transactions.amount_minor IS 'Transaction amount in minor currency units (sen/cents). INTEGER >= 0. NEVER FLOAT.';
COMMENT ON COLUMN public.transactions.currency IS 'Transaction currency code (MYR, USD).';
COMMENT ON COLUMN public.transactions.myr_equiv_minor IS 'Equivalent value in MYR minor units (sen). Populated for multi-currency reporting. INTEGER >= 0.';
COMMENT ON COLUMN public.transactions.fx_rate IS 'Foreign exchange rate used for MYR conversion. DECIMAL(10,6).';
COMMENT ON COLUMN public.transactions.occurred_at IS 'Date the transaction occurred (cash basis date).';
COMMENT ON COLUMN public.transactions.vendor IS 'Counterparty name (e.g. ''OpenAI'', ''Client ABC'').';
COMMENT ON COLUMN public.transactions.category IS 'Primary category for P&L grouping (e.g. ''Software'', ''Services Income'').';
COMMENT ON COLUMN public.transactions.subcategory IS 'Secondary categorisation (e.g. ''AI/ML'', ''Web Design'').';
COMMENT ON COLUMN public.transactions.description IS 'Brief description of the transaction.';
COMMENT ON COLUMN public.transactions.notes IS 'Internal notes.';
COMMENT ON COLUMN public.transactions.tags IS 'Array of tags for flexible filtering. GIN indexed.';
COMMENT ON COLUMN public.transactions.status IS 'Row status: pending_review, active, archived (soft delete).';
COMMENT ON COLUMN public.transactions.period_status IS 'Bookkeeping period lock: open (editable) or closed (locked).';
COMMENT ON COLUMN public.transactions.reference_code IS 'External reference (invoice number, receipt ID, etc.).';
COMMENT ON COLUMN public.transactions.closed_at IS 'Timestamp when this transaction was reconciled / closed.';
COMMENT ON COLUMN public.transactions.subscription_id IS 'Links to a subscription if this is a subscription payment. FK → subscriptions, SET NULL on delete.';
COMMENT ON COLUMN public.transactions.project_id IS 'Links to a project if this is project-related. FK → projects, SET NULL on delete.';
COMMENT ON COLUMN public.transactions.file_id IS 'Links to an uploaded receipt/invoice file. FK → files, SET NULL on delete.';
COMMENT ON COLUMN public.transactions.refund_of_transaction_id IS 'Self-referencing FK: this transaction is a refund of the referenced transaction. SET NULL on delete.';
COMMENT ON COLUMN public.transactions.created_at IS 'Record creation timestamp.';
COMMENT ON COLUMN public.transactions.updated_at IS 'Record last-update timestamp.';

-- 4.7 extractions
COMMENT ON TABLE  public.extractions IS 'AI OCR extraction results for uploaded files. One extraction per file.';
COMMENT ON COLUMN public.extractions.id IS 'Auto-generated UUID.';
COMMENT ON COLUMN public.extractions.file_id IS 'Linked file (FK → files). CASCADE delete. Unique — one extraction per file.';
COMMENT ON COLUMN public.extractions.model_used IS 'Name/identifier of the AI model used (e.g. ''gpt-4o-2024-08'').';
COMMENT ON COLUMN public.extractions.raw_response IS 'Raw JSON response from the AI model.';
COMMENT ON COLUMN public.extractions.extracted_fields IS 'Structured extracted fields (vendor, amount, date, etc.).';
COMMENT ON COLUMN public.extractions.confidence_scores IS 'Per-field confidence scores (0.0–1.0).';
COMMENT ON COLUMN public.extractions.manually_corrected IS 'Whether a human has reviewed and corrected the extraction.';
COMMENT ON COLUMN public.extractions.processing_time_ms IS 'Time taken to process the file in milliseconds. INTEGER >= 0.';
COMMENT ON COLUMN public.extractions.created_at IS 'Record creation timestamp.';
COMMENT ON COLUMN public.extractions.updated_at IS 'Record last-update timestamp.';

-- 4.8 reminders
COMMENT ON TABLE  public.reminders IS 'Notification and calendar reminders for subscriptions, tax instalments, and planning events.';
COMMENT ON COLUMN public.reminders.id IS 'Auto-generated UUID.';
COMMENT ON COLUMN public.reminders.reminder_type IS 'Type of reminder: subscription_renewal, cp500_instalment, tax_position_check, tax_reserve_transfer, year_end_planning.';
COMMENT ON COLUMN public.reminders.ref_type IS 'Type of referenced object: subscription, cp500_schedule, system.';
COMMENT ON COLUMN public.reminders.ref_id IS 'UUID of the referenced object. Polymorphic — interpreted with ref_type. No FK constraint.';
COMMENT ON COLUMN public.reminders.trigger_at IS 'UTC timestamp when the reminder should fire.';
COMMENT ON COLUMN public.reminders.offset_days IS 'Number of days before the event date this reminder was created for.';
COMMENT ON COLUMN public.reminders.channel IS 'Delivery channel: in_app, email, or gcal.';
COMMENT ON COLUMN public.reminders.status IS 'Reminder status: pending, sent, dismissed, failed, archived.';
COMMENT ON COLUMN public.reminders.title IS 'Short title shown to the user.';
COMMENT ON COLUMN public.reminders.body IS 'Detailed reminder message body.';
COMMENT ON COLUMN public.reminders.gcal_event_id IS 'Google Calendar event ID if synced to Google Calendar.';
COMMENT ON COLUMN public.reminders.sent_at IS 'Timestamp when the reminder was actually sent.';
COMMENT ON COLUMN public.reminders.dismissed_at IS 'Timestamp when the user dismissed the reminder.';
COMMENT ON COLUMN public.reminders.created_at IS 'Record creation timestamp.';
COMMENT ON COLUMN public.reminders.updated_at IS 'Record last-update timestamp.';

-- 4.9 month_closes
COMMENT ON TABLE  public.month_closes IS 'Monthly bookkeeping close records. Once closed, transactions in that period are locked (period_status = closed).';
COMMENT ON COLUMN public.month_closes.id IS 'Auto-generated UUID.';
COMMENT ON COLUMN public.month_closes.entity_id IS 'Owning entity (FK → entities).';
COMMENT ON COLUMN public.month_closes.year IS 'Calendar year of the close (e.g. 2026).';
COMMENT ON COLUMN public.month_closes.month IS 'Calendar month (1–12).';
COMMENT ON COLUMN public.month_closes.closed_at IS 'Timestamp when the month was first closed.';
COMMENT ON COLUMN public.month_closes.reopened_at IS 'Timestamp when the month was reopened (null if never reopened).';
COMMENT ON COLUMN public.month_closes.reopen_reason IS 'Reason provided when reopening a closed month.';
COMMENT ON COLUMN public.month_closes.opening_balance_minor IS 'Opening bank balance in minor units at month start.';
COMMENT ON COLUMN public.month_closes.closing_balance_minor IS 'Actual closing bank balance in minor units at month end.';
COMMENT ON COLUMN public.month_closes.computed_closing_minor IS 'Computed closing balance from transactions (opening + income − expenses).';
COMMENT ON COLUMN public.month_closes.reconciliation_variance_minor IS 'Difference between actual and computed closing balance.';
COMMENT ON COLUMN public.month_closes.reconciliation_note IS 'Explanation for any reconciliation variance.';
COMMENT ON COLUMN public.month_closes.checklist_results IS 'JSONB checklist of close steps completed (e.g. receipts filed, bank reconciled).';
COMMENT ON COLUMN public.month_closes.pack_file_id IS 'Reference to the generated close pack PDF (FK → files, SET NULL).';
COMMENT ON COLUMN public.month_closes.reference_prefix IS 'Reference prefix for the close (e.g. ''MC-2026-06'').';
COMMENT ON COLUMN public.month_closes.notes IS 'Free-text notes for the month close.';
COMMENT ON COLUMN public.month_closes.created_at IS 'Record creation timestamp.';
COMMENT ON COLUMN public.month_closes.updated_at IS 'Record last-update timestamp.';

-- 4.10 audit_log
COMMENT ON TABLE  public.audit_log IS 'Immutable audit trail. Every CREATE, UPDATE, soft-delete, month_reopen, and month_reclose is logged here automatically.';
COMMENT ON COLUMN public.audit_log.id IS 'Auto-incrementing bigint ID.';
COMMENT ON COLUMN public.audit_log.entity_type IS 'Name of the table that was modified (e.g. ''transactions'').';
COMMENT ON COLUMN public.audit_log.entity_id IS 'UUID of the specific row that was modified.';
COMMENT ON COLUMN public.audit_log.action IS 'Action type: create, update, soft_delete, month_reopen, month_reclose.';
COMMENT ON COLUMN public.audit_log.before IS 'Complete JSONB snapshot of the row before the change. NULL for INSERT.';
COMMENT ON COLUMN public.audit_log.after IS 'Complete JSONB snapshot of the row after the change. NULL for DELETE.';
COMMENT ON COLUMN public.audit_log.change_summary IS 'JSONB diff showing only changed fields: {field: {from, to}}.';
COMMENT ON COLUMN public.audit_log.user_id IS 'UUID of the user who made the change (from auth.uid()).';
COMMENT ON COLUMN public.audit_log.ip_address IS 'Client IP address at time of change.';
COMMENT ON COLUMN public.audit_log.created_at IS 'Timestamp when the audit entry was created.';

-- ============================================================================
-- 5. INDEXES
-- ============================================================================

-- 5.1 transactions
CREATE INDEX IF NOT EXISTS idx_transactions_entity_occurred
    ON public.transactions (entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type
    ON public.transactions (type);
CREATE INDEX IF NOT EXISTS idx_transactions_status
    ON public.transactions (status);
CREATE INDEX IF NOT EXISTS idx_transactions_period_status
    ON public.transactions (period_status);
CREATE INDEX IF NOT EXISTS idx_transactions_subscription_id
    ON public.transactions (subscription_id);
CREATE INDEX IF NOT EXISTS idx_transactions_project_id
    ON public.transactions (project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_file_id
    ON public.transactions (file_id);
CREATE INDEX IF NOT EXISTS idx_transactions_refund_of
    ON public.transactions (refund_of_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_occurred_type
    ON public.transactions (occurred_at, type);
CREATE INDEX IF NOT EXISTS idx_transactions_tags
    ON public.transactions USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_transactions_vendor
    ON public.transactions (vendor);
CREATE INDEX IF NOT EXISTS idx_transactions_reference_code
    ON public.transactions (reference_code);

-- 5.2 subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_entity_id
    ON public.subscriptions (entity_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status
    ON public.subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_payment
    ON public.subscriptions (next_payment_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_vendor
    ON public.subscriptions (vendor);
CREATE INDEX IF NOT EXISTS idx_subscriptions_category
    ON public.subscriptions (category);
CREATE INDEX IF NOT EXISTS idx_subscriptions_entity_status
    ON public.subscriptions (entity_id, status);

-- 5.3 projects
CREATE INDEX IF NOT EXISTS idx_projects_entity_id
    ON public.projects (entity_id);
CREATE INDEX IF NOT EXISTS idx_projects_status
    ON public.projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_client
    ON public.projects (client);
CREATE INDEX IF NOT EXISTS idx_projects_expected_delivery
    ON public.projects (expected_delivery_date);
CREATE INDEX IF NOT EXISTS idx_projects_entity_status
    ON public.projects (entity_id, status);

-- 5.4 files
CREATE INDEX IF NOT EXISTS idx_files_storage_path
    ON public.files (storage_path);
CREATE INDEX IF NOT EXISTS idx_files_sha256
    ON public.files (sha256_hash);
CREATE INDEX IF NOT EXISTS idx_files_entity_id
    ON public.files (entity_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_at
    ON public.files (uploaded_at DESC);

-- 5.5 extractions
CREATE INDEX IF NOT EXISTS idx_extractions_file_id
    ON public.extractions (file_id);
CREATE INDEX IF NOT EXISTS idx_extractions_model
    ON public.extractions (model_used);
CREATE INDEX IF NOT EXISTS idx_extractions_corrected
    ON public.extractions (manually_corrected);

-- 5.6 reminders
CREATE INDEX IF NOT EXISTS idx_reminders_trigger_at
    ON public.reminders (trigger_at);
CREATE INDEX IF NOT EXISTS idx_reminders_status
    ON public.reminders (status);
CREATE INDEX IF NOT EXISTS idx_reminders_type_ref
    ON public.reminders (reminder_type, ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_reminders_ref
    ON public.reminders (ref_type, ref_id);

-- 5.7 month_closes
-- The UNIQUE (entity_id, year, month) constraint already creates an index automatically.
CREATE INDEX IF NOT EXISTS idx_month_closes_entity
    ON public.month_closes (entity_id);
CREATE INDEX IF NOT EXISTS idx_month_closes_pack_file
    ON public.month_closes (pack_file_id);

-- 5.8 audit_log
CREATE INDEX IF NOT EXISTS idx_audit_entity
    ON public.audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action
    ON public.audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_created
    ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user
    ON public.audit_log (user_id);

-- ============================================================================
-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- 6.1 Enable RLS on all tables
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.month_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_log ENABLE ROW LEVEL SECURITY;

-- 6.2 users
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS users_insert ON public.users;
CREATE POLICY users_insert ON public.users
    FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 6.3 entities
DROP POLICY IF EXISTS entities_select ON public.entities;
CREATE POLICY entities_select ON public.entities
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS entities_insert ON public.entities;
CREATE POLICY entities_insert ON public.entities
    FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS entities_update ON public.entities;
CREATE POLICY entities_update ON public.entities
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 6.4 subscriptions
DROP POLICY IF EXISTS subscriptions_select ON public.subscriptions;
CREATE POLICY subscriptions_select ON public.subscriptions
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS subscriptions_insert ON public.subscriptions;
CREATE POLICY subscriptions_insert ON public.subscriptions
    FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS subscriptions_update ON public.subscriptions;
CREATE POLICY subscriptions_update ON public.subscriptions
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 6.5 projects
DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select ON public.projects
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS projects_insert ON public.projects;
CREATE POLICY projects_insert ON public.projects
    FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS projects_update ON public.projects;
CREATE POLICY projects_update ON public.projects
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 6.6 files
DROP POLICY IF EXISTS files_select ON public.files;
CREATE POLICY files_select ON public.files
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS files_insert ON public.files;
CREATE POLICY files_insert ON public.files
    FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS files_update ON public.files;
CREATE POLICY files_update ON public.files
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 6.7 transactions — UPDATE restricted to open periods
DROP POLICY IF EXISTS transactions_select ON public.transactions;
CREATE POLICY transactions_select ON public.transactions
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS transactions_insert ON public.transactions;
CREATE POLICY transactions_insert ON public.transactions
    FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS transactions_update ON public.transactions;
CREATE POLICY transactions_update ON public.transactions
    FOR UPDATE TO authenticated USING (period_status = 'open') WITH CHECK (period_status = 'open');

-- 6.8 extractions
DROP POLICY IF EXISTS extractions_select ON public.extractions;
CREATE POLICY extractions_select ON public.extractions
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS extractions_insert ON public.extractions;
CREATE POLICY extractions_insert ON public.extractions
    FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS extractions_update ON public.extractions;
CREATE POLICY extractions_update ON public.extractions
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 6.9 reminders
DROP POLICY IF EXISTS reminders_select ON public.reminders;
CREATE POLICY reminders_select ON public.reminders
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS reminders_insert ON public.reminders;
CREATE POLICY reminders_insert ON public.reminders
    FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS reminders_update ON public.reminders;
CREATE POLICY reminders_update ON public.reminders
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 6.10 month_closes
DROP POLICY IF EXISTS month_closes_select ON public.month_closes;
CREATE POLICY month_closes_select ON public.month_closes
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS month_closes_insert ON public.month_closes;
CREATE POLICY month_closes_insert ON public.month_closes
    FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS month_closes_update ON public.month_closes;
CREATE POLICY month_closes_update ON public.month_closes
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 6.11 audit_log — read-only for authenticated users; inserts via trigger (SECURITY DEFINER)
DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log
    FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- 7.1 Auto-updated_at — applied to ALL tables
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_entities_updated_at ON public.entities;
CREATE TRIGGER trg_entities_updated_at
    BEFORE UPDATE ON public.entities
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_files_updated_at ON public.files;
CREATE TRIGGER trg_files_updated_at
    BEFORE UPDATE ON public.files
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_extractions_updated_at ON public.extractions;
CREATE TRIGGER trg_extractions_updated_at
    BEFORE UPDATE ON public.extractions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_reminders_updated_at ON public.reminders;
CREATE TRIGGER trg_reminders_updated_at
    BEFORE UPDATE ON public.reminders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_month_closes_updated_at ON public.month_closes;
CREATE TRIGGER trg_month_closes_updated_at
    BEFORE UPDATE ON public.month_closes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- audit_log does not need an updated_at trigger (append-only)

-- 7.2 Audit logging — applied to: transactions, subscriptions, projects, reminders, month_closes
DROP TRIGGER IF EXISTS trg_transactions_audit ON public.transactions;
CREATE TRIGGER trg_transactions_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS trg_subscriptions_audit ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS trg_projects_audit ON public.projects;
CREATE TRIGGER trg_projects_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS trg_reminders_audit ON public.reminders;
CREATE TRIGGER trg_reminders_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.reminders
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS trg_month_closes_audit ON public.month_closes;
CREATE TRIGGER trg_month_closes_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.month_closes
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ============================================================================
-- 8. SEED DATA
-- ============================================================================

INSERT INTO public.entities (name, slug, default_currency, color, is_taxable)
VALUES
    ('Personal', 'personal', 'MYR', '#6B6B6B', false),
    ('JK Zentra', 'jk-zentra', 'MYR', '#F37002', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 9. DONE
-- ============================================================================

COMMIT;
