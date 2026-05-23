/**
 * @fileoverview ForecastMath — Step-by-step tax forecast calculation display.
 *
 * Shows every intermediate value in the tax forecast with full transparency.
 * Editable inputs for effective rate, LHDN forecast income, and deductible
 * projection allow the user to model different scenarios.
 *
 * Each row has a label, computed value, and optional [Edit] button.
 * .compute rows get orange-soft bg (#FFF6EF) for intermediate totals.
 * .final row gets dark bg (#181818) for the variance line.
 *
 * DISCLAIMER: This is a simplified directional estimate. Your actual tax
 * liability depends on many factors. Consult your tax agent for filing.
 *
 * @module components/tax-position/ForecastMath
 */

"use client";

import React, { useState, useCallback } from "react";
import type { TaxForecast } from "@/lib/actions/taxPosition";
import { formatMYR } from "@/lib/utils/formatting";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ForecastMathProps {
  /** The forecast data from the server action. */
  forecast: TaxForecast | null;
  /** Current effective tax rate from settings (as decimal, e.g. 0.124). */
  effectiveTaxRate: number;
  /** Current LHDN forecast income in minor units (0 if not set). */
  lhdnForecastMinor: number;
  /** User-editable projected annual deductible (0 = auto-calculate). */
  userDeductibleOverride: number;
  /** Loading state. */
  isLoading?: boolean;
  /** Called when the user changes the effective tax rate. */
  onRateChange: (rateDecimal: number) => void;
  /** Called when the user changes the LHDN forecast income. */
  onForecastChange: (incomeMinor: number) => void;
  /** Called when the user changes the deductible projection. */
  onDeductibleChange: (deductibleMinor: number) => void;
}

// ---------------------------------------------------------------------------
// Helper: format percentage
// ---------------------------------------------------------------------------

