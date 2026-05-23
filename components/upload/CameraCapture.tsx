"use client";

/**
 * @file components/upload/CameraCapture.tsx
 * @description Camera capture component optimized for mobile receipt photography.
 *
 * Features:
 * - One-tap camera activation via `<input capture="environment">`
 * - Post-capture preview with "Use this photo" / "Retake" flow
 * - Automatic image compression for mobile bandwidth
 * - Same upload pipeline as {@link UploadDropzone}
 * - Upload progress integration
 * - Mobile-first responsive design
 *
 * @example
 * ```tsx
 * <CameraCapture entity="jk-zentra" onUploadComplete={handleComplete} />
 * ```
 */

import { useCallback, useRef, useState } from "react";
import { Camera, RotateCcw, Check, X, Smartphone, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computeFileHash,
  validateFile,
  formatFileSize,
  MAX_FILE_SIZE,
  type StorageEntity,
} from "@/lib/utils/file";
import { UploadProgress } from "./UploadProgress";

// ------------------------------------------------------------------------------
// Types
// ------------------------------------------------------------------------------

/** Result returned from a successful upload. */
interface UploadResult {
  fileId: string;
  storagePath: string;
  sha256Hash: string;
  signedUrl: string;
  isDuplicate: boolean;
}

/** Props for the CameraCapture component. */
interface CameraCaptureProps {
  /** The owning entity for the uploaded photo. */
  entity: StorageEntity;
  /** Upload origin. */
  source?: "web" | "mobile";
  /** Callback fired when upload completes successfully. */
  onUploadComplete?: (result: UploadResult, file: File) => void;
  /** Callback fired when the user cancels. */
  onCancel?: () => void;
  /** Optional CSS class. */
  className?: string;
}

/** Internal phase of the camera capture flow. */
type CapturePhase = "ready" | "preview" | "hashing" | "uploading" | "complete" | "error";

// ------------------------------------------------------------------------------
// Component
// ------------------------------------------------------------------------------

/**
 * Mobile-optimized camera capture with preview and upload.
 *
 * @param props - See {@link CameraCaptureProps}.
 */
