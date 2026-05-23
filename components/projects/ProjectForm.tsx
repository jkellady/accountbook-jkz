/**
 * ============================================================================
 * JK Zentra Finance Cockpit — Project Form
 * ============================================================================
 *
 * Create/edit form for projects. Handles validation, currency input,
 * date fields, entity selector, and status dropdown.
 *
 * All 10 status values are supported in the status dropdown.
 * On create, default status is 'quoted'.
 */

'use client'

import { useState, useCallback } from 'react'
import { formatAmount, parseAmount } from '@/lib/utils/currency'
import type { ProjectInsert, ProjectUpdate, ProjectStatus } from '@/lib/supabase/database.types'
import { PROJECT_STATUS_LABELS } from '@/lib/actions/projects'
import type { EntityRow } from '@/lib/supabase/database.types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectFormProps {
  /** Pre-populated data for edit mode. If omitted, the form is in create mode. */
  initialData?: {
    id: string
    entity_id: string
    name: string
    client: string
    total_value_minor: number
    currency: string
    payment_schedule_note: string | null
    status: ProjectStatus
    start_date: string
    expected_delivery_date: string | null
    notes: string | null
  }
  /** Available entities for the selector. */
  entities: EntityRow[]
  /** Called when the form is submitted successfully. */
  onSubmit: (data: ProjectInsert | (ProjectUpdate & { id: string })) => void
  /** Called when the user cancels. */
  onCancel: () => void
}

/** Form-level validation errors. */
interface FormErrors {
  name?: string
  client?: string
  total_value?: string
  currency?: string
  start_date?: string
}

// ---------------------------------------------------------------------------
// Status list — all valid project statuses
// ---------------------------------------------------------------------------

