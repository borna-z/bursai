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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!checkOverload(FN_NAME)) {
    return overloadResponse(CORS_HEADERS);
  }

  // ─── Auth: verify the caller's JWT via anon client + getUser ─────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization header" }, 401);
  }
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const userId = user.id;
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
  const idempotencyKey =
    req.headers.get("X-Idempotency-Key") ?? `${FN_NAME}:${userId}`;
  const cached = await checkIdempotency(
    supabaseAdmin,
    FN_NAME,
    userId,
    idempotencyKey,
  );
  if (cached?.cached_response) {
    return jsonResponse(cached.cached_response, 200);
  }

  // ─── Audit BEFORE — forensic trace for this destructive op ───────────
  try {
    await supabaseAdmin.from("analytics_events").insert({
      user_id: userId,
      event_type: "reset_style_memory_initiated",
      metadata: { fn: FN_NAME, idempotency_key: idempotencyKey },
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
          idempotency_key: idempotencyKey,
          ...responseBody.tables_cleared,
        },
      });
    } catch (auditErr) {
      console.warn(
        "[reset_style_memory] audit_completed insert failed",
        auditErr,
      );
    }

    // Cache the response for idempotency replay.
    try {
      await storeIdempotencyResult(
        supabaseAdmin,
        FN_NAME,
        userId,
        idempotencyKey,
        responseBody,
      );
    } catch (cacheErr) {
      console.warn(
        "[reset_style_memory] idempotency store failed",
        cacheErr,
      );
    }

    return jsonResponse(responseBody, 200);
  } catch (err) {
    console.error("[reset_style_memory] threw", err);
    recordError(FN_NAME);
    return jsonResponse({ error: "rpc_failed" }, 500);
  }
});
