"use client";

/**
 * @file components/vault/FileViewer.tsx
 * @description File viewer modal for the Receipt & Invoice Vault.
 *
 * Displays a full-size image or PDF viewer with a sidebar containing
 * file metadata, linked transaction summary, AI extraction details,
 * and action buttons (Download, Rename, Unlink). Supports closing
 * via X button, clicking outside, or pressing the ESC key.
 *
 * @module components/vault/FileViewer
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import {
  getVaultFile,
  getFileSignedUrl,
  updateFileName,
  unlinkFileFromTransaction,
  formatFileSize,
} from "@/lib/actions/vault";
import type { VaultFileDetail, VaultFile } from "@/lib/actions/vault";
import type { ExtractionRow, TransactionRow } from "@/lib/supabase/database.types";
import {
  X,
  Download,
  Pencil,
  Unlink,
  FileText,
  FileImage,
  File,
  ChevronDown,
  ChevronUp,
  Calendar,
  HardDrive,
  Hash,
  Building2,
  Cpu,
  Sparkles,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FileViewerProps {
  /** The vault file to display (from the parent grid/list). */
  vaultFile: VaultFile;
  /** Called when the modal should be closed. */
  onClose: () => void;
  /** Called after a successful rename or unlink to refresh the parent view. */
  onMutated?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal file viewer with metadata sidebar.
 *
 * @param props — File to view, close handler, and mutation callback.
 * @returns JSX.Element | null
 */