const ALL_STATUSES: ProjectStatus[] = [
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
  'archived',
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Project create/edit form with full validation.
 *
 * @param props - ProjectFormProps
 * @returns JSX.Element
 */
export function ProjectForm({
  initialData,
  entities,
  onSubmit,
  onCancel,
}: ProjectFormProps): JSX.Element {
  const isEdit = !!initialData

  // -------------------------------------------------------------------------
  // Form state
  // -------------------------------------------------------------------------

  const [name, setName] = useState(initialData?.name ?? '')
  const [client, setClient] = useState(initialData?.client ?? '')
  const [totalValueInput, setTotalValueInput] = useState(() => {
    if (initialData?.total_value_minor) {
      return (initialData.total_value_minor / 100).toFixed(2)
    }
    return ''
  })
  const [currency, setCurrency] = useState(initialData?.currency ?? 'MYR')
  const [paymentScheduleNote, setPaymentScheduleNote] = useState(
    initialData?.payment_schedule_note ?? ''
  )
  const [status, setStatus] = useState<ProjectStatus>(
    initialData?.status ?? 'quoted'
  )
  const [startDate, setStartDate] = useState(initialData?.start_date ?? '')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    initialData?.expected_delivery_date ?? ''
  )
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [entityId, setEntityId] = useState(
    initialData?.entity_id ?? (entities[0]?.id ?? '')
  )
  const [errors, setErrors] = useState<FormErrors>({})

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  /**
   * Validate all required fields and return true if valid.
   */
  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!name.trim()) {
      newErrors.name = 'Project name is required'
    }
    if (!client.trim()) {
      newErrors.client = 'Client name is required'
    }
    if (!totalValueInput.trim()) {
      newErrors.total_value = 'Total value is required'
    } else {
      const parsed = parseFloat(totalValueInput.replace(/,/g, ''))
      if (isNaN(parsed) || parsed < 0) {
        newErrors.total_value = 'Enter a valid amount'
      }
    }
    if (!currency.trim()) {
      newErrors.currency = 'Currency is required'
    }
    if (!startDate) {
      newErrors.start_date = 'Start date is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [name, client, totalValueInput, currency, startDate])

  // -------------------------------------------------------------------------
  // Submit handler
  // -------------------------------------------------------------------------

  const handleSubmit = useCallback(() => {
    if (!validate()) return

    const totalValueMinor = parseAmount(totalValueInput, currency)

    if (isEdit && initialData) {
      const updateData: ProjectUpdate & { id: string } = {
        id: initialData.id,
        entity_id: entityId,
        name: name.trim(),
        client: client.trim(),
        total_value_minor: totalValueMinor,
        currency,
        payment_schedule_note: paymentScheduleNote.trim() || null,
        status,
        start_date: startDate,
        expected_delivery_date: expectedDeliveryDate || null,
        notes: notes.trim() || null,
      }
      onSubmit(updateData)
    } else {
      const insertData: ProjectInsert = {
        entity_id: entityId,
        name: name.trim(),
        client: client.trim(),
        total_value_minor: totalValueMinor,
        currency,
        payment_schedule_note: paymentScheduleNote.trim() || null,
        status,
        start_date: startDate,
        expected_delivery_date: expectedDeliveryDate || null,
        notes: notes.trim() || null,
      }
      onSubmit(insertData)
    }
  }, [
    validate,
    totalValueInput,
    currency,
    isEdit,
    initialData,
    entityId,
    name,
    client,
    paymentScheduleNote,
    status,
    startDate,
    expectedDeliveryDate,
    notes,
    onSubmit,
  ])

  // -------------------------------------------------------------------------
  // Shared input styles
  // -------------------------------------------------------------------------

  const inputClass =
    'w-full px-3 py-2 bg-white border border-[#E8E6E1] rounded-lg text-sm ' +
    'text-[#181818] placeholder-[#A0A0A0] focus:outline-none focus:ring-2 ' +
    'focus:ring-[#F37002] focus:border-transparent'

  const errorClass = 'text-[#EF4444] text-xs mt-1'

  const labelClass = 'block text-sm font-medium text-[#181818] mb-1'

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-xl border border-[#E8E6E1] p-6">
      <h2 className="text-xl font-bold text-[#181818] mb-6">
        {isEdit ? 'Edit Project' : 'New Project'}
      </h2>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="project-name" className={labelClass}>
            Project Name <span className="text-[#EF4444]">*</span>
          </label>
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Corp Website"
            className={inputClass}
          />
          {errors.name && <p className={errorClass}>{errors.name}</p>}
        </div>

        {/* Client */}
        <div>
          <label htmlFor="project-client" className={labelClass}>
            Client <span className="text-[#EF4444]">*</span>
          </label>
          <input
            id="project-client"
            type="text"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="e.g. Acme Corporation"
            className={inputClass}
          />
          {errors.client && <p className={errorClass}>{errors.client}</p>}
        </div>

        {/* Total Value + Currency */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="project-value" className={labelClass}>
              Total Value <span className="text-[#EF4444]">*</span>
            </label>
            <input
              id="project-value"
              type="text"
              value={totalValueInput}
              onChange={(e) => setTotalValueInput(e.target.value)}
              placeholder="0.00"
              className={inputClass}
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
            {errors.total_value && (
              <p className={errorClass}>{errors.total_value}</p>
            )}
          </div>
          <div>
            <label htmlFor="project-currency" className={labelClass}>
              Currency <span className="text-[#EF4444]">*</span>
            </label>
            <select
              id="project-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inputClass}
            >
              <option value="MYR">MYR — RM</option>
              <option value="USD">USD — $</option>
              <option value="SGD">SGD — S$</option>
              <option value="EUR">EUR — &euro;</option>
              <option value="GBP">GBP — &pound;</option>
            </select>
          </div>
        </div>

        {/* Entity Selector */}
        <div>
          <label htmlFor="project-entity" className={labelClass}>
            Entity <span className="text-[#EF4444]">*</span>
          </label>
          <select
            id="project-entity"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className={inputClass}
          >
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label htmlFor="project-status" className={labelClass}>
            Status
          </label>
          <select
            id="project-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            className={inputClass}
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="project-start" className={labelClass}>
              Start Date <span className="text-[#EF4444]">*</span>
            </label>
            <input
              id="project-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
            {errors.start_date && (
              <p className={errorClass}>{errors.start_date}</p>
            )}
          </div>
          <div>
            <label htmlFor="project-due" className={labelClass}>
              Expected Delivery
            </label>
            <input
              id="project-due"
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Payment Schedule Note */}
        <div>
          <label htmlFor="project-payment-schedule" className={labelClass}>
            Payment Schedule
          </label>
          <textarea
            id="project-payment-schedule"
            value={paymentScheduleNote}
            onChange={(e) => setPaymentScheduleNote(e.target.value)}
            placeholder="e.g. 50% deposit on signing, 50% on delivery"
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="project-notes" className={labelClass}>
            Notes
          </label>
          <textarea
            id="project-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes about this project..."
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E8E6E1]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[#181818] 
                       bg-[#F5F5F2] rounded-lg hover:bg-[#E8E6E1] 
                       transition-colors focus:outline-none focus:ring-2 
                       focus:ring-[#E8E6E1] focus:ring-offset-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white 
                       bg-[#F37002] rounded-lg hover:bg-[#D95F00] 
                       transition-colors focus:outline-none focus:ring-2 
                       focus:ring-[#F37002] focus:ring-offset-1"
          >
            {isEdit ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}
