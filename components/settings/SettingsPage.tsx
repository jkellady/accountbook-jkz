/**
 * SettingsPage — Main settings page for JK Zentra Finance Cockpit.
 *
 * Composes all settings sections into a vertical single-column layout:
 *   1. Profile
 *   2. Default Preferences
 *   3. Tax Settings
 *   4. Reminder Preferences
 *   5. AI Settings
 *   6. FX Preferences
 *   7. Data & Backup
 *   8. Danger Zone
 *
 * Features:
 *   - Per-section save (not global)
 *   - Auto-save on blur (debounced 500ms) with toast feedback
 *   - Zod validation on all numeric inputs
 *   - Fully typed — no `any`
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { SettingsSection } from './SettingsSection'
import { TaxSettings } from './TaxSettings'
import { ReminderSettings } from './ReminderSettings'
import { AISettings } from './AISettings'
import { DataSettings } from './DataSettings'
import {
  getSettings,
  updateSettings,
  updateDisplayName,
} from '@/lib/actions/settings'
import type { UserSettings } from '@/lib/supabase/database.types'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface EntityOption {
  id: string
  name: string
  slug: string
}

interface SettingsPageProps {
  initialSettings: UserSettings
  initialDisplayName: string | null
  initialEmail: string | null
  entities: EntityOption[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (module-level to avoid re-renders)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Toast notification component for save feedback.
 */
