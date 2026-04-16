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

/**
 * Success shape from reserveCredit.
 *
 * `replay` is REQUIRED on success: the RPC sets it to `false` when a new
 * ledger row was just written, and `true` when the idempotency key was
 * already present (caller is hitting the idempotency short-circuit).
 *
 * Callers that run expensive work (e.g. Gemini) MUST check `replay` and
 * skip the expensive path when it's `true` — the original attempt either
 * already completed (return cached result) or is still in flight (return
 * a 202-style response).
 */
export type ReserveSuccess = {
  ok: true;
  source: "monthly" | "topup" | "trial_gift";
  replay: boolean;
};

export type ReserveFailure = {
  ok: false;
  reason: CreditDenialReason;
  /** Original RPC error message when reason === "rpc_error". */
  error?: string;
};

export type ReserveResult = ReserveSuccess | ReserveFailure;

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
 * Pure-read balance query. Works with any client (service-role OR
 * RLS-protected anon/authenticated) because it's a SELECT against
 * render_credits. Does NOT trigger a period reset.
 *
 * Client-side code and anything that only needs a display value should
 * use this. An hourly pg_cron (reset_expired_periods_batch) keeps the
 * row fresh system-wide, and server-side write paths still lazy-reset
 * via getBalance() inline, so the value returned here is at worst one
 * hour stale — acceptable for display.
 */
export async function readBalance(
  client: any,
  userId: string,
): Promise<CreditBalance> {
  const { data, error } = await client
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

/**
 * Server-side balance query with inline period reset.
 *
 * REQUIRES service_role client: `reset_period_if_needed` is locked down
 * to service_role. Callers must pass a client created with
 * SUPABASE_SERVICE_ROLE_KEY — passing a user-scoped/anon client will
 * fail the RPC call and fall back to stale data.
 *
 * Use from edge function write paths where fresh accounting matters
 * (reserve, consume, release, etc.). For read-only display, use
 * `readBalance` instead.
 */
export async function getBalance(
  supabaseAdmin: any,
  userId: string,
): Promise<CreditBalance> {
  // Lazy reset on read. Write paths all hit this first, so the period
  // is always fresh when balances are computed for a mutation decision.
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

  // Normalise: RPC returns { ok, source, replay? } on success (new shape,
  // migration 20260416233226) or { ok: true, source, duplicate: true } on
  // legacy idempotency-hit (pre-migration shape).
  //
  // Both shapes must be treated as replays — if the edge function deploys
  // ahead of the migration, the RPC still emits `duplicate: true` and we
  // would otherwise misclassify retries as fresh reserves. That reopens
  // the exact bug the replay flag was introduced to fix: Gemini is called
  // twice, consume then hits already_terminal, producing a free render.
  //
  // TODO(cleanup after migration 20260416233226_reserve_credit_replay_flag
  // is confirmed applied in all environments): remove the `duplicate`
  // legacy-mapping — grep this TODO tag to locate.
  const raw = data as Record<string, unknown>;
  if (raw?.ok === true) {
    return {
      ok: true,
      source: raw.source as ReserveSuccess["source"],
      replay: raw.replay === true || raw.duplicate === true,
    };
  }

  return {
    ok: false,
    reason: (raw?.reason as CreditDenialReason) ?? "rpc_error",
  };
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
