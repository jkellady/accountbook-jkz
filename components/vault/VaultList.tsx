"use client";

/**
 * @file components/vault/VaultList.tsx
 * @description List/table view for the Receipt & Invoice Vault.
 *
 * Displays files as a sortable table with columns for thumbnail, filename,
 * size, upload date, entity, linked transaction, and actions.
 * Action buttons (View, Download) appear on row hover.
 *
 * @module components/vault/VaultList
 */

import { useCallback } from "react";
import { Thumbnail } from "./Thumbnail";
import { formatFileSize } from "@/lib/actions/vault";
import type { VaultFile, VaultSortColumn, VaultSortDirection } from "@/lib/actions/vault";
import { Eye, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VaultListProps {
  /** Array of vault files to display. */
  files: VaultFile[];
  /** Currently active sort column. */
  sortBy: VaultSortColumn;
  /** Currently active sort direction. */
  sortDir: VaultSortDirection;
  /** Callback when a sortable header is clicked. */
  onSort: (column: VaultSortColumn) => void;
  /** Callback when a row is clicked (opens viewer modal). */
  onFileClick: (file: VaultFile) => void;
  /** Callback when the download button is clicked. */
  onDownload: (file: VaultFile) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a sortable table of vault files.
 *
 * @param props — Table data, sort state, and callbacks.
 * @returns JSX.Element
 */
export function VaultList({
  files,
  sortBy,
  sortDir,
  onSort,
  onFileClick,
  onDownload,
}: VaultListProps): JSX.Element {
  const handleDownload = useCallback(
    (e: React.MouseEvent, file: VaultFile) => {
      e.stopPropagation();
      onDownload(file);
    },
    [onDownload]
  );

  const handleView = useCallback(
    (e: React.MouseEvent, file: VaultFile) => {
      e.stopPropagation();
      onFileClick(file);
    },
    [onFileClick]
  );

  if (files.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 24px",
          color: "#9C9A94",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 16, marginBottom: 8 }}>
          No files match your filters.
        </p>
        <p style={{ fontSize: 14 }}>Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        overflowX: "auto",
        border: "1px solid #E8E6E1",
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14,
        }}
        role="table"
        aria-label="Vault files"
      >
        <thead>
          <tr
            style={{
              borderBottom: "1px solid #E8E6E1",
              backgroundColor: "#FAFAF7",
            }}
          >
            <SortableHeader
              label="File"
              column="original_filename"
              currentSort={sortBy}
              currentDir={sortDir}
              onSort={onSort}
              style={{ width: "40%", paddingLeft: 16 }}
            />
            <SortableHeader
              label="Size"
              column="size_bytes"
              currentSort={sortBy}
              currentDir={sortDir}
              onSort={onSort}
              style={{ width: "10%" }}
            />
            <SortableHeader
              label="Uploaded"
              column="uploaded_at"
              currentSort={sortBy}
              currentDir={sortDir}
              onSort={onSort}
              style={{ width: "15%" }}
            />
            <TableHeader style={{ width: "12%" }}>Entity</TableHeader>
            <TableHeader style={{ width: "15%" }}>Linked to</TableHeader>
            <TableHeader style={{ width: "8%", paddingRight: 16, textAlign: "right" }}>
              Actions
            </TableHeader>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <VaultListRow
              key={file.id}
              file={file}
              onClick={() => onFileClick(file)}
              onView={(e) => handleView(e, file)}
              onDownload={(e) => handleDownload(e, file)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableHeader
// ---------------------------------------------------------------------------

interface SortableHeaderProps {
  label: string;
  column: VaultSortColumn;
  currentSort: VaultSortColumn;
  currentDir: VaultSortDirection;
  onSort: (column: VaultSortColumn) => void;
  style?: React.CSSProperties;
}

function SortableHeader({
  label,
  column,
  currentSort,
  currentDir,
  onSort,
  style,
}: SortableHeaderProps): JSX.Element {
  const isActive = currentSort === column;

  const SortIcon = isActive
    ? currentDir === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <th
      onClick={() => onSort(column)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSort(column);
        }
      }}
      tabIndex={0}
      role="columnheader"
      aria-sort={
        isActive
          ? currentDir === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      style={{
        ...style,
        padding: "12px 8px",
        fontSize: 12,
        fontWeight: 600,
        color: "#6B6B6B",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        cursor: "pointer",
        userSelect: "none",
        textAlign: "left",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          color: isActive ? "#181818" : "#6B6B6B",
        }}
      >
        {label}
        <SortIcon size={14} />
      </span>
    </th>
  );
}

// ---------------------------------------------------------------------------
// TableHeader (non-sortable)
// ---------------------------------------------------------------------------

interface TableHeaderProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

