"use server";

/**
 * @file lib/actions/files.ts
 * @description Server actions for file management in the JK Zentra Finance Cockpit.
 *
 * All functions run on the server and interact with Supabase Storage
 * and the PostgreSQL database. Every exported function includes:
 * - Full input validation
 * - Row-level security (RLS) via the Supabase server client
 * - Audit logging for mutating operations
 * - Structured error responses
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/types/supabase";
import {
  STORAGE_BUCKET,
  generateStoragePath,
  validateFile,
  type StorageEntity,
} from "@/lib/utils/file";

// ------------------------------------------------------------------------------
// Types
// ------------------------------------------------------------------------------

/** A file record as stored in the `files` table. */
export interface FileRecord {
  id: string;
  original_filename: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  sha256_hash: string;
  entity: string;
  source: string;
  status: "active" | "discarded";
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  uploaded_by: string | null;
  idempotency_key: string | null;
}

/** An extraction record linked to a file. */
export interface Extraction {
  id: string;
  file_id: string;
  vendor_name: string | null;
  amount: number | null;
  currency: string | null;
  transaction_date: string | null;
  extracted_data: Record<string, unknown> | null;
  confidence: number | null;
  status: string;
  created_at: string;
}

/** A transaction record linked to a file. */
export interface Transaction {
  id: string;
  file_id: string;
  vendor_name: string | null;
  amount: number | null;
  currency: string | null;
  transaction_date: string | null;
  category: string | null;
  status: string;
  created_at: string;
}

/** Result of a successful upload operation. */
export interface UploadResult {
  fileId: string;
  storagePath: string;
  sha256Hash: string;
  signedUrl: string;
  isDuplicate: boolean;
  existingTransactionId?: string;
}

/** Result of a signed URL request. */
export interface SignedUrlResult {
  signedUrl: string;
  expiresAt: Date;
}

/** Parameters for listing files. */
export interface ListFilesParams {
  entity?: string;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

/** Paginated list response. */
export interface ListFilesResult {
  files: FileRecord[];
  total: number;
}

/** Detailed file lookup response. */
export interface FileDetailResult {
  file: FileRecord;
  extraction?: Extraction;
  linkedTransaction?: Transaction;
}

// ------------------------------------------------------------------------------
// Supabase Server Client
// ------------------------------------------------------------------------------

/**
 * Create a Supabase server client bound to the current request's cookie store.
 * This client respects Row-Level Security (RLS) policies based on the
 * authenticated user's JWT.
 */
function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Cookie can't be set in a Server Component — safe to ignore
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Cookie can't be removed in a Server Component — safe to ignore
          }
        },
      },
    }
  );
}

// ------------------------------------------------------------------------------
// Upload
// ------------------------------------------------------------------------------

/**
 * Upload a file to Supabase Storage and create a corresponding `files` row.
 *
 * Flow:
 * 1. Validate inputs
 * 2. Compute SHA-256 hash (or accept pre-computed hash from client)
 * 3. Check for duplicate (same hash within 24h)
 * 4. Generate structured storage path
 * 5. Upload bytes to Supabase Storage
 * 6. Insert `files` row (or return existing if duplicate)
 * 7. Create audit log entry
 * 8. Generate signed URL for immediate access
 * 9. Return result with metadata
 *
 * @param file              - The file to upload (Next.js 15 Server Action can receive File objects).
 * @param entity            - The owning entity ("personal" or "jk-zentra").
 * @param source            - Where the upload originated ("web" or "mobile").
 * @param idempotencyKey    - Optional client-generated key for deduplication across retries.
 * @param precomputedHash   - Optional SHA-256 hash computed client-side to avoid re-reading bytes.
 * @returns {@link UploadResult} with file metadata and a short-lived signed URL.
 * @throws On validation failure, storage error, or database error.
 */
