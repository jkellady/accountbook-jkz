/**
 * @fileoverview Next.js authentication middleware for JK Zentra Finance Cockpit.
 *
 * Intercepts every request to:
 * 1. Refresh the Supabase session (token refresh if expired).
 * 2. Redirect unauthenticated users away from protected routes → /login.
 * 3. Redirect authenticated users away from auth pages → /dashboard.
 *
 * Applied globally via `middleware.ts` at the project root.
 *
 * @module lib/supabase/middleware
 */

import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "./server";

// ---------------------------------------------------------------------------
// Route configuration
// ---------------------------------------------------------------------------

/**
 * Public routes that do NOT require authentication.
 * Unauthenticated users may access these freely.
 */
const PUBLIC_ROUTES: readonly string[] = [
  "/login",
  "/auth/callback",
  "/", // Landing page
  "/api/webhook", // If webhooks are needed
];

/**
 * Routes that authenticated users should be redirected away from.
 * These are auth flows that don't make sense for signed-in users.
 */
const AUTH_ONLY_ROUTES: readonly string[] = ["/login"];

/**
 * Redirect destinations.
 */
const REDIRECT_TO_LOGIN: string = "/login";
const REDIRECT_TO_DASHBOARD: string = "/dashboard";

// ---------------------------------------------------------------------------
// Route matching helpers
// ---------------------------------------------------------------------------

/**
 * Checks if a pathname matches any of the given route prefixes.
 * Supports exact matches and wildcard prefixes (e.g., `/api/`).
 *
 * @param {string} pathname - The current request pathname.
 * @param {readonly string[]} routes - Array of route prefixes to match against.
 * @returns {boolean} True if the pathname is within the given routes.
 */
function isMatchingRoute(
  pathname: string,
  routes: readonly string[]
): boolean {
  return routes.some((route) => {
    if (route.endsWith("/")) {
      return pathname.startsWith(route);
    }
    return pathname === route;
  });
}

/**
 * Determines if a pathname is for a static asset that should bypass auth.
 * Next.js internal files and public assets don't need session checks.
 *
 * @param {string} pathname - The current request pathname.
 * @returns {boolean} True if the request is for a static asset.
 */
function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") || // Next.js internals
    pathname.startsWith("/static/") || // Public static files
    pathname.startsWith("/favicon") || // Favicon variants
    pathname.startsWith("/images/") || // Public image assets
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  );
}

// ---------------------------------------------------------------------------
// Middleware handler
// ---------------------------------------------------------------------------

/**
 * Main middleware function — runs on every request.
 *
 * Flow:
 * 1. Skip static assets.
 * 2. Create a Supabase middleware client attached to the request/response.
 * 3. Attempt to refresh the session (sets updated cookies on response).
 * 4. Route protection logic:
 *    - Unauthenticated + protected route → /login
 *    - Authenticated + auth route → /dashboard
 * 5. Return the (possibly modified) response.
 *
 * @param {NextRequest} request - The incoming Next.js request.
 * @returns {Promise<NextResponse>} The response, possibly with redirects or updated cookies.
 */
export async function updateSession(
  request: NextRequest
): Promise<NextResponse> {
  // Create a response object that we can modify (set cookies on it).
  let response: NextResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Skip auth checks for static assets — performance optimization.
  const pathname: string = request.nextUrl.pathname;
  if (isStaticAsset(pathname)) {
    return response;
  }

  // -------------------------------------------------------------------------
  // 1. Create middleware client and refresh session
  // -------------------------------------------------------------------------

  const supabase = createMiddlewareClient(request, response);

  // `getUser()` forces a session refresh by calling the Supabase Auth API.
  // This validates the access token and refreshes it if expired.
  // Do NOT use `getSession()` here — it reads from localStorage/cookies
  // without server-side validation, which is insecure for route protection.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    // Log the error for monitoring. Don't throw — we want to continue
    // and treat this as an unauthenticated request.
    console.warn("[Middleware] Session refresh error:", userError.message);
  }

  const isAuthenticated: boolean = user !== null;

  // -------------------------------------------------------------------------
  // 2. Route protection: redirect authenticated users away from /login
  // -------------------------------------------------------------------------

  if (isAuthenticated && isMatchingRoute(pathname, AUTH_ONLY_ROUTES)) {
    const dashboardUrl: URL = new URL(REDIRECT_TO_DASHBOARD, request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // -------------------------------------------------------------------------
  // 3. Route protection: redirect unauthenticated users away from protected routes
  // -------------------------------------------------------------------------

  const isPublicRoute: boolean = isMatchingRoute(pathname, PUBLIC_ROUTES);

  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl: URL = new URL(REDIRECT_TO_LOGIN, request.url);

    // Preserve the original URL so we can redirect back after sign-in.
    // Only set `redirectTo` for non-API routes to avoid leaking internals.
    if (!pathname.startsWith("/api/")) {
      loginUrl.searchParams.set("redirectTo", pathname);
    }

    return NextResponse.redirect(loginUrl);
  }

  // -------------------------------------------------------------------------
  // 4. Return response (with possibly refreshed auth cookies)
  // -------------------------------------------------------------------------

  return response;
}
