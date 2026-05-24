/**
 * Transaction Server Actions — CRUD for the core ledger.
 *
 * All monetary amounts are INTEGER minor units (sen for MYR, cents for USD).
 * Never use float for money.
 *
 * @module lib/actions/transactions
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  TransactionRow,
  TransactionInsert,
  TransactionStatus,
  TransactionType,
  PeriodStatus,
} from "@/lib/supabase/database.types";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// List transactions (with filters)
// ---------------------------------------------------------------------------

export async function listTransactions(params?: {
  entityId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  periodStatus?: PeriodStatus;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ transactions: TransactionRow[]; total: number }> {
  const supabase = await createClient();

  let query = supabase
    .from("transactions")
    .select("*, entities(name, slug)", { count: "exact" })
    .order("occurred_at", { ascending: false });

  if (params?.entityId) {
    query = query.eq("entity_id", params.entityId);
  }
  if (params?.type) {
    query = query.eq("type", params.type);
  }
  if (params?.status) {
    query = query.eq("status", params.status);
  } else {
    query = query.neq("status", "archived");
  }
  if (params?.periodStatus) {
    query = query.eq("period_status", params.periodStatus);
  }
  if (params?.dateFrom) {
    query = query.gte("occurred_at", params.dateFrom);
  }
  if (params?.dateTo) {
    query = query.lte("occurred_at", params.dateTo);
  }
  if (params?.searchQuery) {
    query = query.or(
      `vendor.ilike.%${params.searchQuery}%,description.ilike.%${params.searchQuery}%,category.ilike.%${params.searchQuery}%`
    );
  }

  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("listTransactions error:", error);
    throw new Error(`Failed to list transactions: ${error.message}`);
  }

  return {
    transactions: (data ?? []) as unknown as TransactionRow[],
    total: count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Get single transaction
// ---------------------------------------------------------------------------

export async function getTransaction(
  id: string
): Promise<TransactionRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .select("*, entities(name, slug), files(*), subscriptions(name), projects(name, client)")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("getTransaction error:", error);
    throw new Error(`Failed to get transaction: ${error.message}`);
  }

  return data as unknown as TransactionRow;
}

// ---------------------------------------------------------------------------
// Create transaction
// ---------------------------------------------------------------------------

export async function createTransaction(
  data: TransactionInsert
): Promise<{ transactionId: string }> {
  const supabase = await createClient();

  const { data: result, error } = await supabase
    .from("transactions")
    .insert(data)
    .select("id")
    .single();

  if (error) {
    console.error("createTransaction error:", error);
    throw new Error(`Failed to create transaction: ${error.message}`);
  }

  revalidatePath("/ledger");
  revalidatePath("/dashboard");

  return { transactionId: result.id };
}

// ---------------------------------------------------------------------------
// Update transaction
// ---------------------------------------------------------------------------

export async function updateTransaction(
  id: string,
  data: Partial<TransactionInsert>
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("transactions")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("updateTransaction error:", error);
    throw new Error(`Failed to update transaction: ${error.message}`);
  }

  revalidatePath("/ledger");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Approve transaction (pending_review → active)
// ---------------------------------------------------------------------------

export async function approveTransaction(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("transactions")
    .update({ status: "active" as TransactionStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending_review");

  if (error) {
    console.error("approveTransaction error:", error);
    throw new Error(`Failed to approve transaction: ${error.message}`);
  }

  revalidatePath("/review");
  revalidatePath("/ledger");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Reject transaction (pending_review → archived)
// ---------------------------------------------------------------------------

export async function rejectTransaction(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("transactions")
    .update({ status: "archived" as TransactionStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending_review");

  if (error) {
    console.error("rejectTransaction error:", error);
    throw new Error(`Failed to reject transaction: ${error.message}`);
  }

  revalidatePath("/review");
  revalidatePath("/ledger");
}

// ---------------------------------------------------------------------------
// Archive transaction (soft delete)
// ---------------------------------------------------------------------------

export async function archiveTransaction(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("transactions")
    .update({ status: "archived" as TransactionStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("archiveTransaction error:", error);
    throw new Error(`Failed to archive transaction: ${error.message}`);
  }

  revalidatePath("/ledger");
}

// ---------------------------------------------------------------------------
// Count pending review transactions (for dashboard badge)
// ---------------------------------------------------------------------------

export async function getPendingReviewCount(): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_review");

  if (error) {
    console.error("getPendingReviewCount error:", error);
    return 0;
  }

  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Count transactions by type for dashboard
// ---------------------------------------------------------------------------

export async function getDashboardCounts(): Promise<{
  pendingReview: number;
  activeExpenses: number;
  activeIncome: number;
}> {
  const supabase = await createClient();

  const [{ count: pendingReview }, { count: activeExpenses }, { count: activeIncome }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_review"),
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("type", "expense")
        .eq("status", "active"),
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("type", "income")
        .eq("status", "active"),
    ]);

  return {
    pendingReview: pendingReview ?? 0,
    activeExpenses: activeExpenses ?? 0,
    activeIncome: activeIncome ?? 0,
  };
}
