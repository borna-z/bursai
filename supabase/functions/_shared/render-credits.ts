/**
 * Render Credit Ledger — Shared module for studio-quality render credits.
 *
 * All mutations delegate to atomic Postgres RPC functions to guarantee
 * consistency without requiring the edge function to hold transactions
 * across async awaits. Every mutation is idempotent on idempotency_key.
 *
 * Credit consumption priority: trial_gift → monthly → topup.
 */

// ─── Types ─────────────────────────────────────────────────

export interface CreditBalance {
  remaining: number;
  used: number;
  reserved: number;
  monthly_allowance: number;
  topup: number;
  trial_gift: number;
  period_start: string;
  period_end: string;
}

/**
 * Reasons returned by credit RPCs.
 *
 * Business denials (caller should show UI, not retry):
 *   - "insufficient"     — user is out of credits in all sources
 *   - "no_credit_row"    — user has no render_credits row (pre-init)
 *   - "no_reservation"   — consume/release called with no matching reserve
 *   - "already_terminal" — consume/release called on an already-finalized job
 *
 * Transport-level failure (caller should retry or surface an internal error,
 * NOT show an upgrade CTA — the user may have plenty of credits):
 *   - "rpc_error"        — network, DB, or PL/pgSQL-level failure
 */
export type CreditDenialReason =
  | "insufficient"
  | "no_credit_row"
  | "no_reservation"
  | "already_terminal"
  | "rpc_error";

export interface ReserveResult {
  ok: boolean;
  source?: "monthly" | "topup" | "trial_gift";
  reason?: CreditDenialReason;
  duplicate?: boolean;
  /** Original RPC error message when reason === "rpc_error". */
  error?: string;
}

export interface MutationResult {
  ok: boolean;
  source?: string;
  reason?: CreditDenialReason;
  duplicate?: boolean;
  /** Original RPC error message when reason === "rpc_error". */
  error?: string;
}

// ─── Balance ───────────────────────────────────────────────

/**
 * Get current credit balance for a user.
 * Resets the period first if period_end has passed.
 */
export async function getBalance(
  supabaseAdmin: any,
  userId: string,
): Promise<CreditBalance> {
  // Reset period if needed (fire-and-forget is fine — the RPC is atomic)
  await supabaseAdmin.rpc("reset_period_if_needed", { p_user_id: userId });

  const { data, error } = await supabaseAdmin
    .from("render_credits")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    // Return zero-balance if row doesn't exist yet
    return {
      remaining: 0,
      used: 0,
      reserved: 0,
      monthly_allowance: 0,
      topup: 0,
      trial_gift: 0,
      period_start: new Date().toISOString(),
      period_end: new Date().toISOString(),
    };
  }

  const monthlyAvailable = Math.max(0, data.monthly_allowance - data.used_this_period - data.reserved);
  const remaining = data.trial_gift_remaining + monthlyAvailable + data.topup_balance;

  return {
    remaining,
    used: data.used_this_period,
    reserved: data.reserved,
    monthly_allowance: data.monthly_allowance,
    topup: data.topup_balance,
    trial_gift: data.trial_gift_remaining,
    period_start: data.period_start,
    period_end: data.period_end,
  };
}

// ─── Reserve ───────────────────────────────────────────────

/**
 * Atomically reserve one render credit.
 * Priority: trial_gift → monthly → topup.
 * Idempotent on idempotencyKey.
 */
export async function reserveCredit(
  supabaseAdmin: any,
  userId: string,
  jobId: string,
  idempotencyKey: string,
): Promise<ReserveResult> {
  const { data, error } = await supabaseAdmin.rpc("reserve_credit_atomic", {
    p_user_id: userId,
    p_job_id: jobId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error("[render-credits] reserveCredit RPC error:", error.message);
    // Transport/DB failure, NOT a business denial — caller should retry or
    // surface an internal error, not show an "out of credits" CTA.
    return { ok: false, reason: "rpc_error", error: error.message };
  }

  return data as ReserveResult;
}

// ─── Consume ───────────────────────────────────────────────

/**
 * Confirm a reservation — moves reserved → used.
 * Idempotent on idempotencyKey.
 */
export async function consumeCredit(
  supabaseAdmin: any,
  userId: string,
  jobId: string,
  idempotencyKey: string,
): Promise<MutationResult> {
  const { data, error } = await supabaseAdmin.rpc("consume_credit_atomic", {
    p_user_id: userId,
    p_job_id: jobId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error("[render-credits] consumeCredit RPC error:", error.message);
    return { ok: false, reason: "rpc_error", error: error.message };
  }

  return data as MutationResult;
}

// ─── Release ───────────────────────────────────────────────

/**
 * Release a reservation — returns the credit to its source.
 * Called on render failure.
 * Idempotent on idempotencyKey.
 */
export async function releaseCredit(
  supabaseAdmin: any,
  userId: string,
  jobId: string,
  idempotencyKey: string,
): Promise<MutationResult> {
  const { data, error } = await supabaseAdmin.rpc("release_credit_atomic", {
    p_user_id: userId,
    p_job_id: jobId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error("[render-credits] releaseCredit RPC error:", error.message);
    return { ok: false, reason: "rpc_error", error: error.message };
  }

  return data as MutationResult;
}

// ─── Grant Trial Gift ──────────────────────────────────────

/**
 * Grant trial gift render credits.
 * Idempotent on idempotencyKey — calling twice with same key is a no-op.
 */
export async function grantTrialGift(
  supabaseAdmin: any,
  userId: string,
  amount: number,
  idempotencyKey: string,
): Promise<MutationResult> {
  const { data, error } = await supabaseAdmin.rpc("grant_trial_gift_atomic", {
    p_user_id: userId,
    p_amount: amount,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error("[render-credits] grantTrialGift RPC error:", error.message);
    return { ok: false, reason: "rpc_error", error: error.message };
  }

  return data as MutationResult;
}

// ─── Set Monthly Allowance ─────────────────────────────────

/**
 * Set the monthly render allowance for a user.
 * Called by Stripe webhook on subscription change.
 * Idempotent on idempotencyKey.
 */
export async function setMonthlyAllowance(
  supabaseAdmin: any,
  userId: string,
  allowance: number,
  idempotencyKey: string,
): Promise<MutationResult> {
  const { data, error } = await supabaseAdmin.rpc("set_monthly_allowance_atomic", {
    p_user_id: userId,
    p_allowance: allowance,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error("[render-credits] setMonthlyAllowance RPC error:", error.message);
    return { ok: false, reason: "rpc_error", error: error.message };
  }

  return data as MutationResult;
}

// ─── Reset Period ──────────────────────────────────────────

/**
 * Advance the billing period if period_end < now.
 * Resets used_this_period, preserves topup and trial_gift.
 */
export async function resetPeriodIfNeeded(
  supabaseAdmin: any,
  userId: string,
): Promise<void> {
  const { error } = await supabaseAdmin.rpc("reset_period_if_needed", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[render-credits] resetPeriodIfNeeded RPC error:", error.message);
  }
}
