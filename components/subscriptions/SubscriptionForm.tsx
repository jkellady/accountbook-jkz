/**
 * ============================================================================
 * SubscriptionForm — Full CRUD Form for Subscriptions
 * ============================================================================
 *
 * A comprehensive form for creating and editing subscriptions. Covers every
 * editable column in the subscriptions table (§3.3 schema.sql):
 *
 *   name, vendor, plan, category, amount_minor, currency, billing_cycle,
 *   start_date, trial_end_date, next_payment_at, status, reminder_offsets,
 *   reminder_channels, is_stack_radar, notes, entity_id
 *
 * Uses CurrencyInput from Sprint 2 for amount entry. Entity selector
 * is a dropdown populated from the entities table (Personal / JK Zentra).
 *
 * @example
 * // Create mode
 * <SubscriptionForm onSubmit={handleCreate} />
 *
 * // Edit mode
 * <SubscriptionForm subscription={existing} onSubmit={handleUpdate} />
 */

'use client'

import React, { useState, useCallback, useEffect } from 'react'
import type { SubscriptionRow, BillingCycle, SubscriptionStatus } from '@/lib/supabase/database.types'
import { CurrencyInput } from '@/components/forms/CurrencyInput'
import { formatAmount } from '@/lib/utils/currency'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Billing cycle option with human-readable label. */
interface BillingCycleOption {
  value: BillingCycle
  label: string
  shortLabel: string
}

/** Status option with display metadata. */
interface StatusOption {
  value: SubscriptionStatus
  label: string
  pillColor: string
}

/** Reminder offset option (days before renewal). */
interface ReminderOffsetOption {
  value: number
  label: string
}

/** Reminder channel option. */
interface ReminderChannelOption {
  value: string
  label: string
}

/** Entity option for the selector. */
interface EntityOption {
  id: string
  name: string
}

/** Form field state — mirrors SubscriptionInsert shape. */
interface FormData {
  entity_id: string
  name: string
  vendor: string
  plan: string
  category: string
  amount_minor: number | null
  currency: string
  billing_cycle: BillingCycle
  start_date: string
  trial_end_date: string
  next_payment_at: string
  last_paid_at: string
  status: SubscriptionStatus
  reminder_offsets: number[]
  reminder_channels: string[]
  is_stack_radar: boolean
  notes: string
}

