/**
 * TransactionForm — Complete transaction entry and editing form
 *
 * This form serves dual purposes:
 *   1. Manual transaction entry when AI extraction fails or the user wants to
 *      log a transaction directly.
 *   2. Editing an AI-extracted transaction from the review queue.
 *
 * Uses React Hook Form with Zod resolver for real-time validation.
 * Every field maps 1:1 to the transactions table — no invented columns.
 *
 * @example
 * // Manual entry (new transaction)
 * <TransactionForm
 *   entities={entities}
 *   existingTags={['urgent', 'client-a']}
 *   activeProjects={projects}
 *   activeSubscriptions={subscriptions}
 *   onSubmit={(data, action) => saveToSupabase(data)}
 *   onCancel={() => router.back()}
 * />
 *
 * @example
 * // Editing an AI-extracted transaction from review queue
 * <TransactionForm
 *   defaultValues={extractedTransaction}
 *   mode="review"
 *   entities={entities}
 *   existingTags={['urgent', 'client-a']}
 *   activeProjects={projects}
 *   activeSubscriptions={subscriptions}
 *   linkedFile={receiptFile}
 *   onSubmit={(data, action) => approveTransaction(data)}
 *   onCancel={() => router.back()}
 * />
 */

"use client"


import React, { useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  transactionFormSchema,
  type TransactionFormData,
  type ToggleEntity,
} from '@/lib/validation/transaction'

import { EntityToggle } from './EntityToggle'
import { CurrencyInput } from './CurrencyInput'
import { CategorySelector } from './CategorySelector'
import { TagInput } from './TagInput'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** Project option for the project dropdown — minimal shape from projects table. */
export interface ProjectOption {
  readonly id: string
  readonly name: string
  readonly client: string
}

/** Subscription option for the subscription dropdown — minimal shape. */
export interface SubscriptionOption {
  readonly id: string
  readonly name: string
  readonly vendor: string
}

/** File info when a file is linked (e.g. AI-extracted receipt). */
export interface LinkedFileInfo {
  readonly id: string
  readonly display_filename: string | null
  readonly original_filename: string
  readonly mime_type: string
}

/** Form operating mode. */
export type FormMode = 'create' | 'review'

/** Submit action — determines the status field value. */
export type SubmitAction = 'queue' | 'approve'

interface TransactionFormProps {
  /** Form mode — 'create' for manual entry, 'review' for editing AI extraction. */
  readonly mode?: FormMode
  /** The two entities (Personal + JK Zentra). */
  readonly entities: readonly ToggleEntity[]
  /** All existing tags from the database for autocomplete. */
  readonly existingTags: readonly string[]
  /** Active projects for the project link dropdown. */
  readonly activeProjects: readonly ProjectOption[]
  /** Active subscriptions for the subscription link dropdown. */
  readonly activeSubscriptions: readonly SubscriptionOption[]
  /** Pre-populated values when editing an existing transaction. */
  readonly defaultValues?: Partial<TransactionFormData>
  /** Linked file info when a receipt/invoice is attached (e.g. from AI extraction). */
  readonly linkedFile?: LinkedFileInfo | null
  /** Disable all fields during submission. */
  readonly isSubmitting?: boolean
  /** Called on form submission with validated data and the chosen action. */
  readonly onSubmit: (data: TransactionFormData, action: SubmitAction) => void | Promise<void>
  /** Called when user clicks Cancel. */
  readonly onCancel: () => void
}

// ----------------------------------------------------------------------------
// Default values for a new transaction
// ----------------------------------------------------------------------------

