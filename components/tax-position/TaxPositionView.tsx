/**
 * @fileoverview TaxPositionView — Main Tax Position module view.
 *
 * The flagship tax discipline feature. Answers 4 questions in under 60 seconds:
 * 1. How much income YTD?
 * 2. How much tax prepaid via CP500?
 * 3. Likely final tax liability based on run-rate?
 * 4. Overpaying, underpaying, or on track?
 *
 * Composes TaxVerdict, KPI tiles, ForecastMath, CP500Schedule, TaxPrepView,
 * settings strip, and conditional action cards into a unified dashboard.
 *
 * DISCLAIMER: This is a simplified directional estimate. Your actual tax
 * liability depends on many factors. Consult your tax agent for filing.
 *
 * @module components/tax-position/TaxPositionView
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import type {
  TaxPositionKPIs,
  TaxForecast,
  CP500ScheduleResponse,
  TaxPrepData,
} from "@/lib/actions/taxPosition";
import {
  getTaxPositionKPIs,
  getTaxForecast,
  getCP500Schedule,
  getTaxPrepData,
  markCP500Paid,
  formatMYR,
} from "@/lib/actions/taxPosition";
import { TaxVerdict } from "./TaxVerdict";
import { ForecastMath } from "./ForecastMath";
import { CP500Schedule } from "./CP500Schedule";
import { TaxPrepView } from "./TaxPrepView";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TaxPositionViewProps {
  /** Assessment year to display (e.g. 2026). Defaults to current year. */
  initialYear?: number;
  /** Initial entity slug filter. Defaults to 'jk-zentra'. */
  initialEntitySlug?: string;
}

// ---------------------------------------------------------------------------
// KPI Tile sub-component
// ---------------------------------------------------------------------------

interface KPITileProps {
  label: string;
  value: string;
  subtitle?: string;
}

