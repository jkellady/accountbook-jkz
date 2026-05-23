"use client";

/**
 * @file components/vault/VaultGrid.tsx
 * @description Thumbnail grid view for the Receipt & Invoice Vault.
 *
 * Displays files as a responsive 4-column grid of cards on desktop.
 * Each card shows a thumbnail preview, filename, file size, upload date,
 * linked transaction badge (vendor + amount), and an AI extraction badge.
 * Hover reveals an overlay with "View" and "Download" action buttons.
 * Clicking a card opens the file viewer modal.
 *
 * @module components/vault/VaultGrid
 */

import { useCallback } from "react";
import { Thumbnail } from "./Thumbnail";
import { formatFileSize } from "@/lib/actions/vault";
import type { VaultFile } from "@/lib/actions/vault";
import { Eye, Download } from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VaultGridProps {
  /** Array of vault files to display. */
  files: VaultFile[];
  /** Callback when a file card is clicked (opens viewer modal). */
  onFileClick: (file: VaultFile) => void;
  /** Callback when the download button is clicked. */
  onDownload: (file: VaultFile) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a 4-column grid of vault file cards.
 *
 * @param props — Grid configuration and callbacks.
 * @returns JSX.Element
 */
export function VaultGrid({
  files,
  onFileClick,
  onDownload,
}: VaultGridProps): JSX.Element {
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
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 16,
        padding: "16px 0",
      }}
      role="list"
      aria-label="Vault file grid"
    >
      {files.map((file) => (
        <VaultGridCard
          key={file.id}
          file={file}
          onClick={() => onFileClick(file)}
          onView={(e) => handleView(e, file)}
          onDownload={(e) => handleDownload(e, file)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VaultGridCard — single card
// ---------------------------------------------------------------------------

interface VaultGridCardProps {
  file: VaultFile;
  onClick: () => void;
  onView: (e: React.MouseEvent) => void;
  onDownload: (e: React.MouseEvent) => void;
}

/**
 * Formats a minor-unit amount as a currency string.
 *
 * @param minor — Amount in minor units (cents/sen).
 * @param currency — Currency code (e.g. "MYR", "USD").
 * @returns Formatted string (e.g. "RM 12.50").
 */
function formatAmount(minor: number | null, currency: string | null): string {
  if (minor === null || currency === null) return "";
  const major = minor / 100;
  const prefix = currency === "MYR" ? "RM " : currency === "USD" ? "$" : `${currency} `;
  return `${prefix}${major.toFixed(2)}`;
}

/**
 * Formats an ISO timestamp to a readable date string.
 *
 * @param isoDate — ISO-8601 timestamp string.
 * @returns Localized date string (e.g. "23 Mar 2026").
 */
function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function VaultGridCard({
  file,
  onClick,
  onView,
  onDownload,
}: VaultGridCardProps): JSX.Element {
  const displayName = file.display_filename ?? file.original_filename;
  const fileSize = formatFileSize(file.size_bytes);
  const uploadDate = formatDate(file.uploaded_at);

  return (
    <div
      role="listitem"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      aria-label={`${displayName}, ${fileSize}, uploaded ${uploadDate}`}
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E8E6E1",
        borderRadius: 12,
        padding: 12,
        cursor: "pointer",
        transition: "box-shadow 0.15s ease, transform 0.1s ease",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Thumbnail with hover overlay */}
      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <Thumbnail
          storagePath={file.storage_path}
          mimeType={file.mime_type}
          alt={displayName}
          size={160}
        />

        {/* Hover overlay */}
        <div
          className="vault-card-overlay"
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            opacity: 0,
            transition: "opacity 0.15s ease",
            pointerEvents: "none",
          }}
        >
          <button
            onClick={onView}
            aria-label={`View ${displayName}`}
            style={overlayButtonStyle}
            type="button"
          >
            <Eye size={18} />
          </button>
          <button
            onClick={onDownload}
            aria-label={`Download ${displayName}`}
            style={overlayButtonStyle}
            type="button"
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Filename */}
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "#181818",
          margin: "0 0 4px 0",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.3,
        }}
        title={displayName}
      >
        {displayName}
      </p>

      {/* Meta row: size + date */}
      <p
        style={{
          fontSize: 12,
          color: "#9C9A94",
          margin: "0 0 8px 0",
          lineHeight: 1.3,
        }}
      >
        {fileSize} &middot; {uploadDate}
      </p>

      {/* Badges row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
        }}
      >
        {/* Linked transaction badge */}
        {file.linkedTransactionVendor && (
          <span
            style={{
              backgroundColor: "#FFF6EF",
              color: "#F37002",
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 999,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
            title={`${file.linkedTransactionVendor}${file.linkedTransactionAmountMinor !== null ? ` — ${formatAmount(file.linkedTransactionAmountMinor, file.linkedTransactionCurrency)}` : ""}`}
          >
            {file.linkedTransactionVendor}
            {file.linkedTransactionAmountMinor !== null &&
              ` · ${formatAmount(file.linkedTransactionAmountMinor, file.linkedTransactionCurrency)}`}
          </span>
        )}

        {/* AI extraction badge */}
        {file.hasExtraction && (
          <span
            style={{
              backgroundColor: "#E8F5EE",
              color: "#1F8A4C",
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 999,
            }}
          >
            AI
          </span>
        )}

        {/* Entity badge */}
        {file.entityName && (
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
        )}
      </div>

      {/* CSS for hover overlay — injected via inline for portability */}
      <style>{`
        .vault-card-overlay {
          pointer-events: none;
        }
        *:hover > .vault-card-overlay,
        *:focus-within > .vault-card-overlay {
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlayButtonStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  backgroundColor: "rgba(255, 255, 255, 0.95)",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#181818",
  transition: "background-color 0.1s ease, transform 0.1s ease",
  pointerEvents: "auto",
};
