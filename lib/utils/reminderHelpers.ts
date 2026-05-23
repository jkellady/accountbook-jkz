/**
 * Reminder Helper Utilities
 * =========================
 * Pure functions for calculating trigger dates, checking overdue status,
 * formatting reminder display text, and generating default reminder offsets.
 *
 * All dates are handled in UTC internally. Display formatting is the
 * responsibility of the calling component.
 */

import {
  ReminderType,
  BillingCycle,
} from "@/lib/supabase/database.types";

// ============================================================================
// Constants
// ============================================================================

/** Number of milliseconds in one day. */
const MS_PER_DAY = 86_400_000;

/** Default reminder offsets (days before event) for subscription renewals. */
const DEFAULT_SUBSCRIPTION_OFFSETS: number[] = [7, 3, 1, 0];

/** Default reminder offsets for CP500 tax instalments. */
const DEFAULT_CP500_OFFSETS: number[] = [7, 3, 1];

/** Default reminder offsets for tax position check (last business day of month). */
const DEFAULT_TAX_POSITION_OFFSETS: number[] = [0];

/** Default reminder offsets for tax reserve transfer. */
const DEFAULT_TAX_RESERVE_OFFSETS: number[] = [3, 1];

/** Default reminder offsets for year-end planning (Oct 1). */
const DEFAULT_YEAR_END_OFFSETS: number[] = [0];

// ============================================================================
// Trigger-at calculation
// ============================================================================

/**
 * Calculate the UTC trigger timestamp for a reminder.
 *
 * @param eventDate   - The event date as an ISO-8601 date string (e.g. '2026-04-30').
 * @param offsetDays  - Days before the event to trigger the reminder.
 * @returns ISO-8601 UTC timestamp string (e.g. '2026-04-23T00:00:00.000Z').
 */
export function calculateTriggerAt(eventDate: string, offsetDays: number): string {
  const event = new Date(eventDate);
  if (Number.isNaN(event.getTime())) {
    throw new Error(`Invalid eventDate: ${eventDate}`);
  }
  const triggerTime = event.getTime() - offsetDays * MS_PER_DAY;
  return new Date(triggerTime).toISOString();
}

// ============================================================================
// Overdue check
// ============================================================================

/**
 * Determine whether a reminder is overdue.
 *
 * @param triggerAt - The reminder's trigger timestamp (ISO-8601 UTC).
 * @returns `true` if the current wall-clock time is past the trigger time.
 */
export function isOverdue(triggerAt: string): boolean {
  const trigger = new Date(triggerAt);
  if (Number.isNaN(trigger.getTime())) {
    throw new Error(`Invalid triggerAt: ${triggerAt}`);
  }
  return new Date().getTime() > trigger.getTime();
}

// ============================================================================
// Display formatting
// ============================================================================

/**
 * Human-readable title for a reminder based on its type and the referenced
 * object's display name.
 *
 * @param reminderType - One of the ReminderType variants.
 * @param refName      - Display name of the referenced subscription / schedule.
 * @returns Formatted title string.
 */
export function formatReminderTitle(
  reminderType: ReminderType,
  refName: string,
): string {
  switch (reminderType) {
    case "subscription_renewal":
      return `${refName} — Subscription Renewal`;
    case "cp500_instalment":
      return `CP500 Instalment — ${refName}`;
    case "tax_position_check":
      return "Monthly Tax Position Check";
    case "tax_reserve_transfer":
      return "Tax Reserve Transfer Reminder";
    case "year_end_planning":
      return "Year-End Tax Planning";
    default:
      // Exhaustiveness guard — if we reach here a new type was added
      // to the DB CHECK constraint but not to this switch.
      throw new Error(`Unhandled reminder type: ${reminderType as string}`);
  }
}

// ============================================================================
// Default offsets
// ============================================================================

/**
 * Return the default reminder-offset array for a given billing cycle.
 *
 * @param billingCycle - One of the BillingCycle variants.
 * @returns Array of offset days (e.g. [7, 3, 1, 0]).
 */
export function getDefaultOffsets(billingCycle: BillingCycle): number[] {
  switch (billingCycle) {
    case "monthly":
    case "quarterly":
    case "yearly":
      return [...DEFAULT_SUBSCRIPTION_OFFSETS];
    case "trial":
      // Trial subscriptions: remind closer to the trial end.
      return [3, 1, 0];
    case "one_time":
      // One-time purchases: no renewal reminders needed.
      return [];
    default:
      // Exhaustiveness guard.
      throw new Error(`Unhandled billing cycle: ${billingCycle as string}`);
  }
}

/**
 * Return the default reminder-offset array for a given system reminder type.
 *
 * @param reminderType - One of the non-subscription ReminderType variants.
 * @returns Array of offset days.
 */
export function getSystemReminderOffsets(reminderType: ReminderType): number[] {
  switch (reminderType) {
    case "cp500_instalment":
      return [...DEFAULT_CP500_OFFSETS];
    case "tax_position_check":
      return [...DEFAULT_TAX_POSITION_OFFSETS];
    case "tax_reserve_transfer":
      return [...DEFAULT_TAX_RESERVE_OFFSETS];
    case "year_end_planning":
      return [...DEFAULT_YEAR_END_OFFSETS];
    default:
      throw new Error(
        `No system offsets defined for reminder type: ${reminderType as string}`,
      );
  }
}
