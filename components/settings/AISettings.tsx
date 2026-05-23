/**
 * AISettings — AI configuration section for the Settings page.
 *
 * Includes:
 *   - Monthly AI cost cap (RM input, range 1–50)
 *   - Fallback model toggle (GPT-4o-mini on by default)
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { SettingsSection } from './SettingsSection'
import { updateSettings } from '@/lib/actions/settings'
import type { UserSettings } from '@/lib/supabase/database.types'

interface AISettingsProps {
  settings: UserSettings
  onSaved: () => void
}

/** Convert minor units (sen) to RM display string */
function minorToRM(minor: number): string {
  return (minor / 100).toFixed(2)
}

/** Parse RM string to minor units (sen) */
function rmToMinor(rm: string): number {
  const parsed = Math.round(parseFloat(rm) * 100)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * AI settings section with cost cap and model fallback toggle.
 *
 * @param settings — Current user settings from the database
 * @param onSaved — Callback fired after successful auto-save
 */
export function AISettings({ settings, onSaved }: AISettingsProps): JSX.Element {
  const [capRM, setCapRM] = useState<string>(
    minorToRM(settings.monthly_ai_cost_cap_minor)
  )
  const [fallbackEnabled, setFallbackEnabled] = useState<boolean>(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

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

  const handleCapChange = (value: string) => {
    setCapRM(value)
    const minor = rmToMinor(value)
    // Clamp to valid range: 1.00 - 50.00 RM
    const clamped = Math.min(5000, Math.max(100, minor))
    debouncedSave({ monthly_ai_cost_cap_minor: clamped })
  }

  const handleFallbackToggle = () => {
    setFallbackEnabled((prev) => !prev)
    // Note: fallback model preference is not stored in DB schema
    // This is UI-only state for now; could be added to settings JSONB later
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <SettingsSection
      title="AI Settings"
      description="Control AI extraction costs and model preferences."
    >
      {/* Monthly Cost Cap */}
      <div className="space-y-1">
        <label className="block text-[13px] font-medium text-[#6B6B6B]">
          Monthly AI cost cap (RM)
        </label>
        <div className="relative max-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A0A0] text-[14px]">
            RM
          </span>
          <input
            type="number"
            min={1}
            max={50}
            step={1}
            value={capRM}
            onChange={(e) => handleCapChange(e.target.value)}
            onBlur={(e) => handleCapChange(e.target.value)}
            className="w-full h-11 pl-10 pr-3 border border-[#E5E5E5] rounded-lg text-[14px] text-[#181818] focus:outline-none focus:border-[#F37002] focus:ring-1 focus:ring-[#F37002] transition-colors"
          />
        </div>
        <p className="text-[12px] text-[#A0A0A0]">
          Maximum spend on AI extraction per month. We&apos;ll stop processing if
          cap reached.
        </p>
        <p className="text-[12px] text-[#A0A0A0]">
          Range: RM 1.00 – RM 50.00
        </p>
      </div>

      {/* Fallback Model Toggle */}
      <div className="pt-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <label className="block text-[13px] font-medium text-[#6B6B6B]">
              Fallback model
            </label>
            <p className="text-[12px] text-[#A0A0A0]">
              Use GPT-4o-mini for lower cost when primary model exceeds cap
            </p>
          </div>
          <button
            type="button"
            onClick={handleFallbackToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              fallbackEnabled ? 'bg-[#F37002]' : 'bg-[#E5E5E5]'
            }`}
            aria-pressed={fallbackEnabled}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                fallbackEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Save status */}
      {saveStatus !== 'idle' && (
        <div className="flex justify-end">
          <span
            className={`text-[12px] font-medium ${
              saveStatus === 'saving' ? 'text-[#A0A0A0]' : 'text-green-600'
            }`}
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
          </span>
        </div>
      )}
    </SettingsSection>
  )
}
