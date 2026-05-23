/**
 * @fileoverview TaxPrepView — Year-end tax preparation workspace.
 *
 * Provides a filtered transaction list grouped by category with running totals,
 * tag filter buttons, missing receipt flags, and CSV export for the tax agent.
 *
 * DISCLAIMER: This is a simplified directional estimate. Your actual tax
 * liability depends on many factors. Consult your tax agent for filing.
 *
 * @module components/tax-position/TaxPrepView
 */

"use client";

import React, { useState, useMemo, useCallback } from "react";
import type { TransactionRow } from "@/lib/supabase/database.types";
import type { TaxPrepData } from "@/lib/actions/taxPosition";
import { formatMYR } from "@/lib/actions/taxPosition";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TaxPrepViewProps {
  /** Tax prep data from the server action. */
  data: TaxPrepData | null;
  /** Assessment year being viewed. */
  year: number;
  /** Loading state. */
  isLoading?: boolean;
  /** Called when user applies tags to selected transactions. */
  onBulkTag?: (transactionIds: string[], tag: string) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Tag filter definitions
// ---------------------------------------------------------------------------

interface TagFilter {
  key: string;
  label: string;
  color: string;
}

const TAG_FILTERS: TagFilter[] = [
  { key: "tax-claimable", label: "Tax Claimable", color: "#22C55E" },
  { key: "capital-allowance", label: "Capital Allowance", color: "#3B82F6" },
  { key: "mixed-use", label: "Mixed Use", color: "#F59E0B" },
  { key: "proof-incomplete", label: "Proof Incomplete", color: "#EF4444" },
];

// ---------------------------------------------------------------------------
// Helper: download CSV
// ---------------------------------------------------------------------------

/**
 * Convert transactions to CSV and trigger a download.
 *
 * @param transactions - Transaction rows to export.
 * @param year - Assessment year for the filename.
 */
function exportToCSV(transactions: TransactionRow[], year: number): void {
  const headers = [
    "Date",
    "Vendor",
    "Category",
    "Subcategory",
    "Description",
    "Amount (MYR)",
    "Type",
    "Tags",
    "Reference",
    "Receipt File ID",
  ];

  const rows = transactions.map((tx) => [
    tx.occurred_at,
    tx.vendor,
    tx.category,
    tx.subcategory ?? "",
    tx.description ?? "",
    ((tx.myr_equiv_minor ?? tx.amount_minor) / 100).toFixed(2),
    tx.type,
    (tx.tags ?? []).join("; "),
    tx.reference_code ?? "",
    tx.file_id ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? "");
          // Escape quotes and wrap in quotes if contains comma or quote
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tax-prep-${year}-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format a date string for display.
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
 * Year-end tax preparation workspace.
 *
 * @param props - TaxPrepViewProps.
 * @returns React element.
 */
export function TaxPrepView({
  data,
  year,
  isLoading = false,
  onBulkTag,
}: TaxPrepViewProps): React.ReactElement {
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [selectedTxs, setSelectedTxs] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const transactions = data?.transactions ?? [];
  const byCategory = data?.byCategory ?? [];

  // Filter transactions by tag and category
  const filteredTransactions = useMemo(() => {
    let result = transactions;

    if (activeTagFilter) {
      result = result.filter((tx) => tx.tags?.includes(activeTagFilter));
    }

    if (categoryFilter) {
      result = result.filter((tx) => tx.category === categoryFilter);
    }

    return result;
  }, [transactions, activeTagFilter, categoryFilter]);

  // Toggle a transaction selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedTxs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select all visible
  const selectAllVisible = useCallback(() => {
    setSelectedTxs(new Set(filteredTransactions.map((tx) => tx.id)));
  }, [filteredTransactions]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedTxs(new Set());
  }, []);

  // Apply bulk tag
  const handleBulkTag = useCallback(
    async (tag: string) => {
      if (!onBulkTag || selectedTxs.size === 0) return;
      await onBulkTag(Array.from(selectedTxs), tag);
      setSelectedTxs(new Set());
    },
    [onBulkTag, selectedTxs]
  );

  // Missing receipt percentage
  const missingReceiptCount = data?.missingReceiptCount ?? 0;
  const taxClaimableCount = transactions.filter((tx) =>
    tx.tags?.includes("tax-claimable")
  ).length;

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <div
        className="rounded-xl border overflow-hidden animate-pulse"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E6E1" }}
        data-testid="tax-prep-loading"
      >
        <div className="px-4 py-3 border-b" style={{ borderColor: "#E8E6E1" }}>
          <div className="h-4 bg-neutral-200 rounded w-48" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-neutral-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E6E1" }}
      data-testid="tax-prep-view"
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3"
        style={{ borderColor: "#E8E6E1", backgroundColor: "#FAFAF7" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "#181818" }}>
          TAX PREP WORKSPACE — {year}
        </h3>
        <div className="flex items-center gap-2">
          {missingReceiptCount > 0 && (
            <span
              className="text-xs px-2 py-1 rounded-full font-medium text-red-700 bg-red-50"
            >
              {missingReceiptCount} missing receipts
            </span>
          )}
          <span className="text-xs" style={{ color: "#A3A3A3" }}>
            {taxClaimableCount} tax-claimable transactions
          </span>
        </div>
      </div>

      {/* Category summary */}
      {byCategory.length > 0 && (
        <div
          className="px-4 py-3 border-b overflow-x-auto"
          style={{ borderColor: "#E8E6E1", backgroundColor: "#FAFAF7" }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCategoryFilter(null)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                categoryFilter === null
                  ? "font-semibold"
                  : ""
              }`}
              style={{
                borderColor: categoryFilter === null ? "#F37002" : "#E8E6E1",
                backgroundColor: categoryFilter === null ? "#FFF6EF" : "#FFFFFF",
                color: categoryFilter === null ? "#F37002" : "#666",
              }}
              type="button"
            >
              All ({transactions.length})
            </button>
            {byCategory.map((cat) => (
              <button
                key={cat.category}
                onClick={() =>
                  setCategoryFilter((cur) =>
                    cur === cat.category ? null : cat.category
                  )
                }
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  categoryFilter === cat.category ? "font-semibold" : ""
                }`}
                style={{
                  borderColor:
                    categoryFilter === cat.category ? "#F37002" : "#E8E6E1",
                  backgroundColor:
                    categoryFilter === cat.category ? "#FFF6EF" : "#FFFFFF",
                  color:
                    categoryFilter === cat.category ? "#F37002" : "#666",
                }}
                type="button"
              >
                {cat.category} ({cat.count} · {formatMYR(cat.total_minor)})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tag filters */}
      <div
        className="px-4 py-2.5 border-b flex items-center gap-2 flex-wrap"
        style={{ borderColor: "#E8E6E1" }}
      >
        <span className="text-xs font-medium" style={{ color: "#666" }}>
          Filter:
        </span>
        {TAG_FILTERS.map((tag) => {
          const count = transactions.filter((tx) =>
            tx.tags?.includes(tag.key)
          ).length;
          const isActive = activeTagFilter === tag.key;
          return (
            <button
              key={tag.key}
              onClick={() =>
                setActiveTagFilter((cur) => (cur === tag.key ? null : tag.key))
              }
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                isActive ? "font-semibold" : ""
              }`}
              style={{
                borderColor: isActive ? tag.color : "#E8E6E1",
                backgroundColor: isActive ? `${tag.color}15` : "#FFFFFF",
                color: isActive ? tag.color : "#666",
              }}
              type="button"
            >
              {tag.label} ({count})
            </button>
          );
        })}

        {activeTagFilter && (
          <button
            onClick={() => setActiveTagFilter(null)}
            className="text-xs px-2 py-1 rounded"
            style={{ color: "#A3A3A3" }}
            type="button"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Bulk actions */}
      {selectedTxs.size > 0 && (
        <div
          className="px-4 py-2.5 border-b flex items-center gap-3 flex-wrap"
          style={{
            borderColor: "#E8E6E1",
            backgroundColor: "#FFF6EF",
          }}
        >
          <span className="text-xs font-medium" style={{ color: "#F37002" }}>
            {selectedTxs.size} selected
          </span>
          <button
            onClick={selectAllVisible}
            className="text-xs px-2 py-1 rounded border"
            style={{ borderColor: "#E8E6E1", color: "#666" }}
            type="button"
          >
            Select all visible
          </button>
          <button
            onClick={clearSelection}
            className="text-xs px-2 py-1 rounded border"
            style={{ borderColor: "#E8E6E1", color: "#666" }}
            type="button"
          >
            Clear
          </button>
          <span className="text-xs" style={{ color: "#A3A3A3" }}>
            Tag as:
          </span>
          {TAG_FILTERS.map((tag) => (
            <button
              key={tag.key}
              onClick={() => handleBulkTag(tag.key)}
              className="text-xs px-2 py-1 rounded border transition-colors hover:opacity-80"
              style={{
                borderColor: tag.color,
                color: tag.color,
                backgroundColor: `${tag.color}10`,
              }}
              type="button"
            >
              {tag.label}
            </button>
          ))}
        </div>
      )}

      {/* Transaction list */}
      <div className="max-h-[600px] overflow-y-auto">
        {filteredTransactions.length === 0 ? (
          <div
            className="px-4 py-8 text-center"
            style={{ color: "#A3A3A3" }}
          >
            <p className="text-sm">No transactions match the current filters.</p>
            {(activeTagFilter || categoryFilter) && (
              <button
                onClick={() => {
                  setActiveTagFilter(null);
                  setCategoryFilter(null);
                }}
                className="text-xs mt-2 underline"
                style={{ color: "#F37002" }}
                type="button"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "#E8E6E1" }}>
            {filteredTransactions.map((tx) => {
              const amount = tx.myr_equiv_minor ?? tx.amount_minor ?? 0;
              const isIncome = tx.type === "income";
              const isSelected = selectedTxs.has(tx.id);
              const missingReceipt =
                tx.tags?.includes("tax-claimable") && !tx.file_id;

              return (
                <div
                  key={tx.id}
                  className={`px-4 py-2.5 flex items-center gap-3 transition-colors ${
                    isSelected ? "bg-orange-50" : "hover:bg-neutral-50"
                  }`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(tx.id)}
                    className="shrink-0 rounded border-gray-300"
                  />

                  {/* Missing receipt warning */}
                  {missingReceipt ? (
                    <div
                      className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full"
                      style={{ backgroundColor: "#FEE2E2" }}
                      title="Missing receipt"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M6 1C3.24 1 1 3.24 1 6s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm0-3c-.55 0-1-.45-1-1V3c0-.55.45-1 1-1s1 .45 1 1v2c0 .55-.45 1-1 1z"
                          fill="#EF4444"
                        />
                      </svg>
                    </div>
                  ) : (
                    <div className="shrink-0 w-5" />
                  )}

                  {/* Date + Vendor */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {tx.vendor}
                      </span>
                      {tx.tags?.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: TAG_FILTERS.find(
                              (t) => t.key === tag
                            )
                              ? `${TAG_FILTERS.find((t) => t.key === tag)!.color}15`
                              : "#F5F5F0",
                            color:
                              TAG_FILTERS.find((t) => t.key === tag)?.color ??
                              "#666",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: "#A3A3A3" }}>
                      <span>{fmtDate(tx.occurred_at)}</span>
                      <span>·</span>
                      <span>{tx.category}</span>
                      {tx.subcategory && (
                        <>
                          <span>·</span>
                          <span>{tx.subcategory}</span>
                        </>
                      )}
                      {tx.reference_code && (
                        <>
                          <span>·</span>
                          <span>Ref: {tx.reference_code}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <span
                    className="text-sm font-semibold tabular-nums shrink-0"
                    style={{ color: isIncome ? "#22C55E" : "#181818" }}
                  >
                    {isIncome ? "+" : ""}
                    {formatMYR(amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div
        className="px-4 py-3 border-t flex items-center justify-between flex-wrap gap-3"
        style={{ borderColor: "#E8E6E1", backgroundColor: "#FAFAF7" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "#A3A3A3" }}>
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </span>
        </div>

        <button
          onClick={() => exportToCSV(transactions, year)}
          className="text-xs px-3 py-1.5 rounded border transition-colors flex items-center gap-1.5"
          style={{
            borderColor: "#E8E6E1",
            backgroundColor: "#FFFFFF",
            color: "#666",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#F5F5F0";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#FFFFFF";
          }}
          type="button"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
          >
            <path
              d="M7 1v8m0 0l-3-3m3 3l3-3M2 9v3h10V9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Export for Agent (CSV)
        </button>
      </div>

      {/* Disclaimer */}
      <div
        className="px-4 py-2.5 border-t"
        style={{ borderColor: "#E8E6E1", backgroundColor: "#FAFAF7" }}
      >
        <p className="text-[10px" style={{ color: "#A3A3A3" }}>
          This is a simplified directional estimate. Your actual tax liability
          depends on many factors. Consult your tax agent for filing.
        </p>
      </div>
    </div>
  );
}

export default TaxPrepView;
