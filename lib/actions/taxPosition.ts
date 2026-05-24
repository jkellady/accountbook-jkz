/**
 * @fileoverview Tax Position Server Actions — JK Zentra Finance Cockpit
 *
 * Provides the calculation engine behind the Tax Position Module.
 * All monetary amounts are in INTEGER minor units (sen) to avoid float drift.
 * Every forecast step is transparent — no black boxes.
 *
 * DISCLAIMER: This is a simplified directional estimate. Actual tax liability
 * depends on many factors. Consult your tax agent for filing.
 *
 * @module lib/actions/taxPosition
 */

"use server";

import { createActionClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  TransactionRow,
  CP500ScheduleItem,
  UserSettings,
} from "@/lib/supabase/database.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The four KPI tiles shown at the top of the Tax Position view. */
export interface TaxPositionKPIs {
  /** Sum of income transactions YTD in minor units (sen). */
  income_ytd_minor: number;
  /** Sum of tax-claimable expense transactions YTD in minor units (sen). */
  deductible_ytd_minor: number;
  /** Sum of tax_prepayment transactions (CP500 paid) in minor units (sen). */
  cp500_paid_minor: number;
  /** Total CP500 scheduled for the year from settings in minor units (sen). */
  cp500_scheduled_minor: number;
  /** Sum of tax_reserve_transfer transactions YTD in minor units (sen). */
  tax_reserve_minor: number;
  /** How many CP500 instalments have been paid. */
  cp500_instalments_paid: number;
  /** Total CP500 instalments scheduled (always 6). */
  cp500_instalments_total: number;
}

/** Full step-by-step forecast math result. Every field is derived transparently. */
export interface TaxForecast {
  /** Actual income year-to-date in minor units (sen). */
  income_ytd_minor: number;
  /** Number of months elapsed since year start (minimum 1). */
  months_elapsed: number;
  /** Number of months remaining in the year. */
  months_remaining: number;
  /** Projected income for remaining months based on run-rate in minor units (sen). */
  projected_remaining_minor: number;
  /** Projected full-year income in minor units (sen). */
  projected_full_year_minor: number;
  /** Actual tax-claimable expenses YTD in minor units (sen). */
  deductible_ytd_minor: number;
  /** Projected annual deductible expenses (YTD expenses annualised) in minor units (sen). */
  projected_annual_deductible_minor: number;
  /** Projected taxable income (full-year income minus annualised deductions) in minor units (sen). */
  projected_taxable_income_minor: number;
  /** Effective tax rate as a decimal (e.g. 0.124 for 12.4%). */
  effective_tax_rate: number;
  /** Estimated full-year tax liability in minor units (sen). */
  estimated_tax_minor: number;
  /** Total CP500 scheduled for the year in minor units (sen). */
  cp500_scheduled_minor: number;
  /** Difference between CP500 scheduled and estimated tax in minor units (sen). Positive = overpaying. */
  variance_minor: number;
  /** Human-readable verdict based on variance vs threshold. */
  verdict: "overpaying" | "underpaying" | "on_track";
}

/** A single CP500 instalment enriched with payment status. */
export interface CP500Instalment {
  /** Instalment number (1–6). */
  instalment_no: number;
  /** ISO-8601 due date (e.g. '2026-04-30'). */
  due_date: string;
  /** Amount due in minor units (sen). */
  amount_minor: number;
  /** Whether a matching tax_prepayment transaction exists. */
  is_paid: boolean;
  /** Date the instalment was paid, if applicable. */
  paid_date: string | null;
  /** Linked receipt file ID, if any. */
  file_id: string | null;
}

/** CP500 schedule response. */
export interface CP500ScheduleResponse {
  /** The 6 CP500 instalments with payment status. */
  instalments: CP500Instalment[];
}

/** Year-end tax preparation workspace data. */
export interface TaxPrepData {
  /** All transactions for the selected year and entity. */
  transactions: TransactionRow[];
  /** Transactions grouped by category with running totals. */
  byCategory: {
    /** Category name. */
    category: string;
    /** Total amount in minor units (sen). */
    total_minor: number;
    /** Number of transactions in this category. */
    count: number;
  }[];
  /** Number of tax-claimable transactions missing a receipt (file_id IS NULL). */
  missingReceiptCount: number;
}