function fmtPercent(decimal: number): string {
  return `${(decimal * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Row sub-component
// ---------------------------------------------------------------------------

interface MathRowProps {
  label: string;
  value: string;
  note?: string;
  variant?: "default" | "compute" | "final" | "input";
  children?: React.ReactNode;
}

function MathRow({
  label,
  value,
  note,
  variant = "default",
  children,
}: MathRowProps): React.ReactElement {
  const bgClass =
    variant === "compute"
      ? ""
      : variant === "final"
        ? ""
        : variant === "input"
          ? ""
          : "";

  const bgStyle: React.CSSProperties =
    variant === "compute"
      ? { backgroundColor: "#FFF6EF" }
      : variant === "final"
        ? { backgroundColor: "#181818" }
        : variant === "input"
          ? { backgroundColor: "#F9F9F6" }
          : {};

  const textStyle: React.CSSProperties =
    variant === "final"
      ? { color: "#FFFFFF" }
      : variant === "compute"
        ? { color: "#F37002" }
        : {};

  const labelStyle: React.CSSProperties =
    variant === "final" ? { color: "#A3A3A3" } : {};

  return (
    <div
      className={`flex items-center justify-between py-2.5 px-4 border-b border-dashed ${bgClass}`}
      style={{
        ...bgStyle,
        borderColor: variant === "final" ? "#333" : "#E8E6E1",
      }}
    >
      <div className="flex-1 min-w-0">
        <span
          className="text-sm"
          style={labelStyle}
        >
          {label}
        </span>
        {note && (
          <span
            className="text-xs ml-2"
            style={{ color: variant === "final" ? "#666" : "#A3A3A3" }}
          >
            {note}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span
          className="text-sm font-semibold tabular-nums"
          style={textStyle}
        >
          {value}
        </span>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Step-by-step forecast math with editable inputs.
 * Every calculation step is displayed transparently — no black boxes.
 *
 * @param props - ForecastMathProps.
 * @returns React element.
 */
export function ForecastMath({
  forecast,
  effectiveTaxRate,
  lhdnForecastMinor,
  userDeductibleOverride,
  isLoading = false,
  onRateChange,
  onForecastChange,
  onDeductibleChange,
}: ForecastMathProps): React.ReactElement {
  // Local edit state
  const [editingRate, setEditingRate] = useState(false);
  const [editingForecast, setEditingForecast] = useState(false);
  const [editingDeductible, setEditingDeductible] = useState(false);

  // Local input values
  const [rateInput, setRateInput] = useState(
    (effectiveTaxRate * 100).toFixed(1)
  );
  const [forecastInput, setForecastInput] = useState(
    (lhdnForecastMinor / 100).toFixed(2)
  );
  const [deductibleInput, setDeductibleInput] = useState(
    (userDeductibleOverride / 100).toFixed(2)
  );

  // Sync local inputs when props change
  React.useEffect(() => {
    setRateInput((effectiveTaxRate * 100).toFixed(1));
  }, [effectiveTaxRate]);

  React.useEffect(() => {
    setForecastInput((lhdnForecastMinor / 100).toFixed(2));
  }, [lhdnForecastMinor]);

  React.useEffect(() => {
    setDeductibleInput((userDeductibleOverride / 100).toFixed(2));
  }, [userDeductibleOverride]);

  // --- Loading skeleton ---
  if (isLoading || !forecast) {
    return (
      <div
        className="rounded-xl border overflow-hidden animate-pulse"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E6E1" }}
        data-testid="forecast-math-loading"
      >
        <div className="px-4 py-3 border-b" style={{ borderColor: "#E8E6E1" }}>
          <div className="h-4 bg-neutral-200 rounded w-40" />
        </div>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2.5 px-4 border-b border-dashed"
            style={{ borderColor: "#E8E6E1" }}
          >
            <div className="h-3 bg-neutral-200 rounded w-48" />
            <div className="h-3 bg-neutral-200 rounded w-20" />
          </div>
        ))}
      </div>
    );
  }

  // --- Handlers ---
  const handleRateSubmit = useCallback(() => {
    const parsed = parseFloat(rateInput);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      onRateChange(parsed / 100);
    }
    setEditingRate(false);
  }, [rateInput, onRateChange]);

  const handleForecastSubmit = useCallback(() => {
    const parsed = parseFloat(forecastInput);
    if (!isNaN(parsed) && parsed >= 0) {
      onForecastChange(Math.round(parsed * 100));
    }
    setEditingForecast(false);
  }, [forecastInput, onForecastChange]);

  const handleDeductibleSubmit = useCallback(() => {
    const parsed = parseFloat(deductibleInput);
    if (!isNaN(parsed) && parsed >= 0) {
      onDeductibleChange(Math.round(parsed * 100));
    }
    setEditingDeductible(false);
  }, [deductibleInput, onDeductibleChange]);

  const monthsElapsedLabel =
    forecast.months_elapsed === 1
      ? "Jan"
      : forecast.months_elapsed === 2
        ? "Jan-Feb"
        : forecast.months_elapsed === 3
          ? "Jan-Mar"
          : forecast.months_elapsed === 4
            ? "Jan-Apr"
            : forecast.months_elapsed === 5
              ? "Jan-May"
              : forecast.months_elapsed === 6
                ? "Jan-Jun"
                : forecast.months_elapsed === 7
                  ? "Jan-Jul"
                  : forecast.months_elapsed === 8
                    ? "Jan-Aug"
                    : forecast.months_elapsed === 9
                      ? "Jan-Sep"
                      : forecast.months_elapsed === 10
                        ? "Jan-Oct"
                        : forecast.months_elapsed === 11
                          ? "Jan-Nov"
                          : "Jan-Dec";

  const runRateNote =
    lhdnForecastMinor > 0
      ? "(LHDN forecast applied)"
      : `(${formatMYR(forecast.income_ytd_minor)} / ${forecast.months_elapsed} months x ${forecast.months_remaining} months)`;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E6E1" }}
      data-testid="forecast-math"
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: "#E8E6E1", backgroundColor: "#FAFAF7" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "#181818" }}>
          FORECAST MATH
        </h3>
        <span className="text-xs" style={{ color: "#A3A3A3" }}>
          All amounts editable
        </span>
      </div>

      {/* Income section */}
      <MathRow
        label={`Income YTD (${monthsElapsedLabel})`}
        value={formatMYR(forecast.income_ytd_minor)}
      />

      <MathRow
        label="Projected income (remaining months)"
        value={formatMYR(forecast.projected_remaining_minor)}
        note={runRateNote}
        variant={lhdnForecastMinor > 0 ? "input" : "default"}
      >
        <button
          onClick={() => {
            setEditingForecast((v) => !v);
            setEditingRate(false);
            setEditingDeductible(false);
          }}
          className="text-xs px-2 py-0.5 rounded border transition-colors hover:bg-neutral-100"
          style={{ borderColor: "#E8E6E1", color: "#666" }}
          type="button"
        >
          {editingForecast ? "Close" : "Edit"}
        </button>
      </MathRow>

      {editingForecast && (
        <div
          className="px-4 py-2.5 border-b border-dashed"
          style={{ backgroundColor: "#F9F9F6", borderColor: "#E8E6E1" }}
        >
          <div className="flex items-center gap-3">
            <label
              className="text-xs shrink-0"
              style={{ color: "#666" }}
            >
              LHDN full-year forecast (RM):
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={forecastInput}
              onChange={(e) => setForecastInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleForecastSubmit();
              }}
              className="text-sm border rounded px-2 py-1 w-32 tabular-nums"
              style={{ borderColor: "#E8E6E1" }}
              autoFocus
            />
            <button
              onClick={handleForecastSubmit}
              className="text-xs px-2 py-1 rounded text-white"
              style={{ backgroundColor: "#F37002" }}
              type="button"
            >
              Apply
            </button>
          </div>
          <p className="text-xs mt-1" style={{ color: "#A3A3A3" }}>
            Set your LHDN-estimated full-year income. 0 = use run-rate projection.
          </p>
        </div>
      )}

      <MathRow
        label="Projected full-year income"
        value={formatMYR(forecast.projected_full_year_minor)}
        variant="compute"
      />

      <div className="my-1" />

      {/* Deductions section */}
      <MathRow
        label="Deductible expenses YTD"
        value={formatMYR(forecast.deductible_ytd_minor)}
      />

      <MathRow
        label="Projected annual deductible"
        value={
          userDeductibleOverride > 0
            ? formatMYR(userDeductibleOverride)
            : formatMYR(forecast.projected_annual_deductible_minor)
        }
        note={
          userDeductibleOverride > 0
            ? "(user override)"
            : `(${formatMYR(forecast.deductible_ytd_minor)} / ${forecast.months_elapsed} months x 12 months)`
        }
        variant="input"
      >
        <button
          onClick={() => {
            setEditingDeductible((v) => !v);
            setEditingRate(false);
            setEditingForecast(false);
          }}
          className="text-xs px-2 py-0.5 rounded border transition-colors hover:bg-neutral-100"
          style={{ borderColor: "#E8E6E1", color: "#666" }}
          type="button"
        >
          {editingDeductible ? "Close" : "Edit"}
        </button>
      </MathRow>

      {editingDeductible && (
        <div
          className="px-4 py-2.5 border-b border-dashed"
          style={{ backgroundColor: "#F9F9F6", borderColor: "#E8E6E1" }}
        >
          <div className="flex items-center gap-3">
            <label className="text-xs shrink-0" style={{ color: "#666" }}>
              Annual deductible estimate (RM):
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={deductibleInput}
              onChange={(e) => setDeductibleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleDeductibleSubmit();
              }}
              className="text-sm border rounded px-2 py-1 w-32 tabular-nums"
              style={{ borderColor: "#E8E6E1" }}
              autoFocus
            />
            <button
              onClick={handleDeductibleSubmit}
              className="text-xs px-2 py-1 rounded text-white"
              style={{ backgroundColor: "#F37002" }}
              type="button"
            >
              Apply
            </button>
          </div>
          <p className="text-xs mt-1" style={{ color: "#A3A3A3" }}>
            Override the annualised deductible estimate. 0 = auto-calculate from YTD.
          </p>
        </div>
      )}

      <MathRow
        label="Projected taxable income"
        value={formatMYR(forecast.projected_taxable_income_minor)}
        variant="compute"
      />

      <div className="my-1" />

      {/* Tax rate section */}
      <MathRow
        label="Effective tax rate"
        value={fmtPercent(effectiveTaxRate)}
        variant="input"
      >
        <button
          onClick={() => {
            setEditingRate((v) => !v);
            setEditingForecast(false);
            setEditingDeductible(false);
          }}
          className="text-xs px-2 py-0.5 rounded border transition-colors hover:bg-neutral-100"
          style={{ borderColor: "#E8E6E1", color: "#666" }}
          type="button"
        >
          {editingRate ? "Close" : "Edit"}
        </button>
      </MathRow>

      {editingRate && (
        <div
          className="px-4 py-2.5 border-b border-dashed"
          style={{ backgroundColor: "#F9F9F6", borderColor: "#E8E6E1" }}
        >
          <div className="flex items-center gap-3">
            <label className="text-xs shrink-0" style={{ color: "#666" }}>
              Effective rate (%):
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRateSubmit();
              }}
              className="text-sm border rounded px-2 py-1 w-20 tabular-nums"
              style={{ borderColor: "#E8E6E1" }}
              autoFocus
            />
            <button
              onClick={handleRateSubmit}
              className="text-xs px-2 py-1 rounded text-white"
              style={{ backgroundColor: "#F37002" }}
              type="button"
            >
              Apply
            </button>
          </div>
          <p className="text-xs mt-1" style={{ color: "#A3A3A3" }}>
            Your estimated effective tax rate after reliefs and deductions.
          </p>
        </div>
      )}

      <MathRow
        label="Estimated full-year tax"
        value={formatMYR(forecast.estimated_tax_minor)}
        variant="compute"
      />

      <div className="my-1" />

      {/* CP500 + Variance section */}
      <MathRow
        label="CP500 scheduled this year"
        value={formatMYR(forecast.cp500_scheduled_minor)}
        note=""
      />

      <MathRow
        label="VARIANCE"
        value={
          forecast.variance_minor >= 0
            ? `${formatMYR(forecast.variance_minor)} OVERPAYMENT`
            : `${formatMYR(Math.abs(forecast.variance_minor))} SHORTFALL`
        }
        note=""
        variant="final"
      />

      {/* Verdict line */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ backgroundColor: "#FAFAF7" }}
      >
        <span className="text-sm font-medium" style={{ color: "#181818" }}>
          Verdict:
        </span>
        <span
          className={`text-sm font-semibold px-2 py-0.5 rounded ${
            forecast.verdict === "on_track"
              ? "text-emerald-700 bg-emerald-50"
              : forecast.verdict === "overpaying"
                ? "text-amber-700 bg-amber-50"
                : "text-red-700 bg-red-50"
          }`}
        >
          {forecast.verdict === "on_track"
            ? "On track"
            : forecast.verdict === "overpaying"
              ? "Overpaying"
              : "Underpaying"}
        </span>
        <span className="text-sm" style={{ color: "#A3A3A3" }}>
          {forecast.verdict === "overpaying"
            ? "-- CP502 may help reduce instalments"
            : forecast.verdict === "underpaying"
              ? "-- Set aside additional cash reserve"
              : "-- CP500 will cover estimated liability"}
        </span>
      </div>
    </div>
  );
}

export default ForecastMath;
