/**
 * @fileoverview Browser-side Supabase client for JK Zentra Finance Cockpit.
 *
 * Uses `createBrowserClient` from `@supabase/ssr` to manage auth sessions
 * in the browser via a singleton pattern. This client is safe to use in
 * Client Components and handles automatic token refresh.
 *
 * @module lib/supabase/client
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Typed Supabase client for browser usage.
 * Initialised lazily on first call and reused thereafter (singleton).
 */
let browserClient: SupabaseClient<Database> | null = null;

/**
 * Returns the shared browser Supabase client instance.
 * Creates it on first call; subsequent calls return the same instance.
 *
 * @returns {SupabaseClient<Database>} Typed Supabase client for browser use.
 * @throws {Error} If required environment variables are missing.
 */
export function createClient(): SupabaseClient<Database> {
  if (browserClient) {
    return browserClient;
  }

  const url: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey: string | undefined =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables: " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
    );
  }

  browserClient = createBrowserClient<Database>(url, anonKey, {
    auth: {
      // Enable automatic token refresh in the background.
      autoRefreshToken: true,
      // Persist session across page reloads in localStorage.
      persistSession: true,
      // Detect auth state changes (e.g., sign-in, sign-out, token refresh).
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}
