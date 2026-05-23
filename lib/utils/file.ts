/**
 * @file lib/utils/file.ts
 * @description File utilities for the JK Zentra Finance Cockpit.
 * Provides SHA-256 hashing, structured storage path generation,
 * file validation, MIME type handling, and size formatting.
 *
 * All operations are pure functions with no side effects.
 */

// ------------------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------------------

/** Maximum allowed file size in bytes (10 MB). */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Accepted MIME types for upload. */
export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "application/pdf",
] as const;

/** Human-readable labels for accepted file types. */
export const ACCEPTED_FILE_LABELS = ["JPG", "PNG", "HEIC", "PDF"] as const;

/** Private Supabase Storage bucket name for receipts. */
export const STORAGE_BUCKET = "receipts" as const;

/** Entity slug used in storage path segments. */
export type StorageEntity = "personal" | "jk-zentra";

// ------------------------------------------------------------------------------
// SHA-256 Hashing
// ------------------------------------------------------------------------------

/**
 * Compute the SHA-256 hash of a File's byte contents.
 * Uses the Web Crypto API so it can run in both browser and edge contexts.
 *
 * @param file - The file to hash.
 * @returns A hex-encoded SHA-256 string (64 characters).
 * @throws If the Web Crypto API is unavailable or the file cannot be read.
 *
 * @example
 * ```ts
 * const hash = await computeFileHash(file);
 * // "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * ```
 */
export async function computeFileHash(file: File): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error(
      "Web Crypto API is not available in this environment. " +
        "SHA-256 hashing requires a secure context (HTTPS or localhost)."
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (cause) {
    throw new Error(
      `Failed to compute SHA-256 hash for file "${file.name}".`,
      { cause }
    );
  }
}

// ------------------------------------------------------------------------------
// Storage Path Generation
// ------------------------------------------------------------------------------

/**
 * Generate a structured storage path for Supabase Storage.
 *
 * Format: `/{entity}/{YYYY}/{MM}/{uuid}_{sanitizedFilename}`
 *
 * @param entity - The owning entity ("personal" or "jk-zentra").
 * @param originalFilename - The original file name (e.g. "receipt.jpg").
 * @returns A normalized storage path string.
 *
 * @example
 * ```ts
 * generateStoragePath("jk-zentra", "receipt.jpg");
 * // "jk-zentra/2026/05/a1b2c3d4-e5f6-7890-abcd-ef1234567890_receipt.jpg"
 * ```
 */
export function generateStoragePath(
  entity: StorageEntity,
  originalFilename: string
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const uuid = crypto.randomUUID();
  const sanitized = sanitizeFilename(originalFilename);

  return `${entity}/${year}/${month}/${uuid}_${sanitized}`;
}

/**
 * Generate a display-friendly filename from transaction metadata.
 *
 * @param vendor     - Vendor / merchant name.
 * @param amount     - Transaction amount.
 * @param currency   - Currency code (e.g. "USD", "EUR").
 * @param date       - ISO date string (e.g. "2026-05-22").
 * @param ext        - File extension without dot (e.g. "pdf").
 * @returns A formatted filename like `"2026-05-22_anthropic_2000USD.pdf"`.
 */
