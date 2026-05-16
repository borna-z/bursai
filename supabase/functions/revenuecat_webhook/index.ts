/**
 * M31 PR B — RevenueCat webhook.
 *
 * Mirrors `stripe_webhook` semantics for the RevenueCat path:
 *   1. Verify the request originated from RevenueCat (HMAC + timestamp).
 *   2. De-duplicate by event id (PRIMARY KEY race wins → idempotent).
 *   3. Route by event type → upsert / patch the `subscriptions` row that
 *      matches `app_user_id` to `user_id` (PR A configures Purchases with
 *      `appUserID: user.id` so the values are 1:1 the auth UUID).
 *   4. Always log to `revenuecat_events` so a replay of the same payload
 *      short-circuits to `{ status: 'already_processed' }` AFTER successful
 *      processing. Pending rows (transient failure on the first attempt)
 *      are reprocessed on retry — see migration 20260507120300 for why.
 *
 * Signature scheme (per the M31 wave file):
 *   The wave authoritatively specifies HMAC SHA256 over the raw body,
 *   delivered via the `X-RevenueCat-Signature` header. Validator lives in
 *   `_shared/revenuecat-signature.ts`.
 *
 *   Replay protection: events older than 5 minutes are rejected unless
 *   they match a pending row in `revenuecat_events` (legitimate RC retry).
 *
 * Subscription state semantics:
 *   - INITIAL_PURCHASE / RENEWAL / UNCANCELLATION / PRODUCT_CHANGE /
 *     NON_RENEWING_PURCHASE → upsert `subscriptions` with status='active',
 *     plan='premium', current_period_end = expiration_at_ms; render
 *     allowance set to 20/month.
 *   - TRANSFER → activate the new app_user_id AND end every origin id.
 *   - CANCELLATION → keep status='active' until expiration (Apple grace
 *     period).
 *   - EXPIRATION → status='canceled', plan='free', allowance reset to 0.
 *   - BILLING_ISSUE → status='past_due', plan='free', allowance reset to 0.
 *   - SUBSCRIBER_ALIAS → log recovery hint when auth user has no row.
 *   - TEST / others → log only, no subscriptions mutation.
 *
 * Out-of-order protection: each subscriptions mutation compares
 * `event.event_timestamp_ms` against the row's
 * `latest_revenuecat_event_timestamp_ms`; older events are skipped.
 *
 * Pure event-to-transition mapping lives in
 * `_shared/revenuecat-state-machine.ts`.
 *
 * Error handling:
 *   - PERMANENT processing errors → log to `revenuecat_events.error`,
 *     stamp `processed_at`, return 200.
 *   - TRANSIENT errors → leave `processed_at` NULL so RC retries.
 */

import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { setMonthlyAllowance } from "../_shared/render-credits.ts";
import { captureWarning } from "../_shared/observability.ts";
import { isRevenueCatEventStale } from "../_shared/rc-event-ordering.ts";
import {
  enforceRateLimit,
  RateLimitError,
  rateLimitResponse,
} from "../_shared/scale-guard.ts";
import {
  SIGNATURE_HEADER,
  verifyRevenueCatSignature,
} from "../_shared/revenuecat-signature.ts";
import {
  classifyRevenueCatEvent,
  deriveEventId,
  deriveEventTimestampMs,
  isMutationEventType,
  isStripeActivelyPaying,
  pickLatestActiveEntitlement,
  PREMIUM_MONTHLY_ALLOWANCE,
  RC_STRIPE_MODE_MARKER,
  RcSubscriberResponse,
  RevenueCatEvent,
  RevenueCatTransition,
  unwrapEvent,
  UUID_REGEX,
} from "../_shared/revenuecat-state-machine.ts";

const VAULT_SECRET_NAME = "revenuecat_webhook_secret";
const ENV_FALLBACK_SECRET = "REVENUECAT_WEBHOOK_SECRET";

const VAULT_REST_API_KEY_NAME = "revenuecat_rest_api_key";
const ENV_FALLBACK_REST_API_KEY = "REVENUECAT_REST_API_KEY";
const RC_REST_BASE = "https://api.revenuecat.com/v1";

const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;
const SECRET_TTL_MS = 5 * 60 * 1000;

type SubscriptionsTable = {
  user_id: string;
  status: string;
  plan: string;
  price_id: string | null;
  current_period_end: string | null;
  updated_at: string;
  latest_revenuecat_event_id?: string | null;
  latest_revenuecat_event_timestamp_ms?: number | null;
};

type ErrorClassification = "transient" | "permanent";

let cachedSecret: { value: string; fetchedAt: number } | null = null;
let cachedRestApiKey: { value: string; fetchedAt: number } | null = null;

const logStep = (step: string, details?: unknown, correlationId?: string) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  const prefix = correlationId ? `[REVENUECAT-WEBHOOK ${correlationId}]` : `[REVENUECAT-WEBHOOK]`;
  console.log(`${prefix} ${step}${detailsStr}`);
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    status,
  });
}