export async function uploadFile(
  file: File,
  entity: StorageEntity,
  source: "web" | "mobile" = "web",
  idempotencyKey?: string,
  precomputedHash?: string
): Promise<UploadResult> {
  const supabase = createClient();

  // --- 1. Authenticate --------------------------------------------------------
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: You must be signed in to upload files.");
  }

  // --- 2. Validate file -------------------------------------------------------
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error ?? "File validation failed.");
  }

  // Validate entity
  if (!entity || (entity !== "personal" && entity !== "jk-zentra")) {
    throw new Error(
      `Invalid entity "${entity}". Must be "personal" or "jk-zentra".`
    );
  }

  // --- 3. Compute or use precomputed hash ------------------------------------
  let sha256Hash: string;
  try {
    sha256Hash =
      precomputedHash ??
      (await computeHashFromFile(file));
  } catch (cause) {
    throw new Error("Failed to compute SHA-256 hash for the file.", {
      cause,
    });
  }

  // --- 4. Idempotency check (24h window) -------------------------------------
  if (idempotencyKey) {
    const { data: existingIdempotent } = await supabase
      .from("files")
      .select("id, storage_path, status, deleted_at")
      .eq("idempotency_key", idempotencyKey)
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      )
      .maybeSingle();

    if (existingIdempotent && existingIdempotent.status === "active") {
      // Existing active file — return signed URL for it
      const { data: signedUrlData } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(existingIdempotent.storage_path, 300);

      return {
        fileId: existingIdempotent.id,
        storagePath: existingIdempotent.storage_path,
        sha256Hash,
        signedUrl: signedUrlData?.signedUrl ?? "",
        isDuplicate: true,
      };
    }
  }

  // --- 5. Duplicate check (same hash, active, within 24h) --------------------
  const { data: existingFile } = await supabase
    .from("files")
    .select("id, storage_path, status, deleted_at, linked_transaction:id")
    .eq("sha256_hash", sha256Hash)
    .eq("status", "active")
    .is("deleted_at", null)
    .gte(
      "created_at",
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    )
    .maybeSingle();

  if (existingFile && existingFile.status === "active") {
    // Duplicate detected — generate signed URL for existing file
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(existingFile.storage_path, 300);

    if (signedUrlError) {
      throw new Error(
        `Duplicate file detected but failed to generate signed URL: ${signedUrlError.message}`
      );
    }

    // Log the duplicate detection
    await supabase.from("audit_log").insert({
      actor_id: user.id,
      action: "DUPLICATE_DETECTED",
      target_type: "file",
      target_id: existingFile.id,
      details: {
        original_filename: file.name,
        sha256_hash: sha256Hash,
        idempotency_key: idempotencyKey ?? null,
      },
    });

    return {
      fileId: existingFile.id,
      storagePath: existingFile.storage_path,
      sha256Hash,
      signedUrl: signedUrlData.signedUrl,
      isDuplicate: true,
      existingTransactionId: existingFile.linked_transaction
        ? String(existingFile.linked_transaction)
        : undefined,
    };
  }

  // --- 6. Generate storage path ----------------------------------------------
  const storagePath = generateStoragePath(entity, file.name);

  // --- 7. Upload to Supabase Storage -----------------------------------------
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600",
    });

  if (uploadError) {
    // Clean up partial upload if possible
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  // --- 8. Insert files row ---------------------------------------------------
  const { data: insertedFile, error: insertError } = await supabase
    .from("files")
    .insert({
      original_filename: file.name,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type,
      sha256_hash: sha256Hash,
      entity,
      source,
      status: "active" as const,
      deleted_at: null,
      uploaded_by: user.id,
      idempotency_key: idempotencyKey ?? null,
    })
    .select("id, storage_path")
    .single();

  if (insertError || !insertedFile) {
    // Rollback: remove the object from storage
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw new Error(
      `Database insert failed: ${insertError?.message ?? "Unknown error"}`
    );
  }

  // --- 9. Audit log ----------------------------------------------------------
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "FILE_UPLOADED",
    target_type: "file",
    target_id: insertedFile.id,
    details: {
      original_filename: file.name,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type,
      sha256_hash: sha256Hash,
      entity,
      source,
      idempotency_key: idempotencyKey ?? null,
    },
  });

  // --- 10. Generate signed URL (5 minutes) -----------------------------------
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 300);

  if (signedUrlError) {
    // Non-fatal: file is uploaded, just can't generate URL right now
    console.warn("Failed to generate signed URL after upload:", signedUrlError.message);
  }

  // --- 11. Revalidate caches -------------------------------------------------
  revalidatePath("/files");
  revalidatePath("/");

  return {
    fileId: insertedFile.id,
    storagePath,
    sha256Hash,
    signedUrl: signedUrlData?.signedUrl ?? "",
    isDuplicate: false,
  };
}

// ------------------------------------------------------------------------------
// Signed URL
// ------------------------------------------------------------------------------

