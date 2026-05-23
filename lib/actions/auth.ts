/**
 * @fileoverview Authentication Server Actions for JK Zentra Finance Cockpit.
 *
 * All auth operations are performed server-side via Next.js Server Actions.
 * No passwords are used — only magic links and Google OAuth.
 *
 * Exported functions:
 * - `signInWithMagicLink(email)` — Sends a magic link to the given email.
 * - `signInWithGoogle()` — Initiates Google OAuth sign-in flow.
 * - `signOut()` — Clears the current session and signs the user out.
 * - `getSession()` — Retrieves the currently authenticated user and session.
 * - `ensureUserRecord(user)` — Ensures the users table has a record for the auth user.
 *
 * @module lib/actions/auth
 */

"use server";

import { z } from "zod";
import type { User, Session } from "@supabase/supabase-js";
import { createActionClient } from "@/lib/supabase/server";
import type { UserSettings } from "@/lib/supabase/database.types";

// ---------------------------------------------------------------------------
// Rate limiting storage (in-memory, per-process)
// ---------------------------------------------------------------------------

/**
 * Simple in-memory rate limiter for magic link requests.
 * In production, replace with Redis or a database-backed store for
 * multi-process / multi-instance deployments.
 */
class RateLimiter {
  /**
   * Stores email-based rate limit entries.
   * Key: email address, Value: array of Unix timestamps (ms).
   */
  private emailLimits: Map<string, number[]> = new Map();

  /**
   * Stores IP-based rate limit entries.
   * Key: IP address hash, Value: array of Unix timestamps (ms).
   */
  private ipLimits: Map<string, number[]> = new Map();

  /**
   * Maximum magic link requests per email per hour.
   */
  private readonly MAX_PER_EMAIL: number = 3;

  /**
   * Maximum magic link requests per IP per hour.
   */
  private readonly MAX_PER_IP: number = 5;

  /**
   * Time window in milliseconds (1 hour).
   */
  private readonly WINDOW_MS: number = 60 * 60 * 1000;