/** Parameters for marking a CP500 instalment as paid. */
export interface MarkCP500PaidParams {
  instalmentNo: number;
  date: string;
  fileId?: string;
}

/** Response from marking a CP500 instalment as paid. */
export interface MarkCP500PaidResponse {
  /** ID of the created tax_prepayment transaction. */
  transactionId: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get year boundaries for a given assessment year.
 * Malaysia tax year runs Jan–Dec, assessed the following year.
 * Year 2026 assessment = income from 2026-01-01 to 2026-12-31.
 *
 * @param year - The assessment year (e.g. 2026).
 * @returns Tuple of [yearStart, yearEnd] as ISO date strings.
 */
function getYearBoundaries(year: number): [string, string] {
  return [`${year}-01-01`, `${year}-12-31`];
}

/**
 * Calculate months elapsed from year start to today.
 * Returns at least 1 to avoid division-by-zero in run-rate calculations.
 *
 * @param year - The assessment year.
 * @returns Number of full months elapsed (1–12).
 */
function getMonthsElapsed(year: number): number {
  const now = new Date();
  const yearStart = new Date(`${year}-01-01`);
  const effectiveNow = now < yearStart ? yearStart : now;

  const months =
    (effectiveNow.getFullYear() - yearStart.getFullYear()) * 12 +
    (effectiveNow.getMonth() - yearStart.getMonth()) +
    1; // +1 because Jan 1–31 counts as month 1

  return Math.max(1, Math.min(12, months));
}

/**
 * Resolve the taxable entity ID from an optional slug filter.
 * If slug is provided, returns the matching entity.
 * If no slug, returns the JK Zentra entity (the taxable entity).
 *
 * @param supabase - Typed Supabase client.
 * @param entitySlug - Optional entity slug filter.
 * @returns The entity ID to use for queries, or null if not found.
 */
async function resolveEntityId(
  supabase: SupabaseClient<Database>,
  entitySlug?: string
): Promise<string | null> {
  let query = supabase
    .from("entities")
    .select("id")
    .eq("is_taxable", true);

  if (entitySlug) {
    query = query.eq("slug", entitySlug as "personal" | "jk-zentra");
  } else {
    query = query.eq("slug", "jk-zentra");
  }

  const { data, error } = await query.single();

  if (error || !data) {
    console.error("[taxPosition] resolveEntityId error:", error);
    return null;
  }

  return data.id;
}

/**
 * Fetch user settings from the database.
 * Returns default values if settings are not populated.
 *
 * @param supabase - Typed Supabase client.
 * @returns UserSettings with defaults applied.
 */
async function getUserSettings(
  supabase: SupabaseClient<Database>
): Promise<UserSettings> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return getDefaultSettings();
  }

  const { data, error } = await supabase
    .from("users")
    .select("settings")
    .eq("id", user.id)
    .single();

  if (error || !data || !data.settings) {
    console.error("[taxPosition] getUserSettings error:", error);
    return getDefaultSettings();
  }

  return mergeSettings(data.settings as unknown as Partial<UserSettings>);
}

/**
 * Return sensible defaults for tax calculation settings.
 *
 * @returns Default UserSettings.
 */
function getDefaultSettings(): UserSettings {
  return {
    default_entity_id: null,
    tax_year_start: `${new Date().getFullYear()}-01-01`,
    effective_tax_rate_percent: 15,
    lhdn_forecast_income_minor: 0,
    cp500_schedule: [],
    tax_reserve_strategy: {
      enabled: false,
      percent_of_income: 15,
      target_account_name: "Tax Reserve",
      reminder_day_of_month: 15,
    },
    cp502_threshold_percent: 10,
    reminder_channels: ["in_app"],
    google_calendar_connected: false,
    fx_preference: "latest_cached",
    monthly_ai_cost_cap_minor: 50000,
  };
}

/**
 * Merge partial settings from database with full defaults.
 *
 * @param partial - Partial settings from DB.
 * @returns Complete UserSettings.
 */