/** Props for the SubscriptionForm component. */
interface SubscriptionFormProps {
  /** Existing subscription for edit mode; omit for create mode */
  subscription?: SubscriptionRow | null
  /** Available entities for the selector (usually fetched server-side) */
  entities: EntityOption[]
  /** Called when the form is submitted with validated data */
  onSubmit: (data: FormData) => void | Promise<void>
  /** Called when the user cancels */
  onCancel?: () => void
  /** Optional submit button label */
  submitLabel?: string
  /** Loading state */
  isSubmitting?: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BILLING_CYCLES: readonly BillingCycleOption[] = [
  { value: 'monthly', label: 'Monthly', shortLabel: 'mo' },
  { value: 'yearly', label: 'Yearly', shortLabel: 'yr' },
  { value: 'quarterly', label: 'Quarterly', shortLabel: 'qtr' },
  { value: 'trial', label: 'Trial', shortLabel: 'trial' },
  { value: 'one_time', label: 'One-time', shortLabel: '1x' },
] as const

const STATUSES: readonly StatusOption[] = [
  { value: 'active', label: 'Active', pillColor: '#1F8A4C' },
  { value: 'trial', label: 'Trial', pillColor: '#2563EB' },
  { value: 'paused', label: 'Paused', pillColor: '#C77700' },
  { value: 'cancelled', label: 'Cancelled', pillColor: '#A0A0A0' },
  { value: 'expired', label: 'Expired', pillColor: '#B43A2D' },
] as const

const REMINDER_OFFSETS: readonly ReminderOffsetOption[] = [
  { value: 7, label: '7 days' },
  { value: 3, label: '3 days' },
  { value: 1, label: '1 day' },
  { value: 0, label: 'Same day' },
] as const

const REMINDER_CHANNELS: readonly ReminderChannelOption[] = [
  { value: 'in_app', label: 'In-app' },
  { value: 'email', label: 'Email' },
] as const

const DEFAULT_CATEGORIES = [
  'AI & Software',
  'Hardware & Equipment',
  'Connectivity',
  'Cloud / Hosting',
  'Design Tools',
  'Development Tools',
  'Marketing',
  'Education',
  'Office / Workspace',
  'Tax / Admin',
  'Banking / Fees',
  'Other',
] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Initialise form data from an existing subscription or defaults.
 */
function buildInitialFormData(
  subscription: SubscriptionRow | null | undefined,
  entities: EntityOption[]
): FormData {
  const defaultEntityId = entities[0]?.id ?? ''

  if (!subscription) {
    return {
      entity_id: defaultEntityId,
      name: '',
      vendor: '',
      plan: '',
      category: '',
      amount_minor: null,
      currency: 'MYR',
      billing_cycle: 'monthly',
      start_date: new Date().toISOString().split('T')[0],
      trial_end_date: '',
      next_payment_at: '',
      last_paid_at: '',
      status: 'active',
      reminder_offsets: [7, 3, 1],
      reminder_channels: ['in_app'],
      is_stack_radar: true,
      notes: '',
    }
  }

  return {
    entity_id: subscription.entity_id,
    name: subscription.name,
    vendor: subscription.vendor,
    plan: subscription.plan ?? '',
    category: subscription.category,
    amount_minor: subscription.amount_minor,
    currency: subscription.currency,
    billing_cycle: subscription.billing_cycle,
    start_date: subscription.start_date,
    trial_end_date: subscription.trial_end_date ?? '',
    next_payment_at: subscription.next_payment_at ?? '',
    last_paid_at: subscription.last_paid_at ?? '',
    status: subscription.status === 'archived' ? 'active' : subscription.status,
    reminder_offsets: subscription.reminder_offsets,
    reminder_channels: subscription.reminder_channels,
    is_stack_radar: subscription.is_stack_radar,
    notes: subscription.notes ?? '',
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Full CRUD form for creating or editing a subscription.
 *
 * @param props - See {@link SubscriptionFormProps}
 * @returns JSX.Element
 */
export function SubscriptionForm({
  subscription,
  entities,
  onSubmit,
  onCancel,
  submitLabel = subscription ? 'Update Subscription' : 'Create Subscription',
  isSubmitting = false,
}: SubscriptionFormProps): React.JSX.Element {
  const isEditMode = !!subscription

  const [formData, setFormData] = useState<FormData>(() =>
    buildInitialFormData(subscription, entities)
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Sync form data when subscription prop changes
  useEffect(() => {
    setFormData(buildInitialFormData(subscription, entities))
  }, [subscription, entities])

  // -- Field updaters -------------------------------------------------------

  const updateField = useCallback(<K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error for this field
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const handleAmountChange = useCallback(
    ({ amountMinor, currency }: { amountMinor: number; currency: string }) => {
      setFormData((prev) => ({
        ...prev,
        amount_minor: amountMinor,
        currency,
      }))
      setErrors((prev) => {
        const next = { ...prev }
        delete next.amount_minor
        return next
      })
    },
    []
  )

  // -- Reminder toggle helpers ----------------------------------------------

  const toggleReminderOffset = useCallback((days: number) => {
    setFormData((prev) => {
      const has = prev.reminder_offsets.includes(days)
      return {
        ...prev,
        reminder_offsets: has
          ? prev.reminder_offsets.filter((d) => d !== days)
          : [...prev.reminder_offsets, days].sort((a, b) => b - a),
      }
    })
  }, [])

  const toggleReminderChannel = useCallback((channel: string) => {
    setFormData((prev) => {
      const has = prev.reminder_channels.includes(channel)
      return {
        ...prev,
        reminder_channels: has
          ? prev.reminder_channels.filter((c) => c !== channel)
          : [...prev.reminder_channels, channel],
      }
    })
  }, [])

  // -- Validation -----------------------------------------------------------

  const validate = useCallback((): boolean => {
    const nextErrors: Record<string, string> = {}

    if (!formData.entity_id) nextErrors.entity_id = 'Select an entity'
    if (!formData.name.trim()) nextErrors.name = 'Name is required'
    if (!formData.vendor.trim()) nextErrors.vendor = 'Vendor is required'
    if (!formData.category.trim()) nextErrors.category = 'Category is required'
    if (formData.amount_minor === null || formData.amount_minor <= 0) {
      nextErrors.amount_minor = 'Amount must be greater than 0'
    }
    if (!formData.start_date) nextErrors.start_date = 'Start date is required'
    if (!formData.billing_cycle) nextErrors.billing_cycle = 'Billing cycle is required'

    // Validate trial has end date if billing_cycle is trial
    if (formData.billing_cycle === 'trial' && !formData.trial_end_date) {
      nextErrors.trial_end_date = 'Trial end date is required for trial subscriptions'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }, [formData])

  // -- Submit ---------------------------------------------------------------

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!validate()) return
      await onSubmit(formData)
    },
    [formData, onSubmit, validate]
  )

  // -- Status pill color helper ---------------------------------------------

  const statusPillColor = STATUSES.find((s) => s.value === formData.status)?.pillColor ?? '#6B6B6B'

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E8E6E1',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '640px',
      }}
    >
      {/* Header */}
      <h2
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#181818',
          margin: '0 0 20px 0',
        }}
      >
        {isEditMode ? `Edit: ${subscription.name}` : 'New Subscription'}
      </h2>

      {/* ── Row 1: Entity + Status ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Entity selector */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#6B6B6B',
              marginBottom: '8px',
            }}
          >
            Entity
          </label>
          <select
            value={formData.entity_id}
            onChange={(e) => updateField('entity_id', e.target.value)}
            style={{
              width: '100%',
              height: '44px',
              padding: '0 12px',
              fontSize: '14px',
              border: errors.entity_id ? '1px solid #E53E3E' : '1px solid #E5E5E5',
              borderRadius: '8px',
              backgroundColor: '#FFFFFF',
              color: '#181818',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
          {errors.entity_id && (
            <span style={{ fontSize: '12px', color: '#E53E3E', marginTop: '4px', display: 'block' }}>
              {errors.entity_id}
            </span>
          )}
        </div>

        {/* Status selector */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#6B6B6B',
              marginBottom: '8px',
            }}
          >
            Status
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => updateField('status', s.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: formData.status === s.value ? s.pillColor : '#E5E5E5',
                  backgroundColor: formData.status === s.value ? s.pillColor : '#FFFFFF',
                  color: formData.status === s.value ? '#FFFFFF' : '#6B6B6B',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: Name + Vendor ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <FormInput
          label="Subscription Name"
          value={formData.name}
          onChange={(v) => updateField('name', v)}
          placeholder="e.g. Claude Pro"
          error={errors.name}
          required
        />
        <FormInput
          label="Vendor"
          value={formData.vendor}
          onChange={(v) => updateField('vendor', v)}
          placeholder="e.g. Anthropic"
          error={errors.vendor}
          required
        />
      </div>

      {/* ── Row 3: Plan + Category ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <FormInput
          label="Plan"
          value={formData.plan}
          onChange={(v) => updateField('plan', v)}
          placeholder="e.g. Pro Monthly"
          error={undefined}
        />
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#6B6B6B',
              marginBottom: '8px',
            }}
          >
            Category
          </label>
          <input
            list="category-options"
            value={formData.category}
            onChange={(e) => updateField('category', e.target.value)}
            placeholder="e.g. AI & Software"
            style={{
              width: '100%',
              height: '44px',
              padding: '0 12px',
              fontSize: '14px',
              border: errors.category ? '1px solid #E53E3E' : '1px solid #E5E5E5',
              borderRadius: '8px',
              backgroundColor: '#FFFFFF',
              color: '#181818',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <datalist id="category-options">
            {DEFAULT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
          {errors.category && (
            <span style={{ fontSize: '12px', color: '#E53E3E', marginTop: '4px', display: 'block' }}>
              {errors.category}
            </span>
          )}
        </div>
      </div>

      {/* ── Row 4: Amount + Billing Cycle ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <CurrencyInput
          amountMinor={formData.amount_minor}
          currency={formData.currency}
          onChange={handleAmountChange}
          label="Amount"
          error={errors.amount_minor}
        />
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#6B6B6B',
              marginBottom: '8px',
            }}
          >
            Billing Cycle
          </label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {BILLING_CYCLES.map((bc) => (
              <button
                key={bc.value}
                type="button"
                onClick={() => updateField('billing_cycle', bc.value)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: formData.billing_cycle === bc.value ? '#181818' : '#E5E5E5',
                  backgroundColor: formData.billing_cycle === bc.value ? '#181818' : '#FFFFFF',
                  color: formData.billing_cycle === bc.value ? '#FFFFFF' : '#6B6B6B',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {bc.label}
              </button>
            ))}
          </div>
          {errors.billing_cycle && (
            <span style={{ fontSize: '12px', color: '#E53E3E', marginTop: '4px', display: 'block' }}>
              {errors.billing_cycle}
            </span>
          )}
        </div>
      </div>

      {/* ── Row 5: Dates ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        <FormDate
          label="Start Date"
          value={formData.start_date}
          onChange={(v) => updateField('start_date', v)}
          error={errors.start_date}
          required
        />
        <FormDate
          label="Trial End Date"
          value={formData.trial_end_date}
          onChange={(v) => updateField('trial_end_date', v)}
          error={errors.trial_end_date}
          disabled={formData.billing_cycle !== 'trial'}
        />
        <FormDate
          label="Next Payment"
          value={formData.next_payment_at}
          onChange={(v) => updateField('next_payment_at', v)}
          error={undefined}
        />
      </div>

      {/* ── Row 6: Reminders ── */}
      <div
        style={{
          backgroundColor: '#FAFAF7',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        <label
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 600,
            color: '#181818',
            marginBottom: '12px',
          }}
        >
          Reminder Offsets
        </label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {REMINDER_OFFSETS.map((ro) => {
            const active = formData.reminder_offsets.includes(ro.value)
            return (
              <button
                key={ro.value}
                type="button"
                onClick={() => toggleReminderOffset(ro.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: active ? '#181818' : '#E5E5E5',
                  backgroundColor: active ? '#181818' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#6B6B6B',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {ro.label}
              </button>
            )
          })}
        </div>

        <label
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 600,
            color: '#181818',
            marginBottom: '12px',
          }}
        >
          Reminder Channels
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {REMINDER_CHANNELS.map((rc) => {
            const active = formData.reminder_channels.includes(rc.value)
            return (
              <button
                key={rc.value}
                type="button"
                onClick={() => toggleReminderChannel(rc.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: active ? '#181818' : '#E5E5E5',
                  backgroundColor: active ? '#181818' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#6B6B6B',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {rc.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Row 7: Stack Radar toggle + Notes ── */}
      <div style={{ marginBottom: '16px' }}>
        {/* Stack Radar toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: '1px solid #E8E6E1',
            marginBottom: '16px',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#181818',
              }}
            >
              Show on Stack Radar
            </span>
            <span
              style={{
                display: 'block',
                fontSize: '12px',
                color: '#6B6B6B',
                marginTop: '2px',
              }}
            >
              Include this subscription in the Stack Radar dashboard
            </span>
          </div>
          <ToggleSwitch
            checked={formData.is_stack_radar}
            onChange={(v) => updateField('is_stack_radar', v)}
          />
        </div>

        {/* Notes */}
        <label
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 500,
            color: '#6B6B6B',
            marginBottom: '8px',
          }}
        >
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Add any notes about this subscription..."
          rows={3}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            border: '1px solid #E5E5E5',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            color: '#181818',
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              border: '1px solid #E5E5E5',
              backgroundColor: '#FFFFFF',
              color: '#6B6B6B',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            border: 'none',
            backgroundColor: '#181818',
            color: '#FFFFFF',
            cursor: isSubmitting ? 'wait' : 'pointer',
            opacity: isSubmitting ? 0.7 : 1,
            transition: 'opacity 0.15s ease',
          }}
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Reusable text input with label and error. */
function FormInput({
  label,
  value,
  onChange,
  placeholder,
  error,
  required = false,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  required?: boolean
  type?: string
}): React.JSX.Element {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: '13px',
          fontWeight: 500,
          color: '#6B6B6B',
          marginBottom: '8px',
        }}
      >
        {label}
        {required && <span style={{ color: '#E53E3E', marginLeft: '4px' }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          height: '44px',
          padding: '0 12px',
          fontSize: '14px',
          border: error ? '1px solid #E53E3E' : '1px solid #E5E5E5',
          borderRadius: '8px',
          backgroundColor: '#FFFFFF',
          color: '#181818',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {error && (
        <span style={{ fontSize: '12px', color: '#E53E3E', marginTop: '4px', display: 'block' }}>
          {error}
        </span>
      )}
    </div>
  )
}

/** Date input with label and error. */
function FormDate({
  label,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  required?: boolean
  disabled?: boolean
}): React.JSX.Element {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: '13px',
          fontWeight: 500,
          color: '#6B6B6B',
          marginBottom: '8px',
        }}
      >
        {label}
        {required && <span style={{ color: '#E53E3E', marginLeft: '4px' }}>*</span>}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%',
          height: '44px',
          padding: '0 12px',
          fontSize: '14px',
          border: error ? '1px solid #E53E3E' : '1px solid #E5E5E5',
          borderRadius: '8px',
          backgroundColor: disabled ? '#F5F5F5' : '#FFFFFF',
          color: disabled ? '#A0A0A0' : '#181818',
          outline: 'none',
          boxSizing: 'border-box',
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
      {error && (
        <span style={{ fontSize: '12px', color: '#E53E3E', marginTop: '4px', display: 'block' }}>
          {error}
        </span>
      )}
    </div>
  )
}

/** Toggle switch for boolean fields. */
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (value: boolean) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: '48px',
        height: '26px',
        borderRadius: '13px',
        border: 'none',
        backgroundColor: checked ? '#1F8A4C' : '#E5E5E5',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        padding: 0,
      }}
    >
      <span
        style={{
          display: 'block',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          position: 'absolute',
          top: '3px',
          left: checked ? '25px' : '3px',
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  )
}