export function FileViewer({ vaultFile, onClose, onMutated }: FileViewerProps): JSX.Element {
  const [detail, setDetail] = useState<VaultFileDetail | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [renameValue, setRenameValue] = useState<string>("");
  const [showOcrText, setShowOcrText] = useState<boolean>(false);
  const [isUnlinking, setIsUnlinking] = useState<boolean>(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const isImage = vaultFile.mime_type.startsWith("image/");
  const isPdf = vaultFile.mime_type === "application/pdf";

  // -------------------------------------------------------------------------
  // Fetch file detail and signed URL on mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const [fileDetail, url] = await Promise.all([
          getVaultFile(vaultFile.id),
          getFileSignedUrl(vaultFile.storage_path),
        ]);

        if (!cancelled) {
          setDetail(fileDetail);
          setSignedUrl(url);
          setRenameValue(
            fileDetail.file.display_filename ?? fileDetail.file.original_filename
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load file");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [vaultFile.id, vaultFile.storage_path]);

  // -------------------------------------------------------------------------
  // ESC key handler
  // -------------------------------------------------------------------------

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll while modal is open
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // -------------------------------------------------------------------------
  // Click outside to close
  // -------------------------------------------------------------------------

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // -------------------------------------------------------------------------
  // Rename handler
  // -------------------------------------------------------------------------

  const handleRename = useCallback(async () => {
    if (!renameValue.trim()) return;

    try {
      await updateFileName(vaultFile.id, renameValue.trim());
      setIsRenaming(false);
      // Refresh detail
      const updated = await getVaultFile(vaultFile.id);
      setDetail(updated);
      onMutated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename file");
    }
  }, [renameValue, vaultFile.id, onMutated]);

  // -------------------------------------------------------------------------
  // Unlink handler
  // -------------------------------------------------------------------------

  const handleUnlink = useCallback(async () => {
    if (!detail?.linkedTransaction) return;
    if (!confirm("Unlink this file from the transaction?")) return;

    try {
      setIsUnlinking(true);
      await unlinkFileFromTransaction(detail.linkedTransaction.id);
      const updated = await getVaultFile(vaultFile.id);
      setDetail(updated);
      onMutated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink");
    } finally {
      setIsUnlinking(false);
    }
  }, [detail?.linkedTransaction, vaultFile.id, onMutated]);

  // -------------------------------------------------------------------------
  // Download handler
  // -------------------------------------------------------------------------

  const handleDownload = useCallback(() => {
    if (signedUrl) {
      const a = document.createElement("a");
      a.href = signedUrl;
      a.download = detail?.file.display_filename ?? detail?.file.original_filename ?? "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [signedUrl, detail]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const displayName = detail?.file.display_filename ?? detail?.file.original_filename ?? "File";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "5vh 5vw",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-viewer-title"
    >
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 12,
          maxWidth: "90vw",
          maxHeight: "90vh",
          width: 1200,
          display: "flex",
          overflow: "hidden",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
        }}
      >
        {/* Left: File preview */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            backgroundColor: "#181818",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Close button (top-left of preview) */}
          <button
            onClick={onClose}
            aria-label="Close file viewer"
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              width: 36,
              height: 36,
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#FFFFFF",
              backdropFilter: "blur(8px)",
              zIndex: 10,
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
            }}
            type="button"
          >
            <X size={18} />
          </button>

          {/* Preview content */}
          {isLoading ? (
            <LoadingPlaceholder />
          ) : error ? (
            <ErrorDisplay message={error} />
          ) : isImage && signedUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={signedUrl}
              alt={displayName}
              style={{
                maxWidth: "100%",
                maxHeight: "90vh",
                objectFit: "contain",
              }}
            />
          ) : isPdf ? (
            <PdfViewer signedUrl={signedUrl} filename={displayName} />
          ) : (
            <GenericFileDisplay mimeType={vaultFile.mime_type} filename={displayName} />
          )}
        </div>

        {/* Right: Sidebar metadata */}
        <div
          style={{
            width: 340,
            minWidth: 340,
            maxHeight: "90vh",
            overflowY: "auto",
            borderLeft: "1px solid #E8E6E1",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Sidebar header */}
          <div
            style={{
              padding: "20px 20px 16px",
              borderBottom: "1px solid #E8E6E1",
              position: "sticky",
              top: 0,
              backgroundColor: "#FFFFFF",
              zIndex: 5,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              {isRenaming ? (
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename();
                      if (e.key === "Escape") setIsRenaming(false);
                    }}
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      border: "1px solid #F37002",
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 600,
                      outline: "none",
                      color: "#181818",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      onClick={handleRename}
                      style={primaryButtonStyle}
                      type="button"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsRenaming(false)}
                      style={secondaryButtonStyle}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2
                    id="file-viewer-title"
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#181818",
                      lineHeight: 1.4,
                      wordBreak: "break-word",
                    }}
                  >
                    {displayName}
                  </h2>
                  <button
                    onClick={() => setIsRenaming(true)}
                    aria-label="Rename file"
                    style={iconButtonStyle}
                    title="Rename"
                    type="button"
                  >
                    <Pencil size={15} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sidebar content */}
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
            {/* File metadata section */}
            <SidebarSection title="File Details" icon={<HardDrive size={14} />}>
              <MetadataGrid>
                <MetadataItem label="Type" value={vaultFile.mime_type} />
                <MetadataItem
                  label="Size"
                  value={formatFileSize(vaultFile.size_bytes)}
                />
                <MetadataItem
                  label="Uploaded"
                  value={formatDate(vaultFile.uploaded_at)}
                  icon={<Calendar size={12} />}
                />
                <MetadataItem
                  label="SHA-256"
                  value={shortenHash(vaultFile.sha256_hash)}
                  title={vaultFile.sha256_hash}
                  icon={<Hash size={12} />}
                />
                <MetadataItem
                  label="Source"
                  value={vaultFile.source}
                  capitalize
                />
                {detail?.entityName && (
                  <MetadataItem
                    label="Entity"
                    value={detail.entityName}
                    icon={<Building2 size={12} />}
                  />
                )}
              </MetadataGrid>
            </SidebarSection>

            {/* Linked transaction section */}
            {detail?.linkedTransaction && (
              <SidebarSection
                title="Linked Transaction"
                icon={<Sparkles size={14} />}
              >
                <TransactionCard transaction={detail.linkedTransaction} />
                <button
                  onClick={handleUnlink}
                  disabled={isUnlinking}
                  style={{
                    ...dangerButtonStyle,
                    opacity: isUnlinking ? 0.6 : 1,
                    cursor: isUnlinking ? "not-allowed" : "pointer",
                  }}
                  type="button"
                >
                  <Unlink size={14} />
                  {isUnlinking ? "Unlinking..." : "Unlink from transaction"}
                </button>
              </SidebarSection>
            )}

            {/* AI Extraction section */}
            {detail?.extraction && (
              <SidebarSection title="AI Extraction" icon={<Cpu size={14} />}>
                <ExtractionDetail extraction={detail.extraction} />

                {/* Raw OCR text (collapsible) */}
                {detail.extraction.raw_response && (
                  <div style={{ marginTop: 12 }}>
                    <button
                      onClick={() => setShowOcrText((prev) => !prev)}
                      style={collapsibleToggleStyle}
                      type="button"
                      aria-expanded={showOcrText}
                    >
                      {showOcrText ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                      Raw OCR Text
                    </button>
                    {showOcrText && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 12,
                          backgroundColor: "#FAFAF7",
                          borderRadius: 8,
                          border: "1px solid #E8E6E1",
                          maxHeight: 200,
                          overflowY: "auto",
                        }}
                      >
                        <pre
                          style={{
                            margin: 0,
                            fontSize: 12,
                            lineHeight: 1.5,
                            color: "#6B6B6B",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            fontFamily:
                              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                          }}
                        >
                          {extractRawText(detail.extraction.raw_response)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </SidebarSection>
            )}
          </div>

          {/* Sidebar footer: actions */}
          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid #E8E6E1",
              marginTop: "auto",
              display: "flex",
              gap: 8,
              position: "sticky",
              bottom: 0,
              backgroundColor: "#FFFFFF",
            }}
          >
            <button
              onClick={handleDownload}
              disabled={!signedUrl}
              style={{
                ...primaryButtonStyle,
                flex: 1,
                opacity: signedUrl ? 1 : 0.5,
                cursor: signedUrl ? "pointer" : "not-allowed",
              }}
              type="button"
            >
              <Download size={15} />
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingPlaceholder(): JSX.Element {
  return (
    <div
      style={{
        width: 120,
        height: 120,
        borderRadius: 12,
        backgroundColor: "#2A2A2A",
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

function ErrorDisplay({ message }: { message: string }): JSX.Element {
  return (
    <div
      style={{
        color: "#FFFFFF",
        textAlign: "center",
        padding: 24,
      }}
    >
      <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>Error loading file</p>
      <p style={{ fontSize: 13, opacity: 0.5 }}>{message}</p>
    </div>
  );
}

interface PdfViewerProps {
  signedUrl: string | null;
  filename: string;
}

function PdfViewer({ signedUrl, filename }: PdfViewerProps): JSX.Element {
  if (!signedUrl) {
    return (
      <div style={{ color: "#FFFFFF", textAlign: "center", padding: 24 }}>
        <FileText size={48} strokeWidth={1} style={{ opacity: 0.4, marginBottom: 12 }} />
        <p style={{ fontSize: 14, opacity: 0.6 }}>PDF preview unavailable</p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "90vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
      }}
    >
      <FileText size={64} strokeWidth={1} style={{ color: "#FFFFFF", opacity: 0.6 }} />
      <p style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 500, margin: 0 }}>{filename}</p>
      <a
        href={signedUrl}
        download={filename}
        style={{
          padding: "10px 20px",
          backgroundColor: "#F37002",
          color: "#FFFFFF",
          borderRadius: 8,
          textDecoration: "none",
          fontSize: 14,
          fontWeight: 500,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Download size={16} />
        Download PDF
      </a>
    </div>
  );
}

interface GenericFileDisplayProps {
  mimeType: string;
  filename: string;
}

function GenericFileDisplay({ mimeType, filename }: GenericFileDisplayProps): JSX.Element {
  const Icon = mimeType.startsWith("image/")
    ? FileImage
    : mimeType === "application/pdf"
      ? FileText
      : File;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: 24,
        color: "#FFFFFF",
      }}
    >
      <Icon size={64} strokeWidth={1} style={{ opacity: 0.6 }} />
      <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{filename}</p>
      <p style={{ fontSize: 12, opacity: 0.5, margin: 0 }}>{mimeType}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar sub-components
// ---------------------------------------------------------------------------

function SidebarSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div>
      <h3
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: "#6B6B6B",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          margin: "0 0 12px 0",
        }}
      >
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function MetadataGrid({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "10px 16px",
      }}
    >
      {children}
    </div>
  );
}