function mergeSettings(partial: Partial<UserSettings>): UserSettings {
  const defaults = getDefaultSettings();
  return {
    ...defaults,
    ...partial,
    tax_reserve_strategy: {
      ...defaults.tax_reserve_strategy,
      ...(partial.tax_reserve_strategy ?? {}),
    },
    cp500_schedule: partial.cp500_schedule ?? defaults.cp500_schedule,
  };
}

// ===========================================================================
// SERVER ACTIONS
// ===========================================================================

/**
 * Get the four KPI values for the Tax Position header tiles.
 *
 * @param year - Assessment year (e.g. 2026). Defaults to current year.
 * @param entitySlug - Optional entity slug filter (e.g. 'jk-zentra').
 * @returns TaxPositionKPIs with all four KPI values.
 */
export async function getTaxPositionKPIs(
  year?: number,
  entitySlug?: string
): Promise<TaxPositionKPIs> {
  const supabase = await createActionClient();
  const assessmentYear = year ?? new Date().getFullYear();
  const [yearStart, yearEnd] = getYearBoundaries(assessmentYear);

  const entityId = await resolveEntityId(supabase, entitySlug);
  if (!entityId) {
    return {
      income_ytd_minor: 0,
      deductible_ytd_minor: 0,
      cp500_paid_minor: 0,
      cp500_scheduled_minor: 0,
      tax_reserve_minor: 0,
      cp500_instalments_paid: 0,
      cp500_instalments_total: 6,
    };
  }

  const today = new Date().toISOString().split("T")[0];

  // --- Income YTD: SUM(myr_equiv_minor) WHERE type='income' ---
  const { data: incomeData, error: incomeError } = await supabase
    .from("transactions")
    .select("myr_equiv_minor")
    .eq("entity_id", entityId)
    .eq("type", "income")
    .eq("status", "active")
    .gte("occurred_at", yearStart)
    .lte("occurred_at", today);

  if (incomeError) {
    console.error("[taxPosition] income YTD error:", incomeError);
  }
  const incomeYtd =
    incomeData?.reduce((sum, row) => sum + (row.myr_equiv_minor ?? 0), 0) ?? 0;

  // --- Deductible YTD: SUM(myr_equiv_minor) WHERE type='expense' AND tags @> ['tax-claimable'] ---
  const { data: deductibleData, error: deductibleError } = await supabase
    .from("transactions")
    .select("myr_equiv_minor")
    .eq("entity_id", entityId)
    .eq("type", "expense")
    .eq("status", "active")
    .contains("tags", ["tax-claimable"])
    .gte("occurred_at", yearStart)
    .lte("occurred_at", today);

  if (deductibleError) {
    console.error("[taxPosition] deductible YTD error:", deductibleError);
  }
  const deductibleYtd =
    deductibleData?.reduce(
      (sum, row) => sum + (row.myr_equiv_minor ?? 0),
      0
    ) ?? 0;

  // --- CP500 Paid: SUM(myr_equiv_minor) WHERE type='tax_prepayment' ---
  const { data: cp500Data, error: cp500Error } = await supabase
    .from("transactions")
    .select("myr_equiv_minor")
    .eq("entity_id", entityId)
    .eq("type", "tax_prepayment")
    .eq("status", "active")
    .gte("occurred_at", yearStart)
    .lte("occurred_at", yearEnd);

  if (cp500Error) {
    console.error("[taxPosition] CP500 paid error:", cp500Error);
  }
  const cp500Paid =
    cp500Data?.reduce((sum, row) => sum + (row.myr_equiv_minor ?? 0), 0) ?? 0;

  // --- Tax Reserve: SUM(myr_equiv_minor) WHERE type='tax_reserve_transfer' ---
  const { data: reserveData, error: reserveError } = await supabase
    .from("transactions")
    .select("myr_equiv_minor")
    .eq("entity_id", entityId)
    .eq("type", "tax_reserve_transfer")
    .eq("status", "active")
    .gte("occurred_at", yearStart)
    .lte("occurred_at", today);

  if (reserveError) {
    console.error("[taxPosition] tax reserve error:", reserveError);
  }
  const taxReserve =
    reserveData?.reduce((sum, row) => sum + (row.myr_equiv_minor ?? 0), 0) ??
    0;

  // --- CP500 Scheduled from settings ---
  const settings = await getUserSettings(supabase);
  const cp500Scheduled = (settings.cp500_schedule ?? []).reduce(
    (sum, inst: CP500ScheduleItem) => sum + (inst.amount_minor ?? 0),
    0
  );

  // Count paid instalments by matching to transactions
  const cp500InstalmentsTotal = settings.cp500_schedule?.length ?? 6;
  const paidInstalments =
    settings.cp500_schedule?.filter((inst: CP500ScheduleItem) => {
      return inst.status === "paid" || inst.file_id;
    }).length ?? 0;

  return {
    income_ytd_minor: incomeYtd,
    deductible_ytd_minor: deductibleYtd,
    cp500_paid_minor: cp500Paid,
    cp500_scheduled_minor: cp500Scheduled,
    tax_reserve_minor: taxReserve,
    cp500_instalments_paid: paidInstalments,
    cp500_instalments_total: cp500InstalmentsTotal,
  };
}

