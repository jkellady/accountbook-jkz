/**
 * JK Zentra Finance Cockpit — Extraction Server Actions
 * Sprint 1 — OCR/Extraction Pipeline
 *
 * Next.js server actions that orchestrate the AI extraction pipeline:
 *   1. triggerExtraction  — Queues AI extraction for an uploaded file
 *   2. getExtraction      — Retrieves extraction status and results
 *   3. markCorrected      — Flags an extraction as human-verified
 *
 * Each action validates inputs with Zod, uses the typed Supabase client,
 * and handles errors gracefully with fallback paths.
 */

'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '../supabase/server'
import { extractWithFallback } from '../ai/gemini'
import {
  checkFileHashDuplicate,
  checkSemanticDuplicate,
} from '../utils/duplicateDetection'
import type { ExtractionRow } from '../supabase/database.types'

// ----------------------------------------------------------------------------
// Zod input validators
// ----------------------------------------------------------------------------

const fileIdSchema = z.string().uuid({ message: 'Invalid file UUID format' })
const extractionIdSchema = z
  .string()
  .uuid({ message: 'Invalid extraction UUID format' })

// ----------------------------------------------------------------------------
// Internal: map extracted entity string to actual entity UUID
// ----------------------------------------------------------------------------

/** The two seeded entities — extractions determine which one a transaction
 *  belongs to.  'mixed' defaults to Personal and flags for review. */
const ENTITY_SLUG_MAP: Record<string, string> = {
  // Filled at runtime from the database.  Keys: 'personal', 'business'
}

/**
 * Resolve the entity slug ('personal' | 'business') to a database entity UUID.
 * Caches the result to avoid repeated lookups.
 */