export function CameraCapture({
  entity,
  source = "web",
  onUploadComplete,
  onCancel,
  className,
}: CameraCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<CapturePhase>("ready");
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // --- Camera activation -----------------------------------------------------

  const handleOpenCamera = useCallback(() => {
    setError(null);
    setUploadResult(null);
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset input
      e.target.value = "";

      // Validate
      const validation = validateFile(file);
      if (!validation.valid) {
        setError(validation.error ?? "Invalid file");
        setPhase("error");
        return;
      }

      // Compress if it's a large image
      setIsCompressing(true);
      const processedFile = await compressImageIfNeeded(file);
      setIsCompressing(false);

      // Create preview
      const objectUrl = URL.createObjectURL(processedFile);
      setPreviewUrl(objectUrl);
      setCapturedFile(processedFile);
      setPhase("preview");
    },
    []
  );

  // --- Preview actions -------------------------------------------------------

  const handleRetake = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setCapturedFile(null);
    setError(null);
    setUploadResult(null);
    setPhase("ready");
  }, [previewUrl]);

  const handleUsePhoto = useCallback(async () => {
    if (!capturedFile) return;

    setPhase("hashing");
    setProgress(10);

    try {
      // Compute hash
      const hash = await computeFileHash(capturedFile);
      setProgress(30);

      // Upload
      setPhase("uploading");
      setProgress(40);

      const result = await uploadPhoto(capturedFile, entity, source, hash);

      if (result.success) {
        setUploadResult(result.data);
        setPhase("complete");
        setProgress(100);
        onUploadComplete?.(result.data, capturedFile);
      } else {
        setError(result.error);
        setPhase("error");
        setProgress(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPhase("error");
      setProgress(0);
    }
  }, [capturedFile, entity, source, onUploadComplete]);

  // --- Cleanup ---------------------------------------------------------------

  const handleDismiss = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setCapturedFile(null);
    setError(null);
    setUploadResult(null);
    setPhase("ready");
    setProgress(0);
    onCancel?.();
  }, [previewUrl, onCancel]);

  // ------------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------------

  return (
    <div className={cn("w-full", className)}>
      {/* Hidden camera input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelected}
        className="sr-only"
        aria-hidden="true"
      />

      {/* === PHASE: Ready === */}
      {phase === "ready" && (
        <button
          onClick={handleOpenCamera}
          disabled={isCompressing}
          className={cn(
            "group flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 transition-all duration-200",
            "border-zinc-300 bg-zinc-50/50 hover:border-orange-400 hover:bg-orange-50/50",
            "dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:border-orange-500 dark:hover:bg-orange-950/20",
            "focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2",
            "sm:p-8"
          )}
        >
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600 transition-transform group-hover:scale-110",
              "dark:bg-orange-900/40 dark:text-orange-400"
            )}
          >
            {isCompressing ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Camera className="h-6 w-6" />
            )}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 sm:text-base">
              {isCompressing ? "Processing..." : "Snap receipt"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Take a photo with your camera
            </p>
          </div>
          <Smartphone className="ml-auto h-5 w-5 text-zinc-300 dark:text-zinc-600" />
        </button>
      )}

      {/* === PHASE: Preview === */}
      {phase === "preview" && capturedFile && previewUrl && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          {/* Preview image */}
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-100 sm:aspect-[4/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Captured receipt preview"
              className="h-full w-full object-contain"
            />
            {/* File info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
              <p className="text-sm font-medium text-white">
                {capturedFile.name}
              </p>
              <p className="text-xs text-white/80">
                {formatFileSize(capturedFile.size)}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 p-4">
            <button
              onClick={handleRetake}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors",
                "hover:bg-zinc-50 hover:border-zinc-300",
                "dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:border-zinc-500",
                "focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2"
              )}
            >
              <RotateCcw className="h-4 w-4" />
              Retake
            </button>
            <button
              onClick={handleUsePhoto}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-medium text-white transition-colors",
                "hover:bg-orange-600 active:bg-orange-700",
                "dark:bg-orange-600 dark:hover:bg-orange-500",
                "focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
              )}
            >
              <Check className="h-4 w-4" />
              Use this photo
            </button>
          </div>
        </div>
      )}

      {/* === PHASE: Hashing / Uploading === */}
      {(phase === "hashing" || phase === "uploading") && capturedFile && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <UploadProgress
            id="camera-upload"
            filename={capturedFile.name}
            size={capturedFile.size}
            progress={progress}
            status={phase === "hashing" ? "uploading" : "uploading"}
            onCancel={handleRetake}
          />
        </div>
      )}

      {/* === PHASE: Complete === */}
      {phase === "complete" && uploadResult && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-950/30">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400">
              <Check className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                {uploadResult.isDuplicate
                  ? "Duplicate receipt detected"
                  : "Receipt uploaded successfully"}
              </p>
              <p className="mt-1 text-xs text-green-700 dark:text-green-400">
                {uploadResult.isDuplicate
                  ? "This file already exists in the system."
                  : "Your receipt is being processed."}
              </p>
              {uploadResult.signedUrl && (
                <a
                  href={uploadResult.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-green-600 underline hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                >
                  View receipt
                </a>
              )}
            </div>
            <button
              onClick={handleDismiss}
              className="rounded p-1 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/40"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick action: snap another */}
          <button
            onClick={handleRetake}
            className={cn(
              "mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-green-300 px-4 py-2.5 text-sm font-medium text-green-700 transition-colors",
              "hover:bg-green-100",
              "dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/40"
            )}
          >
            <Camera className="h-4 w-4" />
            Snap another receipt
          </button>
        </div>
      )}

      {/* === PHASE: Error === */}
      {phase === "error" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-800 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
              <X className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                Upload failed
              </p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                {error ?? "An unexpected error occurred."}
              </p>
            </div>
          </div>

          {/* Retry actions */}
          <div className="mt-4 flex gap-3">
            {capturedFile && (
              <button
                onClick={handleUsePhoto}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-colors",
                  "hover:bg-red-600"
                )}
              >
                <RotateCcw className="h-4 w-4" />
                Retry
              </button>
            )}
            <button
              onClick={handleRetake}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700",
                "hover:bg-zinc-50",
                "dark:border-zinc-600 dark:text-zinc-300"
              )}
            >
              <Camera className="h-4 w-4" />
              New photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------
// Image compression utility
// ------------------------------------------------------------------------------

/**
 * Compress an image file if it exceeds a threshold.
 * Uses canvas-based JPEG compression for mobile optimization.
 *
 * @param file       - The original image file.
 * @param maxWidth   - Maximum width in pixels (default: 1920).
 * @param quality    - JPEG quality 0-1 (default: 0.85).
 * @param threshold  - Size threshold in bytes above which to compress (default: 1MB).
 * @returns A potentially compressed File.
 */
async function compressImageIfNeeded(
  file: File,
  maxWidth: number = 1920,
  quality: number = 0.85,
  threshold: number = 1024 * 1024
): Promise<File> {
  // Only compress images, and only if above threshold
  if (!file.type.startsWith("image/") || file.size <= threshold) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate new dimensions
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      // Draw to canvas
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(file); // Fallback: return original
        return;
      }

      // Handle EXIF orientation (basic)
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file); // Fallback
            return;
          }
          const compressed = new File([blob], file.name, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          resolve(compressed);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // Fallback to original on error
    };

    img.src = url;
  });
}

// ------------------------------------------------------------------------------
// Upload helper
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
 * Upload a captured photo to the server.
 */
async function uploadPhoto(
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
        error: errorData.error ?? `Upload failed (${response.status})`,
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
          : "Network error. Please check your connection.",
    };
  }
}
