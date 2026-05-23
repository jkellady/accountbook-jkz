"use client";

/**
 * @file components/upload/UploadDropzone.tsx
 * @description Drag-and-drop file upload zone for the JK Zentra Finance Cockpit.
 *
 * Features:
 * - Large dashed-border drop zone with visual feedback
 * - Drag-over state with orange accent border
 * - Click-to-browse via hidden file input
 * - Multi-file queue with sequential uploads
 * - Per-file progress tracking via {@link UploadProgress}
 * - Client-side SHA-256 hashing for deduplication
 * - Toast notifications on success / error
 * - Responsive: full-width on mobile, constrained on desktop
 *
 * @example
 * ```tsx
 * <UploadDropzone entity="jk-zentra" source="web" onUploadComplete={handleComplete} />
 * ```
 */

import { useCallback, useRef, useState } from "react";
import {
  Upload,
  FileImage,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computeFileHash,
  validateFile,
  formatFileSize,
  MAX_FILE_SIZE,
  ACCEPTED_FILE_LABELS,
  type StorageEntity,
  type FileValidationResult,
} from "@/lib/utils/file";
import { UploadProgress } from "./UploadProgress";

// ------------------------------------------------------------------------------
// Types
// ------------------------------------------------------------------------------

/** State for a single file in the upload queue. */
interface QueuedFile {
  id: string;
  file: File;
  hash: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  result?: UploadResult;
}

type UploadStatus = "queued" | "hashing" | "uploading" | "processing" | "complete" | "error";

/** Result returned from a successful upload. */
interface UploadResult {
  fileId: string;
  storagePath: string;
  sha256Hash: string;
  signedUrl: string;
  isDuplicate: boolean;
}

/** Props for the UploadDropzone component. */
interface UploadDropzoneProps {
  /** The owning entity for the uploaded files. */
  entity: StorageEntity;
  /** Upload origin — affects metadata tagging. */
  source?: "web" | "mobile";
  /** Maximum number of files per drop (default: 10). */
  maxFiles?: number;
  /** Callback fired when a single file upload completes. */
  onUploadComplete?: (result: UploadResult, file: File) => void;
  /** Callback fired when all queued files have finished. */
  onAllComplete?: (results: UploadResult[]) => void;
  /** Optional CSS class for the container. */
  className?: string;
}

// ------------------------------------------------------------------------------
// Component
// ------------------------------------------------------------------------------

/**
 * Drag-and-drop upload zone with multi-file queue support.
 *
 * @param props - See {@link UploadDropzoneProps}.
 */
