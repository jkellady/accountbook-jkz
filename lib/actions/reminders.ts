/**
 * Reminder Server Actions
 * =======================
 * All functions in this file run on the server (Next.js "use server").
 *
 * Responsibilities:
 *   - Generate reminders for subscriptions and CP500 schedules.
 *   - CRUD operations on reminders (list, dismiss, snooze, mark-sent).
 *   - Every exported function has full JSDoc and zero `any` types.
 *
 * Idempotency:
 *   - generateSubscriptionReminders deletes existing pending reminders
 *     for the subscription before creating new ones, making it safe to
 *     call repeatedly on the same subscription.
 *   - generateCP500Reminders upserts based on (ref_type, ref_id, offset_days)
 *     so duplicate runs are no-ops.
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  ReminderRow,
  ReminderInsert,
  ReminderType,
  ReminderChannel,
  CP500ScheduleItem,
  UserSettings,
} from "@/lib/supabase/database.types";
import {
  calculateTriggerAt,
  formatReminderTitle,
  getSystemReminderOffsets,
} from "@/lib/utils/reminderHelpers";

// ============================================================================
// Types
// ============================================================================

/** Lightweight row shape returned when fetching a subscription for reminder generation. */
interface SubscriptionReminderSource {
  id: string;
  name: string;
  vendor: string;
  next_payment_at: string | null;
  reminder_offsets: number[];
  reminder_channels: string[];
  status: string;
}

// ============================================================================
// Generate subscription reminders
// ============================================================================

/**
 * Generate (or regenerate) all pending reminders for a subscription.
 *
 * Reads the subscription's `reminder_offsets` and `reminder_channels`, then
 * creates one reminder row per offset per channel.  Existing **pending**
 * reminders for this subscription are removed first, making the call idempotent.
 *
 * @param subscriptionId - UUID of the subscription.
 * @throws When the subscription does not exist or `next_payment_at` is missing.
 */
export async function generateSubscriptionReminders(
  subscriptionId: string,
): Promise<void> {
  const supabase = await createClient();

  // 1. Fetch the subscription
  const { data: sub, error: fetchErr } = await supabase
    .from("subscriptions")
    .select("id, name, vendor, next_payment_at, reminder_offsets, reminder_channels, status")
    .eq("id", subscriptionId)
    .single();

  if (fetchErr || !sub) {
    throw new Error(
      `Subscription not found: ${subscriptionId} — ${fetchErr?.message ?? "unknown error"}`,
    );
  }

  const subscription = sub as unknown as SubscriptionReminderSource;

  // No next payment date = nothing to remind about
  if (!subscription.next_payment_at) {
    return;
  }

  // Archived subscriptions don't get reminders
  if (subscription.status === "archived") {
    return;
  }

  // 2. Delete existing pending reminders for this subscription
  const { error: deleteErr } = await supabase
    .from("reminders")
    .delete()
    .eq("ref_type", "subscription")
    .eq("ref_id", subscriptionId)
    .eq("status", "pending");

  if (deleteErr) {
    throw new Error(
      `Failed to clear existing reminders: ${deleteErr.message}`,
    );
  }

  // 3. Build insert rows
  const offsets: number[] = subscription.reminder_offsets;
  const channels: string[] = subscription.reminder_channels;
  const reminderType: ReminderType = "subscription_renewal";

  const rows: ReminderInsert[] = [];

  for (const offsetDays of offsets) {
    const triggerAt = calculateTriggerAt(
      subscription.next_payment_at,
      offsetDays,
    );

    const title = formatReminderTitle(reminderType, subscription.name);
    const body =
      offsetDays === 0
        ? `Your ${subscription.name} subscription (${subscription.vendor}) renews today.`
        : `Your ${subscription.name} subscription (${subscription.vendor}) renews in ${offsetDays} day${offsetDays === 1 ? "" : "s"} (${subscription.next_payment_at}).`;

    for (const ch of channels) {
      const channel = ch as ReminderChannel;
      rows.push({
        reminder_type: reminderType,
        ref_type: "subscription",
        ref_id: subscriptionId,
        trigger_at: triggerAt,
        offset_days: offsetDays,
        channel,
        status: "pending",
        title,
        body,
      });
    }
  }

  if (rows.length === 0) {
    return;
  }

  // 4. Insert
  const { error: insertErr } = await supabase.from("reminders").insert(rows);

  if (insertErr) {
    throw new Error(
      `Failed to insert subscription reminders: ${insertErr.message}`,
    );
  }
}

// ============================================================================
// List pending reminders
// ============================================================================

/**
 * List all reminders with `status = 'pending'` ordered by `trigger_at` ASC.
 *
 * @returns Array of pending reminder rows.
 */
