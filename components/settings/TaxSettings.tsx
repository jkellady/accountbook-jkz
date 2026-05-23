/**
 * TaxSettings — Tax configuration section for the Settings page.
 *
 * Includes:
 *   - Effective tax rate input (0–30%, step 0.1)
 *   - LHDN forecast income override (RM, 0 = auto)
 *   - CP500 instalment schedule table (6 editable rows)
 *   - CP502 threshold input
 *   - Tax reserve strategy sub-form (toggle + fields)
 *   - Disclaimer footer
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { SettingsSection } from './SettingsSection'
import { updateSettings, generateDefaultCP500Schedule } from '@/lib/actions/settings'
import type { UserSettings, CP500ScheduleItem } from '@/lib/supabase/database.types'

interface TaxSettingsProps {
  settings: UserSettings
  onSaved: () => void
}

/** Format minor units to RM string (e.g. 50000 → "500.00") */
function minorToRM(minor: number): string {
  return (minor / 100).toFixed(2)
}

/** Parse RM string to minor units (e.g. "500.00" → 50000) */
function rmToMinor(rm: string): number {
  const parsed = Math.round(parseFloat(rm) * 100)
  return isNaN(parsed) ? 0 : Math.max(0, parsed)
}

/**
 * Tax settings section with CP500 schedule, tax rate, and reserve strategy.
 *
 * @param settings — Current user settings from the database
 * @param onSaved — Callback fired after successful auto-save
 */
