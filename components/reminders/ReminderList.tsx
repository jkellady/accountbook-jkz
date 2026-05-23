/**
 * ReminderList Component
 * ======================
 * Displays all pending reminders ordered by trigger time.
 *
 * Features:
 *   - Lists pending reminders with title, body, trigger date/time, and type badge.
 *   - Highlights past-due reminders in red.
 *   - "Dismiss" button per reminder.
 *   - "Snooze" dropdown: 1 hour, 1 day, 1 week.
 *   - Empty state when no pending reminders exist.
 *   - Auto-refresh via React's useTransition for server action calls.
 */

"use client";

import { useState, useTransition } from "react";
import {
  dismissReminder,
  snoozeReminder,
} from "@/lib/actions/reminders";
import {
  ReminderRow,
  ReminderType,
} from "@/lib/supabase/database.types";
import { isOverdue } from "@/lib/utils/reminderHelpers";

// ============================================================================
// Props
// ============================================================================

interface ReminderListProps {
  /** Initial pending reminders fetched server-side. */
  initialReminders: ReminderRow[];
}

// ============================================================================
// Helpers
// ============================================================================

/** Return a human-readable label and colour class for a reminder type. */
function typeBadgeMeta(type: ReminderType): { label: string; className: string } {
  switch (type) {
    case "subscription_renewal":
      return { label: "Subscription", className: "bg-blue-100 text-blue-800" };
    case "cp500_instalment":
      return { label: "CP500", className: "bg-orange-100 text-orange-800" };
    case "tax_position_check":
      return { label: "Tax Check", className: "bg-purple-100 text-purple-800" };
    case "tax_reserve_transfer":
      return { label: "Tax Reserve", className: "bg-yellow-100 text-yellow-800" };
    case "year_end_planning":
      return { label: "Year-End", className: "bg-green-100 text-green-800" };
    default:
      return { label: type, className: "bg-gray-100 text-gray-800" };
  }
}

/** Format an ISO UTC timestamp for local display. */
function formatLocalDateTime(isoUtc: string): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return isoUtc;

  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Build a future ISO timestamp for snoozing. */
function buildSnoozeTimestamp(option: "1h" | "1d" | "1w"): string {
  const now = Date.now();
  const ms =
    option === "1h"
      ? 3_600_000
      : option === "1d"
        ? 86_400_000
        : 604_800_000;
  return new Date(now + ms).toISOString();
}

// ============================================================================
// Component
// ============================================================================

export default function ReminderList({
  initialReminders,
}: ReminderListProps): JSX.Element {
  const [reminders, setReminders] = useState<ReminderRow[]>(initialReminders);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Dismiss handler
  // -------------------------------------------------------------------------

  function handleDismiss(reminderId: string): void {
    setActionError(null);

    startTransition(async () => {
      try {
        await dismissReminder(reminderId);
        setReminders((prev) => prev.filter((r) => r.id !== reminderId));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Dismiss failed";
        setActionError(msg);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Snooze handler
  // -------------------------------------------------------------------------

  function handleSnooze(
    reminderId: string,
    option: "1h" | "1d" | "1w",
  ): void {
    setActionError(null);

    startTransition(async () => {
      try {
        const until = buildSnoozeTimestamp(option);
        await snoozeReminder(reminderId, until);
        setReminders((prev) =>
          prev.map((r) =>
            r.id === reminderId ? { ...r, trigger_at: until } : r,
          ),
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Snooze failed";
        setActionError(msg);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Render: empty state
  // -------------------------------------------------------------------------

  if (reminders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mb-3 h-10 w-10 text-gray-300"
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
        <p className="text-sm font-medium">No pending reminders</p>
        <p className="mt-1 text-xs text-gray-400">
          You are all caught up. Reminders will appear here when triggered.
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: list
  // -------------------------------------------------------------------------

  return (
    <div className="w-full">
      {actionError && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {actionError}
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        {reminders.map((reminder) => {
          const overdue = isOverdue(reminder.trigger_at);
          const badge = typeBadgeMeta(reminder.reminder_type);

          return (
            <li
              key={reminder.id}
              className={`flex flex-col gap-2 px-3 py-3 ${overdue ? "bg-red-50" : "bg-white"}`}
            >
              {/* Top row: badge + title */}
              <div className="flex items-start gap-2">
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
                >
                  {badge.label}
                </span>
                <h3
                  className={`flex-1 text-sm font-semibold leading-tight ${overdue ? "text-red-800" : "text-gray-900"}`}
                >
                  {reminder.title}
                </h3>
              </div>

              {/* Body */}
              {reminder.body && (
                <p
                  className={`text-xs leading-relaxed ${overdue ? "text-red-700" : "text-gray-600"}`}
                >
                  {reminder.body}
                </p>
              )}

              {/* Trigger time */}
              <p
                className={`text-xs ${overdue ? "font-semibold text-red-600" : "text-gray-400"}`}
              >
                {overdue ? "Overdue: " : "Triggers: "}
                {formatLocalDateTime(reminder.trigger_at)}
              </p>

              {/* Actions */}
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDismiss(reminder.id)}
                  disabled={isPending}
                  className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
                >
                  Dismiss
                </button>

                <SnoozeDropdown
                  onSnooze={(option) => handleSnooze(reminder.id, option)}
                  disabled={isPending}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================================
// SnoozeDropdown sub-component
// ============================================================================

interface SnoozeDropdownProps {
  onSnooze: (option: "1h" | "1d" | "1w") => void;
  disabled: boolean;
}

function SnoozeDropdown({ onSnooze, disabled }: SnoozeDropdownProps): JSX.Element {
  const [open, setOpen] = useState(false);

  function select(option: "1h" | "1d" | "1w"): void {
    onSnooze(option);
    setOpen(false);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
      >
        Snooze &darr;
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 z-20 mt-1 w-28 rounded-md border border-gray-200 bg-white shadow-lg">
            {(["1h", "1d", "1w"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => select(opt)}
                className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 first:rounded-t-md last:rounded-b-md hover:bg-gray-50"
              >
                {opt === "1h" ? "1 hour" : opt === "1d" ? "1 day" : "1 week"}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
