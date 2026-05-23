/**
 * @file app/api/upload/route.ts
 * @description API route for file uploads via multipart/form-data.
 *
 * This route provides an HTTP-based alternative to Server Actions for
 * scenarios where streaming uploads, progress tracking, or direct
 * API access is preferred (e.g., mobile apps, third-party integrations).
 *
 * Features:
 * - Multipart/form-data parsing
 * - File validation (size, type)
 * - SHA-256 deduplication
 * - Supabase Storage upload
 * - Rate limiting (30 uploads/minute per IP)
 * - Structured error responses
 *
 * @see lib/actions/files.ts for the Server Action equivalent.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/types/supabase";
import {
  STORAGE_BUCKET,
  MAX_FILE_SIZE,
  ACCEPTED_MIME_TYPES,
  generateStoragePath,
  getExtensionFromMimeType,
  type StorageEntity,
} from "@/lib/utils/file";

// ------------------------------------------------------------------------------
// Types
// ------------------------------------------------------------------------------

/** JSON response shape for a successful upload. */
interface UploadSuccessResponse {
  success: true;
  fileId: string;
  storagePath: string;
  sha256Hash: string;
  signedUrl: string;
  isDuplicate: boolean;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
}

/** JSON response shape for an error. */
interface UploadErrorResponse {
  success: false;
  error: string;
  code: UploadErrorCode;
  details?: Record<string, unknown>;
}

/** Narrow error codes for client-side handling. */
type UploadErrorCode =
  | "UNAUTHORIZED"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_TYPE"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "STORAGE_ERROR"
  | "DATABASE_ERROR"
  | "INTERNAL_ERROR";

// ------------------------------------------------------------------------------
// Rate Limiting (in-memory — production should use Redis)
// ------------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/** Simple in-memory rate limiter keyed by IP address. */
const rateLimitMap = new Map<string, RateLimitEntry>();

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Check if the given IP has exceeded the upload rate limit.
 *
 * @param ip - The client's IP address.
 * @returns `true` if the request should be rate-limited.
 */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

/**
 * Get remaining requests in the current rate-limit window.
 */
function getRateLimitRemaining(ip: string): number {
  const entry = rateLimitMap.get(ip);
  if (!entry) return RATE_LIMIT_MAX;
  return Math.max(0, RATE_LIMIT_MAX - entry.count);
}

// ------------------------------------------------------------------------------
// Supabase Client (for API route context)
// ------------------------------------------------------------------------------

function createClient(request: NextRequest) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set() {
          // Not setting cookies in API route
        },
        remove() {
          // Not removing cookies in API route
        },
      },
    }
  );
}

// ------------------------------------------------------------------------------
// POST Handler
// ------------------------------------------------------------------------------