export function TaxSettings({ settings, onSaved }: TaxSettingsProps): JSX.Element {
  const [effectiveRate, setEffectiveRate] = useState<number>(
    settings.effective_tax_rate_percent
  )
  const [forecastIncome, setForecastIncome] = useState<string>(
    minorToRM(settings.lhdn_forecast_income_minor)
  )
  const [cp502Threshold, setCp502Threshold] = useState<number>(
    settings.cp502_threshold_percent
  )
  const [schedule, setSchedule] = useState<CP500ScheduleItem[]>(
    settings.cp500_schedule.length > 0
      ? settings.cp500_schedule
      : []
  )
  const [reserveStrategy, setReserveStrategy] = useState(
    settings.tax_reserve_strategy
  )
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  /** Debounced auto-save to the server */
  const debouncedSave = useCallback(
    (partial: Partial<UserSettings>) => {
      setSaveStatus('saving')
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        try {
          await updateSettings(partial)
          setSaveStatus('saved')
          onSaved()
          setTimeout(() => setSaveStatus('idle'), 2000)
        } catch {
          setSaveStatus('idle')
        }
      }, 500)
    },
    [onSaved]
  )

  const handleRateChange = (value: string) => {
    const num = parseFloat(value)
    if (isNaN(num)) return
    const clamped = Math.min(30, Math.max(0, Math.round(num * 10) / 10))
    setEffectiveRate(clamped)
    debouncedSave({ effective_tax_rate_percent: clamped })
  }

  const handleForecastChange = (value: string) => {
    setForecastIncome(value)
    const minor = rmToMinor(value)
    debouncedSave({ lhdn_forecast_income_minor: minor })
  }

  const handleCp502Change = (value: string) => {
    const num = parseFloat(value)
    if (isNaN(num)) return
    const clamped = Math.min(100, Math.max(0, Math.round(num * 10) / 10))
    setCp502Threshold(clamped)
    debouncedSave({ cp502_threshold_percent: clamped })
  }

  const handleScheduleChange = (
    index: number,
    field: keyof CP500ScheduleItem,
    value: string | number
  ) => {
    const updated = schedule.map((item, i) => {
      if (i !== index) return item
      if (field === 'amount_minor') {
        const minor = typeof value === 'string' ? rmToMinor(value) : value
        return { ...item, amount_minor: minor }
      }
      if (field === 'due_date') {
        return { ...item, due_date: value as string }
      }
      if (field === 'status') {
        return { ...item, status: value as string }
      }
      if (field === 'payment_method') {
        return { ...item, payment_method: value as string }
      }
      return item
    })
    setSchedule(updated)
    debouncedSave({ cp500_schedule: updated })
  }

  const handleAddAllCP500 = async () => {
    const year = new Date().getFullYear()
    const estimatedTax = rmToMinor(forecastIncome) > 0
      ? Math.round(rmToMinor(forecastIncome) * (effectiveRate / 100))
      : 120000 // RM 1,200 default if no income set
    const newSchedule = await generateDefaultCP500Schedule(year, estimatedTax)
    setSchedule(newSchedule)
    debouncedSave({ cp500_schedule: newSchedule })
  }

  const handleReserveToggle = () => {
    const updated = { ...reserveStrategy, enabled: !reserveStrategy.enabled }
    setReserveStrategy(updated)
    debouncedSave({ tax_reserve_strategy: updated })
  }

  const handleReserveChange = (
    field: keyof typeof reserveStrategy,
    value: string | number | boolean
  ) => {
    const updated = { ...reserveStrategy, [field]: value }
    setReserveStrategy(updated)
    debouncedSave({ tax_reserve_strategy: updated })
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <SettingsSection
      title="Tax Settings"
      description="Configure your tax year parameters, CP500 schedule, and reserve strategy."
    >
      {/* Effective Tax Rate */}
      <div className="space-y-1">
        <label className="block text-[13px] font-medium text-[#6B6B6B]">
          Effective tax rate (%)
        </label>
        <div className="relative max-w-[200px]">
          <input
            type="number"
            min={0}
            max={30}
            step={0.1}
            value={effectiveRate}
            onChange={(e) => handleRateChange(e.target.value)}
            onBlur={(e) => handleRateChange(e.target.value)}
            className="w-full h-11 px-3 pr-8 border border-[#E5E5E5] rounded-lg text-[14px] text-[#181818] focus:outline-none focus:border-[#F37002] focus:ring-1 focus:ring-[#F37002] transition-colors"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A0A0A0] text-[13px]">
            %
          </span>
        </div>
        <p className="text-[12px] text-[#A0A0A0]">
          Your estimated effective tax rate. Used for Tax Position forecast.
        </p>
      </div>

      {/* LHDN Forecast Income */}
      <div className="space-y-1 pt-2">
        <label className="block text-[13px] font-medium text-[#6B6B6B]">
          LHDN forecast income override (RM)
        </label>
        <div className="relative max-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A0A0] text-[14px]">
            RM
          </span>
          <input
            type="number"
            min={0}
            step={100}
            value={forecastIncome}
            onChange={(e) => handleForecastChange(e.target.value)}
            onBlur={(e) => handleForecastChange(e.target.value)}
            className="w-full h-11 pl-10 pr-3 border border-[#E5E5E5] rounded-lg text-[14px] text-[#181818] focus:outline-none focus:border-[#F37002] focus:ring-1 focus:ring-[#F37002] transition-colors"
          />
        </div>
        <p className="text-[12px] text-[#A0A0A0]">
          Leave 0 to use auto projection from your actual income.
        </p>
      </div>

      {/* CP500 Schedule */}
      <div className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-[13px] font-medium text-[#6B6B6B]">
            CP500 instalment schedule
          </label>
          <button
            type="button"
            onClick={handleAddAllCP500}
            className="text-[12px] font-medium text-[#F37002] hover:text-[#D56202] transition-colors"
          >
            + Add all 6
          </button>
        </div>

        {schedule.length > 0 ? (
          <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#FAFAF7]">
                  <th className="px-3 py-2 text-left text-[#6B6B6B] font-medium">
                    #
                  </th>
                  <th className="px-3 py-2 text-left text-[#6B6B6B] font-medium">
                    Due date
                  </th>
                  <th className="px-3 py-2 text-left text-[#6B6B6B] font-medium">
                    Amount (RM)
                  </th>
                  <th className="px-3 py-2 text-left text-[#6B6B6B] font-medium">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-[#6B6B6B] font-medium">
                    Method
                  </th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((item, index) => (
                  <tr
                    key={item.instalment_no}
                    className="border-t border-[#E5E5E5] hover:bg-[#FAFAF7]"
                  >
                    <td className="px-3 py-2 text-[#181818] font-medium">
                      {item.instalment_no}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={item.due_date}
                        onChange={(e) =>
                          handleScheduleChange(index, 'due_date', e.target.value)
                        }
                        className="w-[130px] h-8 px-2 border border-[#E5E5E5] rounded text-[12px] text-[#181818] focus:outline-none focus:border-[#F37002]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={minorToRM(item.amount_minor)}
                        onChange={(e) =>
                          handleScheduleChange(
                            index,
                            'amount_minor',
                            e.target.value
                          )
                        }
                        className="w-[100px] h-8 px-2 border border-[#E5E5E5] rounded text-[12px] text-[#181818] focus:outline-none focus:border-[#F37002]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={item.status || 'pending'}
                        onChange={(e) =>
                          handleScheduleChange(
                            index,
                            'status',
                            e.target.value
                          )
                        }
                        className="h-8 px-2 border border-[#E5E5E5] rounded text-[12px] text-[#181818] focus:outline-none focus:border-[#F37002]"
                      >
                        <option value="pending">Unpaid</option>
                        <option value="paid">Paid</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="e.g. FPX"
                        value={item.payment_method || ''}
                        onChange={(e) =>
                          handleScheduleChange(
                            index,
                            'payment_method',
                            e.target.value
                          )
                        }
                        className="w-[100px] h-8 px-2 border border-[#E5E5E5] rounded text-[12px] text-[#181818] focus:outline-none focus:border-[#F37002]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border border-dashed border-[#E5E5E5] rounded-lg p-6 text-center">
            <p className="text-[13px] text-[#A0A0A0]">
              No CP500 instalments scheduled yet.
            </p>
            <p className="text-[12px] text-[#A0A0A0] mt-1">
              Click "Add all 6" to generate the default schedule.
            </p>
          </div>
        )}
      </div>

      {/* CP502 Threshold */}
      <div className="space-y-1 pt-2">
        <label className="block text-[13px] font-medium text-[#6B6B6B]">
          CP502 top-up threshold (%)
        </label>
        <div className="relative max-w-[200px]">
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={cp502Threshold}
            onChange={(e) => handleCp502Change(e.target.value)}
            onBlur={(e) => handleCp502Change(e.target.value)}
            className="w-full h-11 px-3 pr-8 border border-[#E5E5E5] rounded-lg text-[14px] text-[#181818] focus:outline-none focus:border-[#F37002] focus:ring-1 focus:ring-[#F37002] transition-colors"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A0A0A0] text-[13px]">
            %
          </span>
        </div>
        <p className="text-[12px] text-[#A0A0A0]">
          Voluntary top-up trigger when instalments fall short of estimate.
        </p>
      </div>

      {/* Tax Reserve Strategy */}
      <div className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-[13px] font-medium text-[#6B6B6B]">
            Tax reserve strategy
          </label>
          <button
            type="button"
            onClick={handleReserveToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              reserveStrategy.enabled ? 'bg-[#F37002]' : 'bg-[#E5E5E5]'
            }`}
            aria-pressed={reserveStrategy.enabled}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                reserveStrategy.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {reserveStrategy.enabled && (
          <div className="pl-4 border-l-2 border-[#F37002] space-y-3">
            <div className="space-y-1">
              <label className="block text-[12px] font-medium text-[#6B6B6B]">
                Percent of income (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={reserveStrategy.percent_of_income}
                onChange={(e) =>
                  handleReserveChange(
                    'percent_of_income',
                    Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                  )
                }
                className="w-[120px] h-10 px-3 border border-[#E5E5E5] rounded-lg text-[13px] text-[#181818] focus:outline-none focus:border-[#F37002] focus:ring-1 focus:ring-[#F37002]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[12px] font-medium text-[#6B6B6B]">
                Target account name
              </label>
              <input
                type="text"
                value={reserveStrategy.target_account_name}
                onChange={(e) =>
                  handleReserveChange('target_account_name', e.target.value)
                }
                className="w-full max-w-[280px] h-10 px-3 border border-[#E5E5E5] rounded-lg text-[13px] text-[#181818] focus:outline-none focus:border-[#F37002] focus:ring-1 focus:ring-[#F37002]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[12px] font-medium text-[#6B6B6B]">
                Reminder day of month
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={reserveStrategy.reminder_day_of_month}
                onChange={(e) =>
                  handleReserveChange(
                    'reminder_day_of_month',
                    Math.min(31, Math.max(1, parseInt(e.target.value) || 1))
                  )
                }
                className="w-[100px] h-10 px-3 border border-[#E5E5E5] rounded-lg text-[13px] text-[#181818] focus:outline-none focus:border-[#F37002] focus:ring-1 focus:ring-[#F37002]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="pt-3 pb-1">
        <p className="text-[11px] text-[#A0A0A0] leading-relaxed">
          <strong>Disclaimer:</strong> This is a simplification. Your actual tax
          rate depends on your chargeable income bracket under the Malaysian tax
          scale. Consult a tax professional for precise calculations.
        </p>
      </div>

      {/* Save status indicator */}
      {saveStatus !== 'idle' && (
        <div className="flex justify-end">
          <span
            className={`text-[12px] font-medium ${
              saveStatus === 'saving'
                ? 'text-[#A0A0A0]'
                : 'text-green-600'
            }`}
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
          </span>
        </div>
      )}
    </SettingsSection>
  )
}
