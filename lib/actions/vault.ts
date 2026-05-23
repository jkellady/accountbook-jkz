"use server";

/**
 * @file lib/actions/vault.ts
 * @description Server actions for the Receipt & Invoice Vault in the JK Zentra Finance Cockpit.
 *
 * Provides listing, search, filtering, and mutation operations for the files table
 * with joined data from extractions and transactions. Every function is fully typed
 * and uses Row-Level Security via the Supabase server client.
 *
 * @module lib/actions/vault
 */

import { createActionClient } from "@/lib/supabase/server";
import type { Database, EntityName } from "@/lib/supabase/database.types";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Type aliases from database schema — strictly matched, no invented columns
// ---------------------------------------------------------------------------

type FileRow = Database["public"]["Tables"]["files"]["Row"];
type ExtractionRow = Database["public"]["Tables"]["extractions"]["Row"];
type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type EntityRow = Database["public"]["Tables"]["entities"]["Row"];

// ---------------------------------------------------------------------------
// Vault-specific computed types
// ---------------------------------------------------------------------------

/**
 * Enriched file record returned by listVaultFiles.
 * Joins transactions (vendor, amount) and extractions (OCR text, hasExtraction flag).
 */
export interface VaultFile extends FileRow {
  /** ID of the linked transaction, if any. */
  linkedTransactionId: string | null;
  /** Vendor name from the linked transaction, if any. */
  linkedTransactionVendor: string | null;
  /** Whether an AI extraction exists for this file. */
  hasExtraction: boolean;
  /** Raw OCR text extracted from the file (from raw_response->raw_text). */
  ocrText: string | null;
  /** Linked transaction amount in minor units, if any. */
  linkedTransactionAmountMinor: number | null;
  /** Linked transaction currency, if any. */
  linkedTransactionCurrency: string | null;
  /** Entity name (Personal or JK Zentra), if entity_id is set. */
  entityName: EntityName | null;
}

/** Supported MIME type filters for the vault. */
export type VaultMimeFilter = "image" | "pdf" | "all";

/** Supported sort columns for vault listing. */
export type VaultSortColumn = "uploaded_at" | "original_filename" | "size_bytes";

/** Supported sort directions. */
export type VaultSortDirection = "asc" | "desc";

/** Parameters for listVaultFiles. */
export interface ListVaultFilesParams {
  /** Full-text search query matched against OCR text, filename, and linked vendor. */
  searchQuery?: string;
  /** Filter by owning entity UUID. */
  entityId?: string;
  /** ISO-8601 date string (inclusive) — filter files uploaded on or after. */
  dateFrom?: string;
  /** ISO-8601 date string (inclusive) — filter files uploaded on or before. */
  dateTo?: string;
  /** Filter by file type: image, pdf, or all. */
  mimeType?: VaultMimeFilter;
  /** Page number (1-based). */
  page?: number;
  /** Items per page. */
  pageSize?: number;
  /** Column to sort by. */
  sortBy?: VaultSortColumn;
  /** Sort direction. */
  sortDir?: VaultSortDirection;
}

/** Result shape for listVaultFiles. */
export interface ListVaultFilesResult {
  /** Paginated vault files with joined data. */
  files: VaultFile[];
  /** Total count matching the filters (for pagination). */
  total: number;
}

/** Detailed file view with linked extraction and transaction. */
export interface VaultFileDetail {
  /** The file record. */
  file: FileRow;
  /** Linked extraction data (AI OCR results), if any. */
  extraction: ExtractionRow | null;
  /** Linked transaction, if any. */
  linkedTransaction: TransactionRow | null;
  /** Entity name, if file has an entity. */
  entityName: EntityName | null;
}

// ---------------------------------------------------------------------------
// JSONB helper — raw_response shape
// ---------------------------------------------------------------------------

/**
 * Expected shape of extractions.raw_response JSONB.
 * The raw_text field contains the full OCR text.
 */
interface RawResponseShape {
  raw_text?: string;
}

// ---------------------------------------------------------------------------
// Utility: format bytes to human-readable string
// ---------------------------------------------------------------------------

/**
 * Converts a byte count to a human-readable string (B, KB, MB, GB).
 *
 * @param bytes — File size in bytes.
 * @returns Formatted size string (e.g. "1.5 MB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ---------------------------------------------------------------------------
// 1. LIST — with filters, pagination, search, sort
// ---------------------------------------------------------------------------

/**
 * Lists vault files with full-text search, filters, pagination, and sorting.
 *
 * Search matches against:
 * - extractions.raw_response->>raw_text (OCR text via JSONB operator)
 * - files.original_filename
 * - files.display_filename
 * - transactions.vendor (linked transaction vendor name)
 *
 * @param params — Filter, search, pagination, and sort parameters.
 * @returns Object containing the paginated files array and total count.
 *
 * @example
 * ```ts
 * const { files, total } = await listVaultFiles({
 *   searchQuery: "grab receipt",
 *   entityId: "uuid-here",
 *   mimeType: "image",
 *   page: 1,
 *   pageSize: 24,
 * });
 * ```
 */