async function resolveEntityId(slug: 'personal' | 'business'): Promise<string> {
  // Return cached value if available
  if (ENTITY_SLUG_MAP[slug]) {
    return ENTITY_SLUG_MAP[slug]
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('entities')
    .select('id, slug')
    .eq('slug', slug)
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to resolve entity slug "${slug}": ${error?.message ?? 'Entity not found'}`
    )
  }

  ENTITY_SLUG_MAP[slug] = data.id
  return data.id
}

// ----------------------------------------------------------------------------
// 1. triggerExtraction
// ----------------------------------------------------------------------------

/**
 * Trigger AI extraction for an uploaded file.
 *
 * Pipeline:
 *   1. Validate fileId
 *   2. Fetch file record (storage_path, mime_type, sha256_hash, entity_id)
 *   3. Check for duplicate by file hash (Layer 1)
 *   4. Call Gemini 2.5 Flash with GPT-4o-mini fallback
 *   5. Check for semantic duplicate (Layer 2: vendor + amount + date ±2 days)
 *   6. Store extraction result in `extractions` table
 *   7. Create a pending `transaction` from the extracted fields
 *   8. Return the extraction ID and status
 *
 * @param fileId — UUID of the uploaded file in the `files` table
 * @returns Object with extractionId and status
 * @throws Error if validation fails, file not found, or extraction errors
 */
export async function triggerExtraction(
  fileId: string
): Promise<{ extractionId: string; status: string }> {
  // 1. Validate
  const parsedFileId = fileIdSchema.safeParse(fileId)
  if (!parsedFileId.success) {
    throw new Error(`Invalid fileId: ${parsedFileId.error.message}`)
  }

  const supabase = await createClient()

  // 2. Fetch file record
  const { data: fileRecord, error: fileError } = await supabase
    .from('files')
    .select('id, storage_path, mime_type, sha256_hash, entity_id')
    .eq('id', parsedFileId.data)
    .single()

  if (fileError || !fileRecord) {
    throw new Error(
      `File not found: ${fileError?.message ?? `No file with ID ${fileId}`}`
    )
  }

  // 3. Layer 1: Check file-hash duplicate
  const hashDuplicate = await checkFileHashDuplicate(fileRecord.sha256_hash)
  if (hashDuplicate.isDuplicate && hashDuplicate.existingTransactionId) {
    // File already processed — return the existing extraction
    const { data: existingExtraction } = await supabase
      .from('extractions')
      .select('id')
      .eq('file_id', fileId)
      .maybeSingle()

    if (existingExtraction) {
      return {
        extractionId: existingExtraction.id,
        status: 'duplicate_file_hash',
      }
    }
  }

  // 4. Run AI extraction (Gemini → GPT-4o-mini fallback)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase environment variables for storage access'
    )
  }

  let extractionResult: Awaited<ReturnType<typeof extractWithFallback>>

  try {
    extractionResult = await extractWithFallback(
      fileRecord.id,
      fileRecord.mime_type,
      fileRecord.storage_path,
      supabaseUrl,
      supabaseServiceKey
    )
  } catch (err) {
    // Store a failed extraction record for audit/debugging
    const errorMessage = err instanceof Error ? err.message : String(err)
    const { data: failedExtraction } = await supabase
      .from('extractions')
      .insert({
        file_id: fileRecord.id,
        model_used: 'gemini-2.5-flash',
        raw_response: { error: errorMessage },
        extracted_fields: null,
        confidence_scores: null,
        processing_time_ms: 0,
      })
      .select('id')
      .single()

    throw new Error(
      `AI extraction failed for file ${fileId}: ${errorMessage}`
    )
  }

  const { result, modelUsed, rawResponse, processingTimeMs } = extractionResult

  // 5. Layer 2: Check semantic duplicate (vendor + amount + date ±2 days)
  const semanticDuplicate = await checkSemanticDuplicate(
    result.vendor,
    result.amount,
    result.date
  )

  // Transaction status is ALWAYS 'pending_review' — human approval required.
  // Confidence scores control UI highlighting only (orange/yellow/green).
  // status='active' is only set by explicit human approval in the review queue.
  const txStatus: 'pending_review' = 'pending_review'
  const overallConfidence = result.confidence.overall

  // 6. Store extraction result
  const { data: extractionRecord, error: extractionError } = await supabase
    .from('extractions')
    .insert({
      file_id: fileRecord.id,
      model_used: modelUsed,
      raw_response: rawResponse as Record<string, unknown>,
      extracted_fields: result as unknown as Record<string, unknown>,
      confidence_scores: result.confidence as unknown as Record<string, unknown>,
      manually_corrected: false,
      processing_time_ms: processingTimeMs,
    })
    .select('id')
    .single()

  if (extractionError || !extractionRecord) {
    throw new Error(
      `Failed to store extraction: ${extractionError?.message ?? 'Unknown error'}`
    )
  }

  // 7. Create a transaction from the extraction (if not a duplicate)
  if (!hashDuplicate.isDuplicate) {
    // Determine entity: use file's entity_id if set, otherwise resolve from extracted entity
    let entityId: string | null = fileRecord.entity_id

    if (!entityId && result.entity !== 'mixed') {
      try {
        const slug = result.entity === 'business' ? 'jk-zentra' : 'personal'
        entityId = await resolveEntityId(slug as 'personal' | 'business')
      } catch {
        // If entity resolution fails, leave null — transaction will need manual filing
        entityId = null
      }
    }

    // Only create a transaction if we can determine an entity
    if (entityId) {
      const { error: txError } = await supabase.from('transactions').insert({
        entity_id: entityId,
        type: result.type,
        amount_minor: result.amount,
        currency: result.currency,
        occurred_at: result.date,
        vendor: result.vendor,
        category: result.category,
        subcategory: result.subcategory,
        description: result.description,
        notes: semanticDuplicate.isDuplicate
          ? `Possible duplicate of transaction ${semanticDuplicate.existingTransactionId} (similarity: ${(semanticDuplicate.similarity * 100).toFixed(0)}%)`
          : `AI extracted by ${modelUsed}. Confidence: ${(overallConfidence * 100).toFixed(0)}%`,
        tags: result.is_subscription ? ['subscription'] : [],
        status: txStatus,
        period_status: 'open',
        file_id: fileRecord.id,
      })

      if (txError) {
        // Non-fatal: log but don't fail the extraction
        console.error(
          `[triggerExtraction] Transaction creation failed for file ${fileId}:`,
          txError.message
        )
      }
    }
  }

  // 8. Revalidate the extractions page
  revalidatePath('/dashboard/extractions')

  return {
    extractionId: extractionRecord.id,
    status: hashDuplicate.isDuplicate
      ? 'duplicate_file_hash'
      : semanticDuplicate.isDuplicate
        ? 'duplicate_semantic'
        : 'pending_review',
  }
}

// ----------------------------------------------------------------------------
// 2. getExtraction
// ----------------------------------------------------------------------------

/**
 * Retrieve an extraction record by its ID, including confidence scores
 * and linked file metadata.
 *
 * @param extractionId — UUID of the extraction record
 * @returns The full extraction row, or null if not found
 */
export async function getExtraction(
  extractionId: string
): Promise<ExtractionRow | null> {
  const parsedId = extractionIdSchema.safeParse(extractionId)
  if (!parsedId.success) {
    throw new Error(`Invalid extractionId: ${parsedId.error.message}`)
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('extractions')
    .select('*')
    .eq('id', parsedId.data)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // Row not found — return null (not an error)
      return null
    }
    throw new Error(`Failed to fetch extraction: ${error.message}`)
  }

  return data
}

// ----------------------------------------------------------------------------
// 3. markCorrected
// ----------------------------------------------------------------------------

/**
 * Mark an extraction as manually corrected by a human reviewer.
 * Updates `manually_corrected` to true and revalidates the UI.
 *
 * @param extractionId — UUID of the extraction to mark as corrected
 * @throws Error if the extraction does not exist or update fails
 */
export async function markCorrected(extractionId: string): Promise<void> {
  const parsedId = extractionIdSchema.safeParse(extractionId)
  if (!parsedId.success) {
    throw new Error(`Invalid extractionId: ${parsedId.error.message}`)
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('extractions')
    .update({ manually_corrected: true })
    .eq('id', parsedId.data)

  if (error) {
    throw new Error(`Failed to mark extraction as corrected: ${error.message}`)
  }

  revalidatePath('/dashboard/extractions')
}