export function generateDisplayFilename(
  vendor: string,
  amount: number,
  currency: string,
  date: string,
  ext: string
): string {
  const safeVendor = vendor.replace(/[^a-zA-Z0-9\u00C0-\u024F_-]/g, "_");
  const safeAmount = amount.toFixed(2).replace(/\./g, "_");
  const safeDate = date.replace(/\//g, "-");
  const safeExt = ext.replace(/^\./, "");

  return `${safeDate}_${safeVendor}_${safeAmount}${currency}.${safeExt}`;
}

// ------------------------------------------------------------------------------
// File Validation
// ------------------------------------------------------------------------------

/** Result shape returned by {@link validateFile}. */
export interface FileValidationResult {
  /** Whether the file passed all validation checks. */
  valid: boolean;
  /** Human-readable error message when `valid` is `false`. */
  error?: string;
  /** Detected MIME type of the file. */
  mimeType?: string;
  /** Detected file extension. */
  extension?: string;
  /** File size in bytes. */
  size?: number;
}

/**
 * Validate a file against JK Zentra upload rules.
 *
 * Checks:
 * - File size <= 10 MB
 * - MIME type in the allowed whitelist
 *
 * @param file - The file to validate.
 * @returns A {@link FileValidationResult} describing the outcome.
 *
 * @example
 * ```ts
 * const result = validateFile(file);
 * if (!result.valid) {
 *   toast.error(result.error);
 * }
 * ```
 */
export function validateFile(file: File): FileValidationResult {
  // Size check
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File "${file.name}" is ${formatFileSize(
        file.size
      )}, which exceeds the ${formatFileSize(MAX_FILE_SIZE)} limit.`,
      size: file.size,
    };
  }

  // Empty file check
  if (file.size === 0) {
    return {
      valid: false,
      error: `File "${file.name}" is empty (0 bytes).`,
      size: 0,
    };
  }

  // MIME type check
  const mimeType = file.type;
  if (!ACCEPTED_MIME_TYPES.includes(mimeType as (typeof ACCEPTED_MIME_TYPES)[number])) {
    const accepted = ACCEPTED_FILE_LABELS.join(", ");
    return {
      valid: false,
      error: `File type "${mimeType}" is not supported. Accepted types: ${accepted}.`,
      mimeType,
      size: file.size,
    };
  }

  return {
    valid: true,
    mimeType,
    extension: getExtensionFromMimeType(mimeType),
    size: file.size,
  };
}

// ------------------------------------------------------------------------------
// MIME Type Helpers
// ------------------------------------------------------------------------------

/**
 * Map a MIME type to its canonical file extension.
 *
 * @param mimeType - A standard MIME type string.
 * @returns The file extension without the leading dot (e.g. `"jpg"`, `"pdf"`).
 *          Falls back to `"bin"` for unknown types.
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/heic": "heic",
    "application/pdf": "pdf",
  };
  return map[mimeType] ?? "bin";
}

/**
 * Map a file extension back to its canonical MIME type.
 *
 * @param ext - File extension without the dot (e.g. `"jpg"`).
 * @returns The MIME type or `"application/octet-stream"` as fallback.
 */
export function getMimeTypeFromExtension(ext: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    heic: "image/heic",
    pdf: "application/pdf",
  };
  return map[ext.toLowerCase()] ?? "application/octet-stream";
}

// ------------------------------------------------------------------------------
// Display Helpers
// ------------------------------------------------------------------------------

/**
 * Format a byte count into a human-readable string.
 *
 * @param bytes - Number of bytes.
 * @returns Formatted string like `"245 KB"` or `"1.2 MB"`.
 *
 * @example
 * ```ts
 * formatFileSize(1234567); // "1.2 MB"
 * formatFileSize(512);     // "512 B"
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);

  const value = bytes / Math.pow(k, i);
  const decimals = i === 0 ? 0 : 1;

  return `${value.toFixed(decimals)} ${units[i]}`;
}

/**
 * Get an appropriate icon identifier for a given MIME type.
 * Useful for rendering file-type icons in the UI.
 *
 * @param mimeType - The file's MIME type.
 * @returns An icon identifier string ("image", "pdf", or "generic").
 */
export function getFileIconType(mimeType: string): "image" | "pdf" | "generic" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return "generic";
}

// ------------------------------------------------------------------------------
// Internal Helpers
// ------------------------------------------------------------------------------

/**
 * Sanitize a filename for safe use in storage paths.
 * Removes path traversal characters, control characters, and
 * replaces spaces with underscores.
 *
 * @param filename - The original filename.
 * @returns A sanitized filename safe for use in object storage.
 */
function sanitizeFilename(filename: string): string {
  return (
    filename
      // Remove path traversal
      .replace(/\\/g, "_")
      .replace(/\//g, "_")
      // Remove control characters
      .replace(/[\x00-\x1f\x7f]/g, "")
      // Collapse multiple spaces/underscores
      .replace(/\s+/g, "_")
      // Trim
      .trim()
  );
}

/**
 * Extract the base name (without extension) from a filename.
 *
 * @param filename - The full filename.
 * @returns The filename without its extension.
 */
export function getBaseName(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot === -1 ? filename : filename.slice(0, lastDot);
}

/**
 * Extract the file extension from a filename.
 *
 * @param filename - The full filename.
 * @returns The extension without the leading dot, lowercase.
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot === -1 ? "" : filename.slice(lastDot + 1).toLowerCase();
}