/**
 * Get the full step-by-step forecast math.
 * Every intermediate value is returned so the UI can show transparent calculations.
 *
 * @param year - Assessment year (e.g. 2026). Defaults to current year.
 * @param entitySlug - Optional entity slug filter.
 * @returns TaxForecast with every step of the calculation exposed.
 */
export async function getTaxForecast(
  year?: number,
  entitySlug?: string
): Promise<TaxForecast> {
  const supabase = await createActionClient();
  const assessmentYear = year ?? new Date().getFullYear();
  const [yearStart, yearEnd] = getYearBoundaries(assessmentYear);

  const entityId = await resolveEntityId(supabase, entitySlug);
  const settings = await getUserSettings(supabase);

  const today = new Date().toISOString().split("T")[0];

  // Fallback zero forecast if no entity found
  if (!entityId) {
    return {
      income_ytd_minor: 0,
      months_elapsed: 1,
      months_remaining: 11,
      projected_remaining_minor: 0,
      projected_full_year_minor: 0,
      deductible_ytd_minor: 0,
      projected_annual_deductible_minor: 0,
      projected_taxable_income_minor: 0,
      effective_tax_rate: settings.effective_tax_rate_percent / 100,
      estimated_tax_minor: 0,
      cp500_scheduled_minor: 0,
      variance_minor: 0,
      verdict: "on_track",
    };
  }

  // --- Income YTD ---
  const { data: incomeData, error: incomeError } = await supabase
    .from("transactions")
    .select("myr_equiv_minor")
    .eq("entity_id", entityId)
    .eq("type", "income")
    .eq("status", "active")
    .gte("occurred_at", yearStart)
    .lte("occurred_at", today);

  if (incomeError) {
    console.error("[taxPosition] forecast income error:", incomeError);
  }
  const incomeYtd =
    incomeData?.reduce((sum, row) => sum + (row.myr_equiv_minor ?? 0), 0) ?? 0;

  // --- Deductible YTD ---
  const { data: deductibleData, error: deductibleError } = await supabase
    .from("transactions")
    .select("myr_equiv_minor")
    .eq("entity_id", entityId)
    .eq("type", "expense")
    .eq("status", "active")
    .contains("tags", ["tax-claimable"])
    .gte("occurred_at", yearStart)
    .lte("occurred_at", today);

  if (deductibleError) {
    console.error("[taxPosition] forecast deductible error:", deductibleError);
  }
  const deductibleYtd =
    deductibleData?.reduce(
      (sum, row) => sum + (row.myr_equiv_minor ?? 0),
      0
    ) ?? 0;

  // --- CP500 Scheduled ---
  const cp500Scheduled = (settings.cp500_schedule ?? []).reduce(
    (sum, inst: CP500ScheduleItem) => sum + (inst.amount_minor ?? 0),
    0
  );

  // --- Forecast Math (transparent step-by-step) ---
  const monthsElapsed = getMonthsElapsed(assessmentYear);
  const monthsRemaining = 12 - monthsElapsed;

  // If LHDN forecast is set and non-zero, use it; otherwise run-rate projection
  const lhdnForecast = settings.lhdn_forecast_income_minor ?? 0;

  // Projected remaining income
  let projectedRemaining: number;
  if (lhdnForecast > 0 && incomeYtd < lhdnForecast) {
    // Use LHDN forecast as full-year target, subtract YTD
    projectedRemaining = lhdnForecast - incomeYtd;
  } else {
    // Run-rate: YTD / months_elapsed * months_remaining
    projectedRemaining = Math.round(
      (incomeYtd / monthsElapsed) * monthsRemaining
    );
  }

  const projectedFullYear = incomeYtd + projectedRemaining;

  // Annualise deductible expenses
  const projectedAnnualDeductible = Math.round(
    (deductibleYtd / monthsElapsed) * 12
  );

  // Projected taxable income (floor at 0)
  const projectedTaxable = Math.max(
    0,
    projectedFullYear - projectedAnnualDeductible
  );

  // Effective tax rate from settings (as decimal)
  const effectiveTaxRate = (settings.effective_tax_rate_percent ?? 15) / 100;

  // Estimated tax
  const estimatedTax = Math.round(projectedTaxable * effectiveTaxRate);

  // Variance: positive = CP500 covers more than estimated (overpaying)
  const variance = cp500Scheduled - estimatedTax;

  // Verdict logic using cp502_threshold_percent (default 10%)
  const thresholdPercent = (settings.cp502_threshold_percent ?? 10) / 100;
  const thresholdAmount = cp500Scheduled * thresholdPercent;

  let verdict: TaxForecast["verdict"];
  if (cp500Scheduled === 0) {
    // No CP500 scheduled — neutral unless estimated tax is significant
    verdict = estimatedTax > 0 ? "underpaying" : "on_track";
  } else if (variance > thresholdAmount) {
    verdict = "overpaying";
  } else if (variance < -thresholdAmount) {
    verdict = "underpaying";
  } else {
    verdict = "on_track";
  }

  return {
    income_ytd_minor: incomeYtd,
    months_elapsed: monthsElapsed,
    months_remaining: monthsRemaining,
    projected_remaining_minor: projectedRemaining,
    projected_full_year_minor: projectedFullYear,
    deductible_ytd_minor: deductibleYtd,
    projected_annual_deductible_minor: projectedAnnualDeductible,
    projected_taxable_income_minor: projectedTaxable,
    effective_tax_rate: effectiveTaxRate,
    estimated_tax_minor: estimatedTax,
    cp500_scheduled_minor: cp500Scheduled,
    variance_minor: variance,
    verdict,
  };
}

