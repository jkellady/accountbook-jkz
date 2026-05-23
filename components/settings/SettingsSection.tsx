/**
 * SettingsSection — Reusable section wrapper for the Settings page.
 *
 * Wraps each settings group in a white card with a header title,
 * optional description, and consistent bottom border.
 */

import { type ReactNode } from 'react'

interface SettingsSectionProps {
  /** Section heading — displayed in Fraunces 22px */
  title: string
  /** Optional description text below the title */
  description?: string
  /** Section content */
  children: ReactNode
  /** Optional className for the container */
  className?: string
}

/**
 * Render a single settings section as a white card.
 *
 * @param title — Section heading
 * @param description — Optional subtitle/description
 * @param children — Section form content
 * @param className — Optional additional CSS classes
 */
export function SettingsSection({
  title,
  description,
  children,
  className = '',
}: SettingsSectionProps): JSX.Element {
  return (
    <section
      className={`bg-white border border-[#E8E6E1] rounded-xl p-6 ${className}`}
    >
      <div className="mb-5">
        <h2
          className="text-[22px] font-semibold text-[#181818]"
          style={{ fontFamily: 'Fraunces, serif' }}
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[13px] text-[#A0A0A0]">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
