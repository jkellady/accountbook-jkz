/**
 * Reminder Cron API Route
 * ========================
 * GET /api/cron/reminders
 *
 * Designed to be invoked by Vercel Cron (or manually) every hour.
 *
 * Flow:
 *   1. Find all reminders WHERE trigger_at <= NOW() AND status = 'pending'.
 *   2. For each reminder, dispatch via the appropriate channel.
 *   3. Mark as 'sent' (or 'failed' on error).
 *   4. Return a summary count.
 *
 * Idempotency: reminders are processed once — after status changes to 'sent'
 * or 'failed', subsequent cron runs will skip them. Safe to run multiple
 * times with no duplicate notifications.
 *
 * Authentication: expects a `CRON_SECRET` header for Vercel Cron jobs.
 * The secret is compared against the `CRON_SECRET` environment variable.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ReminderRow, ReminderChannel } from "@/lib/supabase/database.types";

// ============================================================================
// Types
// ============================================================================

/** Result shape returned in the JSON response. */
interface CronResult {
  processed: number;
  sent_in_app: number;
  sent_email: number;
  sent_gcal: number;
  failed: number;
  errors: string[];
}

// ============================================================================
// Channel dispatchers
// ============================================================================

/**
 * Log an in-app reminder as sent.
 * In-app reminders have no external API call — the UI polls for pending rows.
 * We simply mark them sent so they stop appearing in the cron query.
 *
 * @param _reminder - The reminder row (unused, but kept for interface uniformity).
 * @returns `true` always — in-app dispatch is a no-op.
 */
async function dispatchInApp(_reminder: ReminderRow): Promise<boolean> {
  // In-app reminders are surfaced by the UI polling `listPendingReminders`.
  // Once the cron fires, we mark them sent so they disappear from the badge.
  // The user can still see them in a "recent notifications" view if needed later.
  return true;
}

/**
 * Send a reminder via email using Resend.
 *
 * **STUB** — currently logs to stdout. Wire in `resend.emails.send()`
 * once the Resend API key is configured.
 *
 * @param reminder - The reminder row containing title and body.
 * @returns `true` on success, `false` on failure.
 */
async function dispatchEmail(reminder: ReminderRow): Promise<boolean> {
  try {
    // TODO: Wire in Resend API when available.
    // import { Resend } from 'resend';
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'reminders@jkzentra.com',
    //   to:   userEmail,
    //   subject: reminder.title,
    //   text: reminder.body ?? reminder.title,
    // });

    // eslint-disable-next-line no-console
    console.log(`[CRON][EMAIL] Would send: "${reminder.title}" — ${reminder.body ?? "(no body)"}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sync a reminder to Google Calendar.
 *
 * **STUB** — currently logs to stdout. Wire in the Google Calendar API
 * once the OAuth flow and `gcal_refresh_token` are available.
 *
 * @param reminder - The reminder row.
 * @returns `true` on success, `false` on failure.
 */
async function dispatchGCal(reminder: ReminderRow): Promise<boolean> {
  try {
    // TODO: Wire in Google Calendar API when available.
    // Requires: gcal_refresh_token, gcal_calendar_id from user settings.

    // eslint-disable-next-line no-console
    console.log(`[CRON][GCAL] Would sync: "${reminder.title}" at ${reminder.trigger_at}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Route a reminder to its configured channel dispatcher.
 *
 * @param reminder - The pending reminder row to dispatch.
 * @returns `true` if the channel reported success.
 */
async function dispatchReminder(reminder: ReminderRow): Promise<boolean> {
  const channel = reminder.channel as ReminderChannel;

  switch (channel) {
    case "in_app":
      return dispatchInApp(reminder);
    case "email":
      return dispatchEmail(reminder);
    case "gcal":
      return dispatchGCal(reminder);
    default:
      // Exhaustiveness guard
      throw new Error(`Unknown channel: ${channel as string}`);
  }
}

// ============================================================================
// Route handler
// ============================================================================

/**
 * GET handler — fires every hour (or on manual trigger).
 *
 * Query params (optional):
 *   - `secret` — override the Authorization header (useful for manual testing).
 *
 * Response:
 *   ```json
 *   {
 *     "ok": true,
 *     "result": {
 *       "processed": 5,
 *       "sent_in_app": 3,
 *       "sent_email": 1,
 *       "sent_gcal": 1,
 *       "failed": 0,
 *       "errors": []
 *     }
 *   }
 *   ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // --------------------------------------------------------------------------
  // Auth check — Vercel Cron sends the secret as a Bearer token.
  // Allow a `?secret=` query param for manual testing.
  // --------------------------------------------------------------------------
  const expectedSecret = process.env.CRON_SECRET;
  const urlSecret = request.nextUrl.searchParams.get("secret");
  const headerSecret = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");

  const providedSecret = urlSecret ?? headerSecret;

  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // --------------------------------------------------------------------------
  // Fetch pending reminders that are due
  // --------------------------------------------------------------------------
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: reminders, error: fetchErr } = await supabase
    .from("reminders")
    .select("*")
    .eq("status", "pending")
    .lte("trigger_at", now)
    .order("trigger_at", { ascending: true });

  if (fetchErr) {
    return NextResponse.json(
      { ok: false, error: `Fetch failed: ${fetchErr.message}` },
      { status: 500 },
    );
  }

  const pendingReminders = (reminders ?? []) as unknown as ReminderRow[];

  // --------------------------------------------------------------------------
  // Process each reminder
  // --------------------------------------------------------------------------
  const result: CronResult = {
    processed: pendingReminders.length,
    sent_in_app: 0,
    sent_email: 0,
    sent_gcal: 0,
    failed: 0,
    errors: [],
  };

  for (const reminder of pendingReminders) {
    try {
      const success = await dispatchReminder(reminder);

      if (success) {
        // Mark as sent
        const { error: updateErr } = await supabase
          .from("reminders")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", reminder.id);

        if (updateErr) {
          throw new Error(
            `Mark-sent failed for ${reminder.id}: ${updateErr.message}`,
          );
        }

        // Tally by channel
        const ch = reminder.channel as ReminderChannel;
        if (ch === "in_app") result.sent_in_app++;
        else if (ch === "email") result.sent_email++;
        else if (ch === "gcal") result.sent_gcal++;
      } else {
        // Channel reported failure — mark as failed
        const { error: failErr } = await supabase
          .from("reminders")
          .update({ status: "failed" })
          .eq("id", reminder.id);

        if (failErr) {
          throw new Error(
            `Mark-failed update error for ${reminder.id}: ${failErr.message}`,
          );
        }

        result.failed++;
        result.errors.push(`${reminder.id}: channel dispatch failed (${reminder.channel})`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      result.failed++;
      result.errors.push(`${reminder.id}: ${message}`);

      // Attempt to mark as failed — best effort, don't throw
      try {
        await supabase
          .from("reminders")
          .update({ status: "failed" })
          .eq("id", reminder.id);
      } catch {
        // Swallowed — we already recorded the error in result.errors
      }
    }
  }

  return NextResponse.json({ ok: true, result });
}