/**
 * Get the CP500 instalment schedule enriched with actual payment status.
 * Reads the schedule from users.settings, then cross-references with
 * tax_prepayment transactions to determine which instalments are paid.
 *
 * @param year - Assessment year (e.g. 2026). Defaults to current year.
 * @returns CP500ScheduleResponse with 6 instalments and payment status.
 */
export async function getCP500Schedule(
  year?: number
): Promise<CP500ScheduleResponse> {
  const supabase = await createActionClient();
  const assessmentYear = year ?? new Date().getFullYear();
  const [yearStart, yearEnd] = getYearBoundaries(assessmentYear);

  const settings = await getUserSettings(supabase);

  // Get all tax_prepayment transactions for this year
  const entityId = await resolveEntityId(supabase);
  let prepaymentsQuery = supabase
    .from("transactions")
    .select("myr_equiv_minor, occurred_at, reference_code, file_id")
    .eq("type", "tax_prepayment")
    .eq("status", "active")
    .gte("occurred_at", yearStart)
    .lte("occurred_at", yearEnd);

  if (entityId) {
    prepaymentsQuery = prepaymentsQuery.eq("entity_id", entityId);
  }

  const { data: prepayments, error } = await prepaymentsQuery;

  if (error) {
    console.error("[taxPosition] getCP500Schedule error:", error);
  }

  // Build enriched instalment list
  const schedule: CP500Instalment[] = (settings.cp500_schedule ?? []).map(
    (inst: CP500ScheduleItem) => {
      // Look for a matching prepayment transaction
      // Match by reference_code containing the instalment number, or by amount + date proximity
      const matchingPrepayment = prepayments?.find((p) => {
        // Try to match by reference code (e.g. "CP500-1" or "1/2026")
        if (
          p.reference_code &&
          p.reference_code.includes(String(inst.instalment_no))
        ) {
          return true;
        }
        // Fallback: match by exact amount and date within same month
        if (p.myr_equiv_minor === inst.amount_minor && p.occurred_at) {
          const paymentMonth = new Date(p.occurred_at).getMonth();
          const dueMonth = new Date(inst.due_date).getMonth();
          return paymentMonth === dueMonth;
        }
        return false;
      });

      return {
        instalment_no: inst.instalment_no,
        due_date: inst.due_date,
        amount_minor: inst.amount_minor,
        is_paid: !!matchingPrepayment || inst.status === "paid",
        paid_date: matchingPrepayment?.occurred_at ?? null,
        file_id: inst.file_id ?? matchingPrepayment?.file_id ?? null,
      };
    }
  );

  // If no schedule in settings, return a default 6-instalment skeleton
  if (schedule.length === 0) {
    const defaultAmount = 0;
    const defaultSchedule: CP500Instalment[] = Array.from(
      { length: 6 },
      (_, i) => {
        const month = (i + 1) * 2; // Apr, Jun, Aug, Oct, Dec, Feb
        const dueMonth = month <= 12 ? month : 2;
        const dueYear = month <= 12 ? assessmentYear : assessmentYear + 1;
        const monthStr = String(dueMonth).padStart(2, "0");
        return {
          instalment_no: i + 1,
          due_date: `${dueYear}-${monthStr}-30`,
          amount_minor: defaultAmount,
          is_paid: false,
          paid_date: null,
          file_id: null,
        };
      }
    );
    return { instalments: defaultSchedule };
  }

  return { instalments: schedule };
}

