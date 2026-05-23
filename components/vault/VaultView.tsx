"use client";

/**
 * @file components/vault/VaultView.tsx
 * @description Main vault browser for the Receipt & Invoice Vault.
 *
 * The trust layer of the JK Zentra Finance Cockpit. This component provides:
 * - Full-text search on OCR text (raw_text), filename, and linked vendor (debounced 300ms)
 * - Filter bar: entity dropdown, date range, file type (All/Images/PDFs)
 * - Sort controls: upload date, filename, size
 * - Grid view (desktop): 4-column thumbnail cards via VaultGrid
 * - List view (desktop toggle): sortable table via VaultList
 * - List view (mobile): stacked cards
 * - Pagination: 24 items per page
 * - File viewer modal: opens on file click via FileViewer
 *
 * @module components/vault/VaultView
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  listVaultFiles,
  listEntitiesForVault,
  getFileSignedUrl,
  formatFileSize,
} from "@/lib/actions/vault";
import type {
  VaultFile,
  VaultMimeFilter,
  VaultSortColumn,
  VaultSortDirection,
  ListVaultFilesResult,
} from "@/lib/actions/vault";
import type { EntityRow } from "@/lib/supabase/database.types";
import { VaultGrid } from "./VaultGrid";
import { VaultList } from "./VaultList";
import { FileViewer } from "./FileViewer";
import { Thumbnail } from "./Thumbnail";
import {
  Search,
  Filter,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
  SlidersHorizontal,
} from "lucide-react";

// ---------------------------------------------------------------------------
// View mode type
// ---------------------------------------------------------------------------

type ViewMode = "grid" | "list";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 24;
const DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Main vault browser component.
 *
 * Orchestrates search, filtering, sorting, pagination, and view switching
 * between grid and list layouts. Manages the file viewer modal state.
 *
 * @returns JSX.Element
 */
