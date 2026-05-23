/**
 * JK Zentra Finance Cockpit — Duplicate Detection
 * Sprint 1 — OCR/Extraction Pipeline
 *
 * Two-layer duplicate detection system:
 *
 *   Layer 1 — File Hash Deduplication (SHA-256)
 *     Identifies exact duplicate uploads by comparing SHA-256 hashes.
 *     Fast, deterministic, catches re-uploaded files and email-forwards.
 *
 *   Layer 2 — Semantic Deduplication (vendor + amount + date ±2 days)
 *     Identifies near-duplicates: different photos of the same receipt,
 *     forwarded email attachments, screenshots of the same transaction.
 *     Uses fuzzy date matching and vendor normalisation.
 *
 * Both layers run during triggerExtraction() BEFORE creating a transaction.
 */

import { createClient } from '../supabase/server'
import type { TransactionRow } from '../supabase/database.types'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** Result of a Layer 1 (hash) duplicate check. */
export interface HashDuplicateResult {
  /** True if a file with this exact SHA-256 hash already exists. */
  isDuplicate: boolean
  /** The existing transaction ID linked to the duplicate file, if any. */
  existingTransactionId?: string
}

/** Result of a Layer 2 (semantic) duplicate check. */
export interface SemanticDuplicateResult {
  /** True if a semantically similar transaction already exists. */
  isDuplicate: boolean
  /** Similarity score 0.0–1.0 (1.0 = exact match on all fields). */
  similarity: number
  /** The existing transaction ID that matches, if any. */
  existingTransactionId?: string
}

// ----------------------------------------------------------------------------
// Layer 1: File Hash Deduplication
// ----------------------------------------------------------------------------

/**
 * Check whether a file with the given SHA-256 hash has already been processed.
 *
 * Queries the `files` table for any row with a matching `sha256_hash` that
 * is linked to an existing transaction via `transactions.file_id`.
 *
 * @param sha256Hash — The SHA-256 hash of the uploaded file
 * @returns HashDuplicateResult indicating whether this is an exact duplicate
 */
export async function checkFileHashDuplicate(
  sha256Hash: string
): Promise<HashDuplicateResult> {
  const supabase = await createClient()

  // Find files with the same hash
  const { data: duplicateFiles, error: fileError } = await supabase
    .from('files')
    .select('id')
    .eq('sha256_hash', sha256Hash)

  if (fileError) {
    // On error, allow the upload to proceed (fail-open for UX)
    console.error('[checkFileHashDuplicate] File query failed:', fileError.message)
    return { isDuplicate: false }
  }

  if (!duplicateFiles || duplicateFiles.length === 0) {
    return { isDuplicate: false }
  }

  // Check if any of these duplicate files are linked to a transaction
  const fileIds = duplicateFiles.map((f) => f.id)

  const { data: linkedTransactions, error: txError } = await supabase
    .from('transactions')
    .select('id, file_id')
    .in('file_id', fileIds)
    .neq('status', 'archived')
    .limit(1)

  if (txError) {
    console.error('[checkFileHashDuplicate] Transaction query failed:', txError.message)
    return { isDuplicate: false }
  }

  if (linkedTransactions && linkedTransactions.length > 0) {
    return {
      isDuplicate: true,
      existingTransactionId: linkedTransactions[0].id,
    }
  }

  // File hash matches but no transaction yet — still flag as duplicate file
  return { isDuplicate: true }
}

// ----------------------------------------------------------------------------
// Layer 2: Semantic Deduplication
// ----------------------------------------------------------------------------

/**
 * Normalise a vendor name for fuzzy comparison.
 * Lowercases, strips common suffixes, removes punctuation and extra spaces.
 */