function KPITile({ label, value, subtitle }: KPITileProps): React.ReactElement {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-1"
      style={{
        backgroundColor: "#FFFFFF",
        borderColor: "#E8E6E1",
        borderRadius: "12px",
      }}
    >
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "#A3A3A3" }}>
        {label}
      </span>
      <span className="text-xl font-bold tabular-nums" style={{ color: "#181818" }}>
        {value}
      </span>
      {subtitle && (
        <span className="text-xs" style={{ color: "#A3A3A3" }}>
          {subtitle}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings strip sub-component
// ---------------------------------------------------------------------------

interface SettingsStripProps {
  effectiveTaxRate: number;
  lhdnForecastMinor: number;
  reserveEnabled: boolean;
  reservePercent: number;
}

function SettingsStrip({
  effectiveTaxRate,
  lhdnForecastMinor,
  reserveEnabled,
  reservePercent,
}: SettingsStripProps): React.ReactElement {
  return (
    <div
      className="rounded-xl border p-4 flex flex-wrap items-center gap-x-6 gap-y-2"
      style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E6E1" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: "#A3A3A3" }}>
          Effective rate:
        </span>
        <span className="text-xs font-semibold" style={{ color: "#F37002" }}>
          {(effectiveTaxRate * 100).toFixed(1)}%
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: "#A3A3A3" }}>
          LHDN forecast:
        </span>
        <span className="text-xs font-semibold" style={{ color: "#181818" }}>
          {lhdnForecastMinor > 0 ? formatMYR(lhdnForecastMinor) : "Not set (run-rate)"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: "#A3A3A3" }}>
          Reserve:
        </span>
        <span
          className="text-xs font-semibold"
          style={{ color: reserveEnabled ? "#22C55E" : "#A3A3A3" }}
        >
          {reserveEnabled ? `${reservePercent}% of income` : "Off"}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action card sub-component (conditional)
// ---------------------------------------------------------------------------

interface ActionCardProps {
  verdict: TaxForecast["verdict"];
  varianceMinor: number;
}

function ActionCard({ verdict, varianceMinor }: ActionCardProps): React.ReactElement | null {
  if (verdict === "on_track") {
    return null;
  }

  const isOverpaying = verdict === "overpaying";

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: "linear-gradient(135deg, #FFF3DD 0%, #FFEBC4 100%)",
        borderColor: "#F59E0B",
      }}
      data-testid="action-card"
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: isOverpaying ? "#FEF3C7" : "#FEE2E2" }}
        >
          {isOverpaying ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1L1 5v5c0 3.87 2.99 7.49 7 8.25 4.01-.76 7-4.38 7-8.25V5L8 1z"
                stroke="#F59E0B"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5.5 8l2 2 3-3"
                stroke="#F59E0B"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="#EF4444" strokeWidth="1.5" />
              <path d="M8 5v4M8 11v.01" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </div>

        <div className="flex-1">
          <h4 className="text-sm font-semibold mb-1" style={{ color: "#181818" }}>
            {isOverpaying ? "Consider CP502 Revision" : "Set Aside Additional Reserve"}
          </h4>
          <p className="text-xs mb-3" style={{ color: "#666" }}>
            {isOverpaying
              ? `You are overpaying by ${formatMYR(varianceMinor)}. Filing a CP502 may allow you to reduce remaining CP500 instalments. Consult your tax agent.`
              : `You are underpaying by ${formatMYR(Math.abs(varianceMinor))}. Consider setting aside additional cash to cover the shortfall at year-end.`}
          </p>

          <div className="flex gap-2">
            <button
              className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
              style={{
                backgroundColor: isOverpaying ? "#F59E0B" : "#EF4444",
                color: "#FFFFFF",
              }}
              onClick={() => {
                // Future: open CP502 form or reserve calculator
                alert(
                  isOverpaying
                    ? "CP502 form would open here. Feature coming in Sprint 2."
                    : "Reserve calculator would open here. Feature coming in Sprint 2."
                );
              }}
              type="button"
            >
              {isOverpaying ? "Learn about CP502" : "Calculate reserve"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Main Tax Position view — composes all tax position sub-components.
 * Manages data fetching and editable forecast state.
 *
 * @param props - TaxPositionViewProps.
 * @returns React element.
 */
export function TaxPositionView({
  initialYear,
  initialEntitySlug = "jk-zentra",
}: TaxPositionViewProps): React.ReactElement {
  const year = initialYear ?? new Date().getFullYear();
  const entitySlug = initialEntitySlug;

  // Data state
  const [kpis, setKpis] = useState<TaxPositionKPIs | null>(null);
  const [forecast, setForecast] = useState<TaxForecast | null>(null);
  const [schedule, setSchedule] = useState<CP500ScheduleResponse | null>(null);
  const [taxPrep, setTaxPrep] = useState<TaxPrepData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  // Editable state (local overrides)
  const [editableRate, setEditableRate] = useState(0.15);
  const [editableForecast, setEditableForecast] = useState(0);
  const [editableDeductible, setEditableDeductible] = useState(0);

  // Active tab
  const [activeTab, setActiveTab] = useState<"forecast" | "prep">("forecast");

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [kpisData, forecastData, scheduleData, taxPrepData] =
        await Promise.all([
          getTaxPositionKPIs(year, entitySlug),
          getTaxForecast(year, entitySlug),
          getCP500Schedule(year),
          getTaxPrepData(year, entitySlug),
        ]);

      setKpis(kpisData);
      setForecast(forecastData);
      setSchedule(scheduleData);
      setTaxPrep(taxPrepData);

      // Sync editable state from loaded forecast
      setEditableRate(forecastData.effective_tax_rate);
      // LHDN forecast would come from settings — keep existing editable value
      // Deductible override stays as user set it
    } catch (err) {
      console.error("[TaxPositionView] loadAll error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [year, entitySlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRateChange = useCallback((rateDecimal: number) => {
    setEditableRate(rateDecimal);
    // Trigger recalculation with new rate
    setForecast((prev) => {
      if (!prev) return prev;
      const newEstimatedTax = Math.round(
        prev.projected_taxable_income_minor * rateDecimal
      );
      const newVariance = prev.cp500_scheduled_minor - newEstimatedTax;

      // Recompute verdict
      const thresholdAmount = prev.cp500_scheduled_minor * 0.1; // 10% default
      let newVerdict: TaxForecast["verdict"];
      if (prev.cp500_scheduled_minor === 0) {
        newVerdict = newEstimatedTax > 0 ? "underpaying" : "on_track";
      } else if (newVariance > thresholdAmount) {
        newVerdict = "overpaying";
      } else if (newVariance < -thresholdAmount) {
        newVerdict = "underpaying";
      } else {
        newVerdict = "on_track";
      }

      return {
        ...prev,
        effective_tax_rate: rateDecimal,
        estimated_tax_minor: newEstimatedTax,
        variance_minor: newVariance,
        verdict: newVerdict,
      };
    });
  }, []);

  const handleForecastChange = useCallback((incomeMinor: number) => {
    setEditableForecast(incomeMinor);
    // Recalculate projection
    setForecast((prev) => {
      if (!prev) return prev;
      const projectedRemaining =
        incomeMinor > 0 && prev.income_ytd_minor < incomeMinor
          ? incomeMinor - prev.income_ytd_minor
          : Math.round(
              (prev.income_ytd_minor / Math.max(1, prev.months_elapsed)) *
                prev.months_remaining
            );
      const projectedFullYear = prev.income_ytd_minor + projectedRemaining;
      const projectedTaxable = Math.max(
        0,
        projectedFullYear - prev.projected_annual_deductible_minor
      );
      const newEstimatedTax = Math.round(projectedTaxable * prev.effective_tax_rate);
      const newVariance = prev.cp500_scheduled_minor - newEstimatedTax;

      const thresholdAmount = prev.cp500_scheduled_minor * 0.1;
      let newVerdict: TaxForecast["verdict"];
      if (prev.cp500_scheduled_minor === 0) {
        newVerdict = newEstimatedTax > 0 ? "underpaying" : "on_track";
      } else if (newVariance > thresholdAmount) {
        newVerdict = "overpaying";
      } else if (newVariance < -thresholdAmount) {
        newVerdict = "underpaying";
      } else {
        newVerdict = "on_track";
      }

      return {
        ...prev,
        projected_remaining_minor: projectedRemaining,
        projected_full_year_minor: projectedFullYear,
        projected_taxable_income_minor: projectedTaxable,
        estimated_tax_minor: newEstimatedTax,
        variance_minor: newVariance,
        verdict: newVerdict,
      };
    });
  }, []);

  const handleDeductibleChange = useCallback((deductibleMinor: number) => {
    setEditableDeductible(deductibleMinor);
    setForecast((prev) => {
      if (!prev) return prev;
      const projectedDeductible =
        deductibleMinor > 0 ? deductibleMinor : prev.projected_annual_deductible_minor;
      const projectedTaxable = Math.max(
        0,
        prev.projected_full_year_minor - projectedDeductible
      );
      const newEstimatedTax = Math.round(projectedTaxable * prev.effective_tax_rate);
      const newVariance = prev.cp500_scheduled_minor - newEstimatedTax;

      const thresholdAmount = prev.cp500_scheduled_minor * 0.1;
      let newVerdict: TaxForecast["verdict"];
      if (prev.cp500_scheduled_minor === 0) {
        newVerdict = newEstimatedTax > 0 ? "underpaying" : "on_track";
      } else if (newVariance > thresholdAmount) {
        newVerdict = "overpaying";
      } else if (newVariance < -thresholdAmount) {
        newVerdict = "underpaying";
      } else {
        newVerdict = "on_track";
      }

      return {
        ...prev,
        projected_annual_deductible_minor: projectedDeductible,
        projected_taxable_income_minor: projectedTaxable,
        estimated_tax_minor: newEstimatedTax,
        variance_minor: newVariance,
        verdict: newVerdict,
      };
    });
  }, []);

  const handleMarkCP500Paid = useCallback(
    async (instalmentNo: number, date: string, fileId?: string) => {
      setIsMarkingPaid(true);
      try {
        await markCP500Paid(instalmentNo, date, fileId);
        // Reload all data after marking
        await loadAll();
      } catch (err) {
        console.error("[TaxPositionView] handleMarkCP500Paid error:", err);
        alert("Failed to mark CP500 as paid. Please try again.");
      } finally {
        setIsMarkingPaid(false);
      }
    },
    [loadAll]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="min-h-screen p-4 sm:p-6"
      style={{ backgroundColor: "#FAFAF7" }}
      data-testid="tax-position-view"
    >
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#181818" }}>
              TAX POSITION — {year}
            </h1>
            <p className="text-xs" style={{ color: "#A3A3A3" }}>
              Year of Assessment {year} &middot; JK Zentra (Sole Proprietor)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Year selector */}
            <select
              className="text-sm border rounded-lg px-3 py-1.5"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "#E8E6E1",
                color: "#181818",
              }}
              value={year}
              onChange={(e) => {
                // In a real app, this would update the URL or call a route handler
                window.location.href = `?year=${e.target.value}`;
              }}
            >
              <option value={year - 1}>{year - 1}</option>
              <option value={year}>{year}</option>
              <option value={year + 1}>{year + 1}</option>
            </select>

            {/* Entity filter */}
            <select
              className="text-sm border rounded-lg px-3 py-1.5"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "#E8E6E1",
                color: "#181818",
              }}
              value={entitySlug}
              onChange={(e) => {
                window.location.href = `?entity=${e.target.value}`;
              }}
            >
              <option value="jk-zentra">JK Zentra</option>
              <option value="personal">Personal</option>
            </select>
          </div>
        </div>

        {/* Verdict card */}
        <TaxVerdict forecast={forecast} isLoading={isLoading} />

        {/* KPI tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPITile
            label="Income YTD"
            value={isLoading ? "..." : formatMYR(kpis?.income_ytd_minor ?? 0)}
            subtitle={
              kpis && kpis.income_ytd_minor > 0
                ? `${((kpis.cp500_instalments_paid / 6) * 100).toFixed(0)}% through tax year`
                : undefined
            }
          />
          <KPITile
            label="Deductible YTD"
            value={isLoading ? "..." : formatMYR(kpis?.deductible_ytd_minor ?? 0)}
          />
          <KPITile
            label="CP500 Paid"
            value={isLoading ? "..." : formatMYR(kpis?.cp500_paid_minor ?? 0)}
            subtitle={
              kpis
                ? `${kpis.cp500_instalments_paid} of ${kpis.cp500_instalments_total} instalments`
                : undefined
            }
          />
          <KPITile
            label="Tax Reserve"
            value={isLoading ? "..." : formatMYR(kpis?.tax_reserve_minor ?? 0)}
          />
        </div>

        {/* Settings strip */}
        {!isLoading && forecast && (
          <SettingsStrip
            effectiveTaxRate={editableRate}
            lhdnForecastMinor={editableForecast}
            reserveEnabled={false}
            reservePercent={15}
          />
        )}

        {/* Tab switcher */}
        <div className="flex items-center gap-1 border-b" style={{ borderColor: "#E8E6E1" }}>
          <button
            onClick={() => setActiveTab("forecast")}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === "forecast" ? "" : ""
            }`}
            style={{
              color: activeTab === "forecast" ? "#F37002" : "#A3A3A3",
            }}
            type="button"
          >
            Forecast
            {activeTab === "forecast" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: "#F37002" }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("prep")}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === "prep" ? "" : ""
            }`}
            style={{
              color: activeTab === "prep" ? "#F37002" : "#A3A3A3",
            }}
            type="button"
          >
            Tax Prep Workspace
            {activeTab === "prep" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: "#F37002" }}
              />
            )}
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "forecast" ? (
          <div className="space-y-4">
            {/* Action card (conditional) */}
            {forecast && forecast.verdict !== "on_track" && (
              <ActionCard
                verdict={forecast.verdict}
                varianceMinor={forecast.variance_minor}
              />
            )}

            {/* Forecast Math */}
            <ForecastMath
              forecast={forecast}
              effectiveTaxRate={editableRate}
              lhdnForecastMinor={editableForecast}
              userDeductibleOverride={editableDeductible}
              isLoading={isLoading}
              onRateChange={handleRateChange}
              onForecastChange={handleForecastChange}
              onDeductibleChange={handleDeductibleChange}
            />

            {/* CP500 Schedule */}
            <CP500Schedule
              schedule={schedule}
              isLoading={isLoading}
              onMarkPaid={handleMarkCP500Paid}
              isMarking={isMarkingPaid}
            />
          </div>
        ) : (
          /* Tax Prep View */
          <TaxPrepView
            data={taxPrep}
            year={year}
            isLoading={isLoading}
          />
        )}

        {/* Disclaimer footer */}
        <div className="pt-4 pb-8 text-center">
          <p className="text-xs" style={{ color: "#A3A3A3" }}>
            This is a simplified directional estimate. Your actual tax liability
            depends on many factors. Consult your tax agent for filing.
          </p>
        </div>
      </div>
    </div>
  );
}

export default TaxPositionView;