export function VaultView(): JSX.Element {
  const router = useRouter();

  // -------------------------------------------------------------------------
  // State: data
  // -------------------------------------------------------------------------

  const [files, setFiles] = useState<VaultFile[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [entities, setEntities] = useState<Pick<EntityRow, "id" | "name" | "slug" | "color">[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // State: search, filters, sort, pagination
  // -------------------------------------------------------------------------

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [entityId, setEntityId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [mimeType, setMimeType] = useState<VaultMimeFilter>("all");
  const [sortBy, setSortBy] = useState<VaultSortColumn>("uploaded_at");
  const [sortDir, setSortDir] = useState<VaultSortDirection>("desc");
  const [page, setPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // -------------------------------------------------------------------------
  // State: modal
  // -------------------------------------------------------------------------

  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);

  // -------------------------------------------------------------------------
  // Debounce search query
  // -------------------------------------------------------------------------

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1); // Reset to page 1 on search change
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // -------------------------------------------------------------------------
  // Fetch entities on mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadEntities() {
      try {
        const data = await listEntitiesForVault();
        if (!cancelled) {
          setEntities(data);
        }
      } catch (err) {
        // Non-critical — filters will just show empty entity dropdown
        console.warn("Failed to load entities:", err);
      }
    }

    loadEntities();

    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Fetch files when filters change
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadFiles() {
      try {
        setIsLoading(true);
        setError(null);

        const result: ListVaultFilesResult = await listVaultFiles({
          searchQuery: debouncedSearch || undefined,
          entityId: entityId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          mimeType: mimeType === "all" ? undefined : mimeType,
          page,
          pageSize: PAGE_SIZE,
          sortBy,
          sortDir,
        });

        if (!cancelled) {
          setFiles(result.files);
          setTotal(result.total);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load files");
          setFiles([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadFiles();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, entityId, dateFrom, dateTo, mimeType, sortBy, sortDir, page]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleSort = useCallback((column: VaultSortColumn) => {
    setSortBy((prev) => {
      if (prev === column) {
        setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir(column === "uploaded_at" ? "desc" : "asc");
      return column;
    });
    setPage(1);
  }, []);

  const handleFileClick = useCallback((file: VaultFile) => {
    setSelectedFile(file);
  }, []);

  const handleCloseViewer = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const handleDownload = useCallback(async (file: VaultFile) => {
    try {
      const url = await getFileSignedUrl(file.storage_path);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.display_filename ?? file.original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Download failed");
    }
  }, []);

  const handleMutated = useCallback(() => {
    // Trigger a re-fetch of the current page
    setPage((p) => p);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearch("");
    setEntityId("");
    setDateFrom("");
    setDateTo("");
    setMimeType("all");
    setSortBy("uploaded_at");
    setSortDir("desc");
    setPage(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div style={{ backgroundColor: "#FAFAF7", minHeight: "100vh" }}>
      {/* Top bar: search + controls */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backgroundColor: "#FAFAF7",
          borderBottom: "1px solid #E8E6E1",
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Row 1: Search + view toggle */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* Search input */}
            <div
              style={{
                flex: 1,
                position: "relative",
                maxWidth: 480,
              }}
            >
              <Search
                size={18}
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9C9A94",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search OCR text, filename, or vendor..."
                aria-label="Search vault files"
                style={{
                  width: "100%",
                  height: 44,
                  padding: "0 40px 0 42px",
                  border: "1px solid #E8E6E1",
                  borderRadius: 10,
                  fontSize: 14,
                  backgroundColor: "#FFFFFF",
                  color: "#181818",
                  outline: "none",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#F37002";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(243, 112, 2, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E8E6E1";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9C9A94",
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  type="button"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              aria-label="Toggle filters"
              aria-expanded={showFilters}
              style={{
                ...iconButtonStyle,
                backgroundColor: showFilters ? "#FFF6EF" : "#FFFFFF",
                color: showFilters ? "#F37002" : "#6B6B6B",
                border: `1px solid ${showFilters ? "#FDE8D6" : "#E8E6E1"}`,
              }}
              type="button"
            >
              <SlidersHorizontal size={18} />
            </button>

            {/* View mode toggle */}
            <div
              style={{
                display: "flex",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E8E6E1",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <ViewModeButton
                mode="grid"
                currentMode={viewMode}
                onClick={() => setViewMode("grid")}
                icon={<Grid3X3 size={16} />}
                label="Grid"
              />
              <ViewModeButton
                mode="list"
                currentMode={viewMode}
                onClick={() => setViewMode("list")}
                icon={<List size={16} />}
                label="List"
              />
            </div>
          </div>

          {/* Row 2: Filters (collapsible) */}
          {showFilters && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
                padding: "12px 16px",
                backgroundColor: "#FFFFFF",
                borderRadius: 10,
                border: "1px solid #E8E6E1",
              }}
            >
              {/* Entity filter */}
              <FilterGroup label="Entity">
                <select
                  value={entityId}
                  onChange={(e) => {
                    setEntityId(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by entity"
                  style={filterSelectStyle}
                >
                  <option value="">All entities</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name}
                    </option>
                  ))}
                </select>
              </FilterGroup>

              {/* Date range */}
              <FilterGroup label="From">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Date from"
                  style={filterInputStyle}
                />
              </FilterGroup>

              <FilterGroup label="To">
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Date to"
                  style={filterInputStyle}
                />
              </FilterGroup>

              {/* File type filter */}
              <FilterGroup label="Type">
                <select
                  value={mimeType}
                  onChange={(e) => {
                    setMimeType(e.target.value as VaultMimeFilter);
                    setPage(1);
                  }}
                  aria-label="Filter by file type"
                  style={filterSelectStyle}
                >
                  <option value="all">All files</option>
                  <option value="image">Images</option>
                  <option value="pdf">PDFs</option>
                </select>
              </FilterGroup>

              {/* Sort controls */}
              <FilterGroup label="Sort">
                <select
                  value={`${sortBy}-${sortDir}`}
                  onChange={(e) => {
                    const [col, dir] = e.target.value.split("-") as [
                      VaultSortColumn,
                      VaultSortDirection,
                    ];
                    setSortBy(col);
                    setSortDir(dir);
                  }}
                  aria-label="Sort by"
                  style={filterSelectStyle}
                >
                  <option value="uploaded_at-desc">Upload date (newest)</option>
                  <option value="uploaded_at-asc">Upload date (oldest)</option>
                  <option value="original_filename-asc">Filename (A–Z)</option>
                  <option value="original_filename-desc">Filename (Z–A)</option>
                  <option value="size_bytes-desc">Size (largest)</option>
                  <option value="size_bytes-asc">Size (smallest)</option>
                </select>
              </FilterGroup>

              {/* Clear filters */}
              <button
                onClick={clearFilters}
                style={{
                  ...secondaryButtonStyle,
                  marginLeft: "auto",
                }}
                type="button"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "8px 24px 32px",
        }}
      >
        {/* Results count */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 0",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "#6B6B6B" }}>
            {isLoading ? (
              "Loading..."
            ) : (
              <>
                <strong style={{ color: "#181818" }}>{total.toLocaleString()}</strong>{" "}
                {total === 1 ? "file" : "files"}
                {debouncedSearch && (
                  <>
                    {" "}
                    matching "<strong>{debouncedSearch}</strong>"
                  </>
                )}
              </>
            )}
          </p>
        </div>

        {/* Error state */}
        {error && (
          <div
            style={{
              padding: "24px",
              backgroundColor: "#FDEBE8",
              borderRadius: 12,
              color: "#D44830",
              fontSize: 14,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            <p style={{ margin: "0 0 8px 0", fontWeight: 500 }}>Error loading files</p>
            <p style={{ margin: 0, fontSize: 13 }}>{error}</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && files.length === 0 ? (
          <LoadingGrid />
        ) : files.length === 0 && !error ? (
          /* Empty state */
          <EmptyState onUploadClick={() => router.push("/upload")} />
        ) : (
          /* File display */
          <>
            {viewMode === "grid" ? (
              <VaultGrid
                files={files}
                onFileClick={handleFileClick}
                onDownload={handleDownload}
              />
            ) : (
              <VaultList
                files={files}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
                onFileClick={handleFileClick}
                onDownload={handleDownload}
              />
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>

      {/* File viewer modal */}
      {selectedFile && (
        <FileViewer
          vaultFile={selectedFile}
          onClose={handleCloseViewer}
          onMutated={handleMutated}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ViewModeButtonProps {
  mode: ViewMode;
  currentMode: ViewMode;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function ViewModeButton({
  mode,
  currentMode,
  onClick,
  icon,
  label,
}: ViewModeButtonProps): JSX.Element {
  const isActive = mode === currentMode;

  return (
    <button
      onClick={onClick}
      aria-label={`Switch to ${label} view`}
      aria-pressed={isActive}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        backgroundColor: isActive ? "#181818" : "transparent",
        color: isActive ? "#FFFFFF" : "#6B6B6B",
        border: "none",
        fontSize: 13,
        fontWeight: isActive ? 600 : 400,
        cursor: "pointer",
        transition: "background-color 0.1s ease, color 0.1s ease",
      }}
      type="button"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

interface FilterGroupProps {
  label: string;
  children: React.ReactNode;
}

function FilterGroup({ label, children }: FilterGroupProps): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#9C9A94",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

interface EmptyStateProps {
  onUploadClick: () => void;
}

function EmptyState({ onUploadClick }: EmptyStateProps): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          backgroundColor: "#F0EFEA",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <Upload size={32} strokeWidth={1.5} style={{ color: "#9C9A94" }} />
      </div>
      <h3
        style={{
          margin: "0 0 8px 0",
          fontSize: 18,
          fontWeight: 600,
          color: "#181818",
        }}
      >
        No files yet
      </h3>
      <p
        style={{
          margin: "0 0 24px 0",
          fontSize: 14,
          color: "#9C9A94",
          maxWidth: 320,
          lineHeight: 1.5,
        }}
      >
        Upload your first receipt or invoice to start building your document vault.
      </p>
      <button
        onClick={onUploadClick}
        style={primaryButtonStyle}
        type="button"
      >
        <Upload size={16} />
        Upload your first receipt
      </button>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: PaginationProps): JSX.Element {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 0 0",
        borderTop: "1px solid #E8E6E1",
        marginTop: 16,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: "#6B6B6B" }}>
        Showing <strong style={{ color: "#181818" }}>{start}</strong>–
        <strong style={{ color: "#181818" }}>{end}</strong> of{" "}
        <strong style={{ color: "#181818" }}>{total.toLocaleString()}</strong>
      </p>

      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          style={{
            ...pageButtonStyle,
            opacity: page <= 1 ? 0.4 : 1,
            cursor: page <= 1 ? "not-allowed" : "pointer",
          }}
          type="button"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Page numbers */}
        {generatePageNumbers(page, totalPages).map((p, i) =>
          p === "..." ? (
            <span
              key={`ellipsis-${i}`}
              style={{
                padding: "6px 10px",
                fontSize: 13,
                color: "#9C9A94",
              }}
            >
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
              style={{
                ...pageButtonStyle,
                backgroundColor: p === page ? "#181818" : "#FFFFFF",
                color: p === page ? "#FFFFFF" : "#181818",
                fontWeight: p === page ? 600 : 400,
              }}
              type="button"
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          style={{
            ...pageButtonStyle,
            opacity: page >= totalPages ? 0.4 : 1,
            cursor: page >= totalPages ? "not-allowed" : "pointer",
          }}
          type="button"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function LoadingGrid(): JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 16,
        padding: "16px 0",
      }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E8E6E1",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 8,
              backgroundColor: "#F0EFEA",
              margin: "0 auto 10px",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: 14,
              borderRadius: 4,
              backgroundColor: "#F0EFEA",
              marginBottom: 6,
              width: "80%",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: 12,
              borderRadius: 4,
              backgroundColor: "#F0EFEA",
              width: "50%",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility: pagination page numbers
// ---------------------------------------------------------------------------

function generatePageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [1];

  if (current > 3) {
    pages.push("...");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("...");
  }

  pages.push(total);

  return pages;
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const iconButtonStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 8,
  backgroundColor: "#FFFFFF",
  border: "1px solid #E8E6E1",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#6B6B6B",
  transition: "background-color 0.1s ease, color 0.1s ease",
  flexShrink: 0,
};

const filterSelectStyle: React.CSSProperties = {
  height: 36,
  padding: "0 28px 0 10px",
  border: "1px solid #E8E6E1",
  borderRadius: 8,
  fontSize: 13,
  backgroundColor: "#FAFAF7",
  color: "#181818",
  outline: "none",
  cursor: "pointer",
  minWidth: 140,
};

const filterInputStyle: React.CSSProperties = {
  height: 36,
  padding: "0 10px",
  border: "1px solid #E8E6E1",
  borderRadius: 8,
  fontSize: 13,
  backgroundColor: "#FAFAF7",
  color: "#181818",
  outline: "none",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "10px 20px",
  backgroundColor: "#F37002",
  color: "#FFFFFF",
  border: "none",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background-color 0.15s ease",
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 14px",
  backgroundColor: "#F0EFEA",
  color: "#6B6B6B",
  border: "none",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  transition: "background-color 0.15s ease",
};

const pageButtonStyle: React.CSSProperties = {
  minWidth: 34,
  height: 34,
  padding: "0 8px",
  borderRadius: 8,
  border: "1px solid #E8E6E1",
  backgroundColor: "#FFFFFF",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontSize: 13,
  transition: "background-color 0.1s ease",
};
