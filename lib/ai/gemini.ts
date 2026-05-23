/**
 * JK Zentra Finance Cockpit — Gemini 2.5 Flash API Client
 * Sprint 1 — OCR/Extraction Pipeline
 *
 * Provides:
 *   • extractFromFile()      — Primary extraction via Gemini 2.5 Flash
 *   • extractWithFallback()  — Auto-retry with GPT-4o-mini on failure
 *   • checkCostCap()         — Daily / monthly spend guardrails
 *
 * Cost controls (hard-coded for Sprint 1):
 *   • Daily cap:  $1.00  (100 minor units)
 *   • Monthly cap: $5.00  (500 minor units)
 *   • Max 3 retries per file
 *   • Circuit breaker: 3 consecutive failures → 5-minute pause
 *
 * ENV VARS REQUIRED:
 *   GEMINI_API_KEY   — Google AI Studio API key
 *   OPENAI_API_KEY   — Fallback model API key (optional but recommended)
 */

import {
  safeParseExtraction,
  type ExtractionResult,
  type ParseResult,
} from './extractionSchema'
import { SYSTEM_PROMPT } from './prompt'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** Model identifier strings — stored in `extractions.model_used`. */
type ModelName = 'gemini-2.5-flash' | 'gpt-4o-mini'

/** Result of a single extraction attempt. */
interface AttemptResult {
  result: ExtractionResult
  modelUsed: ModelName
  rawResponse: Record<string, unknown>
  processingTimeMs: number
}

/** In-memory cost-tracking accumulator (volatile — resets on deploy).
 *  For durable tracking we should persist to DB in Sprint 2. */
interface CostAccumulator {
  /** Spend for the current UTC day in minor units (cents). */
  dailySpendMinor: number
  /** Spend for the current UTC month in minor units (cents). */
  monthlySpendMinor: number
  /** UTC date string (YYYY-MM-DD) for the current daily window. */
  currentDay: string
  /** UTC month string (YYYY-MM) for the current monthly window. */
  currentMonth: string
  /** Number of consecutive failed requests (for circuit breaker). */
  consecutiveFailures: number
  /** ISO timestamp when the circuit breaker will clear. */
  circuitBreakerUntil: string | null
  /** Estimated cost per Gemini call in minor units (cents) — conservative. */
  readonly COST_PER_GEMINI_CALL_MINOR: number
  /** Estimated cost per GPT-4o-mini call in minor units (cents) — conservative. */
  readonly COST_PER_GPT_FALLBACK_MINOR: number
}

// ----------------------------------------------------------------------------
// Hard-coded caps (mirrors the `monthly_ai_cost_cap_minor` in UserSettings)
// ----------------------------------------------------------------------------

const DAILY_CAP_MINOR = 100 // $1.00
const MONTHLY_CAP_MINOR = 500 // $5.00
const MAX_RETRIES = 3
const CIRCUIT_BREAKER_THRESHOLD = 3
const CIRCUIT_BREAKER_PAUSE_MS = 5 * 60 * 1000 // 5 minutes

// Gemini 2.5 Flash pricing: ~$0.15 / 1M tokens input, ~$0.60 / 1M tokens output
// Average receipt: ~2K input tokens → ~$0.0003.  We use $0.01 (1 cent) as a
// conservative ceiling for budget-tracking purposes.
const COST_PER_GEMINI_CALL_MINOR = 1 // 1 cent
const COST_PER_GPT_FALLBACK_MINOR = 2 // 2 cents (GPT-4o-mini is slightly more)

// ----------------------------------------------------------------------------
// In-memory cost tracker (volatile — sufficient for Sprint 1)
// ----------------------------------------------------------------------------

const costTracker: CostAccumulator = {
  dailySpendMinor: 0,
  monthlySpendMinor: 0,
  currentDay: new Date().toISOString().slice(0, 10),
  currentMonth: new Date().toISOString().slice(0, 7),
  consecutiveFailures: 0,
  circuitBreakerUntil: null,
  COST_PER_GEMINI_CALL_MINOR,
  COST_PER_GPT_FALLBACK_MINOR,
}

// ----------------------------------------------------------------------------
// Cost-cap guard
// ----------------------------------------------------------------------------

/**
 * Check whether an AI call is allowed under the daily / monthly caps and
 * circuit-breaker rules.
 *
 * @returns \`{ allowed: true }\` if the call may proceed, otherwise
 *          \`{ allowed: false, reason: string }\` explaining the block.
 */