function TableHeader({ children, style }: TableHeaderProps): JSX.Element {
  return (
    <th
      style={{
        ...style,
        padding: "12px 8px",
        fontSize: 12,
        fontWeight: 600,
        color: "#6B6B6B",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        textAlign: "left",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

// ---------------------------------------------------------------------------
// VaultListRow — single row
// ---------------------------------------------------------------------------

interface VaultListRowProps {
  file: VaultFile;
  onClick: () => void;
  onView: (e: React.MouseEvent) => void;
  onDownload: (e: React.MouseEvent) => void;
}

/**
 * Formats a minor-unit amount as a currency string.
 */
function formatAmount(minor: number | null, currency: string | null): string {
  if (minor === null || currency === null) return "";
  const major = minor / 100;
  const prefix = currency === "MYR" ? "RM " : currency === "USD" ? "$" : `${currency} `;
  return `${prefix}${major.toFixed(2)}`;
}

/**
 * Formats an ISO timestamp to a readable date string.
 */
function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function VaultListRow({
  file,
  onClick,
  onView,
  onDownload,
}: VaultListRowProps): JSX.Element {
  const displayName = file.display_filename ?? file.original_filename;
  const fileSize = formatFileSize(file.size_bytes);
  const uploadDate = formatDate(file.uploaded_at);

  return (
    <tr
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      role="row"
      aria-label={`${displayName}, ${fileSize}`}
      className="vault-list-row"
      style={{
        cursor: "pointer",
        borderBottom: "1px solid #F0EFEA",
        transition: "background-color 0.1s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "#FAFAF7";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {/* Thumbnail + Filename */}
      <td
        style={{
          padding: "10px 8px 10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Thumbnail
          storagePath={file.storage_path}
          mimeType={file.mime_type}
          alt={displayName}
          size={40}
        />
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontWeight: 500,
              color: "#181818",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 280,
              fontSize: 14,
            }}
            title={displayName}
          >
            {displayName}
          </p>
          {/* Inline badges */}
          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            {file.hasExtraction && (
              <span
                style={{
                  backgroundColor: "#E8F5EE",
                  color: "#1F8A4C",
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: 999,
                }}
              >
                AI
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Size */}
      <td
        style={{
          padding: "10px 8px",
          color: "#6B6B6B",
          fontSize: 13,
          verticalAlign: "middle",
        }}
      >
        {fileSize}
      </td>

      {/* Uploaded */}
      <td
        style={{
          padding: "10px 8px",
          color: "#6B6B6B",
          fontSize: 13,
          verticalAlign: "middle",
        }}
      >
        {uploadDate}
      </td>

      {/* Entity */}
      <td
        style={{
          padding: "10px 8px",
          verticalAlign: "middle",
        }}
      >
        {file.entityName ? (
          <span
            style={{
              backgroundColor: "#F0EFEA",
              color: "#6B6B6B",
              fontSize: 11,
              fontWeight: 500,
              padding: "2px 8px",
              borderRadius: 999,
            }}
          >
            {file.entityName}
          </span>
        ) : (
          <span style={{ color: "#C4C2BC", fontSize: 13 }}>—</span>
        )}
      </td>

      {/* Linked to (transaction vendor) */}
      <td
        style={{
          padding: "10px 8px",
          verticalAlign: "middle",
        }}
      >
        {file.linkedTransactionVendor ? (
          <span
            style={{
              backgroundColor: "#FFF6EF",
              color: "#F37002",
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 999,
              display: "inline-block",
              maxWidth: 160,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={`${file.linkedTransactionVendor}${file.linkedTransactionAmountMinor !== null ? ` — ${formatAmount(file.linkedTransactionAmountMinor, file.linkedTransactionCurrency)}` : ""}`}
          >
            {file.linkedTransactionVendor}
            {file.linkedTransactionAmountMinor !== null &&
              ` · ${formatAmount(file.linkedTransactionAmountMinor, file.linkedTransactionCurrency)}`}
          </span>
        ) : (
          <span style={{ color: "#C4C2BC", fontSize: 13 }}>—</span>
        )}
      </td>

      {/* Actions */}
      <td
        style={{
          padding: "10px 16px 10px 8px",
          textAlign: "right",
          verticalAlign: "middle",
        }}
      >
        <div
          className="vault-row-actions"
          style={{
            display: "flex",
            gap: 4,
            justifyContent: "flex-end",
            opacity: 0,
            transition: "opacity 0.15s ease",
          }}
        >
          <button
            onClick={onView}
            aria-label={`View ${displayName}`}
            style={actionButtonStyle}
            type="button"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={onDownload}
            aria-label={`Download ${displayName}`}
            style={actionButtonStyle}
            type="button"
          >
            <Download size={16} />
          </button>
        </div>
      </td>

      {/* CSS for hover actions */}
      <style>{`
        .vault-list-row:hover .vault-row-actions,
        .vault-list-row:focus-within .vault-row-actions {
          opacity: 1 !important;
        }
      `}</style>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const actionButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  backgroundColor: "transparent",
  border: "1px solid #E8E6E1",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#6B6B6B",
  transition: "background-color 0.1s ease, color 0.1s ease",
};