interface MetadataItemProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  title?: string;
  capitalize?: boolean;
}

function MetadataItem({ label, value, icon, title, capitalize }: MetadataItemProps): JSX.Element {
  return (
    <div title={title}>
      <p
        style={{
          margin: "0 0 2px 0",
          fontSize: 11,
          color: "#9C9A94",
          textTransform: "uppercase",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "#181818",
          fontWeight: 500,
          textTransform: capitalize ? "capitalize" : "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {icon}
        {value}
      </p>
    </div>
  );
}

interface TransactionCardProps {
  transaction: TransactionRow;
}

function TransactionCard({ transaction }: TransactionCardProps): JSX.Element {
  const amount = transaction.amount_minor / 100;
  const currencyPrefix =
    transaction.currency === "MYR" ? "RM " : transaction.currency === "USD" ? "$" : `${transaction.currency} `;

  return (
    <div
      style={{
        padding: 14,
        backgroundColor: "#FFF6EF",
        borderRadius: 8,
        border: "1px solid #FDE8D6",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: "#181818",
          }}
        >
          {transaction.vendor}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: "#F37002",
          }}
        >
          {currencyPrefix}
          {amount.toFixed(2)}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          fontSize: 12,
          color: "#6B6B6B",
        }}
      >
        <span>{transaction.category}</span>
        <span>&middot;</span>
        <span>{formatDate(transaction.occurred_at)}</span>
        <span>&middot;</span>
        <span
          style={{
            textTransform: "capitalize",
            fontWeight: 500,
            color:
              transaction.status === "active"
                ? "#1F8A4C"
                : transaction.status === "pending_review"
                  ? "#C49000"
                  : "#9C9A94",
          }}
        >
          {transaction.status.replace("_", " ")}
        </span>
      </div>
    </div>
  );
}