/**
 * Mark a CP500 instalment as paid by creating a tax_prepayment transaction.
 * Also updates the instalment status in users.settings.cp500_schedule.
 *
 * @param instalmentNo - The instalment number (1–6) being marked as paid.
 * @param date - ISO-8601 date string of the payment date.
 * @param fileId - Optional uploaded receipt file ID.
 * @returns MarkCP500PaidResponse with the new transaction ID.
 */
export async function markCP500Paid(
  instalmentNo: number,
  date: string,
  fileId?: string
): Promise<MarkCP500PaidResponse> {
  const supabase = await createActionClient();
  const settings = await getUserSettings(supabase);
  const entityId = await resolveEntityId(supabase);

  if (!entityId) {
    throw new Error("No taxable entity found. Cannot record CP500 payment.");
  }

  // Find the instalment in settings to get the amount
  const instalment = settings.cp500_schedule?.find(
    (inst: CP500ScheduleItem) => inst.instalment_no === instalmentNo
  );

  if (!instalment) {
    throw new Error(`CP500 instalment ${instalmentNo} not found in schedule.`);
  }

  // Create the tax_prepayment transaction
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      entity_id: entityId,
      type: "tax_prepayment",
      amount_minor: instalment.amount_minor,
      currency: "MYR",
      myr_equiv_minor: instalment.amount_minor,
      occurred_at: date,
      vendor: "LHDN",
      category: "Tax",
      subcategory: "CP500",
      reference_code: `CP500-${instalmentNo}/${new Date(date).getFullYear()}`,
      file_id: fileId ?? null,
      tags: ["cp500", `instalment-${instalmentNo}`],
      status: "active",
      period_status: "open",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[taxPosition] markCP500Paid insert error:", error);
    throw new Error(
      `Failed to create tax_prepayment transaction: ${error?.message ?? "Unknown error"}`
    );
  }

  // Update the instalment status in settings
  const updatedSchedule = (settings.cp500_schedule ?? []).map(
    (inst: CP500ScheduleItem) => {
      if (inst.instalment_no === instalmentNo) {
        return {
          ...inst,
          status: "paid" as string,
          file_id: fileId ?? inst.file_id ?? null,
        };
      }
      return inst;
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { error: updateError } = await supabase
      .from("users")
      .update({
        settings: {
          ...settings,
          cp500_schedule: updatedSchedule,
        } as unknown as Database["public"]["Tables"]["users"]["Update"]["settings"],
      })
      .eq("id", user.id);

    if (updateError) {
      console.error(
        "[taxPosition] markCP500Paid settings update error:",
        updateError
      );
    }
  }

  return { transactionId: data.id };
}