async function loadWebhookSecret(serviceClient: SupabaseClient): Promise<string | null> {
  try {
    const { data, error } = await serviceClient
      .schema("vault")
      .from("decrypted_secrets")
      .select("decrypted_secret")
      .eq("name", VAULT_SECRET_NAME)
      .maybeSingle();

    if (!error && data && typeof (data as { decrypted_secret?: unknown }).decrypted_secret === "string") {
      const fromVault = (data as { decrypted_secret: string }).decrypted_secret;
      if (fromVault.length > 0) return fromVault;
    } else if (error) {
      captureWarning("revenuecat_webhook_vault_read_failed", {
        function: "revenuecat_webhook",
        error: error.message,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    captureWarning("revenuecat_webhook_vault_read_failed", {
      function: "revenuecat_webhook",
      error: message,
    });
    logStep("Vault read failed; falling back to env", { message });
  }

  const fromEnv = Deno.env.get(ENV_FALLBACK_SECRET) ?? "";
  return fromEnv.length > 0 ? fromEnv : null;
}

async function getCachedSecret(serviceClient: SupabaseClient): Promise<string | null> {
  if (cachedSecret && Date.now() - cachedSecret.fetchedAt < SECRET_TTL_MS) {
    return cachedSecret.value;
  }
  const v = await loadWebhookSecret(serviceClient);
  if (v) cachedSecret = { value: v, fetchedAt: Date.now() };
  return v;
}

function classifyError(err: unknown): ErrorClassification {
  if (!err) return "transient";

  const code = (err as { code?: unknown })?.code;
  const status = (err as { status?: unknown })?.status;
  const message = err instanceof Error ? err.message : String(err);

  if (typeof code === "string") {
    if (code === "23503" || code === "23502" || code === "22P02") return "permanent";
    if (code.startsWith("PGRST")) {
      if (typeof status === "number") {
        return status >= 500 ? "transient" : "permanent";
      }
      return "permanent";
    }
  }

  if (/ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENOTFOUND|fetch failed|aborted|network/i.test(message)) {
    return "transient";
  }

  return "transient";
}

function dbError(prefix: string, error: { message?: string; code?: string; status?: number }): Error {
  const codeStr = typeof error.code === "string" && error.code.length > 0 ? error.code : "unknown";
  const e = new Error(`${prefix}: ${codeStr}`);
  // deno-lint-ignore no-explicit-any
  (e as any).code = error.code;
  // deno-lint-ignore no-explicit-any
  (e as any).status = error.status;
  return e;
}

async function isStaleEvent(
  client: SupabaseClient,
  userId: string,
  eventTimestampMs: number | null,
): Promise<boolean> {
  return await isRevenueCatEventStale(client, userId, eventTimestampMs);
}

async function upsertSubscriptionActive(
  client: SupabaseClient,
  userId: string,
  productId: string | null,
  periodEnd: string | null,
  eventTimestampMs: number | null,
  status: "active" | "trialing",
  eventId: string,
  correlationId: string,
): Promise<void> {
  const { data: existingRow, error: selectErr } = await client
    .from("subscriptions")
    .select("stripe_mode, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (selectErr) {
    logStep("Active upsert select-before-write failed", { userId, error: selectErr.message, code: selectErr.code }, correlationId);
    throw dbError("subscriptions select", selectErr);
  }
  if (isStripeActivelyPaying(existingRow)) {
    logStep("Active upsert skipped — row is Stripe-managed and actively paying", { userId, existingMode: existingRow?.stripe_mode, existingStatus: existingRow?.status }, correlationId);
    return;
  }

  const row: Partial<SubscriptionsTable> & { user_id: string; stripe_mode?: string } = {
    user_id: userId,
    status,
    plan: "premium",
    price_id: productId,
    current_period_end: periodEnd,
    stripe_mode: RC_STRIPE_MODE_MARKER,
    updated_at: new Date().toISOString(),
    latest_revenuecat_event_id: eventId,
  };
  if (eventTimestampMs !== null) {
    row.latest_revenuecat_event_timestamp_ms = eventTimestampMs;
  }

  const { error } = await client
    .from("subscriptions")
    .upsert(row, { onConflict: "user_id" });

  if (error) {
    logStep("Active upsert failed", { userId, error: error.message, code: error.code }, correlationId);
    throw dbError("subscriptions upsert", error);
  }

  await client
    .from("user_subscriptions")
    .update({ plan: row.plan, updated_at: row.updated_at })
    .eq("user_id", userId);

  const allowanceKey = `rc_allowance_${eventId}`;
  const allowanceResult = await setMonthlyAllowance(
    client,
    userId,
    PREMIUM_MONTHLY_ALLOWANCE,
    allowanceKey,
  );
  if (!allowanceResult.ok && !allowanceResult.duplicate) {
    logStep(
      "Warning: failed to set monthly allowance",
      { userId, allowance: PREMIUM_MONTHLY_ALLOWANCE, reason: allowanceResult.reason },
      correlationId,
    );
  }
}

async function markSubscriptionEnded(
  client: SupabaseClient,
  userId: string,
  status: "canceled" | "past_due",
  eventId: string,
  eventTimestampMs: number | null,
  correlationId: string,
): Promise<void> {
  const { data: existing, error: selectErr } = await client
    .from("subscriptions")
    .select("stripe_mode, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (selectErr) {
    logStep("End-of-life select-before-update failed", { userId, status, error: selectErr.message, code: selectErr.code }, correlationId);
    throw dbError("subscriptions select", selectErr);
  }
  if (isStripeActivelyPaying(existing)) {
    logStep("End-of-life skipped — row is Stripe-managed and actively paying", { userId, status, existingMode: existing?.stripe_mode, existingStatus: existing?.status }, correlationId);
    return;
  }

  const updatedAt = new Date().toISOString();
  const update: Partial<SubscriptionsTable> & { stripe_mode: string; updated_at: string } = {
    status,
    plan: "free",
    stripe_mode: RC_STRIPE_MODE_MARKER,
    updated_at: updatedAt,
    latest_revenuecat_event_id: eventId,
  };
  if (eventTimestampMs !== null) {
    update.latest_revenuecat_event_timestamp_ms = eventTimestampMs;
  }

  const { error } = await client
    .from("subscriptions")
    .update(update)
    .eq("user_id", userId);

  if (error) {
    logStep("End-of-life update failed", { userId, status, error: error.message, code: error.code }, correlationId);
    throw dbError("subscriptions update", error);
  }

  await client
    .from("user_subscriptions")
    .update({ plan: "free", updated_at: updatedAt })
    .eq("user_id", userId);

  const allowanceKey = `rc_allowance_${eventId}`;
  const allowanceResult = await setMonthlyAllowance(client, userId, 0, allowanceKey);
  if (!allowanceResult.ok && !allowanceResult.duplicate) {
    logStep(
      "Warning: failed to zero monthly allowance",
      { userId, reason: allowanceResult.reason },
      correlationId,
    );
  }
}

async function cancellationTouch(
  client: SupabaseClient,
  userId: string,
  eventId: string,
  eventTimestampMs: number | null,
  correlationId: string,
): Promise<void> {
  logStep("Cancellation received — keeping active until expiration", { userId }, correlationId);
  const update: Partial<SubscriptionsTable> & { updated_at: string } = {
    updated_at: new Date().toISOString(),
    latest_revenuecat_event_id: eventId,
  };
  if (eventTimestampMs !== null) {
    update.latest_revenuecat_event_timestamp_ms = eventTimestampMs;
  }
  const { error } = await client
    .from("subscriptions")
    .update(update)
    .eq("user_id", userId);
  if (error) {
    logStep("Cancellation touch failed", { userId, error: error.message, code: error.code }, correlationId);
    throw dbError("subscriptions touch", error);
  }
}

async function handleSubscriberAlias(
  client: SupabaseClient,
  event: RevenueCatEvent,
  correlationId: string,
): Promise<void> {
  const aliases = event.aliases;
  const newUserId = typeof event.app_user_id === "string" ? event.app_user_id : null;
  if (!Array.isArray(aliases) || !newUserId || !UUID_REGEX.test(newUserId)) {
    logStep("SUBSCRIBER_ALIAS: no actionable aliases / user", undefined, correlationId);
    return;
  }
  const anonAliases = aliases.filter(
    (a): a is string => typeof a === "string" && a.startsWith("$RCAnonymousID"),
  );
  if (anonAliases.length === 0) return;

  const { data: subRow } = await client
    .from("subscriptions")
    .select("user_id")
    .eq("user_id", newUserId)
    .maybeSingle();

  if (!subRow) {
    captureWarning("revenuecat_alias_recovery_required", {
      function: "revenuecat_webhook",
      app_user_id: newUserId,
      anon_alias_count: anonAliases.length,
      first_anon_alias: anonAliases[0],
      correlation_id: correlationId,
    });
    logStep(
      "SUBSCRIBER_ALIAS: auth user has no subscriptions row + anonymous aliases present — manual recovery flagged",
      { newUserId, anonAliases },
      correlationId,
    );
  }
}

async function executeTransition(
  client: SupabaseClient,
  event: RevenueCatEvent,
  transition: RevenueCatTransition,
  eventId: string,
  correlationId: string,
): Promise<void> {
  switch (transition.kind) {
    case "noop": {
      logStep("Noop event", { reason: transition.reason }, correlationId);
      // Restore the structured observability signal the original handler emitted
      // for NON_RENEWING_PURCHASE without an expiration. Without this, an
      // upstream payload-shape regression in RC's NON_RENEWING_PURCHASE event
      // would silently degrade to a no-op instead of paging us.
      if (transition.reason === "non_renewing_missing_expiration") {
        const userId = typeof event.app_user_id === "string" ? event.app_user_id : null;
        captureWarning("revenuecat_non_renewing_no_expiration", {
          function: "revenuecat_webhook",
          app_user_id: userId,
          correlation_id: correlationId,
        });
      }
      return;
    }
    case "alias_recovery_check": {
      await handleSubscriberAlias(client, event, correlationId);
      return;
    }
    case "permanent_skip": {
      logStep("Skipping permanent (non-uuid)", { reason: transition.reason }, correlationId);
      throw Object.assign(new Error(transition.reason), { code: transition.code });
    }
    case "upsert_active": {
      const type = (event.type ?? "").toUpperCase();
      if (isMutationEventType(type) && (await isStaleEvent(client, transition.userId, transition.eventTimestampMs))) {
        logStep("Skipping stale (out-of-order) event", { userId: transition.userId, type, eventTimestampMs: transition.eventTimestampMs }, correlationId);
        captureWarning("revenuecat_stale_event", {
          function: "revenuecat_webhook",
          type,
          app_user_id: transition.userId,
          correlation_id: correlationId,
        });
        throw Object.assign(new Error("stale_event"), { permanent: true });
      }
      logStep("Active-state event", { type, userId: transition.userId }, correlationId);
      await upsertSubscriptionActive(
        client,
        transition.userId,
        transition.productId,
        transition.periodEnd,
        transition.eventTimestampMs,
        transition.status,
        eventId,
        correlationId,
      );
      return;
    }
    case "transfer": {
      logStep("Transfer event", { userId: transition.userId }, correlationId);
      const newUserStale = await isStaleEvent(client, transition.userId, transition.eventTimestampMs);
      if (!newUserStale) {
        await upsertSubscriptionActive(
          client,
          transition.userId,
          transition.productId,
          transition.periodEnd,
          transition.eventTimestampMs,
          "active",
          eventId,
          correlationId,
        );
      } else {
        logStep("TRANSFER: new-user upsert skipped (stale)", { userId: transition.userId }, correlationId);
      }
      for (const originalId of transition.originIds) {
        const originStale = await isStaleEvent(client, originalId, transition.eventTimestampMs);
        if (originStale) {
          logStep("TRANSFER: origin end-of-life skipped (stale)", { originalId }, correlationId);
          continue;
        }
        try {
          await markSubscriptionEnded(client, originalId, "canceled", eventId, transition.eventTimestampMs, correlationId);
          logStep("TRANSFER: ended origin subscription", { originalId }, correlationId);
        } catch (err) {
          logStep(
            "TRANSFER: origin end-of-life failed (continuing)",
            { originalId, message: err instanceof Error ? err.message : String(err) },
            correlationId,
          );
        }
      }
      return;
    }
    case "cancellation_touch": {
      await cancellationTouch(client, transition.userId, eventId, transition.eventTimestampMs, correlationId);
      return;
    }
    case "end_of_life": {
      const type = (event.type ?? "").toUpperCase();
      if (await isStaleEvent(client, transition.userId, transition.eventTimestampMs)) {
        logStep("Skipping stale (out-of-order) event", { userId: transition.userId, type, eventTimestampMs: transition.eventTimestampMs }, correlationId);
        captureWarning("revenuecat_stale_event", {
          function: "revenuecat_webhook",
          type,
          app_user_id: transition.userId,
          correlation_id: correlationId,
        });
        throw Object.assign(new Error("stale_event"), { permanent: true });
      }
      logStep(`${type} event`, { userId: transition.userId }, correlationId);
      await markSubscriptionEnded(client, transition.userId, transition.status, eventId, transition.eventTimestampMs, correlationId);
      return;
    }
  }
}

async function handleEvent(
  client: SupabaseClient,
  event: RevenueCatEvent,
  eventId: string,
  correlationId: string,
): Promise<void> {
  const transition = classifyRevenueCatEvent(event);
  await executeTransition(client, event, transition, eventId, correlationId);
}

async function loadRestApiKey(serviceClient: SupabaseClient): Promise<string | null> {
  try {
    const { data, error } = await serviceClient
      .schema("vault")
      .from("decrypted_secrets")
      .select("decrypted_secret")
      .eq("name", VAULT_REST_API_KEY_NAME)
      .maybeSingle();

    if (!error && data && typeof (data as { decrypted_secret?: unknown }).decrypted_secret === "string") {
      const fromVault = (data as { decrypted_secret: string }).decrypted_secret;
      if (fromVault.length > 0) return fromVault;
    } else if (error) {
      captureWarning("revenuecat_sync_vault_read_failed", {
        function: "revenuecat_webhook",
        error: error.message,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    captureWarning("revenuecat_sync_vault_read_failed", {
      function: "revenuecat_webhook",
      error: message,
    });
    logStep("Sync vault read failed; falling back to env", { message });
  }

  const fromEnv = Deno.env.get(ENV_FALLBACK_REST_API_KEY) ?? "";
  return fromEnv.length > 0 ? fromEnv : null;
}

async function getCachedRestApiKey(serviceClient: SupabaseClient): Promise<string | null> {
  if (cachedRestApiKey && Date.now() - cachedRestApiKey.fetchedAt < SECRET_TTL_MS) {
    return cachedRestApiKey.value;
  }
  const v = await loadRestApiKey(serviceClient);
  if (v) cachedRestApiKey = { value: v, fetchedAt: Date.now() };
  return v;
}

async function handleSyncRequest(req: Request, serviceClient: SupabaseClient): Promise<Response> {
  const correlationId: string = crypto.randomUUID();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    logStep("Sync: missing supabase env", undefined, correlationId);
    return jsonResponse({ ok: false, reason: "server_misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, reason: "missing_auth" }, 401);
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return jsonResponse({ ok: false, reason: "missing_auth" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  let userId: string;
  try {
    const { data: userData, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !userData?.user) {
      logStep("Sync: getUser failed", { error: authErr?.message }, correlationId);
      return jsonResponse({ ok: false, reason: "invalid_token" }, 401);
    }
    userId = userData.user.id;
  } catch (err) {
    logStep("Sync: getUser threw", { message: err instanceof Error ? err.message : String(err) }, correlationId);
    return jsonResponse({ ok: false, reason: "invalid_token" }, 401);
  }

  if (!UUID_REGEX.test(userId)) {
    logStep("Sync: non-UUID user id (rejecting)", { userId }, correlationId);
    return jsonResponse({ ok: false, reason: "invalid_user_id" }, 401);
  }

  try {
    await enforceRateLimit(serviceClient, userId, "revenuecat_webhook_sync");
  } catch (err) {
    if (err instanceof RateLimitError) {
      logStep("Sync: rate limited", { userId, retryAfterSeconds: err.retryAfterSeconds }, correlationId);
      return rateLimitResponse(err, CORS_HEADERS);
    }
    throw err;
  }

  const restApiKey = await getCachedRestApiKey(serviceClient);
  if (!restApiKey) {
    captureWarning("revenuecat_sync_unconfigured", {
      function: "revenuecat_webhook",
      correlation_id: correlationId,
    });
    logStep("Sync: REVENUECAT_REST_API_KEY not configured", undefined, correlationId);
    return jsonResponse({ ok: false, reason: "sync_unconfigured" }, 503);
  }

  const rcUrl = `${RC_REST_BASE}/subscribers/${encodeURIComponent(userId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let rcResponse: Response;
  try {
    rcResponse = await fetch(rcUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${restApiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : String(err);
    logStep("Sync: RC REST fetch failed", { message }, correlationId);
    captureWarning("revenuecat_sync_rc_fetch_failed", {
      function: "revenuecat_webhook",
      error: message,
      correlation_id: correlationId,
    });
    return jsonResponse({ ok: false, reason: "rc_fetch_failed" }, 500);
  } finally {
    clearTimeout(timer);
  }

  if (rcResponse.status === 404) {
    logStep("Sync: RC subscriber not found", { userId }, correlationId);
    const inactiveKey = `rc_sync_${userId}_inactive_${Math.floor(Date.now() / 1000)}`;
    const downgrade = await downgradeSubscriptionToFree(
      serviceClient,
      userId,
      correlationId,
      inactiveKey,
    );
    if (!downgrade.ok) {
      return jsonResponse({ ok: false, reason: downgrade.reason ?? "downgrade_failed" }, 500);
    }
    return jsonResponse({ ok: false, reason: "rc_subscriber_not_found" }, 404);
  }
  if (rcResponse.status >= 500) {
    const text = await rcResponse.text().catch(() => "");
    logStep("Sync: RC REST 5xx", { status: rcResponse.status, body: text.slice(0, 200) }, correlationId);
    captureWarning("revenuecat_sync_rc_5xx", {
      function: "revenuecat_webhook",
      status: rcResponse.status,
      correlation_id: correlationId,
    });
    return jsonResponse({ ok: false, reason: "rc_upstream_5xx" }, 500);
  }
  if (!rcResponse.ok) {
    const text = await rcResponse.text().catch(() => "");
    logStep("Sync: RC REST 4xx", { status: rcResponse.status, body: text.slice(0, 200) }, correlationId);
    captureWarning("revenuecat_sync_rc_4xx", {
      function: "revenuecat_webhook",
      status: rcResponse.status,
      correlation_id: correlationId,
    });
    return jsonResponse({ ok: false, reason: "sync_unconfigured" }, 503);
  }

  let payload: RcSubscriberResponse;
  try {
    payload = (await rcResponse.json()) as RcSubscriberResponse;
  } catch (err) {
    logStep("Sync: RC response was not JSON", { message: err instanceof Error ? err.message : String(err) }, correlationId);
    captureWarning("revenuecat_sync_bad_response", {
      function: "revenuecat_webhook",
      correlation_id: correlationId,
    });
    return jsonResponse({ ok: false, reason: "rc_bad_response" }, 500);
  }

  const active = pickLatestActiveEntitlement(payload.subscriber?.entitlements);
  const periodTag = active
    ? String(active.expiresMs)
    : `inactive_${Math.floor(Date.now() / 1000)}`;
  const allowanceKey = `rc_sync_${userId}_${periodTag}`;

  if (active) {
    const { data: existingRow, error: selectErr } = await serviceClient
      .from("subscriptions")
      .select("stripe_mode, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (selectErr) {
      logStep("Sync: subscriptions select-before-active-upsert failed", { userId, error: selectErr.message, code: selectErr.code }, correlationId);
      return jsonResponse({ ok: false, reason: "db_transient" }, 500);
    }
    if (isStripeActivelyPaying(existingRow)) {
      logStep("Sync: skipping active upsert — row is Stripe-managed and actively paying", { userId, existingMode: existingRow?.stripe_mode, existingStatus: existingRow?.status }, correlationId);
      logStep("Sync: reconciled (Stripe-preserved)", { userId }, correlationId);
      return jsonResponse({
        ok: true,
        action: "sync",
        state: { plan: "premium", status: "active", current_period_end: active.expiresAt },
      }, 200);
    }

    const periodEnd = active.expiresAt;
    const nowIso = new Date().toISOString();
    const row: Partial<SubscriptionsTable> & { user_id: string; stripe_mode?: string } = {
      user_id: userId,
      status: "active",
      plan: "premium",
      price_id: active.productId,
      current_period_end: periodEnd,
      stripe_mode: RC_STRIPE_MODE_MARKER,
      updated_at: nowIso,
    };
    const { error } = await serviceClient
      .from("subscriptions")
      .upsert(row, { onConflict: "user_id" });
    if (error) {
      logStep("Sync: subscriptions upsert failed", { userId, error: error.message, code: error.code }, correlationId);
      const cls = classifyError(error);
      return jsonResponse({ ok: false, reason: cls === "permanent" ? "db_permanent" : "db_transient" }, 500);
    }
    await serviceClient
      .from("user_subscriptions")
      .update({ plan: row.plan, updated_at: nowIso })
      .eq("user_id", userId);
    const allowanceResult = await setMonthlyAllowance(
      serviceClient,
      userId,
      PREMIUM_MONTHLY_ALLOWANCE,
      allowanceKey,
    );
    if (!allowanceResult.ok && !allowanceResult.duplicate) {
      logStep(
        "Sync: failed to set monthly allowance (continuing)",
        { userId, reason: allowanceResult.reason },
        correlationId,
      );
    }
    logStep("Sync: reconciled active entitlement", { userId, periodEnd }, correlationId);
    return jsonResponse({
      ok: true,
      action: "sync",
      state: { plan: "premium", status: "active", current_period_end: periodEnd },
    }, 200);
  }

  const downgrade = await downgradeSubscriptionToFree(serviceClient, userId, correlationId, allowanceKey);
  if (!downgrade.ok) {
    return jsonResponse({ ok: false, reason: downgrade.reason ?? "downgrade_failed" }, 500);
  }
  logStep("Sync: no active entitlements — downgraded", { userId }, correlationId);
  return jsonResponse({
    ok: true,
    action: "sync",
    state: { plan: "free", status: "canceled", current_period_end: null },
  }, 200);
}

async function downgradeSubscriptionToFree(
  serviceClient: SupabaseClient,
  userId: string,
  correlationId: string,
  allowanceKey: string,
): Promise<{ ok: boolean; reason?: string; skipped?: boolean }> {
  const { data: existing, error: selectErr } = await serviceClient
    .from("subscriptions")
    .select("stripe_mode, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (selectErr) {
    logStep("Sync: subscriptions select-before-downgrade failed", { userId, error: selectErr.message, code: selectErr.code }, correlationId);
    return { ok: false, reason: "subscriptions_select_failed" };
  }
  if (isStripeActivelyPaying(existing)) {
    logStep("Sync: skipping downgrade — row is Stripe-managed and actively paying", { userId, existingMode: existing?.stripe_mode, existingStatus: existing?.status }, correlationId);
    return { ok: true, skipped: true };
  }

  const nowIso = new Date().toISOString();
  const { error: updErr } = await serviceClient
    .from("subscriptions")
    .update({
      status: "canceled",
      plan: "free",
      stripe_mode: RC_STRIPE_MODE_MARKER,
      updated_at: nowIso,
    })
    .eq("user_id", userId);
  if (updErr) {
    logStep("Sync: subscriptions downgrade failed", { userId, error: updErr.message, code: updErr.code }, correlationId);
    return { ok: false, reason: "subscriptions_update_failed" };
  }
  await serviceClient
    .from("user_subscriptions")
    .update({ plan: "free", updated_at: nowIso })
    .eq("user_id", userId);
  const allowanceResult = await setMonthlyAllowance(serviceClient, userId, 0, allowanceKey);
  if (!allowanceResult.ok && !allowanceResult.duplicate) {
    logStep(
      "Sync: failed to zero monthly allowance",
      { userId, reason: allowanceResult.reason },
      correlationId,
    );
    return { ok: false, reason: "allowance_update_failed" };
  }
  return { ok: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  if (action === "sync") {
    const supabaseUrlSync = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKeySync = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrlSync || !supabaseServiceKeySync) {
      logStep("Sync: missing supabase env (early)");
      return jsonResponse({ ok: false, reason: "server_misconfigured" }, 500);
    }
    const serviceClient = createClient(supabaseUrlSync, supabaseServiceKeySync);
    return handleSyncRequest(req, serviceClient);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    logStep("Missing Supabase env");
    return jsonResponse({ error: "Server misconfiguration" }, 500);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  let correlationId: string = crypto.randomUUID();

  let body: string;
  try {
    body = await req.text();
  } catch (err) {
    logStep("Failed to read body", { message: err instanceof Error ? err.message : String(err) }, correlationId);
    return jsonResponse({ error: "Invalid body" }, 400);
  }

  const secret = await getCachedSecret(serviceClient);
  if (!secret) {
    logStep("Missing webhook secret in vault and env", undefined, correlationId);
    captureWarning("revenuecat_webhook_secret_missing", {
      function: "revenuecat_webhook",
      correlation_id: correlationId,
    });
    return jsonResponse({ error: "Webhook secret not configured" }, 500);
  }

  const headerSig = req.headers.get(SIGNATURE_HEADER);
  if (!headerSig) {
    logStep("Missing signature header", undefined, correlationId);
    return jsonResponse({ error: "Missing signature" }, 401);
  }

  let validSig: boolean;
  try {
    validSig = await verifyRevenueCatSignature(secret, body, headerSig);
  } catch (err) {
    logStep("HMAC compute failed", { message: err instanceof Error ? err.message : String(err) }, correlationId);
    return jsonResponse({ error: "Signature verification failure" }, 500);
  }
  if (!validSig) {
    logStep("Signature mismatch", undefined, correlationId);
    captureWarning("revenuecat_signature_mismatch", {
      function: "revenuecat_webhook",
      correlation_id: correlationId,
    });
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    logStep("Invalid JSON", { message: err instanceof Error ? err.message : String(err) }, correlationId);
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const event = unwrapEvent(parsed);
  if (!event) {
    logStep("Unrecognized payload shape", undefined, correlationId);
    return jsonResponse({ error: "Unrecognized payload" }, 400);
  }

  const eventTimestampMs = deriveEventTimestampMs(event);
  if (eventTimestampMs === null) {
    logStep("Event missing timestamp; rejecting", undefined, correlationId);
    captureWarning("revenuecat_event_no_timestamp", {
      function: "revenuecat_webhook",
      correlation_id: correlationId,
    });
    return jsonResponse({ error: "event_too_old", reason: "no_timestamp" }, 401);
  }
  const ageMs = Date.now() - eventTimestampMs;
  if (ageMs > WEBHOOK_TIMESTAMP_TOLERANCE_MS) {
    const eventIdForReplayCheck = deriveEventId(event);
    let isLegitimateRetry = false;
    if (eventIdForReplayCheck) {
      const { data: existing, error: lookupErr } = await serviceClient
        .from("revenuecat_events")
        .select("event_id, processed_at")
        .eq("event_id", eventIdForReplayCheck)
        .maybeSingle();
      if (!lookupErr && existing && !existing.processed_at) {
        isLegitimateRetry = true;
      }
    }
    if (!isLegitimateRetry) {
      logStep("Event too old (replay window exceeded, no pending row)", { ageMs, eventTimestampMs }, correlationId);
      captureWarning("revenuecat_event_too_old", {
        function: "revenuecat_webhook",
        age_ms: ageMs,
        correlation_id: correlationId,
      });
      return jsonResponse({ error: "event_too_old", reason: "outside_tolerance" }, 401);
    }
    logStep(
      "Event past replay window — accepting as RC retry of pending row",
      { ageMs, eventId: eventIdForReplayCheck },
      correlationId,
    );
  }

  const allowSandbox = (Deno.env.get("ALLOW_SANDBOX_EVENTS") ?? "").toLowerCase() === "true";
  const eventEnv = typeof event.environment === "string" ? event.environment.toUpperCase() : null;
  if (!allowSandbox && eventEnv === "SANDBOX") {
    logStep("Rejecting SANDBOX event in production environment", { eventEnv }, correlationId);
    captureWarning("revenuecat_sandbox_on_prod", {
      function: "revenuecat_webhook",
      correlation_id: correlationId,
    });
    const eventIdForLog = deriveEventId(event);
    if (eventIdForLog) {
      await serviceClient
        .from("revenuecat_events")
        .upsert(
          {
            event_id: eventIdForLog,
            event_type: typeof event.type === "string" ? event.type : "UNKNOWN",
            app_user_id: typeof event.app_user_id === "string" ? event.app_user_id : "unknown",
            payload: event as unknown as Record<string, unknown>,
            processed_at: new Date().toISOString(),
            error: "sandbox_on_prod",
          },
          { onConflict: "event_id", ignoreDuplicates: true },
        );
    }
    return jsonResponse({ received: true, status: "sandbox_on_prod" }, 200);
  }
  if (allowSandbox && eventEnv === "PRODUCTION") {
    logStep("Processing PRODUCTION event in sandbox-allowed environment (preview branch)", undefined, correlationId);
  }

  const eventId = deriveEventId(event);
  const eventType = typeof event.type === "string" ? event.type : "UNKNOWN";
  const appUserId = typeof event.app_user_id === "string" ? event.app_user_id : "unknown";

  if (eventId) {
    correlationId = `evt_${eventId.slice(0, 12)}`;
  }

  if (!eventId) {
    logStep("Event missing id; cannot dedupe — accepting once", { eventType }, correlationId);
    try {
      await handleEvent(serviceClient, event, `noid_${crypto.randomUUID()}`, correlationId);
    } catch (err) {
      logStep("Processing failed (no id)", {
        message: err instanceof Error ? err.message : String(err),
      }, correlationId);
    }
    return jsonResponse({ received: true, deduped: false }, 200);
  }

  const { data: inserted, error: insertError } = await serviceClient
    .from("revenuecat_events")
    .upsert(
      {
        event_id: eventId,
        event_type: eventType,
        app_user_id: appUserId,
        payload: event as unknown as Record<string, unknown>,
        processed_at: null,
        attempts: 0,
      },
      { onConflict: "event_id", ignoreDuplicates: true },
    )
    .select("event_id")
    .maybeSingle();

  if (insertError) {
    logStep("Idempotency upsert failed", { error: insertError.message, code: insertError.code }, correlationId);
    return jsonResponse({ error: "Database error" }, 500);
  }

  if (!inserted) {
    const { data: existing, error: existingErr } = await serviceClient
      .from("revenuecat_events")
      .select("event_id, processed_at, attempts")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingErr) {
      logStep("Existing-row lookup failed", { error: existingErr.message, code: existingErr.code }, correlationId);
      return jsonResponse({ error: "Database error" }, 500);
    }
    if (!existing) {
      logStep("Existing row vanished between upsert and select; proceeding", undefined, correlationId);
    } else if (existing.processed_at) {
      logStep("Duplicate event — already processed", { eventId }, correlationId);
      return jsonResponse({ received: true, status: "already_processed" }, 200);
    } else {
      const nextAttempts = (existing.attempts ?? 0) + 1;
      await serviceClient
        .from("revenuecat_events")
        .update({ attempts: nextAttempts })
        .eq("event_id", eventId);
      logStep("Reprocessing pending event", { eventId, attempts: nextAttempts }, correlationId);
    }
  }

  logStep("Processing event", { eventId, eventType, appUserId }, correlationId);

  let processingError: string | null = null;
  let classification: ErrorClassification = "permanent";
  try {
    await handleEvent(serviceClient, event, eventId, correlationId);
    classification = "permanent";
  } catch (err) {
    processingError = err instanceof Error ? err.message : String(err);
    const taggedPermanent = (err as { permanent?: boolean })?.permanent === true;
    if (taggedPermanent) {
      classification = "permanent";
    } else {
      classification = classifyError(err);
    }
    logStep("Processing error", { error: processingError, classification }, correlationId);
    if (classification === "permanent") {
      captureWarning("revenuecat_permanent_failure", {
        function: "revenuecat_webhook",
        type: eventType,
        app_user_id: appUserId,
        error: processingError,
        correlation_id: correlationId,
      });
    }
  }

  try {
    if (processingError && classification === "transient") {
      await serviceClient
        .from("revenuecat_events")
        .update({ error: processingError })
        .eq("event_id", eventId);
    } else {
      await serviceClient
        .from("revenuecat_events")
        .update({
          processed_at: new Date().toISOString(),
          error: processingError,
        })
        .eq("event_id", eventId);
    }
  } catch (err) {
    logStep("Events log update failed (non-fatal)", {
      message: err instanceof Error ? err.message : String(err),
    }, correlationId);
  }

  if (processingError && classification === "transient") {
    return jsonResponse({ error: processingError, transient: true }, 500);
  }

  return jsonResponse(
    {
      received: true,
      ok: !processingError,
      ...(processingError ? { error: processingError } : {}),
    },
    200,
  );
});
