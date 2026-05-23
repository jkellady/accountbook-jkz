/**
 * @fileoverview Authentication form component for JK Zentra Finance Cockpit.
 *
 * Client component that provides two sign-in methods:
 * 1. Magic link via email — enter email, receive a login link.
 * 2. Google OAuth — one-click sign-in with Google.
 *
 * Features:
 * - Full loading states for both sign-in methods.
 * - Success feedback after magic link is sent.
 * - Inline error display with clear messaging.
 * - Responsive design, mobile-friendly.
 * - JK Zentra design system: off-white bg, dark panels, orange accent (#F37002).
 *
 * @module components/auth/AuthForm
 */

"use client";

import React, { useState, useCallback, useTransition } from "react";
import {
  signInWithMagicLink,
  signInWithGoogle,
} from "@/lib/actions/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Possible UI states for the authentication form.
 */
type AuthFormState = "idle" | "submitting_magic" | "submitting_google" | "success" | "error";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Authentication form — provides magic link and Google OAuth sign-in.
 *
 * @returns {JSX.Element} The rendered authentication form.
 */
export default function AuthForm(): JSX.Element {
  // Email input state
  const [email, setEmail] = useState<string>("");

  // Form UI state
  const [formState, setFormState] = useState<AuthFormState>("idle");

  // Error message to display
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Success message to display
  const [successMessage, setSuccessMessage] = useState<string>("");

  // useTransition for non-blocking UI updates during server actions
  const [isPending, startTransition] = useTransition();

  // -------------------------------------------------------------------------
  // Email validation (client-side, lightweight)
  // -------------------------------------------------------------------------

  /**
   * Validates the email format using a simple regex.
   * Full validation happens server-side via Zod.
   *
   * @param {string} value - The email address to validate.
   * @returns {boolean} True if the email appears valid.
   */
  const isValidEmail = useCallback((value: string): boolean => {
    const EMAIL_REGEX: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return EMAIL_REGEX.test(value) && value.length <= 254;
  }, []);

  // -------------------------------------------------------------------------
  // Magic link submission handler
  // -------------------------------------------------------------------------

  /**
   * Handles magic link form submission.
   * Validates input, calls the server action, and updates UI state.
   *
   * @param {React.FormEvent<HTMLFormElement>} event - The form submit event.
   */
  const handleMagicLinkSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>): void => {
      event.preventDefault();

      // Prevent double-submission
      if (formState === "submitting_magic" || formState === "submitting_google") {
        return;
      }

      // Clear previous states
      setErrorMessage("");
      setSuccessMessage("");

      // Client-side validation
      const trimmedEmail: string = email.trim();

      if (!trimmedEmail) {
        setErrorMessage("Please enter your email address.");
        setFormState("error");
        return;
      }

      if (!isValidEmail(trimmedEmail)) {
        setErrorMessage("Please enter a valid email address.");
        setFormState("error");
        return;
      }

      // Submit via server action
      setFormState("submitting_magic");

      startTransition(async () => {
        try {
          const result = await signInWithMagicLink(trimmedEmail);

          if (result.success) {
            setFormState("success");
            setSuccessMessage(
              "Check your email for a magic link. Click the link to sign in."
            );
            setEmail(""); // Clear the input on success
          } else {
            setFormState("error");
            setErrorMessage(result.error ?? "Failed to send magic link. Please try again.");
          }
        } catch {
          setFormState("error");
          setErrorMessage("An unexpected error occurred. Please try again.");
        }
      });
    },
    [email, formState, isValidEmail]
  );

  // -------------------------------------------------------------------------
  // Google OAuth handler
  // -------------------------------------------------------------------------

  /**
   * Initiates Google OAuth sign-in by calling the server action
   * and redirecting to the returned URL.
   */
  const handleGoogleSignIn = useCallback((): void => {
    // Prevent double-submission
    if (formState === "submitting_magic" || formState === "submitting_google") {
      return;
    }

    // Clear previous states
    setErrorMessage("");
    setSuccessMessage("");
    setFormState("submitting_google");

    startTransition(async () => {
      try {
        const result = await signInWithGoogle();

        if (result.url) {
          // Redirect to Google's OAuth consent screen
          window.location.href = result.url;
        } else {
          setFormState("error");
          setErrorMessage(result.error ?? "Failed to start Google sign-in. Please try again.");
        }
      } catch {
        setFormState("error");
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    });
  }, [formState]);

  // -------------------------------------------------------------------------
  // Derived state flags
  // -------------------------------------------------------------------------

  const isSubmittingMagic: boolean = formState === "submitting_magic" || (isPending && formState !== "submitting_google");
  const isSubmittingGoogle: boolean = formState === "submitting_google";
  const isSubmitting: boolean = isSubmittingMagic || isSubmittingGoogle;
  const hasError: boolean = formState === "error" && errorMessage.length > 0;
  const hasSuccess: boolean = formState === "success" && successMessage.length > 0;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Card container */}
      <div className="bg-[#1a1a2e] rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center">
          <div className="mb-4">
            {/* Logo placeholder — replace with actual JK Zentra logo */}
            <div className="w-14 h-14 mx-auto bg-[#F37002] rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold">Z</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            JK Zentra
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Finance Cockpit
          </p>
        </div>

        {/* Success state */}
        {hasSuccess && (
          <div className="mx-8 mb-4 p-4 bg-emerald-950/50 border border-emerald-800 rounded-xl">
            <div className="flex items-start gap-3">
              {/* Success icon */}
              <svg
                className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <div>
                <p className="text-emerald-300 font-medium text-sm">
                  Magic link sent!
                </p>
                <p className="text-emerald-400/70 text-sm mt-0.5">
                  {successMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div className="mx-8 mb-4 p-4 bg-red-950/50 border border-red-800 rounded-xl">
            <div className="flex items-start gap-3">
              {/* Error icon */}
              <svg
                className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <p className="text-red-300 text-sm">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Magic link form */}
        <form onSubmit={handleMagicLinkSubmit} className="px-8 pb-6">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setEmail(e.target.value);
              // Clear error when user starts typing again
              if (formState === "error") {
                setFormState("idle");
                setErrorMessage("");
              }
            }}
            disabled={isSubmitting}
            className={`
              w-full px-4 py-3 rounded-xl bg-[#0f0f1a] border
              text-white placeholder-gray-500 text-sm
              transition-colors duration-200 outline-none
              focus:ring-2 focus:ring-[#F37002]/50 focus:border-[#F37002]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${hasError ? "border-red-600" : "border-gray-700"}
            `}
            aria-describedby={hasError ? "email-error" : undefined}
            aria-invalid={hasError}
          />

          <button
            type="submit"
            disabled={isSubmitting || !email.trim()}
            className={`
              w-full mt-4 py-3 px-4 rounded-xl font-semibold text-sm
              transition-all duration-200
              flex items-center justify-center gap-2
              ${
                isSubmittingMagic
                  ? "bg-[#F37002]/70 cursor-wait"
                  : "bg-[#F37002] hover:bg-[#d96202] active:scale-[0.98]"
              }
              text-white
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {isSubmittingMagic ? (
              <>
                {/* Spinner */}
                <svg
                  className="animate-spin h-4 w-4 text-white"
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
                <span>Sending magic link...</span>
              </>
            ) : (
              <span>Send magic link</span>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="px-8 flex items-center gap-4">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-500 text-xs uppercase tracking-wider">
            or
          </span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* Google OAuth button */}
        <div className="px-8 pt-6 pb-8">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className={`
              w-full py-3 px-4 rounded-xl font-semibold text-sm
              transition-all duration-200
              flex items-center justify-center gap-3
              bg-white hover:bg-gray-100 active:scale-[0.98]
              text-gray-900
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {isSubmittingGoogle ? (
              <>
                {/* Spinner */}
                <svg
                  className="animate-spin h-4 w-4 text-gray-600"
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
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                {/* Google "G" icon */}
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Sign in with Google</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Footer text */}
      <p className="text-center text-gray-500 text-xs mt-6 px-4">
        By signing in, you agree to our Terms of Service and Privacy Policy.
        No password required — we use secure magic links or Google OAuth.
      </p>
    </div>
  );
}