function normaliseVendor(vendor: string): string {
  return vendor
    .toLowerCase()
    .replace(/\b(sdn\s*bhd|ltd|limited|inc|llc|plc|corp|gmbh|co\.?)\b/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Compute a similarity score between two vendor names.
 * Uses a simple token-based Jaccard similarity (sufficient for Sprint 1).
 * Returns a value between 0.0 (completely different) and 1.0 (identical).
 */
function vendorSimilarity(a: string, b: string): number {
  const normA = normaliseVendor(a)
  const normB = normaliseVendor(b)

  if (normA === normB) return 1.0
  if (normA.length === 0 || normB.length === 0) return 0.0

  // Simple substring match for common cases
  if (normA.includes(normB) || normB.includes(normA)) {
    const ratio =
      Math.min(normA.length, normB.length) / Math.max(normA.length, normB.length)
    return 0.7 + 0.3 * ratio // 0.7–1.0 range for substring matches
  }

  // Token-based Jaccard similarity
  const tokensA = new Set(normA.split(' ').filter((t) => t.length > 0))
  const tokensB = new Set(normB.split(' ').filter((t) => t.length > 0))

  if (tokensA.size === 0 && tokensB.size === 0) return 1.0
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0

  const intersection = new Set([...tokensA].filter((x) => tokensB.has(x)))
  const union = new Set([...tokensA, ...tokensB])

  return intersection.size / union.size
}

/**
 * Check for semantically similar transactions within a ±2 day window.
 *
 * Queries the `transactions` table for transactions with:
 *   • Matching vendor name (fuzzy — vendorSimilarity >= 0.7)
 *   • Exact matching amount (in minor units)
 *   • Date within ±2 days of the given date
 *
 * @param vendor      — Normalised vendor name from AI extraction
 * @param amountMinor — Amount in minor units (sen / cents)
 * @param date        — ISO-8601 date string (YYYY-MM-DD)
 * @returns SemanticDuplicateResult with similarity score and match info
 */
export async function checkSemanticDuplicate(
  vendor: string,
  amountMinor: number,
  date: string
): Promise<SemanticDuplicateResult> {
  const supabase = await createClient()

  // Compute the date window: ±2 days
  const targetDate = new Date(date + 'T00:00:00Z')
  if (isNaN(targetDate.getTime())) {
    throw new Error(`Invalid date format: ${date}`)
  }

  const startDate = new Date(targetDate)
  startDate.setUTCDate(startDate.getUTCDate() - 2)
  const endDate = new Date(targetDate)
  endDate.setUTCDate(endDate.getUTCDate() + 2)

  const startStr = startDate.toISOString().slice(0, 10)
  const endStr = endDate.toISOString().slice(0, 10)

  // Query transactions in the date window with the same amount
  // We fetch candidates and then do fuzzy vendor matching in-memory
  // because PostgreSQL doesn't have built-in fuzzy string matching without
  // extensions (pg_trgm).
  const { data: candidates, error } = await supabase
    .from('transactions')
    .select('id, vendor, amount_minor, occurred_at')
    .eq('amount_minor', amountMinor)
    .gte('occurred_at', startStr)
    .lte('occurred_at', endStr)
    .neq('status', 'archived')

  if (error) {
    console.error('[checkSemanticDuplicate] Query failed:', error.message)
    return { isDuplicate: false, similarity: 0 }
  }

  if (!candidates || candidates.length === 0) {
    return { isDuplicate: false, similarity: 0 }
  }

  // Find the best vendor match among candidates
  let bestMatch: {
    transactionId: string
    similarity: number
  } | null = null

  for (const candidate of candidates) {
    const similarity = vendorSimilarity(vendor, candidate.vendor)

    if (similarity >= 0.7) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = {
          transactionId: candidate.id,
          similarity,
        }
      }
    }
  }

  if (bestMatch) {
    return {
      isDuplicate: true,
      similarity: bestMatch.similarity,
      existingTransactionId: bestMatch.transactionId,
    }
  }

  return { isDuplicate: false, similarity: 0 }
}

// ----------------------------------------------------------------------------
// Combined duplicate check (convenience helper)
// ----------------------------------------------------------------------------

/**
 * Run both duplicate detection layers and return a consolidated result.
 *
 * @param sha256Hash  — SHA-256 hash of the uploaded file
 * @param vendor      — Vendor name from AI extraction
 * @param amountMinor — Amount in minor units
 * @param date        — Transaction date (YYYY-MM-DD)
 * @returns Combined duplicate analysis with both layer results
 */
export async function checkAllDuplicates(
  sha256Hash: string,
  vendor: string,
  amountMinor: number,
  date: string
): Promise<{
  hashDuplicate: HashDuplicateResult
  semanticDuplicate: SemanticDuplicateResult
  isAnyDuplicate: boolean
}> {
  const [hashDuplicate, semanticDuplicate] = await Promise.all([
    checkFileHashDuplicate(sha256Hash),
    checkSemanticDuplicate(vendor, amountMinor, date),
  ])

  return {
    hashDuplicate,
    semanticDuplicate,
    isAnyDuplicate: hashDuplicate.isDuplicate || semanticDuplicate.isDuplicate,
  }
}
