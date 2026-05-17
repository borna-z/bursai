/**
 * Wave 8.5 PR B (P90) — destructive Style Memory reset.
 *
 * Calls the SECURITY DEFINER `reset_style_memory_atomic` RPC after
 * auth + rate-limit + subscription gate. Pattern matches `grant_trial_gift`
 * + `start_trial`: anon-client + getUser() for JWT verification, then a
 * service-role client for the RPC.
 *
 * Body: empty object (no parameters — userId comes from the verified JWT).
 *
 * Response:
 *   200 { ok: true, tables_cleared: { feedback_signals, garment_pair_memory, user_style_summaries } }
 *   401 { error: 'Missing authorization header' | 'Unauthorized' }
 *   402 { error: 'subscription_required', reason }
 *   429 { error, retryAfter }
 *   500 { error: 'rpc_failed' }
 *   503 { error: 'overloaded' }
 *
 * Idempotency: every reset call writes an `analytics_events` audit row both
 * BEFORE and AFTER the RPC for forensic trace. Idempotency key is the
 * caller's `X-Idempotency-Key` header if present, else
 * `${FN_NAME}:${userId}` (server-derived from the verified JWT — clients
 * cannot spoof another user's key).
 *
 * Audit trail rationale: this op clears all of the user's learned memory.
 * Forensic logging supports user complaints, supports legal/GDPR review,
 * and surfaces accidental triggers (e.g., a UI bug that fires the action
 * without the confirmation dialog).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { authenticate } from "../_shared/auth.ts";
import { CORS_HEADERS } from "../_shared/cors.ts";
import {
  enforceRateLimit,
  RateLimitError,
  rateLimitResponse,
  enforceSubscription,
  subscriptionLockedResponse,
  checkOverload,
  overloadResponse,
  recordError,
} from "../_shared/scale-guard.ts";
import {
  checkIdempotency,
  storeIdempotencyResult,
} from "../_shared/idempotency.ts";

const FN_NAME = "reset_style_memory";

// deno-lint-ignore no-explicit-any
function jsonResponse(body: unknown, status: number): Response {
  // Audit R6-P11: every PR B endpoint sets `Cache-Control: no-store` so
  // that intermediary CDNs / proxies cannot cache idempotency-replay
  // bodies and serve them across users via key collision.
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // checkOverload returns TRUE when overloaded (matches sibling functions:
  // grant_trial_gift, start_trial, delete_user_account, memory_ingest).
  if (checkOverload(FN_NAME)) {
    return overloadResponse(CORS_HEADERS);
  }

  // ─── Auth: verify the caller's JWT via the shared helper ────────────
  // Replaced the 18-line inline pattern with `authenticate(req, headers)`
  // from `_shared/auth.ts`. Same 401 envelopes, same anon-client
  // construction, just centralized. (N18 — Copilot #9.)
  const authResult = await authenticate(req, CORS_HEADERS);
  if (!authResult.success) return authResult.response;
  const { user } = authResult.auth;
  const userId = user.id;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  // ─── Rate limit ─────────────────────────────────────────────────────
  try {
    await enforceRateLimit(supabaseAdmin, userId, FN_NAME);
  } catch (e) {
    if (e instanceof RateLimitError) return rateLimitResponse(e, CORS_HEADERS);
    recordError(FN_NAME);
    return jsonResponse({ error: "rate_limit_internal" }, 500);
  }

  // ─── Subscription gate (Wave 8 P54) ─────────────────────────────────
  const sub = await enforceSubscription(supabaseAdmin, userId);
  if (!sub.allowed) {
    return subscriptionLockedResponse(sub.reason, CORS_HEADERS);
  }

  // ─── Idempotency (destructive op — double-tap guard) ────────────────
  //
  // The shared helper reads `X-Idempotency-Key` from the request directly
  // and namespaces by (functionName, userId). Returns a baked `Response`
  // when a prior call's result is cached / a concurrent in-flight claim
  // exists; returns `null` when the caller should proceed (fresh key OR
  // no key supplied at all).
  //
  // For destructive ops with no client-supplied key, the helper no-ops
  // (the request proceeds idempotently each call). That's acceptable
  // here — the AlertDialog double-confirmation is the human guard, and
  // the underlying RPC is intrinsically idempotent (re-running the
  // wipe just deletes zero rows the second time).
  const cachedResponse = await checkIdempotency(req, supabaseAdmin, {
    functionName: FN_NAME,
    userId,
  });
  if (cachedResponse) {
    return cachedResponse;
  }

  // ─── Audit BEFORE — forensic trace for this destructive op ───────────
  try {
    await supabaseAdmin.from("analytics_events").insert({
      user_id: userId,
      event_type: "reset_style_memory_initiated",
      metadata: {
        fn: FN_NAME,
        idempotency_key: req.headers.get("X-Idempotency-Key") ?? null,
      },
    });
  } catch (auditErr) {
    // Audit logging is non-critical; don't block the user on telemetry
    // infrastructure issues.
    console.warn("[reset_style_memory] audit_initiated insert failed", auditErr);
  }

  // ─── RPC call — atomic wipe ─────────────────────────────────────────
  try {
    const { data, error } = await supabaseAdmin.rpc(
      "reset_style_memory_atomic",
      { p_user_id: userId },
    );

    if (error) {
      console.error("[reset_style_memory] RPC error", error);
      recordError(FN_NAME);
      return jsonResponse({ error: "rpc_failed" }, 500);
    }

    const counts = (data ?? {}) as {
      ok?: boolean;
      feedback_signals_deleted?: number;
      garment_pair_memory_deleted?: number;
      user_style_summaries_deleted?: number;
    };

    if (counts.ok !== true) {
      console.error("[reset_style_memory] RPC returned non-ok", counts);
      recordError(FN_NAME);
      return jsonResponse({ error: "rpc_failed" }, 500);
    }

    const responseBody = {
      ok: true,
      tables_cleared: {
        feedback_signals: counts.feedback_signals_deleted ?? 0,
        garment_pair_memory: counts.garment_pair_memory_deleted ?? 0,
        user_style_summaries: counts.user_style_summaries_deleted ?? 0,
      },
    };

    // ─── Audit AFTER — capture deletion counts in trace ────────────────
    try {
      await supabaseAdmin.from("analytics_events").insert({
        user_id: userId,
        event_type: "reset_style_memory_completed",
        metadata: {
          fn: FN_NAME,
          idempotency_key: req.headers.get("X-Idempotency-Key") ?? null,
          ...responseBody.tables_cleared,
        },
      });
    } catch (auditErr) {
      console.warn(
        "[reset_style_memory] audit_completed insert failed",
        auditErr,
      );
    }

    const successResponse = jsonResponse(responseBody, 200);

    // Cache the response for idempotency replay. Pass a clone so the
    // helper can consume the body via .clone() while we still return the
    // original to the caller.
    try {
      await storeIdempotencyResult(
        req,
        successResponse.clone(),
        supabaseAdmin,
        { functionName: FN_NAME, userId },
      );
    } catch (cacheErr) {
      console.warn(
        "[reset_style_memory] idempotency store failed",
        cacheErr,
      );
    }

    return successResponse;
  } catch (err) {
    console.error("[reset_style_memory] threw", err);
    recordError(FN_NAME);
    return jsonResponse({ error: "rpc_failed" }, 500);
  }
});