function SaveToast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-[#181818] text-white rounded-lg shadow-lg text-[14px] font-medium transition-opacity">
      {message}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render the complete settings page with all 8 sections.
 *
 * @param initialSettings — Hydrated UserSettings from server
 * @param initialDisplayName — User's current display name
 * @param initialEmail — User's email from auth
 * @param entities — Available entity options (Personal, JK Zentra)
 */
export function SettingsPage({
  initialSettings,
  initialDisplayName,
  initialEmail,
  entities,
}: SettingsPageProps): JSX.Element {
  // ── Local state ───────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<UserSettings>(initialSettings)
  const [displayName, setDisplayName] = useState<string>(
    initialDisplayName ?? ''
  )
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(
    settings.default_entity_id
  )
  const [fxPreference, setFxPreference] = useState<
    'latest_cached' | 'realtime'
  >(settings.fx_preference)
  const [showSecondaryCurrency, setShowSecondaryCurrency] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle'
  )
  const [toastVisible, setToastVisible] = useState(false)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showSavedToast = useCallback(() => {
    setToastVisible(true)
    setSaveStatus('saved')
    setTimeout(() => {
      setToastVisible(false)
      setSaveStatus('idle')
    }, 2000)
  }, [])

  // ── Debounced save helper ─────────────────────────────────────────────────
  const debouncedSave = useCallback(
    (partial: Partial<UserSettings>) => {
      setSaveStatus('saving')
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        try {
          await updateSettings(partial)
          setSettings((prev) => ({ ...prev, ...partial }))
          showSavedToast()
        } catch {
          setSaveStatus('idle')
        }
      }, 500)
    },
    [showSavedToast]
  )

  // ── Handlers: Profile ─────────────────────────────────────────────────────
  const handleDisplayNameBlur = async () => {
    const trimmed = displayName.trim()
    if (!trimmed || trimmed === (initialDisplayName ?? '')) return
    setSaveStatus('saving')
    try {
      await updateDisplayName(trimmed)
      showSavedToast()
    } catch {
      setSaveStatus('idle')
    }
  }

  // ── Handlers: Default Preferences ─────────────────────────────────────────
  const handleEntityChange = (entityId: string) => {
    setSelectedEntityId(entityId)
    debouncedSave({ default_entity_id: entityId })
  }

  // ── Handlers: FX Preferences ──────────────────────────────────────────────
  const handleFxChange = (pref: 'latest_cached' | 'realtime') => {
    setFxPreference(pref)
    debouncedSave({ fx_preference: pref })
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ── Derived data ──────────────────────────────────────────────────────────
  const selectedEntityName =
    entities.find((e) => e.id === selectedEntityId)?.name ??
    entities[0]?.name ??
    'Personal'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      {/* Header */}
      <div className="border-b border-[#E8E6E1] bg-white">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-8">
          <h1
            className="text-[28px] font-bold text-[#181818]"
            style={{ fontFamily: 'Fraunces, serif' }}
          >
            Settings
          </h1>
          <p className="mt-1 text-[14px] text-[#A0A0A0]">
            Manage your profile, tax preferences, and account settings.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Section 1: Profile */}
        <SettingsSection
          title="Profile"
          description="Your personal information."
        >
          <div className="space-y-4">
            {/* Display Name */}
            <div className="space-y-1">
              <label
                htmlFor="display-name"
                className="block text-[13px] font-medium text-[#6B6B6B]"
              >
                Display name
              </label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={handleDisplayNameBlur}
                placeholder="Your display name"
                className="w-full max-w-[360px] h-11 px-3 border border-[#E5E5E5] rounded-lg text-[14px] text-[#181818] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#F37002] focus:ring-1 focus:ring-[#F37002] transition-colors"
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-1">
              <label className="block text-[13px] font-medium text-[#6B6B6B]">
                Email
              </label>
              <div className="w-full max-w-[360px] h-11 px-3 border border-[#E5E5E5] rounded-lg bg-[#FAFAF7] flex items-center">
                <span className="text-[14px] text-[#A0A0A0]">
                  {initialEmail ?? '—'}
                </span>
              </div>
              <p className="text-[12px] text-[#A0A0A0]">
                Email is managed through your authentication provider.
              </p>
            </div>
          </div>

          {saveStatus !== 'idle' && (
            <div className="flex justify-end pt-1">
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

        {/* Section 2: Default Preferences */}
        <SettingsSection
          title="Default Preferences"
          description="Choose your default entity and currency display."
        >
          {/* Default Entity */}
          <div className="space-y-2">
            <label className="block text-[13px] font-medium text-[#6B6B6B]">
              Default entity
            </label>
            <div className="flex gap-4">
              {entities.map((entity) => (
                <label
                  key={entity.id}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <div
                    className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
                      selectedEntityId === entity.id
                        ? 'border-[#F37002]'
                        : 'border-[#E5E5E5]'
                    }`}
                    onClick={() => handleEntityChange(entity.id)}
                  >
                    {selectedEntityId === entity.id && (
                      <div className="w-2 h-2 rounded-full bg-[#F37002]" />
                    )}
                  </div>
                  <span className="text-[14px] text-[#181818]">
                    {entity.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Tax Year Start (read-only) */}
          <div className="space-y-1 pt-1">
            <label className="block text-[13px] font-medium text-[#6B6B6B]">
              Tax year start
            </label>
            <div className="w-full max-w-[200px] h-11 px-3 border border-[#E5E5E5] rounded-lg bg-[#FAFAF7] flex items-center">
              <span className="text-[14px] text-[#A0A0A0]">01-01</span>
            </div>
            <p className="text-[12px] text-[#A0A0A0]">
              Malaysia calendar year — not editable.
            </p>
          </div>

          {/* Primary Currency (read-only) */}
          <div className="space-y-1 pt-1">
            <label className="block text-[13px] font-medium text-[#6B6B6B]">
              Primary currency
            </label>
            <div className="w-full max-w-[200px] h-11 px-3 border border-[#E5E5E5] rounded-lg bg-[#FAFAF7] flex items-center">
              <span className="text-[14px] text-[#A0A0A0]">MYR</span>
            </div>
          </div>

          {/* Secondary Currency Toggle */}
          <div className="pt-1">
            <div className="flex items-center justify-between max-w-[200px]">
              <label className="text-[13px] font-medium text-[#6B6B6B]">
                Show USD
              </label>
              <button
                type="button"
                onClick={() => setShowSecondaryCurrency((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showSecondaryCurrency ? 'bg-[#F37002]' : 'bg-[#E5E5E5]'
                }`}
                aria-pressed={showSecondaryCurrency}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showSecondaryCurrency ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </SettingsSection>

        {/* Section 3: Tax Settings */}
        <TaxSettings settings={settings} onSaved={showSavedToast} />

        {/* Section 4: Reminder Preferences */}
        <ReminderSettings settings={settings} onSaved={showSavedToast} />

        {/* Section 5: AI Settings */}
        <AISettings settings={settings} onSaved={showSavedToast} />

        {/* Section 6: FX Preferences */}
        <SettingsSection
          title="FX Preferences"
          description="Choose how foreign exchange rates are resolved."
        >
          <div className="space-y-3">
            <label className="block text-[13px] font-medium text-[#6B6B6B]">
              Rate preference
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
                    fxPreference === 'latest_cached'
                      ? 'border-[#F37002]'
                      : 'border-[#E5E5E5]'
                  }`}
                  onClick={() => handleFxChange('latest_cached')}
                >
                  {fxPreference === 'latest_cached' && (
                    <div className="w-2 h-2 rounded-full bg-[#F37002]" />
                  )}
                </div>
                <div>
                  <span className="text-[14px] text-[#181818]">
                    Use latest cached rate
                  </span>
                  <p className="text-[12px] text-[#A0A0A0]">
                    Default — sufficient for tax preparation
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
                    fxPreference === 'realtime'
                      ? 'border-[#F37002]'
                      : 'border-[#E5E5E5]'
                  }`}
                  onClick={() => handleFxChange('realtime')}
                >
                  {fxPreference === 'realtime' && (
                    <div className="w-2 h-2 rounded-full bg-[#F37002]" />
                  )}
                </div>
                <div>
                  <span className="text-[14px] text-[#181818]">
                    Fetch real-time rate
                  </span>
                  <p className="text-[12px] text-[#A0A0A0]">
                    Uses more API calls — best for live conversions
                  </p>
                </div>
              </label>
            </div>

            <p className="text-[12px] text-[#A0A0A0] pt-1">
              Cached rates are sufficient for tax prep. Real-time rates use more
              API calls.
            </p>
          </div>

          {saveStatus === 'saving' && (
            <div className="flex justify-end">
              <span className="text-[12px] font-medium text-[#A0A0A0]">
                Saving...
              </span>
            </div>
          )}
        </SettingsSection>

        {/* Section 7 & 8: Data & Backup + Danger Zone */}
        <DataSettings />
      </div>

      {/* Toast */}
      <SaveToast message="Saved" visible={toastVisible} />
    </div>
  )
}