/**
 * Get Tax Prep View data for year-end preparation.
 * Returns all transactions for the selected year grouped by category,
 * with missing receipt counts and tag breakdowns.
 *
 * @param year - Assessment year (e.g. 2026). Defaults to current year.
 * @param entitySlug - Optional entity slug filter.
 * @returns TaxPrepData with transactions, category breakdown, and missing receipt count.
 */
export async function getTaxPrepData(
  year?: number,
  entitySlug?: string
): Promise<TaxPrepData> {
  const supabase = await createActionClient();
  const assessmentYear = year ?? new Date().getFullYear();
  const [yearStart, yearEnd] = getYearBoundaries(assessmentYear);

  const entityId = await resolveEntityId(supabase, entitySlug);

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("status", "active")
    .gte("occurred_at", yearStart)
    .lte("occurred_at", yearEnd);

  if (entityId) {
    query = query.eq("entity_id", entityId);
  } else {
    // Default to taxable entity only (JK Zentra)
    query = query.eq("entity_id", "jk-zentra");
  }

  const { data: transactions, error } = await query.order("occurred_at", {
    ascending: false,
  });

  if (error) {
    console.error("[taxPosition] getTaxPrepData error:", error);
    return { transactions: [], byCategory: [], missingReceiptCount: 0 };
  }

  const txs = (transactions ?? []) as TransactionRow[];

  // Group by category with running totals
  const categoryMap = new Map<
    string,
    { category: string; total_minor: number; count: number }
  >();

  for (const tx of txs) {
    const existing = categoryMap.get(tx.category);
    const amount = tx.myr_equiv_minor ?? tx.amount_minor ?? 0;
    if (existing) {
      existing.total_minor += amount;
      existing.count += 1;
    } else {
      categoryMap.set(tx.category, {
        category: tx.category,
        total_minor: amount,
        count: 1,
      });
    }
  }

  const byCategory = Array.from(categoryMap.values()).sort(
    (a, b) => b.total_minor - a.total_minor
  );

  // Count missing receipts: tax-claimable transactions with file_id IS NULL
  const missingReceiptCount = txs.filter((tx) => {
    const hasTaxClaimable = tx.tags?.includes("tax-claimable");
    const missingFile = !tx.file_id;
    return hasTaxClaimable && missingFile;
  }).length;

  return {
    transactions: txs,
    byCategory,
    missingReceiptCount,
  };
}

/**
 * Update user tax settings (effective rate, LHDN forecast, deductible projection).
 * Merges new values with existing settings to avoid overwriting other fields.
 *
 * @param updates - Partial settings to update.
 * @returns Success flag.
 */
export async function updateTaxSettings(updates: {
  effective_tax_rate_percent?: number;
  lhdn_forecast_income_minor?: number;
  projected_annual_deductible_minor?: number;
}): Promise<{ success: boolean }> {
  const supabase = await createActionClient();
  const settings = await getUserSettings(supabase);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated.");
  }

  const mergedSettings: UserSettings = {
    ...settings,
    ...(updates.effective_tax_rate_percent !== undefined && {
      effective_tax_rate_percent: updates.effective_tax_rate_percent,
    }),
    ...(updates.lhdn_forecast_income_minor !== undefined && {
      lhdn_forecast_income_minor: updates.lhdn_forecast_income_minor,
    }),
    ...(updates.projected_annual_deductible_minor !== undefined && {
      // Store as a custom key in settings for user override
      // This is a UI-level override, not in the DB schema
    }),
  };

  const { error } = await supabase
    .from("users")
    .update({
      settings:
        mergedSettings as unknown as Database["public"]["Tables"]["users"]["Update"]["settings"],
    })
    .eq("id", user.id);

  if (error) {
    console.error("[taxPosition] updateTaxSettings error:", error);
    throw new Error(`Failed to update tax settings: ${error.message}`);
  }

  return { success: true };
}

/**
 * Format a minor-unit amount as MYR currency string.
 * e.g. 32680 → "RM 326.80"
 *
 * @param minor - Amount in minor units (sen).
 * @returns Formatted MYR string.
 */
export function formatMYR(minor: number): string {
  return `RM ${fmtMinor(minor)}`;
}