/**
 * Handle multipart file upload.
 *
 * Expected form fields:
 * - `file`       : The file blob (required)
 * - `entity`     : "personal" | "jk-zentra" (required)
 * - `source`     : "web" | "mobile" (optional, default "web")
 * - `idempotencyKey`: Optional deduplication key
 *
 * Response: JSON with uploaded file metadata and a signed URL.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<UploadSuccessResponse | UploadErrorResponse>> {
  const startTime = Date.now();

  // --- 1. Rate limiting -------------------------------------------------------
  const clientIp =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";

  // Use first IP if x-forwarded-for contains multiple
  const ip = clientIp.split(",")[0]?.trim() ?? clientIp;

  if (isRateLimited(ip)) {
    return NextResponse.json(
      {
        success: false,
        error: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX} uploads per minute.`,
        code: "RATE_LIMITED",
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": "0",
          "Retry-After": String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)),
        },
      }
    );
  }

  try {
    // --- 2. Parse multipart form data -----------------------------------------
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid form data. Expected multipart/form-data.",
          code: "VALIDATION_FAILED",
        },
        { status: 400 }
      );
    }

    // --- 3. Extract and validate fields ---------------------------------------
    const file = formData.get("file");
    const entity = formData.get("entity");
    const source = formData.get("source") ?? "web";
    const idempotencyKey = formData.get("idempotencyKey")?.toString() ?? undefined;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required field: 'file' must be a File.",
          code: "VALIDATION_FAILED",
        },
        { status: 400 }
      );
    }

    if (!entity || (entity !== "personal" && entity !== "jk-zentra")) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid entity "${entity}". Must be "personal" or "jk-zentra".`,
          code: "VALIDATION_FAILED",
        },
        { status: 400 }
      );
    }

    // --- 4. File size validation ----------------------------------------------
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File size ${formatBytes(file.size)} exceeds the ${formatBytes(
            MAX_FILE_SIZE
          )} limit.`,
          code: "FILE_TOO_LARGE",
          details: { maxSize: MAX_FILE_SIZE, receivedSize: file.size },
        },
        { status: 413 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "File is empty (0 bytes).",
          code: "VALIDATION_FAILED",
        },
        { status: 400 }
      );
    }

    // --- 5. MIME type validation ----------------------------------------------
    if (
      !ACCEPTED_MIME_TYPES.includes(
        file.type as (typeof ACCEPTED_MIME_TYPES)[number]
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type "${file.type}". Accepted: ${ACCEPTED_MIME_TYPES.join(", ")}.`,
          code: "UNSUPPORTED_TYPE",
          details: { receivedType: file.type, acceptedTypes: ACCEPTED_MIME_TYPES },
        },
        { status: 415 }
      );
    }

    // --- 6. Authenticate with Supabase ----------------------------------------
    const supabase = createClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Valid session required.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    // --- 7. Compute SHA-256 hash ----------------------------------------------
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha256Hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // --- 8. Duplicate check ---------------------------------------------------
    const { data: existingFile } = await supabase
      .from("files")
      .select("id, storage_path")
      .eq("sha256_hash", sha256Hash)
      .eq("status", "active")
      .is("deleted_at", null)
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      )
      .maybeSingle();

    if (existingFile) {
      const { data: signedData } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(existingFile.storage_path, 300);

      // Audit log
      await supabase.from("audit_log").insert({
        actor_id: user.id,
        action: "DUPLICATE_DETECTED",
        target_type: "file",
        target_id: existingFile.id,
        details: {
          method: "api",
          original_filename: file.name,
          sha256_hash: sha256Hash,
        },
      });

      return NextResponse.json({
        success: true,
        fileId: existingFile.id,
        storagePath: existingFile.storage_path,
        sha256Hash,
        signedUrl: signedData?.signedUrl ?? "",
        isDuplicate: true,
        originalFilename: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
    }

    // --- 9. Generate storage path and upload ----------------------------------
    const storagePath = generateStoragePath(entity as StorageEntity, file.name);

    // Re-construct file from arrayBuffer for upload
    const fileBlob = new Blob([arrayBuffer], { type: file.type });

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBlob, {
        contentType: file.type,
        upsert: false,
        cacheControl: "3600",
      });

    if (uploadError) {
      // Attempt cleanup
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return NextResponse.json(
        {
          success: false,
          error: `Storage upload failed: ${uploadError.message}`,
          code: "STORAGE_ERROR",
        },
        { status: 502 }
      );
    }

    // --- 10. Insert database row ----------------------------------------------
    const { data: insertedFile, error: insertError } = await supabase
      .from("files")
      .insert({
        original_filename: file.name,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type,
        sha256_hash: sha256Hash,
        entity,
        source: source.toString(),
        status: "active",
        deleted_at: null,
        uploaded_by: user.id,
        idempotency_key: idempotencyKey ?? null,
      })
      .select("id, storage_path")
      .single();

    if (insertError || !insertedFile) {
      // Rollback storage upload
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return NextResponse.json(
        {
          success: false,
          error: `Database insert failed: ${insertError?.message ?? "Unknown error"}`,
          code: "DATABASE_ERROR",
        },
        { status: 500 }
      );
    }

    // --- 11. Audit log --------------------------------------------------------
    await supabase.from("audit_log").insert({
      actor_id: user.id,
      action: "FILE_UPLOADED",
      target_type: "file",
      target_id: insertedFile.id,
      details: {
        method: "api",
        original_filename: file.name,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type,
        sha256_hash: sha256Hash,
        entity,
        source: source.toString(),
        duration_ms: Date.now() - startTime,
      },
    });

    // --- 12. Generate signed URL ----------------------------------------------
    const { data: signedData } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 300);

    // --- 13. Response ---------------------------------------------------------
    return NextResponse.json(
      {
        success: true,
        fileId: insertedFile.id,
        storagePath,
        sha256Hash,
        signedUrl: signedData?.signedUrl ?? "",
        isDuplicate: false,
        originalFilename: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
      {
        status: 201,
        headers: {
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": String(getRateLimitRemaining(ip)),
        },
      }
    );
  } catch (error) {
    console.error("[Upload API] Unexpected error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred during upload.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

// ------------------------------------------------------------------------------
// GET Handler (for health check / CORS preflight info)
// ------------------------------------------------------------------------------

/**
 * GET handler returns upload configuration and accepted parameters.
 * Useful for clients to discover upload constraints before sending files.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    bucket: STORAGE_BUCKET,
    maxFileSize: MAX_FILE_SIZE,
    maxFileSizeHuman: formatBytes(MAX_FILE_SIZE),
    acceptedMimeTypes: ACCEPTED_MIME_TYPES,
    acceptedExtensions: ACCEPTED_MIME_TYPES.map(getExtensionFromMimeType),
    rateLimit: {
      max: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_MS / 1000,
    },
    signedUrlExpirySeconds: 300,
    endpoints: {
      upload: {
        method: "POST",
        contentType: "multipart/form-data",
        fields: {
          file: "required — the file blob",
          entity: 'required — "personal" | "jk-zentra"',
          source: 'optional — "web" | "mobile" (default: "web")',
          idempotencyKey: "optional — client-generated dedup key",
        },
      },
    },
  });
}

// ------------------------------------------------------------------------------
// OPTIONS Handler (CORS preflight)
// ------------------------------------------------------------------------------

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

// ------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}
