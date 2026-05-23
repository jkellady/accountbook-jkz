/**
 * @fileoverview Next.js root middleware for JK Zentra Finance Cockpit.
 *
 * Applies authentication middleware to all routes. The middleware:
 * 1. Refreshes the Supabase session (token refresh if expired).
 * 2. Redirects unauthenticated users to /login.
 * 3. Redirects authenticated users away from auth pages to /dashboard.
 * 4. Skips auth checks for static assets and API routes.
 *
 * Delegates the core Supabase cookie/session handling to
 * lib/supabase/middleware.ts for maintainability.
 *
 * @see lib/supabase/middleware.ts — Core auth middleware logic.
 * @see lib/supabase/server.ts — Middleware client factory.
 *
 * @module middleware
 */

import { type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

/**
 * Middleware entry point — runs on every request matching the matcher config.
 *
 * Delegates to `updateSession` from `lib/supabase/middleware` for all
 * auth-related logic (session refresh, route protection, cookie management).
 *
 * @param {NextRequest} request - The incoming Next.js request.
 * @returns {Promise<Response>} The response, possibly with redirects or updated cookies.
 */
export async function middleware(request: NextRequest): Promise<Response> {
  return updateSession(request);
}

/**
 * Middleware matcher configuration.
 *
 * Runs on all routes EXCEPT:
 * - Static files (_next/static, images, fonts, icons, etc.)
 * - Next.js internal files (_next/image, _next/static)
 * - Favicon variants
 * - Public manifest and robots files
 *
 * The auth middleware itself skips static assets internally as a safety net,
 * but excluding them at the matcher level improves performance.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|json|txt)$).*)",
  ],
};
