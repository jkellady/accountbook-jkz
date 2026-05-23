/**
 * @fileoverview TaxVerdict — Hero verdict card for the Tax Position module.
 *
 * Displays a plain-language sentence about the user's tax position,
 * with a dark panel and orange left accent. Changes appearance based
 * on verdict state: overpaying, underpaying, or on_track.
 *
 * DISCLAIMER: This is a simplified directional estimate. Your actual tax
 * liability depends on many factors. Consult your tax agent for filing.
 *
 * @module components/tax-position/TaxVerdict
 */

"use client";

import React from "react";
import type { TaxForecast } from "@/lib/actions/taxPosition";
import { formatMYR } from "@/lib/actions/taxPosition";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TaxVerdictProps {
  /** The forecast result containing verdict and variance. */
  forecast: Pick<TaxForecast, "verdict" | "variance_minor"> | null;
  /** Whether the forecast data is still loading. */
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Verdict configuration — deterministic message + style mapping
// ---------------------------------------------------------------------------

interface VerdictConfig {
  /** Plain-language headline sentence. */
  headline: string;
  /** Subtitle explaining the position. */
  subtitle: string;
  /** CSS class for the status pill background. */
  pillClass: string;
  /** CSS class for the status pill text. */
  pillTextClass: string;
  /** Pill label text. */
  pillLabel: string;
}

const VERDICT_MAP: Record<TaxForecast["verdict"], VerdictConfig> = {
  on_track: {
    headline: "You're on track. CP500 will cover it.",
    subtitle: "Your scheduled prepayments align with your projected liability.",
    pillClass: "bg-emerald-50",
    pillTextClass: "text-emerald-700",
    pillLabel: "ON TRACK",
  },
  overpaying: {
    headline: "You're overpaying. Consider CP502 revision.",
    subtitle: "Your CP500 instalments exceed your projected tax liability.",
    pillClass: "bg-amber-50",
    pillTextClass: "text-amber-700",
    pillLabel: "OVERPAYING",
  },
  underpaying: {
    headline: "You're underpaying. Set aside cash reserve.",
    subtitle: "Your projected tax exceeds your scheduled CP500 prepayments.",
    pillClass: "bg-red-50",
    pillTextClass: "text-red-700",
    pillLabel: "UNDERPAYING",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Hero verdict card with dark background and orange left accent.
 * Displays the current tax position in plain language with a status pill.
 *
 * @param props - TaxVerdictProps.
 * @returns React element.
 */
export function TaxVerdict({ forecast, isLoading = false }: TaxVerdictProps): React.ReactElement {
  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (isLoading || !forecast) {
    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "#181818" }}
        data-testid="tax-verdict-loading"
      >
        <div className="flex">
          {/* Orange left accent */}
          <div className="w-1.5 shrink-0" style={{ backgroundColor: "#F37002" }} />
          <div className="p-6 flex-1 animate-pulse">
            <div className="h-5 bg-neutral-700 rounded w-3/4 mb-3" />
            <div className="h-4 bg-neutral-700 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Resolved state
  // -------------------------------------------------------------------------
  const config = VERDICT_MAP[forecast.verdict];
  const varianceAbs = Math.abs(forecast.variance_minor);
  const isVariance = varianceAbs > 0;

  return (
    <div
      className="rounded-xl overflow-hidden shadow-sm"
      style={{ backgroundColor: "#181818" }}
      data-testid="tax-verdict"
      data-verdict={forecast.verdict}
    >
      <div className="flex">
        {/* Orange left accent — 6px solid */}
        <div
          className="shrink-0"
          style={{ width: "6px", backgroundColor: "#F37002" }}
        />

        {/* Content */}
        <div className="p-5 sm:p-6 flex-1">
          {/* Headline */}
          <p
            className="text-base sm:text-lg font-semibold mb-2"
            style={{ color: "#FFFFFF" }}
          >
            {config.headline}
          </p>

          {/* Subtitle */}
          <p
            className="text-sm mb-4"
            style={{ color: "#A3A3A3" }}
          >
            {config.subtitle}
          </p>

          {/* Status pill + variance */}
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.pillClass} ${config.pillTextClass}`}
            >
              {config.pillLabel}
            </span>

            {isVariance && (
              <span
                className="text-sm font-medium"
                style={{ color: "#A3A3A3" }}
              >
                {forecast.verdict === "overpaying"
                  ? `${formatMYR(varianceAbs)} potential refund`
                  : forecast.verdict === "underpaying"
                    ? `${formatMYR(varianceAbs)} shortfall`
                    : `${formatMYR(varianceAbs)} variance`}
              </span>
            )}

            {forecast.verdict === "on_track" && (
              <span
                className="text-sm"
                style={{ color: "#A3A3A3" }}
              >
                RM 0 variance
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaxVerdict;