export async function checkCostCap(): Promise<{
  allowed: boolean
  reason?: string
}> {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const thisMonth = now.toISOString().slice(0, 7)

  // Roll the day / month windows if needed
  if (today !== costTracker.currentDay) {
    costTracker.currentDay = today
    costTracker.dailySpendMinor = 0
  }
  if (thisMonth !== costTracker.currentMonth) {
    costTracker.currentMonth = thisMonth
    costTracker.monthlySpendMinor = 0
  }

  // Circuit-breaker check
  if (costTracker.circuitBreakerUntil) {
    const until = new Date(costTracker.circuitBreakerUntil)
    if (now < until) {
      return {
        allowed: false,
        reason: `Circuit breaker active. Retry after ${costTracker.circuitBreakerUntil}`,
      }
    }
    // Circuit breaker has expired — reset
    costTracker.circuitBreakerUntil = null
    costTracker.consecutiveFailures = 0
  }

  // Daily cap check
  if (costTracker.dailySpendMinor + COST_PER_GEMINI_CALL_MINOR > DAILY_CAP_MINOR) {
    return {
      allowed: false,
      reason: `Daily AI cost cap reached ($${(DAILY_CAP_MINOR / 100).toFixed(2)}). Try again tomorrow.`,
    }
  }

  // Monthly cap check
  if (
    costTracker.monthlySpendMinor + COST_PER_GEMINI_CALL_MINOR >
    MONTHLY_CAP_MINOR
  ) {
    return {
      allowed: false,
      reason: `Monthly AI cost cap reached ($${(MONTHLY_CAP_MINOR / 100).toFixed(2)}). Contact admin to increase.`,
    }
  }

  return { allowed: true }
}

// ----------------------------------------------------------------------------
// Internal: record spend and track failures
// ----------------------------------------------------------------------------

function recordSpend(minorAmount: number): void {
  costTracker.dailySpendMinor += minorAmount
  costTracker.monthlySpendMinor += minorAmount
}

function recordSuccess(): void {
  costTracker.consecutiveFailures = 0
}

function recordFailure(): void {
  costTracker.consecutiveFailures += 1
  if (costTracker.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    const until = new Date(Date.now() + CIRCUIT_BREAKER_PAUSE_MS)
    costTracker.circuitBreakerUntil = until.toISOString()
  }
}

// ----------------------------------------------------------------------------
// Internal: call Gemini 2.5 Flash
// ----------------------------------------------------------------------------

/**
 * Call the Gemini 2.5 Flash model with the system prompt and a base64-encoded
 * file.  Returns the parsed JSON extraction result.
 */
async function callGemini(
  base64Data: string,
  mimeType: string
): Promise<AttemptResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  const startTime = Date.now()

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`

  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Gemini API error: ${response.status} ${response.statusText} — ${body}`
    )
  }

  const geminiJson = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>
      }
      finishReason?: string
    }>
    usageMetadata?: {
      promptTokenCount?: number
      candidatesTokenCount?: number
    }
  }

  const candidate = geminiJson.candidates?.[0]
  if (!candidate) {
    throw new Error('Gemini returned no candidates')
  }
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`Gemini finish reason: ${candidate.finishReason}`)
  }

  const rawText = candidate.content?.parts?.[0]?.text
  if (!rawText) {
    throw new Error('Gemini returned empty text')
  }

  // Parse the JSON from the model
  let rawJson: unknown
  try {
    rawJson = JSON.parse(rawText)
  } catch {
    throw new Error('Gemini returned invalid JSON')
  }

  const parseResult: ParseResult = safeParseExtraction(rawJson)
  if (!parseResult.success) {
    throw new Error(
      `Schema validation failed: ${parseResult.error.message}`
    )
  }

  const processingTimeMs = Date.now() - startTime
  recordSpend(COST_PER_GEMINI_CALL_MINOR)
  recordSuccess()

  return {
    result: parseResult.data,
    modelUsed: 'gemini-2.5-flash',
    rawResponse: rawJson as Record<string, unknown>,
    processingTimeMs,
  }
}

// ----------------------------------------------------------------------------
// Internal: call GPT-4o-mini fallback
// ----------------------------------------------------------------------------

/**
 * Call GPT-4o-mini as the fallback model when Gemini fails.
 * Uses the same system prompt and returns the same structured format.
 */
async function callGptFallback(
  base64Data: string,
  mimeType: string
): Promise<AttemptResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set — fallback unavailable')
  }

  const startTime = Date.now()

  // Build the message content array with image
  const contentParts: Array<{
    type: string
    text?: string
    image_url?: { url: string; detail: string }
  }> = [
    {
      type: 'text',
      text: 'Extract structured financial data from the attached document. Return ONLY valid JSON matching the schema described in the system prompt.',
    },
    {
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${base64Data}`,
        detail: 'high',
      },
    },
  ]

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: contentParts },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText} — ${body}`
    )
  }

  const openAiJson = (await response.json()) as {
    choices?: Array<{
      message?: { content?: string }
      finish_reason?: string
    }>
    usage?: { total_tokens?: number }
  }

  const choice = openAiJson.choices?.[0]
  if (!choice) {
    throw new Error('OpenAI returned no choices')
  }
  if (choice.finish_reason && choice.finish_reason !== 'stop') {
    throw new Error(`OpenAI finish reason: ${choice.finish_reason}`)
  }

  const rawText = choice.message?.content
  if (!rawText) {
    throw new Error('OpenAI returned empty content')
  }

  let rawJson: unknown
  try {
    rawJson = JSON.parse(rawText)
  } catch {
    throw new Error('OpenAI returned invalid JSON')
  }

  const parseResult: ParseResult = safeParseExtraction(rawJson)
  if (!parseResult.success) {
    throw new Error(
      `Schema validation failed: ${parseResult.error.message}`
    )
  }

  const processingTimeMs = Date.now() - startTime
  recordSpend(COST_PER_GPT_FALLBACK_MINOR)
  recordSuccess()

  return {
    result: parseResult.data,
    modelUsed: 'gpt-4o-mini',
    rawResponse: rawJson as Record<string, unknown>,
    processingTimeMs,
  }
}