/**
 * Generate a time-limited signed URL to access a private file.
 *
 * @param fileId         - The UUID of the file in the `files` table.
 * @param expirySeconds  - How long the URL should remain valid (default: 300 = 5 min).
 * @returns {@link SignedUrlResult} containing the URL and its expiration time.
 * @throws If the file doesn't exist, is soft-deleted, or URL generation fails.
 */
export async function getSignedUrl(
  fileId: string,
  expirySeconds: number = 300
): Promise<SignedUrlResult> {
  const supabase = createClient();

  // --- 1. Authenticate --------------------------------------------------------
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: You must be signed in to access files.");
  }

  // --- 2. Validate parameters -------------------------------------------------
  if (!fileId || typeof fileId !== "string") {
    throw new Error("Invalid fileId: must be a non-empty string.");
  }

  const clampedExpiry = Math.min(Math.max(expirySeconds, 1), 604800); // 1s to 7 days

  // --- 3. Fetch file record ---------------------------------------------------
  const { data: fileRecord, error: fetchError } = await supabase
    .from("files")
    .select("id, storage_path, status, deleted_at")
    .eq("id", fileId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Database error fetching file: ${fetchError.message}`);
  }

  if (!fileRecord) {
    throw new Error(`File not found: ${fileId}`);
  }

  if (fileRecord.status === "discarded" || fileRecord.deleted_at !== null) {
    throw new Error(`File has been deleted: ${fileId}`);
  }

  // --- 4. Generate signed URL -------------------------------------------------
  const { data: signedData, error: signedError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(fileRecord.storage_path, clampedExpiry);

  if (signedError || !signedData?.signedUrl) {
    throw new Error(
      `Failed to generate signed URL: ${signedError?.message ?? "Unknown error"}`
    );
  }

  const expiresAt = new Date(Date.now() + clampedExpiry * 1000);

  return {
    signedUrl: signedData.signedUrl,
    expiresAt,
  };
}

// ------------------------------------------------------------------------------
// Soft Delete
// ------------------------------------------------------------------------------

/**
 * Soft-delete a file by setting `status = 'discarded'` and `deleted_at = now()`.
 * The underlying Storage object is NOT removed — this preserves data integrity
 * for linked transactions and audit trails.
 *
 * @param fileId - The UUID of the file to delete.
 * @param reason - Optional human-readable reason for deletion.
 * @returns `{ success: true }` on success.
 * @throws If the file doesn't exist or the update fails.
 */
export async function deleteFile(
  fileId: string,
  reason?: string
): Promise<{ success: boolean }> {
  const supabase = createClient();

  // --- 1. Authenticate --------------------------------------------------------
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: You must be signed in to delete files.");
  }

  // --- 2. Validate ------------------------------------------------------------
  if (!fileId || typeof fileId !== "string") {
    throw new Error("Invalid fileId: must be a non-empty string.");
  }

  // --- 3. Fetch and verify file exists ----------------------------------------
  const { data: fileRecord, error: fetchError } = await supabase
    .from("files")
    .select("id, status, deleted_at, original_filename, storage_path")
    .eq("id", fileId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Database error: ${fetchError.message}`);
  }

  if (!fileRecord) {
    throw new Error(`File not found: ${fileId}`);
  }

  if (fileRecord.status === "discarded" || fileRecord.deleted_at !== null) {
    // Already deleted — idempotent success
    return { success: true };
  }

  // --- 4. Perform soft delete -------------------------------------------------
  const { error: updateError } = await supabase
    .from("files")
    .update({
      status: "discarded" as const,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", fileId);

  if (updateError) {
    throw new Error(`Failed to delete file: ${updateError.message}`);
  }

  // --- 5. Audit log -----------------------------------------------------------
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "FILE_DELETED",
    target_type: "file",
    target_id: fileId,
    details: {
      original_filename: fileRecord.original_filename,
      storage_path: fileRecord.storage_path,
      reason: reason ?? null,
    },
  });

  // --- 6. Revalidate ----------------------------------------------------------
  revalidatePath("/files");
  revalidatePath("/");

  return { success: true };
}

// ------------------------------------------------------------------------------
// List Files
// ------------------------------------------------------------------------------

/**
 * List files with optional filtering and pagination.
 * Only returns active (non-deleted) files.
 *
 * @param params - Filter and pagination options.
 * @returns A paginated list of {@link FileRecord}s and a total count.
 */
