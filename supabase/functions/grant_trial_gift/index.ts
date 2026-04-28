/**
 * Wave 7 P48-followup — grant_trial_gift edge function.
 *
 * Credits the authenticated caller with N trial render credits via the
 * existing `grant_trial_gift_atomic` Postgres RPC (see
 * `_shared/render-credits.ts:300` `grantTrialGift` helper).
 *
 * Why a dedicated edge function: the AchievementStep onboarding screen
 * needs to credit the caller with 3 render credits without a privileged
 * client. The user-facing client only carries an anon JWT, so it cannot
 * call the SECURITY DEFINER RPC directly with a service-role client. This
 * function bridges the two — verifies the JWT (P4 / P7 cross-user pattern)
 * and runs the RPC under the service-role client.
 *
 * Idempotency: scoped on `onboarding_gift_${userId}` (not on the request
 * `x-idempotency-key` header). The RPC itself is idempotent on its
 * `p_idempotency_key` argument — calling twice is a no-op. Re-mount
 * during dev hot-reload, a network retry, or a duplicate background
 * invocation cannot double-credit. The amount (3) is hardcoded server-side
 * so the client cannot escalate its own gift.
 *
 * Auth pattern: user-facing function (matches `delete_user_account`),
 * NOT cron-only. JWT verification via `getUser()`, then the function runs
 * under a service-role client. Without auth, anyone could grant gifts to
 * arbitrary userIds.
 *
 * Rate limit: 5/min, 20/hour. The grant is a one-time-per-user action
 * (idempotent on `onboarding_gift_${userId}`), so any retries are cheap
 * server-side, but tight limits still bound retry storms / abuse.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { CORS_HEADERS } from "../_shared/cors.ts";
import {
  enforceRateLimit,
  RateLimitError,
  rateLimitResponse,
  checkOverload,
  overloadResponse,
  recordError,
} from "../_shared/scale-guard.ts";
import { grantTrialGift } from "../_shared/render-credits.ts";

const TRIAL_GIFT_AMOUNT = 3;

/** Wave 7.9 audit A.P0 — map RPC `result.reason` strings to HTTP status
 * codes. The previous version returned 500 for every `ok:false`, masking
 * client-side validation errors as transient infrastructure failures. The
 * canonical reason taxonomy comes from `grant_trial_gift_atomic` and the
 * underlying `grantTrialGift` helper:
 *
 *   - `'invalid_amount'` → 400 (caller passed a non-positive amount —
 *     server-side hardcoded so this should never fire, but route correctly
 *     if it does)
 *   - `'invalid_user'` → 400 (userId not a UUID or not in profiles)
 *   - `'rpc_error'` / unknown → 500 (genuinely transient / infrastructure)
 *
 * Routing 4xx for the validation reasons keeps the client's error surface
 * actionable (caller knows it's a permanent rejection, not a retry case).
 */
function statusForReason(reason: string | undefined): number {
  switch (reason) {
    case "invalid_amount":
    case "invalid_user":
      return 400;
    default:
      return 500;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }

  if (checkOverload("grant_trial_gift")) {
    return overloadResponse(CORS_HEADERS);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth FIRST — verify JWT before anything else. This function is
    // user-facing, not cron-only, so the pattern matches delete_user_account
    // (anon client + getUser, NOT the timingSafeEqual hard-reject pattern
    // used for cron-only functions like daily_reminders).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const userId = user.id;

    // Service-role client for the RPC — `grantTrialGift` calls
    // `grant_trial_gift_atomic` which is locked down to service_role.
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    await enforceRateLimit(adminClient, userId, "grant_trial_gift");

    // Idempotency key derived server-side from the verified userId. A
    // client cannot fabricate a different key to bypass the no-op behaviour.
    const idempotencyKey = `onboarding_gift_${userId}`;
    const result = await grantTrialGift(
      adminClient,
      userId,
      TRIAL_GIFT_AMOUNT,
      idempotencyKey,
    );

    if (!result.ok) {
      console.error("[grant_trial_gift] RPC returned ok:false", {
        userId,
        reason: result.reason,
        error: result.error,
      });
      const status = statusForReason(result.reason);
      // Only record errors for genuinely transient failures (5xx). 4xx
      // routes are deterministic client problems and shouldn't trip the
      // overload guard.
      if (status >= 500) {
        recordError("grant_trial_gift");
      }
      return new Response(
        JSON.stringify({
          ok: false,
          reason: result.reason ?? "unknown_error",
        }),
        {
          status,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        amount: TRIAL_GIFT_AMOUNT,
        duplicate: result.duplicate === true,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    if (err instanceof RateLimitError) {
      return rateLimitResponse(err, CORS_HEADERS);
    }
    // Wave 7.9 audit A.P0 — record overload-guard error for transport-level
    // failures (network blips, RPC throws, JSON parse errors). Without this,
    // the overload guard never trips even under heavy upstream-error load
    // because every transport failure was caught and returned as a fresh
    // 500 with no telemetry signal. The guard's `recordError` increments an
    // in-isolate counter; once the counter exceeds the threshold the next
    // `checkOverload` short-circuits with 503 and gives the upstream time
    // to recover before we keep hammering it.
    recordError("grant_trial_gift");
    console.error("[grant_trial_gift] unexpected error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
});
