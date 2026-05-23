"use client";

/**
 * @file components/upload/UploadProgress.tsx
 * @description Reusable upload progress indicator for the JK Zentra Finance Cockpit.
 *
 * Displays per-file upload state with:
 * - Animated progress bar during upload
 * - Spinner during processing
 * - Checkmark on completion
 * - Error state with retry action
 * - Cancel button during active upload
 * - Duplicate detection badge
 *
 * Used by {@link UploadDropzone} and {@link CameraCapture}.
 *
 * @example
 * ```tsx
 * <UploadProgress
 *   id="file-1"
 *   filename="receipt.jpg"
 *   size={245678}
 *   progress={65}
 *   status="uploading"
 *   onCancel={() => abortUpload("file-1")}
 * />
 * ```
 */

import { useCallback } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  FileImage,
  FileText,
  Clock,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize, getFileIconType } from "@/lib/utils/file";

// ------------------------------------------------------------------------------
// Types
// ------------------------------------------------------------------------------

/** Visual state of the upload progress item. */
export type ProgressStatus =
  | "queued"
  | "uploading"
  | "processing"
  | "complete"
  | "error";

/** Props for the UploadProgress component. */
export interface UploadProgressProps {
  /** Unique identifier for this upload item. */
  id: string;
  /** Original filename being uploaded. */
  filename: string;
  /** File size in bytes. */
  size: number;
  /** Upload progress percentage (0–100). */
  progress: number;
  /** Current visual status. */
  status: ProgressStatus;
  /** Error message when status is "error". */
  error?: string;
  /** Whether this file was detected as a duplicate. */
  isDuplicate?: boolean;
  /** Called when the user clicks cancel during an active upload. */
  onCancel?: () => void;
  /** Called when the user clicks retry after an error. */
  onRetry?: () => void;
  /** Called when the user removes this item from the queue. */
  onRemove?: () => void;
}

// ------------------------------------------------------------------------------
// Component
// ------------------------------------------------------------------------------

/**
 * Reusable upload progress indicator showing file name, size, progress,
 * and action buttons for cancel / retry / remove.
 *
 * @param props - See {@link UploadProgressProps}.
 */
export function UploadProgress({
  id,
  filename,
  size,
  progress,
  status,
  error,
  isDuplicate,
  onCancel,
  onRetry,
  onRemove,
}: UploadProgressProps) {
  const iconType = getFileIconTypeFromFilename(filename);
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  // --- Icon renderer ---------------------------------------------------------

  const StatusIcon = useCallback(() => {
    switch (status) {
      case "complete":
        return (
          <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-400" />
        );
      case "error":
        return (
          <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
        );
      case "processing":
        return (
          <Loader2 className="h-5 w-5 animate-spin text-orange-500 dark:text-orange-400" />
        );
      case "uploading":
        return (
          <Loader2 className="h-5 w-5 animate-spin text-blue-500 dark:text-blue-400" />
        );
      case "queued":
      default:
        return (
          <Clock className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
        );
    }
  }, [status]);

  // --- Progress bar color ----------------------------------------------------

  const progressBarColor = (() => {
    switch (status) {
      case "complete":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "processing":
        return "bg-orange-500";
      case "uploading":
        return "bg-blue-500";
      default:
        return "bg-zinc-300 dark:bg-zinc-600";
    }
  })();

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-3 transition-all duration-200",
        "bg-white dark:bg-zinc-900",
        status === "error" && "border-red-200 dark:border-red-800",
        status === "complete" && "border-green-200 dark:border-green-800",
        status !== "error" &&
          status !== "complete" &&
          "border-zinc-200 dark:border-zinc-700"
      )}
    >
      {/* Duplicate badge */}
      {isDuplicate && (
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
          <Copy className="h-3 w-3" />
          Duplicate
        </div>
      )}

      {/* Main row */}
      <div className="flex items-center gap-3">
        {/* File type icon */}
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            iconType === "image" &&
              "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
            iconType === "pdf" &&
              "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
            iconType === "generic" &&
              "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          )}
        >
          {iconType === "image" && <FileImage className="h-4 w-4" />}
          {iconType === "pdf" && <FileText className="h-4 w-4" />}
          {iconType === "generic" && <FileText className="h-4 w-4" />}
        </div>

        {/* File info */}
        <div className="min-w-0 flex-1">
          {/* Filename + size */}
          <div className="flex items-center gap-2">
            <p
              className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200"
              title={filename}
            >
              {filename}
            </p>
            <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
              {formatFileSize(size)}
            </span>
          </div>

          {/* Progress bar (active states) */}
          {status === "uploading" && (
            <div className="mt-2">
              <div className="flex items-center justify-between gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300 ease-out",
                      progressBarColor
                    )}
                    style={{ width: `${clampedProgress}%` }}
                  />
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                  {Math.round(clampedProgress)}%
                </span>
              </div>
            </div>
          )}

          {/* Status text */}
          {status === "processing" && (
            <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
              Processing receipt...
            </p>
          )}
          {status === "queued" && (
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Waiting to upload...
            </p>
          )}
          {status === "complete" && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
              Upload complete
            </p>
          )}
          {status === "error" && error && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Status icon */}
        <div className="shrink-0">
          <StatusIcon />
        </div>

        {/* Action buttons */}
        <div className="shrink-0">
          {/* Cancel during upload */}
          {(status === "uploading" || status === "queued") && onCancel && (
            <button
              onClick={onCancel}
              className={cn(
                "rounded-lg p-1.5 text-zinc-400 transition-colors",
                "hover:bg-red-50 hover:text-red-500",
                "dark:hover:bg-red-950/30 dark:hover:text-red-400",
                "focus:outline-none focus:ring-2 focus:ring-red-400"
              )}
              aria-label="Cancel upload"
              title="Cancel upload"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Retry on error */}
          {status === "error" && onRetry && (
            <button
              onClick={onRetry}
              className={cn(
                "rounded-lg p-1.5 text-zinc-400 transition-colors",
                "hover:bg-orange-50 hover:text-orange-500",
                "dark:hover:bg-orange-950/30 dark:hover:text-orange-400",
                "focus:outline-none focus:ring-2 focus:ring-orange-400"
              )}
              aria-label="Retry upload"
              title="Retry upload"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}

          {/* Remove completed / error */}
          {(status === "complete" || status === "error") && onRemove && (
            <button
              onClick={onRemove}
              className={cn(
                "rounded-lg p-1.5 text-zinc-400 transition-colors",
                "hover:bg-zinc-100 hover:text-zinc-600",
                "dark:hover:bg-zinc-800 dark:hover:text-zinc-300",
                "focus:outline-none focus:ring-2 focus:ring-zinc-400"
              )}
              aria-label="Remove from list"
              title="Remove from list"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------

/**
 * Infer a file icon type from a filename based on its extension.
 *
 * @param filename - The full filename.
 * @returns An icon category: "image", "pdf", or "generic".
 */
function getFileIconTypeFromFilename(
  filename: string
): "image" | "pdf" | "generic" {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "heic", "gif", "webp"].includes(ext ?? "")) {
    return "image";
  }
  if (ext === "pdf") return "pdf";
  return "generic";
}