function buildDefaults(entities: readonly ToggleEntity[]): TransactionFormData {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const defaultEntityId = entities[0]?.id ?? ''

  return {
    entity_id: defaultEntityId,
    type: 'expense',
    amount_minor: 0,
    currency: 'MYR',
    occurred_at: today,
    vendor: '',
    category: '',
    subcategory: null,
    description: null,
    notes: null,
    tags: [],
    file_id: null,
    subscription_id: null,
    project_id: null,
    status: 'pending_review',
  }
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function TransactionForm({
  mode = 'create',
  entities,
  existingTags,
  activeProjects,
  activeSubscriptions,
  defaultValues,
  linkedFile = null,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: TransactionFormProps): React.JSX.Element {
  // --------------------------------------------------------------------------
  // React Hook Form setup
  // --------------------------------------------------------------------------

  const mergedDefaults = React.useMemo<TransactionFormData>(() => {
    const base = buildDefaults(entities)
    if (!defaultValues) return base

    return {
      ...base,
      ...defaultValues,
      // Ensure arrays are not null
      tags: defaultValues.tags ?? base.tags,
    }
  }, [defaultValues, entities])

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isDirty },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: mergedDefaults,
    mode: 'onChange', // Real-time validation
  })

  // Watch values for conditional rendering and derived state
  const watchedType = watch('type')
  const watchedCategory = watch('category')
  const watchedFileId = watch('file_id')
  const watchedTags = watch('tags')
  const watchedAmountMinor = watch('amount_minor')
  const watchedCurrency = watch('currency')
  const watchedSubcategory = watch('subcategory')

  // --------------------------------------------------------------------------
  // Derived state
  // --------------------------------------------------------------------------

  const isReviewMode = mode === 'review'
  const hasFileLinked = watchedFileId !== null

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const handleFormSubmit = useCallback(
    (action: SubmitAction) => {
      return handleSubmit((data: TransactionFormData) => {
        // Override status based on the submit action
        const finalData: TransactionFormData = {
          ...data,
          status: action === 'approve' ? 'active' : 'pending_review',
        }
        return onSubmit(finalData, action)
      })()
    },
    [handleSubmit, onSubmit],
  )

  const handleUnlinkFile = useCallback(() => {
    setValue('file_id', null, { shouldDirty: true })
  }, [setValue])

  // --------------------------------------------------------------------------
  // Shared label style
  // --------------------------------------------------------------------------

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#6B6B6B',
    marginBottom: '8px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '44px',
    padding: '0 12px',
    borderRadius: '8px',
    border: '1px solid #E5E5E5',
    backgroundColor: '#FFFFFF',
    fontSize: '14px',
    color: '#181818',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  }

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    height: 'auto',
    minHeight: '80px',
    padding: '10px 12px',
    resize: 'vertical',
    lineHeight: 1.5,
  }

  const errorStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    color: '#E53E3E',
    marginTop: '6px',
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      style={{
        backgroundColor: '#FAFAF7',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '640px',
        margin: '0 auto',
      }}
      noValidate
    >
      {/* ======================================================================
          Header
          ====================================================================== */}
      <div
        style={{
          marginBottom: '24px',
          borderBottom: '1px solid #E8E6E1',
          paddingBottom: '16px',
        }}
      >
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#181818',
            margin: 0,
          }}
        >
          {isReviewMode ? 'Review Transaction' : 'New Transaction'}
        </h2>
        <p
          style={{
            fontSize: '13px',
            color: '#6B6B6B',
            margin: '6px 0 0 0',
          }}
        >
          {isReviewMode
            ? 'Review and correct the AI-extracted details below.'
            : 'Enter the transaction details manually.'}
        </p>
      </div>

      {/* ======================================================================
          1. Type selector
          ====================================================================== */}
      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Type</label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <div
              role="radiogroup"
              aria-label="Transaction type"
              style={{
                display: 'flex',
                gap: '8px',
              }}
            >
              {(['income', 'expense', 'tax_prepayment', 'tax_payment_final', 'tax_reserve_transfer'] as const).map(
                (t) => {
                  const isSelected = field.value === t
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={isSubmitting}
                      onClick={() => field.onChange(t)}
                      style={{
                        flex: 1,
                        height: '44px',
                        borderRadius: '8px',
                        border: isSelected
                          ? '2px solid #F37002'
                          : '1px solid #E5E5E5',
                        backgroundColor: isSelected
                          ? '#F3700214'
                          : '#FFFFFF',
                        color: isSelected ? '#F37002' : '#6B6B6B',
                        fontSize: '13px',
                        fontWeight: isSelected ? 600 : 400,
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        opacity: isSubmitting ? 0.5 : 1,
                        transition: 'all 0.15s ease',
                        textTransform: 'capitalize',
                        padding: '0 8px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t === 'tax_payment_final'
                        ? 'Tax Final'
                        : t === 'tax_prepayment'
                          ? 'Tax Pre'
                          : t === 'tax_reserve_transfer'
                            ? 'Tax Reserve'
                            : t}
                    </button>
                  )
                },
              )}
            </div>
          )}
        />
        {errors.type && <span role="alert" style={errorStyle}>{errors.type.message}</span>}
      </div>

      {/* ======================================================================
          2. Entity selector
          ====================================================================== */}
      <div style={{ marginBottom: '20px' }}>
        <Controller
          name="entity_id"
          control={control}
          render={({ field }) => (
            <EntityToggle
              value={field.value}
              onChange={(id) => field.onChange(id)}
              entities={entities}
              error={errors.entity_id?.message}
              disabled={isSubmitting}
            />
          )}
        />
      </div>

      {/* ======================================================================
          3. Vendor
          ====================================================================== */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="vendor" style={labelStyle}>
          Vendor
        </label>
        <Controller
          name="vendor"
          control={control}
          render={({ field }) => (
            <input
              id="vendor"
              type="text"
              placeholder="e.g. OpenAI, Grab, Client ABC"
              disabled={isSubmitting}
              aria-invalid={!!errors.vendor}
              aria-describedby={errors.vendor ? 'vendor-error' : undefined}
              style={{
                ...inputStyle,
                borderColor: errors.vendor ? '#E53E3E' : '#E5E5E5',
              }}
              {...field}
              value={field.value ?? ''}
            />
          )}
        />
        {errors.vendor && (
          <span id="vendor-error" role="alert" style={errorStyle}>
            {errors.vendor.message}
          </span>
        )}
      </div>

      {/* ======================================================================
          4. Amount with currency — NOT nested controllers
          ====================================================================== */}
      <div style={{ marginBottom: '20px' }}>
        <CurrencyInput
          amountMinor={watchedAmountMinor ?? null}
          currency={watchedCurrency as 'MYR' | 'USD' | 'SGD' | 'EUR' | 'GBP'}
          onChange={({ amountMinor, currency }) => {
            setValue('amount_minor', amountMinor, { shouldValidate: true })
            setValue('currency', currency, { shouldValidate: true })
          }}
          error={errors.amount_minor?.message}
          disabled={isSubmitting}
        />
      </div>

      {/* ======================================================================
          5. Date
          ====================================================================== */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="occurred_at" style={labelStyle}>
          Date
        </label>
        <Controller
          name="occurred_at"
          control={control}
          render={({ field }) => (
            <input
              id="occurred_at"
              type="date"
              disabled={isSubmitting}
              aria-invalid={!!errors.occurred_at}
              aria-describedby={errors.occurred_at ? 'date-error' : undefined}
              style={{
                ...inputStyle,
                borderColor: errors.occurred_at ? '#E53E3E' : '#E5E5E5',
              }}
              {...field}
            />
          )}
        />
        {errors.occurred_at && (
          <span id="date-error" role="alert" style={errorStyle}>
            {errors.occurred_at.message}
          </span>
        )}
      </div>

      {/* ======================================================================
          6. Category + Subcategory — NOT nested controllers
          ====================================================================== */}
      <div style={{ marginBottom: '20px' }}>
        <CategorySelector
          category={watchedCategory ?? ''}
          subcategory={watchedSubcategory ?? null}
          onChange={({ category, subcategory }) => {
            setValue('category', category, { shouldValidate: true })
            setValue('subcategory', subcategory, { shouldValidate: true })
          }}
          categoryError={errors.category?.message}
          disabled={isSubmitting}
        />
      </div>

      {/* ======================================================================
          7. Description
          ====================================================================== */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="description" style={labelStyle}>
          Description{' '}
          <span style={{ fontWeight: 400, color: '#A0A0A0' }}>(optional)</span>
        </label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <textarea
              id="description"
              placeholder="Brief description of the transaction"
              disabled={isSubmitting}
              rows={3}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'desc-error' : undefined}
              style={{
                ...textareaStyle,
                borderColor: errors.description ? '#E53E3E' : '#E5E5E5',
              }}
              {...field}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value || null)}
            />
          )}
        />
        {errors.description && (
          <span id="desc-error" role="alert" style={errorStyle}>
            {errors.description.message}
          </span>
        )}
      </div>

      {/* ======================================================================
          8. Notes (internal)
          ====================================================================== */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="notes" style={labelStyle}>
          Notes{' '}
          <span style={{ fontWeight: 400, color: '#A0A0A0' }}>(internal only)</span>
        </label>
        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <textarea
              id="notes"
              placeholder="Internal notes — not visible on reports"
              disabled={isSubmitting}
              rows={2}
              aria-invalid={!!errors.notes}
              aria-describedby={errors.notes ? 'notes-error' : undefined}
              style={{
                ...textareaStyle,
                minHeight: '60px',
                borderColor: errors.notes ? '#E53E3E' : '#E5E5E5',
              }}
              {...field}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value || null)}
            />
          )}
        />
        {errors.notes && (
          <span id="notes-error" role="alert" style={errorStyle}>
            {errors.notes.message}
          </span>
        )}
      </div>

      {/* ======================================================================
          9. Tags
          ====================================================================== */}
      <div style={{ marginBottom: '20px' }}>
        <Controller
          name="tags"
          control={control}
          render={({ field }) => (
            <TagInput
              tags={field.value ?? []}
              existingTags={existingTags}
              onChange={(newTags) => field.onChange(newTags)}
              disabled={isSubmitting}
            />
          )}
        />
      </div>

      {/* ======================================================================
          10. File attachment
          ====================================================================== */}
      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Receipt / File</label>

        {hasFileLinked && linkedFile ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #E5E5E5',
              backgroundColor: '#FFFFFF',
            }}
          >
            {/* File thumbnail placeholder */}
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '6px',
                backgroundColor: '#FAFAF7',
                border: '1px solid #E8E6E1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0,
              }}
            >
              {linkedFile.mime_type.startsWith('image/') ? '\u{1F5BC}' : '\u{1F4C4}'}
            </div>

            {/* File info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#181818',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {linkedFile.display_filename ?? linkedFile.original_filename}
              </p>
              <p
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '12px',
                  color: '#6B6B6B',
                }}
              >
                {linkedFile.mime_type}
              </p>
            </div>

            {/* Unlink button */}
            <button
              type="button"
              onClick={handleUnlinkFile}
              disabled={isSubmitting}
              aria-label="Unlink file"
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #E5E5E5',
                backgroundColor: '#FFFFFF',
                color: '#6B6B6B',
                fontSize: '12px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.5 : 1,
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#E53E3E'
                e.currentTarget.style.color = '#E53E3E'
                e.currentTarget.style.backgroundColor = '#FFF5F5'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#E5E5E5'
                e.currentTarget.style.color = '#6B6B6B'
                e.currentTarget.style.backgroundColor = '#FFFFFF'
              }}
            >
              Unlink
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              border: '1px dashed #E5E5E5',
              backgroundColor: '#FFFFFF',
              textAlign: 'center',
              color: '#6B6B6B',
              fontSize: '13px',
            }}
          >
            No file attached
          </div>
        )}

        <Controller
          name="file_id"
          control={control}
          render={({ field }) => (
            <input type="hidden" {...field} value={field.value ?? ''} />
          )}
        />
      </div>

      {/* ======================================================================
          11. Project link
          ====================================================================== */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="project_id" style={labelStyle}>
          Link to Project{' '}
          <span style={{ fontWeight: 400, color: '#A0A0A0' }}>(optional)</span>
        </label>
        <Controller
          name="project_id"
          control={control}
          render={({ field }) => (
            <select
              id="project_id"
              disabled={isSubmitting}
              aria-label="Link to project"
              style={{
                ...inputStyle,
                appearance: 'none',
                WebkitAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B6B6B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '36px',
              }}
              {...field}
              value={field.value ?? ''}
              onChange={(e) =>
                field.onChange(e.target.value || null)
              }
            >
              <option value="">No project</option>
              {activeProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} — {project.client}
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* ======================================================================
          12. Subscription link
          ====================================================================== */}
      <div style={{ marginBottom: '28px' }}>
        <label htmlFor="subscription_id" style={labelStyle}>
          Link to Subscription{' '}
          <span style={{ fontWeight: 400, color: '#A0A0A0' }}>(optional)</span>
        </label>
        <Controller
          name="subscription_id"
          control={control}
          render={({ field }) => (
            <select
              id="subscription_id"
              disabled={isSubmitting}
              aria-label="Link to subscription"
              style={{
                ...inputStyle,
                appearance: 'none',
                WebkitAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B6B6B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '36px',
              }}
              {...field}
              value={field.value ?? ''}
              onChange={(e) =>
                field.onChange(e.target.value || null)
              }
            >
              <option value="">No subscription</option>
              {activeSubscriptions.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.vendor})
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* ======================================================================
          Submit buttons
          ====================================================================== */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          borderTop: '1px solid #E8E6E1',
          paddingTop: '20px',
        }}
      >
        {/* Save to Queue — always available */}
        <button
          type="button"
          onClick={() => handleFormSubmit('queue')}
          disabled={isSubmitting}
          style={{
            flex: '1 1 140px',
            height: '44px',
            borderRadius: '8px',
            border: '1px solid #E5E5E5',
            backgroundColor: '#FFFFFF',
            color: '#181818',
            fontSize: '14px',
            fontWeight: 500,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          {isSubmitting ? 'Saving...' : 'Save to Queue'}
        </button>

        {/* Save & Approve — primary action */}
        <button
          type="button"
          onClick={() => handleFormSubmit('approve')}
          disabled={isSubmitting}
          style={{
            flex: '2 1 200px',
            height: '44px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#F37002',
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.7 : 1,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!isSubmitting) e.currentTarget.style.backgroundColor = '#E06500'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#F37002'
          }}
        >
          {isSubmitting ? 'Saving...' : isReviewMode ? 'Approve' : 'Save & Approve'}
        </button>

        {/* Cancel */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          style={{
            flex: '1 1 100px',
            height: '44px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#6B6B6B',
            fontSize: '14px',
            fontWeight: 500,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.5 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
