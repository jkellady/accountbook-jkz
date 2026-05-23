/**
 * @fileoverview CP500Schedule — CP500 tax instalment schedule display.
 *
 * Shows all 6 CP500 instalments with payment status:
 *   - Paid: green checkmark + paid date
 *   - Due soon (<30 days): amber dot + date
 *   - Upcoming: grey dot
 *
 * Includes a "Mark paid" button that opens a date picker + file upload flow.
 *
 * DISCLAIMER: This is a simplified directional estimate. Your actual tax
 * liability depends on many factors. Consult your tax agent for filing.
 *
 * @module components/tax-position/CP500Schedule
 */

"use client";

import React, { useState, useCallback, useRef } from "react";
import type { CP500ScheduleResponse, CP500Instalment } from "@/lib/actions/taxPosition";
import { formatMYR } from "@/lib/actions/taxPosition";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CP500ScheduleProps {
  /** The CP500 schedule data from the server action. */
  schedule: CP500ScheduleResponse | null;
  /** Loading state. */
  isLoading?: boolean;
  /** Callback when user marks an instalment as paid. */
  onMarkPaid: (instalmentNo: number, date: string, fileId?: string) => void | Promise<void>;
  /** Whether a mark-paid operation is in progress. */
  isMarking?: boolean;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

type InstalmentStatus = "paid" | "due_soon" | "upcoming" | "overdue";

interface StatusConfig {
  dotColor: string;
  label: string;
  labelClass: string;
}

const STATUS_CONFIG: Record<InstalmentStatus, StatusConfig> = {
  paid: {
    dotColor: "#22C55E",
    label: "Paid",
    labelClass: "text-emerald-700 bg-emerald-50",
  },
  due_soon: {
    dotColor: "#F59E0B",
    label: "Due soon",
    labelClass: "text-amber-700 bg-amber-50",
  },
  upcoming: {
    dotColor: "#A3A3A3",
    label: "Upcoming",
    labelClass: "text-neutral-500 bg-neutral-100",
  },
  overdue: {
    dotColor: "#EF4444",
    label: "Overdue",
    labelClass: "text-red-700 bg-red-50",
  },
};

/**
 * Determine the display status of an instalment based on payment state and date.
 *
 * @param instalment - The CP500 instalment to check.
 * @returns InstalmentStatus for display.
 */
function getInstalmentStatus(instalment: CP500Instalment): InstalmentStatus {
  if (instalment.is_paid) {
    return "paid";
  }

  const dueDate = new Date(instalment.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return "overdue";
  }
  if (diffDays <= 30) {
    return "due_soon";
  }
  return "upcoming";
}

/**
 * Format a date string as "MMM DD, YYYY".
 *
 * @param dateStr - ISO date string.
 * @returns Formatted date.
 */
function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CP500 instalment schedule with payment status indicators.
 *
 * @param props - CP500ScheduleProps.
 * @returns React element.
 */
export function CP500Schedule({
  schedule,
  isLoading = false,
  onMarkPaid,
  isMarking = false,
}: CP500ScheduleProps): React.ReactElement {
  const [activeMarkRow, setActiveMarkRow] = useState<number | null>(null);
  const [markDate, setMarkDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [markFileId, setMarkFileId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMarkSubmit = useCallback(
    async (instalmentNo: number) => {
      if (!markDate) return;
      await onMarkPaid(instalmentNo, markDate, markFileId || undefined);
      setActiveMarkRow(null);
      setMarkFileId("");
    },
    [markDate, markFileId, onMarkPaid]
  );

  // --- Loading skeleton ---
  if (isLoading || !schedule) {
    return (
      <div
        className="rounded-xl border overflow-hidden animate-pulse"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E6E1" }}
        data-testid="cp500-schedule-loading"
      >
        <div
          className="px-4 py-3 border-b"
          style={{ borderColor: "#E8E6E1", backgroundColor: "#FAFAF7" }}
        >
          <div className="h-4 bg-neutral-200 rounded w-40" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-3 px-4 border-b"
            style={{ borderColor: "#E8E6E1" }}
          >
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
              <div className="h-3 bg-neutral-200 rounded w-20" />
            </div>
            <div className="h-3 bg-neutral-200 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  const totalAmount = schedule.instalments.reduce(
    (sum, inst) => sum + inst.amount_minor,
    0
  );
  const paidCount = schedule.instalments.filter((i) => i.is_paid).length;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E6E1" }}
      data-testid="cp500-schedule"
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: "#E8E6E1", backgroundColor: "#FAFAF7" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "#181818" }}>
          CP500 SCHEDULE
        </h3>
        <span className="text-xs" style={{ color: "#A3A3A3" }}>
          {paidCount} of {schedule.instalments.length} paid &middot;{" "}
          {formatMYR(totalAmount)} total
        </span>
      </div>

      {/* Instalment rows */}
      <div className="divide-y" style={{ borderColor: "#E8E6E1" }}>
        {schedule.instalments.map((instalment) => {
          const status = getInstalmentStatus(instalment);
          const config = STATUS_CONFIG[status];
          const isMarkingThis = activeMarkRow === instalment.instalment_no;

          return (
            <div
              key={instalment.instalment_no}
              className="px-4 py-3"
              data-instalment={instalment.instalment_no}
              data-status={status}
            >
              <div className="flex items-center justify-between">
                {/* Left: dot + instalment number + due date */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Status dot */}
                  <div
                    className="shrink-0 rounded-full"
                    style={{
                      width: "10px",
                      height: "10px",
                      backgroundColor: config.dotColor,
                    }}
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-medium"
                        style={{ color: "#181818" }}
                      >
                        Instalment {instalment.instalment_no}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.labelClass}`}
                      >
                        {config.label}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: "#A3A3A3" }}>
                      Due {fmtDate(instalment.due_date)}
                      {instalment.paid_date &&
                        ` · Paid ${fmtDate(instalment.paid_date)}`}
                    </span>
                  </div>
                </div>

                {/* Right: amount + mark paid button */}
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: "#181818" }}
                  >
                    {formatMYR(instalment.amount_minor)}
                  </span>

                  {!instalment.is_paid && (
                    <button
                      onClick={() =>
                        setActiveMarkRow((cur) =>
                          cur === instalment.instalment_no
                            ? null
                            : instalment.instalment_no
                        )
                      }
                      disabled={isMarking}
                      className="text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-50"
                      style={{
                        borderColor: "#E8E6E1",
                        color: "#666",
                        backgroundColor: "#FFFFFF",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#F5F5F0";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#FFFFFF";
                      }}
                      type="button"
                    >
                      {isMarkingThis ? "Cancel" : "Mark paid"}
                    </button>
                  )}
                </div>
              </div>

              {/* Mark paid form */}
              {isMarkingThis && (
                <div
                  className="mt-3 p-3 rounded-lg border"
                  style={{
                    backgroundColor: "#FAFAF7",
                    borderColor: "#E8E6E1",
                  }}
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                      <label
                        className="text-xs font-medium"
                        style={{ color: "#666" }}
                      >
                        Payment date
                      </label>
                      <input
                        type="date"
                        value={markDate}
                        onChange={(e) => setMarkDate(e.target.value)}
                        className="text-sm border rounded px-2 py-1.5"
                        style={{ borderColor: "#E8E6E1" }}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        className="text-xs font-medium"
                        style={{ color: "#666" }}
                      >
                        Receipt file ID (optional)
                      </label>
                      <input
                        type="text"
                        value={markFileId}
                        onChange={(e) => setMarkFileId(e.target.value)}
                        placeholder="Paste file ID..."
                        className="text-sm border rounded px-2 py-1.5 w-40"
                        style={{ borderColor: "#E8E6E1" }}
                      />
                    </div>

                    <button
                      onClick={() => handleMarkSubmit(instalment.instalment_no)}
                      disabled={isMarking}
                      className="text-xs px-4 py-1.5 rounded text-white font-medium disabled:opacity-50"
                      style={{ backgroundColor: "#22C55E" }}
                      type="button"
                    >
                      {isMarking ? "Saving..." : "Confirm paid"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer legend */}
      <div
        className="px-4 py-2.5 border-t flex items-center gap-4 flex-wrap"
        style={{ borderColor: "#E8E6E1", backgroundColor: "#FAFAF7" }}
      >
        <span className="text-xs" style={{ color: "#A3A3A3" }}>
          Legend:
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block rounded-full"
            style={{
              width: "8px",
              height: "8px",
              backgroundColor: STATUS_CONFIG.paid.dotColor,
            }}
          />
          <span className="text-xs" style={{ color: "#666" }}>
            Paid
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block rounded-full"
            style={{
              width: "8px",
              height: "8px",
              backgroundColor: STATUS_CONFIG.due_soon.dotColor,
            }}
          />
          <span className="text-xs" style={{ color: "#666" }}>
            Due soon (30d)
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block rounded-full"
            style={{
              width: "8px",
              height: "8px",
              backgroundColor: STATUS_CONFIG.overdue.dotColor,
            }}
          />
          <span className="text-xs" style={{ color: "#666" }}>
            Overdue
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block rounded-full"
            style={{
              width: "8px",
              height: "8px",
              backgroundColor: STATUS_CONFIG.upcoming.dotColor,
            }}
          />
          <span className="text-xs" style={{ color: "#666" }}>
            Upcoming
          </span>
        </span>
      </div>
    </div>
  );
}

export default CP500Schedule;