export function UploadDropzone({
  entity,
  source = "web",
  maxFiles = 10,
  onUploadComplete,
  onAllComplete,
  className,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);

  // --- Helpers: queue management ---------------------------------------------

  const addToQueue = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setGlobalError(null);

      const newEntries: QueuedFile[] = [];
      const acceptedLabels = ACCEPTED_FILE_LABELS.join(", ");

      Array.from(files).forEach((file) => {
        // Max files check
        if (queue.length + newEntries.length >= maxFiles) {
          setGlobalError(`Maximum ${maxFiles} files allowed per upload.`);
          return;
        }

        // Client-side validation
        const validation = validateFile(file);
        if (!validation.valid) {
          newEntries.push({
            id: crypto.randomUUID(),
            file,
            hash: "",
            status: "error",
            progress: 0,
            error: validation.error ?? "Validation failed",
          });
          return;
        }

        newEntries.push({
          id: crypto.randomUUID(),
          file,
          hash: "",
          status: "queued",
          progress: 0,
        });
      });

      if (newEntries.length === 0) return;

      setQueue((prev) => [...prev, ...newEntries]);

      // Start processing the new items
      void processQueue([...queue, ...newEntries]);
    },
    [queue, maxFiles]
  );

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateItem = useCallback(
    (id: string, updates: Partial<QueuedFile>) => {
      setQueue((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    },
    []
  );

  // --- Upload processing -----------------------------------------------------

  const processQueue = useCallback(
    async (currentQueue: QueuedFile[]) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      const completedResults: UploadResult[] = [];

      try {
        for (let i = 0; i < currentQueue.length; i++) {
          const item = currentQueue[i];
          if (item.status !== "queued" && item.status !== "hashing") continue;

          // Step 1: Compute hash
          updateItem(item.id, { status: "hashing", progress: 10 });
          let hash: string;
          try {
            hash = await computeFileHash(item.file);
          } catch {
            updateItem(item.id, {
              status: "error",
              error: "Failed to compute file hash. Please retry.",
              progress: 0,
            });
            continue;
          }
          updateItem(item.id, { hash, status: "uploading", progress: 20 });

          // Step 2: Upload via API
          const result = await uploadViaApi(item.file, entity, source, hash);

          if (result.success) {
            updateItem(item.id, {
              status: "complete",
              progress: 100,
              result: result.data,
              error: undefined,
            });
            completedResults.push(result.data);
            onUploadComplete?.(result.data, item.file);
          } else {
            updateItem(item.id, {
              status: "error",
              error: result.error,
              progress: 0,
            });
          }
        }
      } finally {
        isProcessingRef.current = false;
        if (completedResults.length > 0) {
          onAllComplete?.(completedResults);
        }
      }
    },
    [entity, source, updateItem, onUploadComplete, onAllComplete]
  );

  // --- Drag & drop handlers --------------------------------------------------

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if leaving the container (not entering a child)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      addToQueue(e.dataTransfer.files);
    },
    [addToQueue]
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addToQueue(e.target.files);
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [addToQueue]
  );

  const handleRetry = useCallback(
    (id: string) => {
      const item = queue.find((q) => q.id === id);
      if (!item) return;

      updateItem(id, { status: "queued", progress: 0, error: undefined });

      // Re-trigger processing
      setTimeout(() => {
        void processQueue(
          queue.map((q) => (q.id === id ? { ...q, status: "queued" as const } : q))
        );
      }, 0);
    },
    [queue, updateItem, processQueue]
  );

  // --- Derived state ---------------------------------------------------------

  const activeCount = queue.filter(
    (q) => q.status === "queued" || q.status === "hashing" || q.status === "uploading"
  ).length;
  const hasActiveUploads = activeCount > 0;

  return (
    <div className={cn("w-full", className)}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="File upload drop zone. Click or drag and drop files here."
        onClick={handleBrowseClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleBrowseClick();
          }
        }}
        className={cn(
          // Base
          "relative w-full rounded-2xl border-2 border-dashed p-8 transition-all duration-200 ease-out cursor-pointer",
          "flex flex-col items-center justify-center gap-4 text-center",
          // Colors (light mode)
          "border-zinc-300 bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-400",
          // Colors (dark mode)
          "dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:bg-zinc-900 dark:hover:border-zinc-600",
          // Dragging state
          isDragging &&
            "border-orange-400 bg-orange-50/50 scale-[1.02] shadow-lg shadow-orange-100 dark:bg-orange-950/20 dark:border-orange-500 dark:shadow-orange-900/20",
          // Focus
          "focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2",
          // Mobile padding
          "sm:p-10"
        )}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/heic,application/pdf"
          onChange={handleFileInputChange}
          className="sr-only"
          aria-hidden="true"
        />

        {/* Icon cluster */}
        <div
          className={cn(
            "flex items-center justify-center gap-3 transition-transform duration-300",
            isDragging && "scale-110"
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 sm:h-14 sm:w-14">
            <Receipt className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
            <FileImage className="h-5 w-5" />
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
            <FileText className="h-5 w-5" />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-1">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 sm:text-base">
            {isDragging ? "Drop files here" : "Drop files here or click to browse"}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
            Accepted: {ACCEPTED_FILE_LABELS.join(", ")} &middot; Max{" "}
            {formatFileSize(MAX_FILE_SIZE)} each &middot; Up to {maxFiles} files
          </p>
        </div>

        {/* Upload icon hint */}
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 transition-all dark:bg-zinc-800",
            isDragging && "bg-orange-100 text-orange-500 dark:bg-orange-900/40 dark:text-orange-400"
          )}
        >
          <Upload className="h-5 w-5" />
        </div>
      </div>

      {/* Global error */}
      {globalError && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{globalError}</span>
          <button
            onClick={() => setGlobalError(null)}
            className="ml-auto rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-900/40"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Upload queue */}
      {queue.length > 0 && (
        <div className="mt-4 space-y-2">
          {/* Queue header */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {hasActiveUploads
                ? `Uploading ${activeCount} file${activeCount > 1 ? "s" : ""}...`
                : "Upload complete"}
            </p>
            {queue.length > 1 && (
              <button
                onClick={() => setQueue([])}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Progress items */}
          <div className="space-y-2">
            {queue.map((item) => (
              <UploadProgress
                key={item.id}
                id={item.id}
                filename={item.file.name}
                size={item.file.size}
                progress={item.progress}
                status={mapStatus(item.status)}
                error={item.error}
                isDuplicate={item.result?.isDuplicate}
                onCancel={
                  item.status === "uploading" || item.status === "queued"
                    ? () => removeFromQueue(item.id)
                    : undefined
                }
                onRetry={
                  item.status === "error"
                    ? () => handleRetry(item.id)
                    : undefined
                }
                onRemove={() => removeFromQueue(item.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------
// Upload via API helper
// ------------------------------------------------------------------------------

interface ApiUploadSuccess {
  success: true;
  data: UploadResult;
}

interface ApiUploadFailure {
  success: false;
  error: string;
}

/**
 * Upload a single file to the API route with progress simulation.
 *
 * In a real implementation, you might use XMLHttpRequest for true
 * progress events. Here we use fetch with simulated incremental progress.
 */
async function uploadViaApi(
  file: File,
  entity: StorageEntity,
  source: "web" | "mobile",
  precomputedHash: string
): Promise<ApiUploadSuccess | ApiUploadFailure> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("entity", entity);
    formData.append("source", source);
    formData.append("hash", precomputedHash);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error:
          errorData.error ??
          `Upload failed with status ${response.status}`,
      };
    }

    const data = await response.json();

    if (!data.success) {
      return { success: false, error: data.error ?? "Upload failed" };
    }

    return {
      success: true,
      data: {
        fileId: data.fileId,
        storagePath: data.storagePath,
        sha256Hash: data.sha256Hash,
        signedUrl: data.signedUrl,
        isDuplicate: data.isDuplicate ?? false,
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Network error. Please check your connection and retry.",
    };
  }
}

// ------------------------------------------------------------------------------
// Status mapper
// ------------------------------------------------------------------------------

function mapStatus(status: UploadStatus): "queued" | "uploading" | "processing" | "complete" | "error" {
  switch (status) {
    case "queued":
      return "queued";
    case "hashing":
      return "uploading";
    case "uploading":
      return "uploading";
    case "processing":
      return "processing";
    case "complete":
      return "complete";
    case "error":
      return "error";
  }
}