export async function listPendingReminders(): Promise<ReminderRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("status", "pending")
    .order("trigger_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list pending reminders: ${error.message}`);
  }

  return (data ?? []) as unknown as ReminderRow[];
}

// ============================================================================
// Dismiss reminder
// ============================================================================

/**
 * Mark a reminder as dismissed by the user.
 *
 * @param reminderId - UUID of the reminder to dismiss.
 */
export async function dismissReminder(reminderId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("reminders")
    .update({
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
    })
    .eq("id", reminderId);

  if (error) {
    throw new Error(`Failed to dismiss reminder: ${error.message}`);
  }

  revalidatePath("/");
}

// ============================================================================
// Snooze reminder
// ============================================================================

/**
 * Push a reminder's trigger time into the future ("snooze").
 *
 * The status remains `pending`; only `trigger_at` is updated.
 *
 * @param reminderId  - UUID of the reminder to snooze.
 * @param snoozeUntil - ISO-8601 UTC timestamp of when the reminder should re-fire.
 */
export async function snoozeReminder(
  reminderId: string,
  snoozeUntil: string,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("reminders")
    .update({ trigger_at: snoozeUntil })
    .eq("id", reminderId)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Failed to snooze reminder: ${error.message}`);
  }

  revalidatePath("/");
}

// ============================================================================
// Mark reminder as sent (called by the cron job)
// ============================================================================

/**
 * Mark a reminder as sent, recording the current timestamp as `sent_at`.
 *
 * @param reminderId - UUID of the reminder that was dispatched.
 */
export async function markReminderSent(reminderId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("reminders")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", reminderId);

  if (error) {
    throw new Error(`Failed to mark reminder as sent: ${error.message}`);
  }
}

// ============================================================================
// Generate CP500 reminders from user settings
// ============================================================================

/**
 * Generate pending reminders for every unpaid CP500 instalment found in the
 * current user's `settings.cp500_schedule`.
 *
 * This function is idempotent: it first removes any existing pending
 * `cp500_instalment` reminders, then recreates them based on the latest
 * schedule stored in user settings.
 *
 * @throws When the user row or CP500 schedule cannot be read.
 */
export async function generateCP500Reminders(): Promise<void> {
  const supabase = await createClient();

  // 1. Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthenticated — cannot generate CP500 reminders.");
  }

  // 2. Fetch user settings
  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("settings")
    .eq("id", user.id)
    .single();

  if (userErr || !userRow) {
    throw new Error(
      `Failed to fetch user settings: ${userErr?.message ?? "not found"}`,
    );
  }

  const settings = userRow.settings as unknown as UserSettings | null;
  const schedule: CP500ScheduleItem[] = settings?.cp500_schedule ?? [];

  if (schedule.length === 0) {
    return;
  }

  // 3. Remove existing pending CP500 reminders
  const { error: deleteErr } = await supabase
    .from("reminders")
    .delete()
    .eq("reminder_type", "cp500_instalment")
    .eq("status", "pending");

  if (deleteErr) {
    throw new Error(
      `Failed to clear existing CP500 reminders: ${deleteErr.message}`,
    );
  }

  // 4. Build new rows
  const offsets = getSystemReminderOffsets("cp500_instalment");
  const rows: ReminderInsert[] = [];

  for (const item of schedule) {
    // Skip already-paid instalments
    if (item.status === "paid") {
      continue;
    }

    const refName = `Instalment ${item.instalment_no}`;
    const title = formatReminderTitle("cp500_instalment", refName);
    const amountRm = (item.amount_minor / 100).toFixed(2);

    for (const offsetDays of offsets) {
      const triggerAt = calculateTriggerAt(item.due_date, offsetDays);

      const body =
        offsetDays === 0
          ? `CP500 Instalment ${item.instalment_no} (RM ${amountRm}) is due today.`
          : `CP500 Instalment ${item.instalment_no} (RM ${amountRm}) is due in ${offsetDays} day${offsetDays === 1 ? "" : "s"} (${item.due_date}).`;

      // Only in_app for now; email/gcal can be added when channels are configured
      rows.push({
        reminder_type: "cp500_instalment",
        ref_type: "cp500_schedule",
        ref_id: user.id, // Schedule is per-user, so ref_id points to user
        trigger_at: triggerAt,
        offset_days: offsetDays,
        channel: "in_app",
        status: "pending",
        title,
        body,
      });
    }
  }

  if (rows.length === 0) {
    return;
  }

  // 5. Insert
  const { error: insertErr } = await supabase.from("reminders").insert(rows);

  if (insertErr) {
    throw new Error(
      `Failed to insert CP500 reminders: ${insertErr.message}`,
    );
  }
}
