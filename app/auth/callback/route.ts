/**
 * @fileoverview OAuth callback handler for JK Zentra Finance Cockpit.
 *
 * This route handles the callback from Supabase Auth after a successful
 * magic link click or Google OAuth sign-in. It:
 * 1. Exchanges the authorization `code` for a session.
 * 2. Sets authentication cookies on the response.
 * 3. Ensures the user record exists in the `users` table.
 * 4. Redirects to the dashboard.
 *
 * Edge cases handled:
 * - Missing or invalid `code` parameter.
 * - Expired authorization code.
 * - Supabase configuration errors.
 * - User record creation failures (logs error but still redirects).
 *
 * @module app/auth/callback/route
 */

import { NextRequest, NextResponse } from "next/server";
import { createActionClient } from "@/lib/supabase/server";
import { ensureUserRecord } from "@/lib/actions/auth";

// ---------------------------------------------------------------------------
// Route configuration
// ---------------------------------------------------------------------------

/**
 * URL to redirect to after successful authentication.
 */
const REDIRECT_SUCCESS: string = "/dashboard";

/**
 * URL to redirect to on authentication failure.
 */
const REDIRECT_ERROR: string = "/login";

// ---------------------------------------------------------------------------
// Error response helper
// ---------------------------------------------------------------------------

/**
 * Constructs an error redirect response with an error message query parameter.
 *
 * @param {string} baseUrl - The application's base URL.
 * @param {string} errorMessage - User-friendly error message to display.
 * @returns {NextResponse} Redirect response to the login page with error context.
 */
function errorRedirect(baseUrl: string, errorMessage: string): NextResponse {
  const url: URL = new URL(REDIRECT_ERROR, baseUrl);
  url.searchParams.set("error", encodeURIComponent(errorMessage));
  return NextResponse.redirect(url);
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

/**
 * Handles the OAuth callback GET request.
 *
 * Expects a `code` query parameter from Supabase Auth. Exchanges the code
 * for a session, sets cookies, ensures the user record exists, and redirects
 * to the dashboard.
 *
 * @param {NextRequest} request - The incoming Next.js request.
 * @returns {Promise<NextResponse>} Redirect response to dashboard or login on error.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const baseUrl: string = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    // Extract the authorization code from the query parameters
    const searchParams: URLSearchParams = request.nextUrl.searchParams;
    const code: string | null = searchParams.get("code");

    // -----------------------------------------------------------------------
    // Validate the authorization code
    // -----------------------------------------------------------------------

    if (!code) {
      console.warn("[Auth Callback] Missing authorization code in callback URL");
      return errorRedirect(baseUrl, "Invalid sign-in link. Please try again.");
    }

    // Validate code format: Supabase codes are alphanumeric, ~40-60 chars
    const CODE_PATTERN: RegExp = /^[a-zA-Z0-9_-]+$/;
    if (!CODE_PATTERN.test(code) || code.length < 20 || code.length > 128) {
      console.warn("[Auth Callback] Malformed authorization code");
      return errorRedirect(baseUrl, "Invalid sign-in link. Please try again.");
    }

    // -----------------------------------------------------------------------
    // Exchange code for session
    // -----------------------------------------------------------------------

    const supabase = await createActionClient();

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("[Auth Callback] Code exchange error:", exchangeError.message);

      // Provide specific error messages for known failure modes
      if (exchangeError.message.includes("expired")) {
        return errorRedirect(
          baseUrl,
          "Your sign-in link has expired. Please request a new one."
        );
      }

      if (exchangeError.message.includes("invalid")) {
        return errorRedirect(
          baseUrl,
          "Invalid sign-in link. Please request a new one."
        );
      }

      if (exchangeError.message.includes("grant")) {
        return errorRedirect(
          baseUrl,
          "Sign-in session expired. Please try again."
        );
      }

      return errorRedirect(
        baseUrl,
        "Sign-in failed. Please try again."
      );
    }

    // -----------------------------------------------------------------------
    // Verify session was established
    // -----------------------------------------------------------------------

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("[Auth Callback] Session verification failed:", userError?.message);
      return errorRedirect(
        baseUrl,
        "Could not verify your sign-in. Please try again."
      );
    }

    // -----------------------------------------------------------------------
    // Ensure user record exists in application database
    // -----------------------------------------------------------------------

    try {
      await ensureUserRecord(user);
    } catch (err) {
      // Log the error but don't block the sign-in flow.
      // The user can still use the app; settings will use defaults.
      const errorMessage: string =
        err instanceof Error ? err.message : "Unknown error";
      console.error(
        "[Auth Callback] Failed to ensure user record (non-blocking):",
        errorMessage
      );
    }

    // -----------------------------------------------------------------------
    // Redirect to dashboard
    // -----------------------------------------------------------------------

    // Check for a `redirectTo` param (set by middleware when redirecting
    // unauthenticated users away from a protected route).
    const redirectTo: string | null = searchParams.get("redirectTo");
    const safeRedirect: string = sanitizeRedirect(redirectTo) ?? REDIRECT_SUCCESS;

    const dashboardUrl: URL = new URL(safeRedirect, baseUrl);
    return NextResponse.redirect(dashboardUrl);

  } catch (err) {
    const errorMessage: string =
      err instanceof Error ? err.message : "An unexpected error occurred";
    console.error("[Auth Callback] Unexpected error:", errorMessage);
    return errorRedirect(baseUrl, "An unexpected error occurred. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// Redirect sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitizes a redirect URL to prevent open redirect vulnerabilities.
 * Only allows relative paths starting with "/" (same-origin redirects).
 *
 * @param {string | null} redirect - The raw redirect URL from query params.
 * @returns {string | null} Sanitized relative path, or null if unsafe/invalid.
 */
function sanitizeRedirect(redirect: string | null): string | null {
  if (!redirect) return null;

  // Only allow relative paths (same-origin)
  // Reject absolute URLs, protocol-relative URLs, and path traversal
  if (
    redirect.startsWith("/") &&
    !redirect.startsWith("//") &&
    !redirect.includes(":") &&
    !redirect.includes("..")
  ) {
    return redirect;
  }

  return null;
}