export async function listVaultFiles(
  params: ListVaultFilesParams = {}
): Promise<ListVaultFilesResult> {
  const {
    searchQuery,
    entityId,
    dateFrom,
    dateTo,
    mimeType = "all",
    page = 1,
    pageSize = 24,
    sortBy = "uploaded_at",
    sortDir = "desc",
  } = params;

  const supabase = await createActionClient();

  // Build the base query with joins
  let query = supabase
    .from("files")
    .select(
      `
      *,
      entities:entity_id ( name ),
      transactions:transactions!file_id ( id, vendor, amount_minor, currency ),
      extractions:extractions!file_id ( id, raw_response )
    `,
      { count: "exact" }
    );

  // Apply entity filter
  if (entityId) {
    query = query.eq("entity_id", entityId);
  }

  // Apply date range filters on uploaded_at
  if (dateFrom) {
    query = query.gte("uploaded_at", dateFrom);
  }
  if (dateTo) {
    query = query.lte("uploaded_at", dateTo);
  }

  // Apply MIME type filter
  if (mimeType === "image") {
    query = query.like("mime_type", "image/%");
  } else if (mimeType === "pdf") {
    query = query.eq("mime_type", "application/pdf");
  }

  // Apply full-text search across OCR text, filenames, and vendor
  if (searchQuery && searchQuery.trim().length > 0) {
    const term = searchQuery.trim();
    // We use or() to search across multiple fields:
    // - extractions.raw_response->>raw_text (JSONB text operator)
    // - files.original_filename (ilike)
    // - files.display_filename (ilike)
    // - transactions.vendor (ilike via joined table)
    query = query.or(
      `original_filename.ilike.%${term}%,display_filename.ilike.%${term}%,extractions.raw_response->>raw_text.ilike.%${term}%,transactions.vendor.ilike.%${term}%`
    );
  }

  // Apply sorting
  const orderColumn = sortBy === "original_filename" ? "original_filename" : sortBy;
  query = query.order(orderColumn, { ascending: sortDir === "asc" });

  // Apply pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list vault files: ${error.message}`);
  }

  const total = count ?? 0;

  // Transform raw rows into VaultFile types
  const files: VaultFile[] = (data ?? []).map((row: VaultFileRawRow) => {
    const rawResponse = row.extractions?.raw_response as RawResponseShape | null;
    const ocrText = rawResponse?.raw_text ?? null;

    return {
      ...row,
      linkedTransactionId: row.transactions?.id ?? null,
      linkedTransactionVendor: row.transactions?.vendor ?? null,
      hasExtraction: row.extractions !== null,
      ocrText,
      linkedTransactionAmountMinor: row.transactions?.amount_minor ?? null,
      linkedTransactionCurrency: row.transactions?.currency ?? null,
      entityName: row.entities?.name ?? null,
    };
  });

  return { files, total };
}

// ---------------------------------------------------------------------------
// Raw row shape returned by the joined query above
// ---------------------------------------------------------------------------

/** Shape of a row returned by the Supabase joined query in listVaultFiles. */
interface VaultFileRawRow extends FileRow {
  /** Nested entity data from the join. */
  entities: { name: EntityName } | null;
  /** Nested transaction data from the join (extractions!file_id is one-to-one). */
  transactions: {
    id: string;
    vendor: string;
    amount_minor: number;
    currency: string;
  } | null;
  /** Nested extraction data from the join. */
  extractions: {
    id: string;
    raw_response: Database["public"]["Tables"]["extractions"]["Row"]["raw_response"];
  } | null;
}

// ---------------------------------------------------------------------------
// 2. GET SINGLE FILE — with linked extraction and transaction
// ---------------------------------------------------------------------------

/**
 * Retrieves a single file with its linked extraction and transaction data.
 *
 * @param fileId — UUID of the file to retrieve.
 * @returns Object containing the file, extraction, linked transaction, and entity name.
 *
 * @example
 * ```ts
 * const { file, extraction, linkedTransaction } = await getVaultFile("uuid-here");
 * ```
 */
