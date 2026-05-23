/**
 * ReminderBadge Component
 * =======================
 * Small indicator for the top navigation bar showing the count of
 * pending reminders and a red dot when any are overdue.
 *
 * Clicking the badge opens the reminder panel (via the provided callback).
 */

"use client";

import { ReminderRow } from "@/lib/supabase/database.types";
import { isOverdue } from "@/lib/utils/reminderHelpers";

// ============================================================================
// Props
// ============================================================================

interface ReminderBadgeProps {
  /** Pending reminders to derive the count and overdue state from. */
  reminders: ReminderRow[];
  /** Called when the user clicks the badge to open the reminder panel. */
  onOpen: () => void;
}

// ============================================================================
// Component
// ============================================================================

export default function ReminderBadge({
  reminders,
  onOpen,
}: ReminderBadgeProps): JSX.Element {
  const count = reminders.length;
  const hasOverdue = reminders.some((r) => isOverdue(r.trigger_at));

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative inline-flex items-center rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1"
      aria-label={`${count} pending reminder${count === 1 ? "" : "s"}`}
    >
      {/* Bell icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </svg>

      {/* Count pill */}
      {count > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}

      {/* Red overdue dot */}
      {hasOverdue && (
        <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
      )}
    </button>
  );
}