// ----------------------------------------------------------------------------
// Internal: download file from Supabase Storage as base64
// ----------------------------------------------------------------------------

/**
 * Download a file from Supabase Storage and encode it as base64.
 *
 * @param storagePath — The path in the Supabase Storage bucket
 * @param supabaseUrl — Supabase project URL
 * @param supabaseServiceKey — Service role key for server-side access
 * @returns Base64-encoded file content
 */
async function downloadFileAsBase64(
  storagePath: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<string> {
  const url = `${supabaseUrl}/storage/v1/object/authenticated/${storagePath}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to download file from storage: ${response.status} ${response.statusText}`
    )
  }

  const arrayBuffer = await response.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Extract structured financial data from an uploaded file using
 * Gemini 2.5 Flash.
 *
 * @param fileId     — UUID of the file in the `files` table
 * @param mimeType   — MIME type of the file (e.g. 'image/jpeg', 'application/pdf')
 * @param storagePath — Path in Supabase Storage (from `files.storage_path`)
 * @param supabaseUrl — Supabase project URL (from env)
 * @param supabaseServiceKey — Supabase service role key (from env)
 * @returns The validated extraction result, model used, raw response, and timing
 *
 * @throws Error if cost cap is exceeded, download fails, or all retries exhaust
 */
export async function extractFromFile(
  fileId: string,
  mimeType: string,
  storagePath: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<AttemptResult> {
  // 1. Cost-cap guard
  const capCheck = await checkCostCap()
  if (!capCheck.allowed) {
    throw new Error(`Cost cap blocked extraction for file ${fileId}: ${capCheck.reason}`)
  }

  // 2. Download the file
  let base64Data: string
  try {
    base64Data = await downloadFileAsBase64(
      storagePath,
      supabaseUrl,
      supabaseServiceKey
    )
  } catch (err) {
    throw new Error(
      `Failed to download file ${fileId} from storage: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  // 3. Call Gemini with retries
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await callGemini(base64Data, mimeType)
      return result
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      recordFailure()

      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt - 1) * 1000
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  throw new Error(
    `Gemini extraction failed after ${MAX_RETRIES} retries for file ${fileId}: ${lastError?.message}`
  )
}

/**
 * Extract structured financial data with automatic fallback to GPT-4o-mini
 * if Gemini fails after all retries.
 *
 * @param fileId     — UUID of the file in the `files` table
 * @param mimeType   — MIME type of the file
 * @param storagePath — Path in Supabase Storage
 * @param supabaseUrl — Supabase project URL
 * @param supabaseServiceKey — Supabase service role key
 * @returns The validated extraction result (from whichever model succeeded)
 *
 * @throws Error if BOTH models fail or cost cap is exceeded
 */
export async function extractWithFallback(
  fileId: string,
  mimeType: string,
  storagePath: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<AttemptResult> {
  // Attempt 1: Gemini 2.5 Flash
  try {
    return await extractFromFile(
      fileId,
      mimeType,
      storagePath,
      supabaseUrl,
      supabaseServiceKey
    )
  } catch (geminiErr) {
    const geminiMsg =
      geminiErr instanceof Error ? geminiErr.message : String(geminiErr)

    // If the error is a cost-cap block, don't retry — just propagate
    if (geminiMsg.includes('cost cap') || geminiMsg.includes('Circuit breaker')) {
      throw geminiErr
    }

    // Attempt 2: GPT-4o-mini fallback
    // Re-check cost cap for the more expensive fallback
    const capCheck = await checkCostCap()
    if (!capCheck.allowed) {
      throw new Error(
        `Gemini failed (${geminiMsg}) and fallback blocked: ${capCheck.reason}`
      )
    }

    // Re-download file (in case the first attempt consumed the stream)
    let base64Data: string
    try {
      base64Data = await downloadFileAsBase64(
        storagePath,
        supabaseUrl,
        supabaseServiceKey
      )
    } catch (err) {
      throw new Error(
        `Gemini failed (${geminiMsg}) and file re-download failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    try {
      const startTime = Date.now()
      const fallbackResult = await callGptFallback(base64Data, mimeType)
      const totalTimeMs =
        fallbackResult.processingTimeMs + (Date.now() - startTime - fallbackResult.processingTimeMs)

      return {
        ...fallbackResult,
        processingTimeMs: totalTimeMs,
      }
    } catch (gptErr) {
      const gptMsg =
        gptErr instanceof Error ? gptErr.message : String(gptErr)
      throw new Error(
        `Both extraction models failed for file ${fileId}. ` +
          `Gemini: ${geminiMsg} | GPT-4o-mini: ${gptMsg}`
      )
    }
  }
}

// Re-export types for downstream consumers
export type { AttemptResult, ModelName, CostAccumulator }
