/**
 * @fileoverview Server-side Supabase client for JK Zentra Finance Cockpit.
 *
 * Uses `createServerClient` from `@supabase/ssr` with Next.js 15 cookie
 * handling. Provides two entry points:
 *
 * 1. `createClient()` — for Server Components (reads cookies only).
 * 2. `createActionClient()` — for Server Actions (reads + writes cookies).
 *
 * Both variants properly handle cookie serialization for Next.js 15's
 * async `cookies()` from `next/headers`.
 *
 * @module lib/supabase/server
 */

import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables: " +
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
  );
}

// ---------------------------------------------------------------------------
// Cookie configuration
// ---------------------------------------------------------------------------

/**
 * Cookie options aligned with Supabase Auth requirements and security best
 * practices for a finance application.
 */
const cookieOptions: CookieOptionsWithName = {
  name: "sb-auth-token",
  // Secure in production; allow HTTP in development.
  secure: process.env.NODE_ENV === "production",
  // Lax to support OAuth redirects from external providers.
  sameSite: "lax",
  path: "/",
  // 7 days matches Supabase's default session expiry.
  maxAge: 60 * 60 * 24 * 7,
};

// ---------------------------------------------------------------------------
// Server Component client (read-only cookies)
// ---------------------------------------------------------------------------

/**
 * Creates a Supabase client for use in Server Components.
 * This client can **read** cookies but cannot write them — suitable for
 * rendering pages based on the current auth state.
 *
 * @returns {Promise<SupabaseClient<Database>>} Typed Supabase client for Server Components.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions,
    cookies: {
      /**
       * Retrieves all cookies by name. Returns every cookie that matches
       * the configured cookie name prefix.
       */
      getAll() {
        return cookieStore.getAll();
      },
      /**
       * Server Components cannot set cookies. This is a no-op.
       */
      setAll() {
        // No-op: Server Components cannot modify cookies.
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Server Action client (read + write cookies)
// ---------------------------------------------------------------------------

/**
 * Creates a Supabase client for use in Server Actions.
 * This client can **both read and write** cookies, enabling sign-in,
 * sign-out, and session refresh mutations.
 *
 * @returns {Promise<SupabaseClient<Database>>} Typed Supabase client for Server Actions.
 */
export async function createActionClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions,
    cookies: {
      /**
       * Retrieves all cookies from the incoming request.
       */
      getAll() {
        return cookieStore.getAll();
      },
      /**
       * Sets all cookies on the outgoing response. Called by Supabase Auth
       * when the session changes (sign-in, sign-out, token refresh).
       */
      setAll(cookiesToSet) {
        cookiesToSet.forEach(
          ({ name, value, options }: { name: string; value: string; options: CookieOptionsWithName }) => {
            cookieStore.set(name, value, options);
          }
        );
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Middleware client (read + write cookies for edge runtime)
// ---------------------------------------------------------------------------

import type { NextRequest, NextResponse } from "next/server";

/**
 * Creates a Supabase client for use in Next.js Middleware (edge runtime).
 * This client operates on the request/response cookie headers directly,
 * allowing session refresh and route protection at the edge.
 *
 * @param {NextRequest} request - The incoming Next.js request.
 * @param {NextResponse} response - The outgoing Next.js response (for cookie setting).
 * @returns {SupabaseClient<Database>} Typed Supabase client for Middleware.
 */
export function createMiddlewareClient(
  request: NextRequest,
  response: NextResponse
): SupabaseClient<Database> {
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions,
    cookies: {
      /**
       * Reads cookies from the request headers.
       */
      getAll() {
        return request.cookies.getAll();
      },
      /**
       * Sets cookies on the response headers. These are persisted back
       * to the browser via the NextResponse.
       */
      setAll(cookiesToSet) {
        cookiesToSet.forEach(
          ({ name, value, options }: { name: string; value: string; options: CookieOptionsWithName }) => {
            response.cookies.set(name, value, options);
          }
        );
      },
    },
  });
}
