/**
 * ReminderSettings — Reminder preferences section.
 *
 * Includes:
 *   - Reminder channel checkboxes (in_app, email)
 *   - Default reminder offset chips for subscriptions
 *   - Note about per-subscription overrides
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { SettingsSection } from './SettingsSection'
import { updateSettings } from '@/lib/actions/settings'
import type { UserSettings } from '@/lib/supabase/database.types'

interface ReminderSettingsProps {
  settings: UserSettings
  onSaved: () => void
}

const DEFAULT_OFFSETS = [7, 3, 1, 0]
const CHANNEL_OPTIONS: { value: 'in_app' | 'email'; label: string }[] = [
  { value: 'in_app', label: 'In-app' },
  { value: 'email', label: 'Email' },
]

/**
 * Reminder preferences section with channel toggles and offset chips.
 *
 * @param settings — Current user settings from the database
 * @param onSaved — Callback fired after successful auto-save
 */
export function ReminderSettings({
  settings,
  onSaved,
}: ReminderSettingsProps): JSX.Element {
  const [channels, setChannels] = useState<('in_app' | 'email')[]>(
    settings.reminder_channels
  )
  const [offsets, setOffsets] = useState<number[]>(DEFAULT_OFFSETS)
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

  const toggleChannel = (channel: 'in_app' | 'email') => {
    const updated = channels.includes(channel)
      ? channels.filter((c) => c !== channel)
      : [...channels, channel]
    // Ensure at least one channel remains selected
    if (updated.length === 0) return
    setChannels(updated)
    debouncedSave({ reminder_channels: updated })
  }

  const toggleOffset = (offset: number) => {
    const updated = offsets.includes(offset)
      ? offsets.filter((o) => o !== offset)
      : [...offsets, offset].sort((a, b) => b - a)
    // Ensure at least one offset remains selected
    if (updated.length === 0) return
    setOffsets(updated)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <SettingsSection
      title="Reminder Preferences"
      description="Choose how and when you want to be notified."
    >
      {/* Channels */}
      <div className="space-y-2">
        <label className="block text-[13px] font-medium text-[#6B6B6B]">
          Reminder channels
        </label>
        <div className="flex gap-4">
          {CHANNEL_OPTIONS.map((option) => {
            const isChecked = channels.includes(option.value)
            return (
              <label
                key={option.value}
                className="flex items-center gap-2 cursor-pointer select-none"
              >
                <div
                  className={`flex items-center justify-center w-5 h-5 rounded border transition-colors ${
                    isChecked
                      ? 'bg-[#F37002] border-[#F37002]'
                      : 'border-[#E5E5E5] bg-white'
                  }`}
                  onClick={() => toggleChannel(option.value)}
                >
                  {isChecked && (
                    <svg
                      width="12"
                      height="10"
                      viewBox="0 0 12 10"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1 5L4 8L11 1"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-[14px] text-[#181818]">{option.label}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Default Offsets */}
      <div className="space-y-2 pt-2">
        <label className="block text-[13px] font-medium text-[#6B6B6B]">
          Default reminder offsets (days before)
        </label>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_OFFSETS.map((offset) => {
            const isActive = offsets.includes(offset)
            return (
              <button
                key={offset}
                type="button"
                onClick={() => toggleOffset(offset)}
                className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'bg-[#F37002] text-white'
                    : 'bg-[#F5F5F0] text-[#6B6B6B] hover:bg-[#EBEBE6]'
                }`}
              >
                {offset === 0 ? 'Same day' : `${offset} day${offset > 1 ? 's' : ''}`}
              </button>
            )
          })}
        </div>
        <p className="text-[12px] text-[#A0A0A0]">
          These defaults apply to new subscriptions. Set custom offsets on each
          subscription&apos;s detail page.
        </p>
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