export async function listFiles(
  params: ListFilesParams = {}
): Promise<ListFilesResult> {
  const supabase = createClient();

  // --- 1. Authenticate --------------------------------------------------------
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: You must be signed in to list files.");
  }

  // --- 2. Normalize parameters ------------------------------------------------
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 20), 100);
  const offset = (page - 1) * pageSize;

  // --- 3. Build query ---------------------------------------------------------
  let query = supabase
    .from("files")
    .select("*", { count: "exact" })
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (params.entity) {
    query = query.eq("entity", params.entity);
  }

  if (params.dateFrom) {
    query = query.gte("created_at", params.dateFrom);
  }

  if (params.dateTo) {
    query = query.lte("created_at", params.dateTo);
  }

  if (params.searchQuery) {
    query = query.ilike("original_filename", `%${params.searchQuery}%`);
  }

  // --- 4. Execute query -------------------------------------------------------
  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) {
    throw new Error(`Failed to list files: ${error.message}`);
  }

  return {
    files: (data ?? []) as FileRecord[],
    total: count ?? 0,
  };
}

// ------------------------------------------------------------------------------
// Get File by ID
// ------------------------------------------------------------------------------

/**
 * Retrieve a single file by its ID, including any linked extraction
 * and transaction data.
 *
 * @param fileId - The UUID of the file.
 * @returns {@link FileDetailResult} with the file and optional linked records.
 * @throws If the file doesn't exist or the user lacks access.
 */
export async function getFileById(fileId: string): Promise<FileDetailResult> {
  const supabase = createClient();

  // --- 1. Authenticate --------------------------------------------------------
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: You must be signed in to view files.");
  }

  // --- 2. Validate ------------------------------------------------------------
  if (!fileId || typeof fileId !== "string") {
    throw new Error("Invalid fileId: must be a non-empty string.");
  }

  // --- 3. Fetch file ----------------------------------------------------------
  const { data: fileRecord, error: fileError } = await supabase
    .from("files")
    .select("*")
    .eq("id", fileId)
    .maybeSingle();

  if (fileError) {
    throw new Error(`Database error: ${fileError.message}`);
  }

  if (!fileRecord) {
    throw new Error(`File not found: ${fileId}`);
  }

  // --- 4. Fetch linked extraction ---------------------------------------------
  const { data: extractionData } = await supabase
    .from("extractions")
    .select("*")
    .eq("file_id", fileId)
    .maybeSingle();

  // --- 5. Fetch linked transaction --------------------------------------------
  const { data: transactionData } = await supabase
    .from("transactions")
    .select("*")
    .eq("file_id", fileId)
    .maybeSingle();

  return {
    file: fileRecord as FileRecord,
    extraction: extractionData ?? undefined,
    linkedTransaction: transactionData ?? undefined,
  };
}

// ------------------------------------------------------------------------------
// Internal: Compute hash from File (server-side fallback)
// ------------------------------------------------------------------------------

/**
 * Compute SHA-256 hash from a File object on the server.
 * Uses Node.js crypto module as a fallback when Web Crypto is unavailable.
 */
async function computeHashFromFile(file: File): Promise<string> {
  // Prefer Web Crypto when available (edge runtime)
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Node.js fallback (Node runtime)
  const { createHash } = await import("crypto");
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return createHash("sha256").update(buffer).digest("hex");
}

// ------------------------------------------------------------------------------
// Batch helpers (for multi-file uploads)
// ------------------------------------------------------------------------------

/**
 * Upload multiple files sequentially, collecting results and errors.
 *
 * @param files  - Array of files to upload.
 * @param entity - The owning entity.
 * @param source - Upload source ("web" or "mobile").
 * @returns Array of results — each entry is either `{ success: true, result }`
 *          or `{ success: false, error, filename }`.
 */
export async function uploadFilesBatch(
  files: File[],
  entity: StorageEntity,
  source: "web" | "mobile" = "web"
): Promise<
  (
    | { success: true; result: UploadResult; filename: string }
    | { success: false; error: string; filename: string }
  )[]
> {
  const results: (
    | { success: true; result: UploadResult; filename: string }
    | { success: false; error: string; filename: string }
  )[] = [];

  for (const file of files) {
    try {
      const result = await uploadFile(file, entity, source);
      results.push({ success: true, result, filename: file.name });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ success: false, error: message, filename: file.name });
    }
  }

  return results;
}