export async function getVaultFile(fileId: string): Promise<VaultFileDetail> {
  const supabase = await createActionClient();

  // Fetch the file with entity name
  const { data: file, error: fileError } = await supabase
    .from("files")
    .select(
      `
      *,
      entities:entity_id ( name )
    `
    )
    .eq("id", fileId)
    .single();

  if (fileError) {
    throw new Error(`Failed to fetch vault file: ${fileError.message}`);
  }

  // Fetch linked extraction (one-to-one via file_id)
  const { data: extraction, error: extractionError } = await supabase
    .from("extractions")
    .select("*")
    .eq("file_id", fileId)
    .maybeSingle();

  if (extractionError) {
    throw new Error(`Failed to fetch extraction: ${extractionError.message}`);
  }

  // Fetch linked transaction (one-to-many via file_id, but we expect zero or one)
  const { data: linkedTransaction, error: txError } = await supabase
    .from("transactions")
    .select("*")
    .eq("file_id", fileId)
    .maybeSingle();

  if (txError) {
    throw new Error(`Failed to fetch linked transaction: ${txError.message}`);
  }

  const entityName =
    (file as FileRow & { entities: { name: EntityName } | null }).entities?.name ?? null;

  return {
    file: file as FileRow,
    extraction,
    linkedTransaction,
    entityName,
  };
}

// ---------------------------------------------------------------------------
// 3. UPDATE DISPLAY FILENAME
// ---------------------------------------------------------------------------

/**
 * Updates the display_filename of a file. This is the user-friendly name
 * shown in the UI (distinct from the original upload filename).
 *
 * @param fileId — UUID of the file to rename.
 * @param displayName — New display filename.
 *
 * @example
 * ```ts
 * await updateFileName("uuid-here", "Grab Receipt - March 2026");
 * ```
 */
export async function updateFileName(
  fileId: string,
  displayName: string
): Promise<void> {
  const supabase = await createActionClient();

  const { error } = await supabase
    .from("files")
    .update({ display_filename: displayName.trim() })
    .eq("id", fileId);

  if (error) {
    throw new Error(`Failed to update file name: ${error.message}`);
  }

  revalidatePath("/vault");
}

// ---------------------------------------------------------------------------
// 4. UNLINK FILE FROM TRANSACTION
// ---------------------------------------------------------------------------

/**
 * Removes the file_id link from a transaction, detaching the file
 * from the transaction record without deleting either.
 *
 * @param transactionId — UUID of the transaction to unlink from.
 *
 * @example
 * ```ts
 * await unlinkFileFromTransaction("tx-uuid-here");
 * ```
 */
export async function unlinkFileFromTransaction(
  transactionId: string
): Promise<void> {
  const supabase = await createActionClient();

  const { error } = await supabase
    .from("transactions")
    .update({ file_id: null })
    .eq("id", transactionId);

  if (error) {
    throw new Error(`Failed to unlink file from transaction: ${error.message}`);
  }

  revalidatePath("/vault");
}

// ---------------------------------------------------------------------------
// 5. GET SIGNED URL — for file viewing (5 minute expiry)
// ---------------------------------------------------------------------------

/**
 * Generates a temporary signed URL for viewing a file.
 * URL expires in 5 minutes — suitable for the file viewer modal.
 *
 * @param storagePath — The storage_path value from the files table.
 * @returns The signed URL string.
 *
 * @example
 * ```ts
 * const url = await getFileSignedUrl("receipts/2026/03/uuid-filename.pdf");
 * ```
 */
export async function getFileSignedUrl(storagePath: string): Promise<string> {
  const supabase = await createActionClient();

  const { data, error } = await supabase.storage
    .from("files")
    .createSignedUrl(storagePath, 300); // 5 minutes = 300 seconds

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// 6. GET THUMBNAIL SIGNED URL — for thumbnail grid (60 second expiry)
// ---------------------------------------------------------------------------

/**
 * Generates a temporary signed URL for a thumbnail image.
 * URL expires in 60 seconds — suitable for lazy-loaded grid thumbnails.
 *
 * @param storagePath — The storage_path value from the files table.
 * @returns The signed URL string.
 *
 * @example
 * ```ts
 * const url = await getThumbnailSignedUrl("receipts/2026/03/uuid-filename.jpg");
 * ```
 */
export async function getThumbnailSignedUrl(
  storagePath: string
): Promise<string> {
  const supabase = await createActionClient();

  const { data, error } = await supabase.storage
    .from("files")
    .createSignedUrl(storagePath, 60); // 60 seconds

  if (error) {
    throw new Error(`Failed to create thumbnail signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// 7. LIST ENTITIES — for the entity filter dropdown
// ---------------------------------------------------------------------------

/**
 * Fetches all entities for the vault filter dropdown.
 *
 * @returns Array of entity records.
 */
export async function listEntitiesForVault(): Promise<
  Pick<EntityRow, "id" | "name" | "slug" | "color">[]
> {
  const supabase = await createActionClient();

  const { data, error } = await supabase
    .from("entities")
    .select("id, name, slug, color")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to list entities: ${error.message}`);
  }

  return data ?? [];
}