  /**
   * Checks if a magic link request is allowed for the given email and IP.
   * Returns `true` if within limits, `false` if rate limited.
   *
   * @param {string} email - The email address requesting the magic link.
   * @param {string} ip - The client IP address (hashed or raw).
   * @returns {{ allowed: boolean; reason?: string }} Rate limit check result.
   */
  check(
    email: string,
    ip: string
  ): { allowed: boolean; reason?: string } {
    const now: number = Date.now();
    const windowStart: number = now - this.WINDOW_MS;

    // Check email-based limit
    const emailTimestamps: number[] = this.emailLimits.get(email) ?? [];
    const recentEmailRequests: number[] = emailTimestamps.filter(
      (ts: number) => ts > windowStart
    );

    if (recentEmailRequests.length >= this.MAX_PER_EMAIL) {
      const oldestInWindow: number = recentEmailRequests[0] ?? now;
      const retryAfterSeconds: number = Math.ceil(
        (oldestInWindow + this.WINDOW_MS - now) / 1000
      );
      return {
        allowed: false,
        reason: `Too many requests for this email. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
      };
    }

    // Check IP-based limit
    const ipTimestamps: number[] = this.ipLimits.get(ip) ?? [];
    const recentIpRequests: number[] = ipTimestamps.filter(
      (ts: number) => ts > windowStart
    );

    if (recentIpRequests.length >= this.MAX_PER_IP) {
      const oldestInWindow: number = recentIpRequests[0] ?? now;
      const retryAfterSeconds: number = Math.ceil(
        (oldestInWindow + this.WINDOW_MS - now) / 1000
      );
      return {
        allowed: false,
        reason: `Too many requests from this device. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Records a magic link request for rate limiting purposes.
   *
   * @param {string} email - The email address.
   * @param {string} ip - The client IP address.
   */
  record(email: string, ip: string): void {
    const now: number = Date.now();
    const windowStart: number = now - this.WINDOW_MS;

    // Update email timestamps
    const emailTimestamps: number[] = this.emailLimits.get(email) ?? [];
    const cleanedEmailTimestamps: number[] = emailTimestamps.filter(
      (ts: number) => ts > windowStart
    );
    cleanedEmailTimestamps.push(now);
    this.emailLimits.set(email, cleanedEmailTimestamps);

    // Update IP timestamps
    const ipTimestamps: number[] = this.ipLimits.get(ip) ?? [];
    const cleanedIpTimestamps: number[] = ipTimestamps.filter(
      (ts: number) => ts > windowStart
    );
    cleanedIpTimestamps.push(now);
    this.ipLimits.set(ip, cleanedIpTimestamps);
  }

  /**
   * Cleans up expired entries to prevent unbounded memory growth.
   * Called periodically.
   */
  cleanup(): void {
    const now: number = Date.now();
    const windowStart: number = now - this.WINDOW_MS;

    for (const [email, timestamps] of this.emailLimits.entries()) {
      const filtered: number[] = timestamps.filter((ts: number) => ts > windowStart);
      if (filtered.length === 0) {
        this.emailLimits.delete(email);
      } else {
        this.emailLimits.set(email, filtered);
      }
    }

    for (const [ip, timestamps] of this.ipLimits.entries()) {
      const filtered: number[] = timestamps.filter((ts: number) => ts > windowStart);
      if (filtered.length === 0) {
        this.ipLimits.delete(ip);
      } else {
        this.ipLimits.set(ip, filtered);
      }
    }
  }
}

/** Singleton rate limiter instance. */
const rateLimiter: RateLimiter = new RateLimiter();

// Periodically clean up expired rate limit entries (every 10 minutes).
setInterval(() => rateLimiter.cleanup(), 10 * 60 * 1000);

// ---------------------------------------------------------------------------
// Input validation schemas
// ---------------------------------------------------------------------------

/**
 * Zod schema for email address validation.
 * Ensures valid email format and reasonable length.
 */
const emailSchema: z.ZodString = z
  .string()
  .min(1, "Email address is required")
  .email("Please enter a valid email address")
  .max(254, "Email address is too long");

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * Result type for sign-in operations.
 */
interface SignInResult {
  success: boolean;
  error?: string;
}

/**
 * Result type for Google OAuth sign-in.
 */
interface GoogleSignInResult {
  url: string;
  error?: string;
}

/**
 * Result type for session retrieval.
 */
interface SessionResult {
  user: User | null;
  session: Session | null;
}

/**
 * Sends a magic link sign-in email to the provided address.
 *
 * Rate limited: max 3 requests per email per hour, max 5 per IP per hour.
 *
 * @param {string} email - The email address to send the magic link to.
 * @returns {Promise<SignInResult>} Result indicating success or failure with an error message.
 *
 * @example
 * ```ts
 * const result = await signInWithMagicLink("user@example.com");
 * if (result.success) {
 *   // Show "Check your email" message
 * }
 * ```
 */
export async function signInWithMagicLink(
  email: string
): Promise<SignInResult> {
  try {
    // Validate email format
    const validationResult = emailSchema.safeParse(email);
    if (!validationResult.success) {
      const errorMessage: string =
        validationResult.error.errors[0]?.message ?? "Invalid email address";
      return { success: false, error: errorMessage };
    }

    const validatedEmail: string = validationResult.data;

    // Check rate limits (use email as IP fallback for simplicity)
    const rateLimitResult = rateLimiter.check(validatedEmail, validatedEmail);
    if (!rateLimitResult.allowed) {
      return { success: false, error: rateLimitResult.reason };
    }

    // Create server action client
    const supabase = await createActionClient();

    // Request magic link from Supabase Auth
    const { error } = await supabase.auth.signInWithOtp({
      email: validatedEmail,
      options: {
        // Redirect URL after the user clicks the magic link
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback`,
      },
    });

    if (error) {
      console.error("[Auth] Magic link error:", error.message);

      // Provide user-friendly error messages for known error codes
      if (error.message.includes("rate limit")) {
        return {
          success: false,
          error: "Too many requests. Please wait a moment and try again.",
        };
      }

      if (error.message.includes("email") && error.status === 422) {
        return {
          success: false,
          error: "Unable to send magic link to this email address. Please check and try again.",
        };
      }

      return {
        success: false,
        error: "Failed to send magic link. Please try again later.",
      };
    }

    // Record the request for rate limiting
    rateLimiter.record(validatedEmail, validatedEmail);

    return { success: true };
  } catch (err) {
    const errorMessage: string =
      err instanceof Error ? err.message : "An unexpected error occurred";
    console.error("[Auth] Unexpected error in signInWithMagicLink:", errorMessage);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Initiates a Google OAuth sign-in flow.
 *
 * Constructs the OAuth URL and returns it for the client to redirect to.
 * The callback at `/auth/callback` handles the completion.
 *
 * @returns {Promise<GoogleSignInResult>} Object containing the OAuth URL or an error.
 *
 * @example
 * ```ts
 * const { url, error } = await signInWithGoogle();
 * if (url) window.location.href = url;
 * ```
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    const supabase = await createActionClient();

    const appUrl: string =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const redirectTo: string = `${appUrl}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        // Request minimal scopes — email and profile only.
        // No Google Drive, Calendar, or Gmail access at sign-in.
        scopes: "email profile",
        // PKCE flow is enabled by default in Supabase Auth — no extra config needed.
        queryParams: {
          // Force account selection — useful if multiple Google accounts exist.
          prompt: "select_account",
        },
      },
    });

    if (error) {
      console.error("[Auth] Google OAuth error:", error.message);
      return {
        url: "",
        error: "Failed to initiate Google sign-in. Please try again.",
      };
    }

    if (!data.url) {
      console.error("[Auth] Google OAuth returned no URL");
      return {
        url: "",
        error: "Failed to initiate Google sign-in. Please try again.",
      };
    }

    return { url: data.url };
  } catch (err) {
    const errorMessage: string =
      err instanceof Error ? err.message : "An unexpected error occurred";
    console.error("[Auth] Unexpected error in signInWithGoogle:", errorMessage);
    return {
      url: "",
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Signs the current user out and clears the session.
 *
 * @returns {Promise<{ success: boolean }>} Always returns success unless an unexpected error occurs.
 *
 * @example
 * ```ts
 * const result = await signOut();
 * if (result.success) redirect("/login");
 * ```
 */
export async function signOut(): Promise<{ success: boolean }> {
  try {
    const supabase = await createActionClient();

    const { error } = await supabase.auth.signOut({
      // Sign out from all tabs/devices for security.
      scope: "global",
    });

    if (error) {
      console.error("[Auth] Sign out error:", error.message);
      // Even if the server-side sign-out fails, clear local state.
      // The middleware will handle any stale sessions.
      return { success: true };
    }

    return { success: true };
  } catch (err) {
    const errorMessage: string =
      err instanceof Error ? err.message : "An unexpected error occurred";
    console.error("[Auth] Unexpected error in signOut:", errorMessage);
    // Return success so the UI can proceed regardless.
    return { success: true };
  }
}

/**
 * Retrieves the current authenticated user and session.
 *
 * Uses `getUser()` (not `getSession()`) for server-side security —
 * `getUser()` validates the access token against the Supabase Auth server,
 * preventing tampered client-side session data.
 *
 * @returns {Promise<SessionResult>} The current user and session, or nulls if not authenticated.
 *
 * @example
 * ```ts
 * const { user, session } = await getSession();
 * if (user) {
 *   // Render authenticated content
 * }
 * ```
 */
export async function getSession(): Promise<SessionResult> {
  try {
    const supabase = await createActionClient();

    // getUser() validates the JWT with the Supabase Auth server.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { user: null, session: null };
    }

    // getSession() is safe to call after getUser() succeeds —
    // it reads the session from cookies without a network roundtrip.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return { user, session };
  } catch (err) {
    const errorMessage: string =
      err instanceof Error ? err.message : "An unexpected error occurred";
    console.error("[Auth] Unexpected error in getSession:", errorMessage);
    return { user: null, session: null };
  }
}

// ---------------------------------------------------------------------------
// User record management
// ---------------------------------------------------------------------------

/**
 * Default settings for new users.
 * Seeded into `users.settings` JSONB column on first sign-in.
 */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  default_entity_id: null,
  tax_year_start: "01-01",
  effective_tax_rate_percent: 12.4,
  lhdn_forecast_income_minor: 0,
  cp500_schedule: [],
  tax_reserve_strategy: {
    enabled: true,
    percent_of_income: 15,
    target_account_name: "Tax Reserve",
    reminder_day_of_month: 25,
  },
  cp502_threshold_percent: 10,
  reminder_channels: ["in_app", "email"],
  google_calendar_connected: false,
  fx_preference: "latest_cached",
  monthly_ai_cost_cap_minor: 50000,
};

/**
 * Ensures the `users` table has a record for the given authenticated user.
 * Called after successful sign-in (magic link or OAuth).
 *
 * If the user record doesn't exist, creates it with default settings.
 * If it exists but settings are missing/empty, merges in defaults.
 *
 * @param {User} user - The authenticated Supabase Auth user.
 * @returns {Promise<void>} Resolves when the user record is ensured.
 *
 * @example
 * ```ts
 * const { user } = await supabase.auth.getUser();
 * if (user) await ensureUserRecord(user);
 * ```
 */
export async function ensureUserRecord(user: User): Promise<void> {
  try {
    const supabase = await createActionClient();

    // Check if the user record already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("id, settings")
      .eq("id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error(
        "[Auth] Failed to check existing user record:",
        fetchError.message
      );
      throw new Error("Failed to check user record");
    }

    const now: string = new Date().toISOString();

    if (!existingUser) {
      // Create new user record with default settings
      const { error: insertError } = await supabase.from("users").insert({
        id: user.id,
        email: user.email ?? "",
        display_name: user.user_metadata?.["full_name"] ??
          user.user_metadata?.["name"] ?? null,
        settings: DEFAULT_USER_SETTINGS,
        created_at: now,
        updated_at: now,
      });

      if (insertError) {
        console.error(
          "[Auth] Failed to create user record:",
          insertError.message
        );
        throw new Error("Failed to create user record");
      }

      console.log("[Auth] Created user record for:", user.email);
    } else {
      // User exists — ensure settings are populated (migration safety)
      const currentSettings: unknown = existingUser.settings;
      const needsSettingsUpdate: boolean =
        !currentSettings ||
        (typeof currentSettings === "object" &&
          currentSettings !== null &&
          Object.keys(currentSettings).length === 0);

      if (needsSettingsUpdate) {
        const { error: updateError } = await supabase
          .from("users")
          .update({
            settings: DEFAULT_USER_SETTINGS,
            updated_at: now,
          })
          .eq("id", user.id);

        if (updateError) {
          console.error(
            "[Auth] Failed to update user settings:",
            updateError.message
          );
          throw new Error("Failed to update user settings");
        }

        console.log("[Auth] Updated settings for user:", user.email);
      }
    }
  } catch (err) {
    const errorMessage: string =
      err instanceof Error ? err.message : "An unexpected error occurred";
    console.error("[Auth] Unexpected error in ensureUserRecord:", errorMessage);
    throw err; // Re-throw so callers can handle appropriately
  }
}