interface ExtractionDetailProps {
  extraction: ExtractionRow;
}

function ExtractionDetail({ extraction }: ExtractionDetailProps): JSX.Element {
  const confidence = extraction.confidence_scores as Record<string, number> | null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#6B6B6B" }}>
          Model: <strong style={{ color: "#181818" }}>{extraction.model_used}</strong>
        </span>
        {extraction.processing_time_ms !== null && (
          <span style={{ fontSize: 11, color: "#9C9A94" }}>
            {extraction.processing_time_ms}ms
          </span>
        )}
      </div>

      {extraction.manually_corrected && (
        <span
          style={{
            backgroundColor: "#E8F5EE",
            color: "#1F8A4C",
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 999,
            display: "inline-block",
            alignSelf: "flex-start",
          }}
        >
          Manually Corrected
        </span>
      )}

      {confidence && Object.keys(confidence).length > 0 && (
        <div style={{ marginTop: 4 }}>
          <p
            style={{
              margin: "0 0 6px 0",
              fontSize: 11,
              color: "#9C9A94",
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            Confidence Scores
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {Object.entries(confidence).map(([field, score]) => (
              <div
                key={field}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 12,
                }}
              >
                <span style={{ color: "#6B6B6B", textTransform: "capitalize" }}>
                  {field.replace(/_/g, " ")}
                </span>
                <ConfidenceBadge score={score as number} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number }): JSX.Element {
  const color =
    score >= 0.9 ? "#1F8A4C" : score >= 0.7 ? "#C49000" : "#D44830";
  const bgColor =
    score >= 0.9 ? "#E8F5EE" : score >= 0.7 ? "#FFF8E1" : "#FDEBE8";

  return (
    <span
      style={{
        backgroundColor: bgColor,
        color: color,
        fontSize: 11,
        fontWeight: 600,
        padding: "1px 6px",
        borderRadius: 999,
      }}
    >
      {Math.round(score * 100)}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Formats an ISO date string to a readable format.
 */
function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Shortens a SHA-256 hash for display.
 */
function shortenHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

/**
 * Extracts raw_text from the extraction's raw_response JSONB.
 */
function extractRawText(rawResponse: unknown): string {
  if (typeof rawResponse !== "object" || rawResponse === null) return "No OCR text available";
  const response = rawResponse as Record<string, unknown>;
  if (typeof response.raw_text === "string") return response.raw_text;
  return JSON.stringify(rawResponse, null, 2);
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const iconButtonStyle: React.CSSProperties = {
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
  flexShrink: 0,
  transition: "background-color 0.1s ease, color 0.1s ease",
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 16px",
  backgroundColor: "#F37002",
  color: "#FFFFFF",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background-color 0.15s ease",
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 16px",
  backgroundColor: "#F0EFEA",
  color: "#6B6B6B",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  transition: "background-color 0.15s ease",
};

const dangerButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 12px",
  backgroundColor: "#FDEBE8",
  color: "#D44830",
  border: "none",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  transition: "background-color 0.15s ease",
  marginTop: 10,
  width: "100%",
};

const collapsibleToggleStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 0",
  backgroundColor: "transparent",
  border: "none",
  fontSize: 12,
  fontWeight: 500,
  color: "#6B6B6B",
  cursor: "pointer",
  transition: "color 0.1s ease",
};
