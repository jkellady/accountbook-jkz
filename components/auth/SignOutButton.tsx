/**
 * @fileoverview Sign-out button component for JK Zentra Finance Cockpit.
 *
 * A client component that renders a sign-out button with loading state.
 * Calls the `signOut` server action and redirects to /login on success.
 *
 * @module components/auth/SignOutButton
 */

"use client";

import React, { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/actions/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the SignOutButton component.
 */
interface SignOutButtonProps {
  /**
   * Optional CSS class names to apply to the button.
   */
  className?: string;

  /**
   * Optional label text. Defaults to "Sign Out".
   */
  label?: string;

  /**
   * Optional variant that affects button styling.
   * @default "primary"
   */
  variant?: "primary" | "ghost" | "danger";

  /**
   * Optional callback called after successful sign-out but before redirect.
   */
  onSignOut?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Sign-out button with loading state and error handling.
 *
 * @param {SignOutButtonProps} props - Component props.
 * @returns {JSX.Element} The rendered sign-out button.
 *
 * @example
 * ```tsx
 * <SignOutButton variant="ghost" label="Log out" />
 * ```
 */
export default function SignOutButton({
  className = "",
  label = "Sign Out",
  variant = "primary",
  onSignOut,
}: SignOutButtonProps): JSX.Element {
  // Next.js router for programmatic navigation
  const router = useRouter();

  // Loading state
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);

  // useTransition for smooth non-blocking UI
  const [isPending, startTransition] = useTransition();

  // Combined loading state
  const isLoading: boolean = isSigningOut || isPending;

  // -------------------------------------------------------------------------
  // Variant-based styles
  // -------------------------------------------------------------------------

  /**
   * Base styles applied to all variants.
   */
  const baseStyles: string =
    "inline-flex items-center justify-center gap-2 font-medium text-sm " +
    "transition-all duration-200 rounded-lg " +
    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1a1a2e] " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  /**
   * Variant-specific styles.
   */
  const variantStyles: Record<SignOutButtonProps["variant"] & string, string> = {
    primary:
      "px-4 py-2.5 bg-[#F37002] hover:bg-[#d96202] text-white " +
      "focus:ring-[#F37002] active:scale-[0.98]",
    ghost:
      "px-4 py-2.5 text-gray-400 hover:text-white hover:bg-white/5 " +
      "focus:ring-gray-500",
    danger:
      "px-4 py-2.5 bg-red-900/40 hover:bg-red-900/60 text-red-300 " +
      "border border-red-800 focus:ring-red-500 active:scale-[0.98]",
  };

  const buttonClasses: string = `${baseStyles} ${variantStyles[variant]} ${className}`;

  // -------------------------------------------------------------------------
  // Sign-out handler
  // -------------------------------------------------------------------------

  /**
   * Handles the sign-out action:
   * 1. Calls the server-side signOut action.
   * 2. Invokes the optional onSignOut callback.
   * 3. Redirects to /login.
   */
  const handleSignOut = useCallback((): void => {
    // Prevent double-clicks
    if (isLoading) return;

    setIsSigningOut(true);

    startTransition(async () => {
      try {
        const result = await signOut();

        if (result.success) {
          // Call optional callback before redirect
          onSignOut?.();

          // Refresh the router to clear any cached auth state
          router.refresh();

          // Navigate to login page
          router.push("/login");
        } else {
          // signOut always returns success=true, but handle defensively
          console.warn("[SignOutButton] Sign-out returned non-success");
          setIsSigningOut(false);
        }
      } catch (err) {
        const errorMessage: string =
          err instanceof Error ? err.message : "An unexpected error occurred";
        console.error("[SignOutButton] Sign-out failed:", errorMessage);
        setIsSigningOut(false);
      }
    });
  }, [isLoading, onSignOut, router]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isLoading}
      className={buttonClasses}
      aria-label={isLoading ? "Signing out..." : label}
      aria-busy={isLoading}
    >
      {isLoading ? (
        <>
          {/* Loading spinner */}
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Signing out...</span>
        </>
      ) : (
        <>
          {/* Sign-out icon */}
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
