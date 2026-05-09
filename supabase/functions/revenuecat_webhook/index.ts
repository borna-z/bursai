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
 *   delivered via the `X-RevenueCat-Signature` header. RevenueCat's own
 *   default flow uses `Authorization: Bearer <shared-secret>`, but we
 *   follow the wave's directive — the dashboard configuration step in
 *   M44 wires a custom HMAC header per the wave's contract.
 *   The shared secret lives in `vault.secrets` under the name
 *   `revenuecat_webhook_secret` (read via `vault.decrypted_secrets`),
 *   with a fallback to the `REVENUECAT_WEBHOOK_SECRET` environment
 *   variable for staging / preview branches that don't have vault
 *   plumbing yet. Comparison is constant-time.
 *
 *   Replay protection (Codex P0 on PR #759): in addition to the HMAC, we
 *   reject events whose `event_timestamp_ms` is older than 5 minutes,
 *   and reject events with no timestamp at all. An attacker who captures
 *   one valid POST + signature can otherwise replay it forever.
 *
 * Subscription state semantics:
 *   - INITIAL_PURCHASE / RENEWAL / UNCANCELLATION / PRODUCT_CHANGE
 *       → upsert `subscriptions` with status='active', plan='premium',
 *         current_period_end = expiration_at_ms; render allowance set
 *         to 20/month (parity with stripe_webhook).
 *   - TRANSFER
 *       → activate the new app_user_id AND end the original_app_user_id
 *         (or every id in `transferred_from`) with status='canceled'.
 *   - CANCELLATION
 *       → keep status='active' until expiration (Apple grace period); the
 *         existing `current_period_end` is left in place. RevenueCat will
 *         later send EXPIRATION when the period actually ends.
 *   - EXPIRATION
 *       → status='canceled', plan='free', allowance reset to 0.
 *   - BILLING_ISSUE
 *       → status='past_due', plan='free', allowance reset to 0.
 *   - NON_RENEWING_PURCHASE
 *       → upsert as active for the duration the entitlement granted; if
 *         expiration_at_ms is missing, log + skip (don't grant unbounded
 *         premium).
 *   - SUBSCRIBER_ALIAS
 *       → if the auth user has no subscriptions row but the aliases include
 *         a `$RCAnonymousID:*`, log a Sentry warning to flag the manual
 *         recovery case (pre-alias purchase landed under the anon id and
 *         was short-circuited).
 *   - TEST / others
 *       → log only, no subscriptions mutation.
 *
 * Out-of-order protection: each subscriptions mutation compares
 * `event.event_timestamp_ms` against the row's current `updated_at`; older
 * events are skipped (logged as `stale_event`) so a delayed RENEWAL
 * arriving after an EXPIRATION can't re-activate a canceled subscription.
 *
 * Environment gating: events with `environment === 'SANDBOX'` are rejected
 * in production unless `ALLOW_SANDBOX_EVENTS=true` is set (preview/staging
 * branches). PRODUCTION events are always processed.
 *
 * Error handling:
 *   - PERMANENT processing errors (bad shape, unknown user, FK violation,
 *     non-UUID app_user_id, NOT NULL violation, syntax error) → log to
 *     `revenuecat_events.error`, stamp `processed_at`, return 200 so
 *     RevenueCat does not hammer the endpoint forever.
 *   - TRANSIENT errors (network/timeout, 5xx PostgREST, unknown defaults)
 *     → leave `processed_at` NULL so the next RC retry reprocesses,
 *     return 500 so RevenueCat retries with its built-in exponential
 *     backoff.
 */

import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import { setMonthlyAllowance } from "../_shared/render-credits.ts";
import { captureWarning } from "../_shared/observability.ts";
import { isRevenueCatEventStale } from "../_shared/rc-event-ordering.ts";
import {
  enforceRateLimit,
  RateLimitError,
  rateLimitResponse,
} from "../_shared/scale-guard.ts";

const VAULT_SECRET_NAME = "revenuecat_webhook_secret";
const ENV_FALLBACK_SECRET = "REVENUECAT_WEBHOOK_SECRET";
const SIGNATURE_HEADER = "x-revenuecat-signature";

/**
 * Authenticated client-triggered SYNC path (added post-M31, see findings-log
 * 2026-05-08 / Codex round 2 on PR #768). The mobile `useRestorePurchases`
 * hook calls `POST /functions/v1/revenuecat_webhook?action=sync` with a
 * Supabase JWT after the local poll for the webhook-driven `subscriptions`
 * row times out. The handler resolves the auth user, queries RevenueCat's
 * REST API for fresh `CustomerInfo`, and reconciles the `subscriptions`
 * row directly — closing the failure mode where RC never delivers (or
 * already failed-and-exhausted-retries on) the inbound webhook.
 *
 * Secret: `REVENUECAT_REST_API_KEY` (vault `revenuecat_rest_api_key`,
 * env fallback). When unset, the path returns 503 with
 * `{ ok: false, reason: 'sync_unconfigured' }` — the launch-state until
 * the user provisions the secret in M44 — and the client falls back to
 * the existing `'restored_pending'` UX so nothing regresses.
 */
const VAULT_REST_API_KEY_NAME = "revenuecat_rest_api_key";
const ENV_FALLBACK_REST_API_KEY = "REVENUECAT_REST_API_KEY";
const RC_REST_BASE = "https://api.revenuecat.com/v1";

/**
 * Replay-window for inbound events. Five minutes is wide enough to absorb
 * RevenueCat's worst-case enqueue latency + clock skew between RC's egress
 * fleet and our edge-function clock (Supabase functions run on Deno
 * Deploy's worldwide POPs; a few hundred ms of skew is normal). Tighter
 * than this risks dropping legitimate retries; looser than this widens
 * the replay-attack window unnecessarily.
 */
const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Vault secret cache TTL. The secret rotates rarely (once on initial
 * setup, once on key rotation events) so reading it from vault on every
 * webhook delivery is wasteful. Five minutes balances cache freshness
 * against the cost of a vault round-trip per request.
 */
const SECRET_TTL_MS = 5 * 60 * 1000;

/**
 * Standard render allowance for a premium subscriber. Parity with
 * `stripe_webhook` (`updateSubscription` → `creditAllowance`).
 */
const PREMIUM_MONTHLY_ALLOWANCE = 20;

/**
 * Lower-cased UUID v1-v5 regex. Used to gate `app_user_id` before any
 * write hits `subscriptions` (whose `user_id` column is `uuid`). Non-UUID
 * values are classified as PERMANENT (return 200) so RevenueCat does not
 * retry forever — see Codex P1 on PR #759.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SubscriptionsTable = {
  user_id: string;
  status: string;
  plan: string;
  price_id: string | null;
  current_period_end: string | null;
  updated_at: string;
  /**
   * N2: id of the RC event that produced this row's most recent successful
   * write. Set on every upsert/end-of-life from this webhook so the
   * out-of-order guard can compare against authoritative event identity
   * instead of `updated_at` (which is also rewritten by the CANCELLATION
   * touch + sync path and so isn't a reliable ordering signal).
   */
  latest_revenuecat_event_id?: string | null;
  /**
   * N2: event_timestamp_ms of the RC event that produced the most recent
   * successful write. Replaces `updated_at` as the staleness comparator
   * inside `isStaleEvent`.
   */
  latest_revenuecat_event_timestamp_ms?: number | null;
};

type RevenueCatEvent = {
  type?: string;
  id?: string;
  event_id?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number;
  purchased_at_ms?: number;
  event_timestamp_ms?: number;
  store?: string;
  environment?: string;
  aliases?: unknown;
  transferred_from?: unknown;
  // RevenueCat sometimes nests the event under `event`.
  // We unwrap before touching it.
  [key: string]: unknown;
};

type RevenueCatEnvelope = {
  api_version?: string;
  event?: RevenueCatEvent;
};

/**
 * Permanent vs transient classification result. Permanent → return 200,
 * stamp processed_at, do not retry. Transient → return 500, leave
 * processed_at null, RC will retry on its exponential backoff.
 */
type ErrorClassification = "transient" | "permanent";

/**
 * Marker placed on RC-origin upserts so support tooling can distinguish
 * RevenueCat-managed subscriptions from Stripe-managed ones when both
 * pipelines coexist. Values: 'test' / 'live' on the Stripe side; we use
 * a literal 'revenuecat' here so a `WHERE stripe_mode = 'revenuecat'`
 * scan returns the iOS cohort cleanly.
 */
const RC_STRIPE_MODE_MARKER = "revenuecat";

/** Module-scope vault secret cache. See `getCachedSecret`. */
let cachedSecret: { value: string; fetchedAt: number } | null = null;

/**
 * Module-scope cache for the RevenueCat REST API key (sync path). Same TTL
 * semantics as the webhook secret — rotated rarely, expensive to re-fetch
 * on every sync request.
 */
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

/**
 * Read the shared HMAC secret. Vault first (production), env var fallback
 * (preview branches). We swallow vault errors so a misconfigured preview
 * environment can still validate webhooks via the env var path.
 */
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

/**
 * Module-scope cached wrapper around `loadWebhookSecret`. Avoids a vault
 * round-trip per webhook delivery; the secret rotates rarely and the
 * 5-minute TTL bounds staleness during a rotation event.
 */
async function getCachedSecret(serviceClient: SupabaseClient): Promise<string | null> {
  if (cachedSecret && Date.now() - cachedSecret.fetchedAt < SECRET_TTL_MS) {
    return cachedSecret.value;
  }
  const v = await loadWebhookSecret(serviceClient);
  if (v) cachedSecret = { value: v, fetchedAt: Date.now() };
  return v;
}

/**
 * HMAC-SHA256(body, secret) → lowercase hex.
 */
async function computeHmacHex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const bytes = new Uint8Array(sig);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Compare the incoming signature against the expected HMAC in constant
 * time. Accepts either a bare hex digest or an `sha256=<hex>` prefixed
 * form (some RevenueCat dashboard configurations include the prefix).
 */
function normalizeSignature(raw: string): string {
  const trimmed = raw.trim();
  const eq = trimmed.indexOf("=");
  if (eq > 0 && trimmed.slice(0, eq).toLowerCase() === "sha256") {
    return trimmed.slice(eq + 1).trim().toLowerCase();
  }
  return trimmed.toLowerCase();
}

/**
 * Defensive parser — RevenueCat sometimes wraps the event under `event`
 * and sometimes ships it at the top level (depending on dashboard
 * config). Unwrap once, return the inner shape, never throw.
 */
function unwrapEvent(parsed: unknown): RevenueCatEvent | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as RevenueCatEnvelope & RevenueCatEvent;
  if (obj.event && typeof obj.event === "object") {
    return obj.event;
  }
  // Top-level — only treat as event if it has a `type` field.
  if (typeof obj.type === "string") {
    return obj as RevenueCatEvent;
  }
  return null;
}

/**
 * Stable id for the event. RevenueCat uses `id` on the event object
 * (top-level uuid). Fallback to `event_id` if a future schema rename
 * happens.
 */
function deriveEventId(event: RevenueCatEvent): string | null {
  if (typeof event.id === "string" && event.id.length > 0) return event.id;
  if (typeof event.event_id === "string" && event.event_id.length > 0) return event.event_id;
  return null;
}

/**
 * Read `event_timestamp_ms` defensively. RevenueCat uses ms-precision
 * unix epoch; some legacy fixtures used `event_timestamp_at` (ISO). We
 * accept both and return ms or null.
 */
function deriveEventTimestampMs(event: RevenueCatEvent): number | null {
  const ms = event.event_timestamp_ms;
  if (typeof ms === "number" && Number.isFinite(ms) && ms > 0) return ms;
  const iso = (event as { event_timestamp_at?: unknown }).event_timestamp_at;
  if (typeof iso === "string") {
    const parsed = Date.parse(iso);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

/**
 * Postgres SQLSTATE-driven classifier. RC will retry on 5xx so we map
 * "permanent" causes to 200 (no retry possible without operator action)
 * and unknown failures to "transient" (defensive — RC's own backoff is
 * the cheapest place to absorb the retry).
 *
 * SQLSTATEs we know are PERMANENT:
 *   - 23503: foreign_key_violation (subscriptions.user_id has no profile)
 *   - 23502: not_null_violation (we forgot a required column)
 *   - 22P02: invalid_text_representation (e.g. non-UUID for a uuid col)
 *
 * PostgREST shapes its own codes:
 *   - PGRST1xx-PGRST3xx: PostgREST-side issues, mostly client-bad-request
 *     (4xx semantics) → permanent.
 *   - 5xx-flavoured PGRST codes → transient.
 *
 * Network errors (ECONNREFUSED, ETIMEDOUT, fetch aborts) → transient.
 *
 * Default: TRANSIENT. Costs us a free RC retry on a brand new error
 * shape, but won't silently lose the subscription mutation.
 */
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
      // PostgREST without status — assume client-shape issue (PGRST1xx).
      return "permanent";
    }
  }

  if (/ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENOTFOUND|fetch failed|aborted|network/i.test(message)) {
    return "transient";
  }

  // Default to transient — RC retries are cheap, silent state loss isn't.
  return "transient";
}

/**
 * Parse a Postgres error from supabase-js into a synthetic Error that
 * carries `code` + `status` so `classifyError` can read them after we
 * re-throw. supabase-js returns `{ data, error }`; the error object has
 * `.code` (sqlstate or PGRSTxxx) and `.status` (HTTP). We need to round-
 * trip these through the throw boundary.
 *
 * N2: the raw `error.message` from PostgREST/Postgres can leak schema
 * details (FK constraint names, conflicting row values, table/column
 * identifiers) — see code-quality-2026-05-08 §3.2 B3 / FK-enumeration
 * leak vector. The sanitized error message contains only the prefix and
 * the SQLSTATE code; the original message is intentionally NOT preserved
 * even on the synthetic Error so downstream `console.log`/`logStep`
 * calls that stringify the thrown error can't surface it. Detailed
 * diagnostics still flow to the structured `logStep("... failed", { ...
 * code: error.code, error: error.message })` calls at each call site —
 * those run BEFORE the `throw` and emit to Supabase Logs only.
 */
function dbError(prefix: string, error: { message?: string; code?: string; status?: number }): Error {
  const codeStr = typeof error.code === "string" && error.code.length > 0 ? error.code : "unknown";
  const e = new Error(`${prefix}: ${codeStr}`);
  // deno-lint-ignore no-explicit-any
  (e as any).code = error.code;
  // deno-lint-ignore no-explicit-any
  (e as any).status = error.status;
  return e;
}

function parseExpirationMs(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 0) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Out-of-order guard. Reads the current `subscriptions.updated_at` and
 * returns true if `eventTimestampMs` is older — meaning the inbound
 * event is stale and we should skip it. No-row case returns false (the
 * first event for a user wins regardless of timestamp).
 */
/**
 * Is the existing `subscriptions` row currently a paying Stripe
 * subscription? Codex round 14 P1 — `stripe_mode='live'/'test'` alone
 * is NOT sufficient: when a Stripe subscriber cancels or hits a
 * payment failure, `stripe_webhook` sets `plan='free'` and
 * `status='canceled'/'past_due'` but leaves `stripe_mode` intact as
 * an audit-trail marker. If we skip RC writes purely on the historical
 * mode marker, a user who previously paid via Stripe, cancelled, and
 * then bought / restored via iOS would be stuck on the free row
 * because the RC INITIAL_PURCHASE / RENEWAL upsert short-circuits.
 *
 * The protection we actually want: skip RC writes ONLY when Stripe is
 * actively paying (status `active` or `trialing` on a Stripe-managed
 * row). All other Stripe states (canceled / past_due / null) yield
 * to RC's reconciliation, allowing the user to migrate platforms.
 */
function isStripeActivelyPaying(
  row: { stripe_mode?: string | null; status?: string | null } | null,
): boolean {
  if (!row) return false;
  const mode = typeof row.stripe_mode === "string" ? row.stripe_mode : null;
  if (mode !== "live" && mode !== "test") return false;
  const status = typeof row.status === "string" ? row.status : null;
  return status === "active" || status === "trialing";
}

/**
 * Out-of-order guard. Thin wrapper over `isRevenueCatEventStale` from
 * `_shared/rc-event-ordering.ts` — the comparator was extracted to a
 * shared module so the unit tests (`__tests__/revenuecat-event-
 * ordering.test.ts`) can import it without pulling in this file's
 * `serve()` entrypoint.
 *
 * Compares the inbound `eventTimestampMs` against the row's
 * `latest_revenuecat_event_timestamp_ms` (N2 — N1 used `updated_at`,
 * which is also rewritten by CANCELLATION's touch path and the sync
 * handler, so it's not a reliable ordering signal). Only RC-origin
 * writes set this column, so a row last touched by Stripe has
 * `latest_revenuecat_event_timestamp_ms IS NULL` and the inbound RC
 * event always wins on the first crossover.
 */
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
  event: RevenueCatEvent,
  status: "active" | "trialing",
  eventId: string,
  correlationId: string,
): Promise<void> {
  // SELECT-before-write Stripe protection (mirrors the round-8/11/12
  // hardening on every other subscription-row write path: the sync
  // active branch, `markSubscriptionEnded`, `downgradeSubscriptionToFree`).
  // A user paid via Stripe with an overlapping iOS purchase (re-sub, gift,
  // promotional crossover) would otherwise have RENEWAL/INITIAL_PURCHASE
  // / UNCANCELLATION / PRODUCT_CHANGE / NON_RENEWING_PURCHASE / TRANSFER
  // (new-user side) clobber the Stripe row, silently re-tagging
  // `stripe_mode='revenuecat'`. The next EXPIRATION/BILLING_ISSUE then
  // downgrades because the protection marker is gone. Multi-agent
  // round-13 fallback finding — the last hole in the Stripe-protection
  // contract.
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
    // Stripe owns this row AND is currently paying; no RC action
    // needed. Skip the upsert + mirror + allowance write so the
    // Stripe-managed state is preserved. If Stripe later cancels
    // (`stripe_webhook` sets status='canceled' / 'past_due'), this
    // gate falls through and RC can take over the row.
    return;
  }

  const periodEnd = parseExpirationMs(event.expiration_at_ms);
  const productId = typeof event.product_id === "string" ? event.product_id : null;
  // N2: stamp the originating RC event id + timestamp so the
  // out-of-order guard can compare against authoritative event identity
  // on the next inbound mutation. `eventTimestampMs` may be null when
  // the RC payload omits `event_timestamp_ms` — in that case we leave
  // the column as-is (don't downgrade a previous valid timestamp to
  // null) by omitting it from the partial.
  const eventTimestampMs = deriveEventTimestampMs(event);

  // The codebase's `subscriptions.plan` column is 'free' | 'premium' (see
  // stripe_webhook). Granular monthly/yearly tracking lives in `price_id`,
  // not `plan` — so every active RC purchase maps to `premium`.
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

  // Mirror to user_subscriptions for backward compatibility (matches
  // stripe_webhook).
  await client
    .from("user_subscriptions")
    .update({ plan: row.plan, updated_at: row.updated_at })
    .eq("user_id", userId);

  // Render-credit allowance — parity with stripe_webhook
  // (stripe_webhook/index.ts:316). Without this, every iOS-paying
  // subscriber lands in `subscriptions` with plan='premium' but 0 monthly
  // render credits and cannot use studio renders. Key on event id so
  // every state-transition event gets its own allowance update instead
  // of being collapsed into a single "first active" row.
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
  // SELECT-before-write Stripe protection (mirrors the sync-path
  // `downgradeSubscriptionToFree` Codex round 8 hardening). A user
  // who had an iOS sub, cancelled it, then resubscribed via Stripe
  // (web) would otherwise have their Stripe-paid row clobbered when
  // RC eventually emits the iOS EXPIRATION webhook. Skip ALL three
  // writes (subscriptions, user_subscriptions mirror, render
  // allowance) when the row is Stripe-managed.
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
    // Stripe is the active payer; RC's end-of-life doesn't apply.
    // If Stripe later cancels, the gate falls through and a
    // subsequent RC EXPIRATION can downgrade the row.
    return;
  }

  const updatedAt = new Date().toISOString();
  // N2: stamp event identity on every RC-origin write so the
  // staleness guard on the next inbound mutation has an authoritative
  // comparator. EXPIRATION/BILLING_ISSUE without a timestamp is
  // accepted (legacy fixtures); we just leave the column unchanged in
  // that case so we don't downgrade a previously-set valid timestamp
  // to NULL.
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

  // Zero out render credits — parity with stripe_webhook
  // (stripe_webhook/index.ts:191, :229).
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

/**
 * Resolve the previous app_user_ids on a TRANSFER event. RC's contract
 * uses `transferred_from` (array of strings) but legacy fixtures shipped
 * `original_app_user_id` (single string). Accept both, dedupe, and
 * filter to UUIDs so we never call `markSubscriptionEnded` with an
 * anonymous id.
 */
function extractTransferOriginIds(event: RevenueCatEvent): string[] {
  const out = new Set<string>();
  const arr = event.transferred_from;
  if (Array.isArray(arr)) {
    for (const v of arr) {
      if (typeof v === "string" && UUID_REGEX.test(v)) out.add(v);
    }
  }
  const single = event.original_app_user_id;
  if (typeof single === "string" && UUID_REGEX.test(single)) out.add(single);
  return Array.from(out);
}

/**
 * SUBSCRIBER_ALIAS recovery hint — when an anon→auth alias arrives and
 * the auth user has no subscriptions row, a pre-alias INITIAL_PURCHASE
 * was likely short-circuited under the anon id. Surface the manual
 * recovery case to Sentry. Full automated reroute is deferred (would
 * require querying revenuecat_events under the anon id and replaying);
 * this minimum-viable signal at least flags the support case.
 */
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

async function handleEvent(
  client: SupabaseClient,
  event: RevenueCatEvent,
  eventId: string,
  correlationId: string,
): Promise<void> {
  const userId = typeof event.app_user_id === "string" ? event.app_user_id : null;
  const type = (event.type ?? "").toUpperCase();

  // SUBSCRIBER_ALIAS is special: app_user_id is the new (auth) id but we
  // also care about the anon aliases. Handle it before the UUID gate.
  if (type === "SUBSCRIBER_ALIAS") {
    await handleSubscriberAlias(client, event, correlationId);
    return;
  }

  if (!userId) {
    logStep("Event missing app_user_id; nothing to do", undefined, correlationId);
    return;
  }
  // Sanity: RevenueCat aliases sometimes set `app_user_id` to a non-UUID
  // anonymous id ($RCAnonymousID:...). Skip those — they were emitted
  // before PR A's `Purchases.configure({ appUserID: user.id })` ran.
  if (userId.startsWith("$RCAnonymousID")) {
    logStep("Skipping anonymous app_user_id", { userId }, correlationId);
    return;
  }
  // UUID gate: subscriptions.user_id is a uuid column. Non-UUID values
  // (test-mode aliases, custom external ids) would 22P02 on insert and
  // be classified as permanent — but classifying them up front means we
  // never even start the write, which keeps the events log clean.
  if (!UUID_REGEX.test(userId)) {
    logStep("Skipping non-UUID app_user_id (permanent)", { userId }, correlationId);
    throw Object.assign(new Error("non_uuid_app_user_id"), { code: "22P02" });
  }

  // Out-of-order guard for state-mutating events. CANCELLATION skips
  // this gate because it only touches updated_at; SUBSCRIBER_ALIAS was
  // handled above; TEST/empty fall to the default branch.
  const eventTimestampMs = deriveEventTimestampMs(event);
  const isMutation = [
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
    "NON_RENEWING_PURCHASE",
    "EXPIRATION",
    "BILLING_ISSUE",
  ].includes(type);
  // NOTE — TRANSFER is intentionally NOT in the isMutation list above.
  // TRANSFER's payload affects TWO rows (the new-user upsert + each
  // origin's `markSubscriptionEnded`); a top-level staleness short-
  // circuit would skip ALL of them. The TRANSFER case below applies
  // staleness to the new-user upsert per-row and always runs the
  // origin cleanup (which is idempotent + Stripe-protected). Codex
  // round 12 P1 — pre-fix the global short-circuit caused delayed
  // TRANSFER deliveries to leave origin users incorrectly premium.
  if (isMutation && (await isStaleEvent(client, userId, eventTimestampMs))) {
    logStep("Skipping stale (out-of-order) event", { userId, type, eventTimestampMs }, correlationId);
    captureWarning("revenuecat_stale_event", {
      function: "revenuecat_webhook",
      type,
      app_user_id: userId,
      correlation_id: correlationId,
    });
    // Throw a tagged permanent error so the outer handler logs it to
    // events.error and returns 200 — RC must not retry a stale event.
    throw Object.assign(new Error("stale_event"), { permanent: true });
  }

  switch (type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE": {
      // NON_RENEWING_PURCHASE: skip if no expiration_at_ms (would grant
      // unbounded premium otherwise). The other types always carry an
      // expiration so this gate is a no-op for them, but we apply it
      // uniformly because RC's payload shape isn't strictly enforced.
      if (type === "NON_RENEWING_PURCHASE" && parseExpirationMs(event.expiration_at_ms) === null) {
        logStep("NON_RENEWING_PURCHASE missing expiration_at_ms — skipping", { userId }, correlationId);
        captureWarning("revenuecat_non_renewing_no_expiration", {
          function: "revenuecat_webhook",
          app_user_id: userId,
          correlation_id: correlationId,
        });
        return;
      }
      logStep("Active-state event", { type, userId }, correlationId);
      await upsertSubscriptionActive(client, userId, event, "active", eventId, correlationId);
      break;
    }
    case "TRANSFER": {
      logStep("Transfer event", { userId }, correlationId);
      // Per-row staleness for the new-user upsert: skip if a newer
      // event already wrote the row. The origin cleanup below also
      // applies per-origin staleness so a delayed A→B TRANSFER landing
      // after a newer B→A doesn't undo the active state on A. Codex
      // round 13 P1 — pre-fix the origin cleanup ran unconditionally
      // and could revoke the currently valid owner.
      const newUserStale = await isStaleEvent(client, userId, eventTimestampMs);
      if (!newUserStale) {
        await upsertSubscriptionActive(client, userId, event, "active", eventId, correlationId);
      } else {
        logStep("TRANSFER: new-user upsert skipped (stale)", { userId }, correlationId);
      }
      // End the previous user's subscription. RC's contract is that
      // entitlement transferred FROM the originals TO the new user —
      // their subscription is no longer active.
      const originIds = extractTransferOriginIds(event);
      for (const originalId of originIds) {
        if (originalId === userId) continue;
        // Per-origin staleness: if a newer event already updated this
        // origin's row (e.g. a reverse B→A TRANSFER landed first and
        // set A back to active), this delayed A→B TRANSFER's
        // `markSubscriptionEnded(A)` would otherwise cancel the
        // currently-valid owner. Skip when stale.
        const originStale = await isStaleEvent(client, originalId, eventTimestampMs);
        if (originStale) {
          logStep("TRANSFER: origin end-of-life skipped (stale)", { originalId }, correlationId);
          continue;
        }
        try {
          await markSubscriptionEnded(client, originalId, "canceled", eventId, eventTimestampMs, correlationId);
          logStep("TRANSFER: ended origin subscription", { originalId }, correlationId);
        } catch (err) {
          // Don't fail the whole event if the origin row doesn't exist
          // or has already been ended — log and continue. Transient DB
          // errors will propagate through classifyError on the new-user
          // upsert anyway.
          logStep(
            "TRANSFER: origin end-of-life failed (continuing)",
            { originalId, message: err instanceof Error ? err.message : String(err) },
            correlationId,
          );
        }
      }
      break;
    }
    case "CANCELLATION": {
      // Apple grace period: keep `active` until the period actually ends.
      // We DO NOT downgrade plan here. RevenueCat sends EXPIRATION when
      // the entitlement actually lapses.
      logStep("Cancellation received — keeping active until expiration", { userId }, correlationId);
      // Touch updated_at so observers see the event landed. N2: also
      // stamp event identity so the staleness guard sees this as the
      // most-recent RC mutation; without it a delayed RENEWAL with an
      // earlier event_timestamp_ms could re-activate after a TRANSFER.
      const cancellationTouch: Partial<SubscriptionsTable> & { updated_at: string } = {
        updated_at: new Date().toISOString(),
        latest_revenuecat_event_id: eventId,
      };
      if (eventTimestampMs !== null) {
        cancellationTouch.latest_revenuecat_event_timestamp_ms = eventTimestampMs;
      }
      const { error } = await client
        .from("subscriptions")
        .update(cancellationTouch)
        .eq("user_id", userId);
      if (error) {
        logStep("Cancellation touch failed", { userId, error: error.message, code: error.code }, correlationId);
        throw dbError("subscriptions touch", error);
      }
      break;
    }
    case "EXPIRATION": {
      logStep("Expiration event", { userId }, correlationId);
      await markSubscriptionEnded(client, userId, "canceled", eventId, eventTimestampMs, correlationId);
      break;
    }
    case "BILLING_ISSUE": {
      logStep("Billing issue event", { userId }, correlationId);
      await markSubscriptionEnded(client, userId, "past_due", eventId, eventTimestampMs, correlationId);
      break;
    }
    case "TEST":
    case "":
    default: {
      logStep("Logged-only event type", { type }, correlationId);
      break;
    }
  }
}

/**
 * Load the RevenueCat REST API key. Mirrors `loadWebhookSecret` — vault
 * first (production), env fallback (preview). Returns null when neither
 * source has a non-empty value; the sync handler maps this to a 503
 * `sync_unconfigured` response so the client can fall back to the existing
 * `restored_pending` UX without regressing.
 */
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

/**
 * Cached wrapper around `loadRestApiKey`. 5-minute TTL parity with the
 * webhook secret — bounds staleness during a key rotation without paying
 * a vault round-trip per restore-poll-timeout sync request.
 */
async function getCachedRestApiKey(serviceClient: SupabaseClient): Promise<string | null> {
  if (cachedRestApiKey && Date.now() - cachedRestApiKey.fetchedAt < SECRET_TTL_MS) {
    return cachedRestApiKey.value;
  }
  const v = await loadRestApiKey(serviceClient);
  if (v) cachedRestApiKey = { value: v, fetchedAt: Date.now() };
  return v;
}

/**
 * RC subscriber response — partial typing of the fields we consume.
 * Reference: https://www.revenuecat.com/reference/subscribers
 *
 * `subscriber.entitlements` is a map keyed by entitlement identifier; each
 * value carries `expires_date` (ISO, nullable for non-expiring grants),
 * `purchase_date`, and `product_identifier`. An entitlement is considered
 * active when `expires_date` is null OR > now. We pick the latest-
 * expiring active entitlement to drive the `subscriptions` row.
 */
type RcEntitlement = {
  expires_date?: string | null;
  // Apple App Store / Google Play billing-grace-period extension. RC
  // populates this when the subscription is in a grace period (StoreKit
  // billing failure but the user retains access while the store retries
  // payment). Codex round 6 — without honoring this field we'd downgrade
  // grace-period users prematurely and zero their allowance.
  grace_period_expires_date?: string | null;
  purchase_date?: string | null;
  product_identifier?: string | null;
};

type RcSubscriberResponse = {
  subscriber?: {
    entitlements?: Record<string, RcEntitlement>;
  };
};

type ActiveEntitlement = {
  expiresAt: string | null; // ISO or null (lifetime)
  expiresMs: number; // Number.POSITIVE_INFINITY for lifetime, used for ordering
  productId: string | null;
};

/**
 * Pick the entitlement with the LATEST expiration as the canonical row
 * driver. Lifetime grants (no `expires_date`) win over any time-bound
 * grant. Ties resolve arbitrarily (Object.entries order) — acceptable
 * because tied expirations imply the user genuinely has overlapping
 * grants and either one is a valid reflection of "active premium".
 */
function pickLatestActiveEntitlement(
  entitlements: Record<string, RcEntitlement> | undefined,
): ActiveEntitlement | null {
  if (!entitlements) return null;
  const nowMs = Date.now();
  let best: ActiveEntitlement | null = null;
  for (const ent of Object.values(entitlements)) {
    const expiresIso = typeof ent.expires_date === "string" ? ent.expires_date : null;
    const graceIso =
      typeof ent.grace_period_expires_date === "string"
        ? ent.grace_period_expires_date
        : null;
    let expiresMs: number;
    let effectiveIso: string | null = expiresIso;
    if (expiresIso === null) {
      // Lifetime / non-expiring grant.
      expiresMs = Number.POSITIVE_INFINITY;
    } else {
      const parsed = Date.parse(expiresIso);
      if (Number.isNaN(parsed)) continue;
      if (parsed > nowMs) {
        // Regular expiry still in the future — entitlement is active.
        expiresMs = parsed;
      } else {
        // Regular expiry already passed. Check grace period — if RC has
        // populated `grace_period_expires_date` and it's still in the
        // future, the user has store-side billing-retry access and we
        // should treat the entitlement as active until grace expiry.
        const graceParsed = graceIso !== null ? Date.parse(graceIso) : NaN;
        if (Number.isNaN(graceParsed) || graceParsed <= nowMs) {
          // No grace period (or grace already passed) — genuinely expired.
          continue;
        }
        expiresMs = graceParsed;
        effectiveIso = graceIso;
      }
    }
    const candidate: ActiveEntitlement = {
      expiresAt: effectiveIso,
      expiresMs,
      productId: typeof ent.product_identifier === "string" ? ent.product_identifier : null,
    };
    if (!best || candidate.expiresMs > best.expiresMs) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Authenticated SYNC handler — see comment block at the top of the file.
 *
 * Branches via early-return on the misconfigured / unknown-subscriber /
 * RC-down cases so the client can apply specific fallback UX to each
 * outcome (sync_unconfigured → keep restored_pending, rc_subscriber_not_found
 * → no_purchases, transient → keep restored_pending).
 */
async function handleSyncRequest(req: Request, serviceClient: SupabaseClient): Promise<Response> {
  const correlationId: string = crypto.randomUUID();

  // Auth — must be a valid Supabase JWT. We use an anon-keyed client only
  // to call `getUser(token)` so RLS doesn't apply to our own identity check;
  // the actual `subscriptions` mutation runs through `serviceClient` so
  // the row is upserted with full privileges.
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

  // Per supabase/functions/CLAUDE.md: never use getClaims() — use getUser().
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
    // Defensive — Supabase auth uuids should always pass, but a non-uuid
    // would 22P02 the upsert.
    logStep("Sync: non-UUID user id (rejecting)", { userId }, correlationId);
    return jsonResponse({ ok: false, reason: "invalid_user_id" }, 401);
  }

  // Rate-limit the sync path so an authenticated user can't spam the
  // RC REST API + DB writes. The hook only fires sync after a 10s
  // poll timeout (or on the empty-entitlements branch), so a tight cap
  // is plenty. Mirrors the per-function `ai_rate_limits` table the
  // rest of the AI pipeline uses; tier multipliers (free 0.5x /
  // premium 2x) apply automatically. Tracked under the synthetic
  // function name `revenuecat_webhook_sync` so it slots into the
  // shared telemetry without colliding with the unauthenticated
  // webhook path.
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
    // Launch-state: the secret is provisioned later in M44. Returning 503
    // (rather than 500) is the contract with the mobile client — it keeps
    // the existing `restored_pending` UX instead of surfacing a transient
    // generic-error alert. Captured as a warning so we know if the path
    // is firing in production before M44 ships.
    captureWarning("revenuecat_sync_unconfigured", {
      function: "revenuecat_webhook",
      correlation_id: correlationId,
    });
    logStep("Sync: REVENUECAT_REST_API_KEY not configured", undefined, correlationId);
    return jsonResponse({ ok: false, reason: "sync_unconfigured" }, 503);
  }

  // Fetch fresh CustomerInfo from RC. We use a 10s timeout so a hung RC
  // egress doesn't leave the client waiting past its own retry window.
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

  // RC docs: 404 on unknown subscriber. Treat as "user has no purchases"
  // AND run the same downgrade the inactive-entitlement branch runs — a
  // pre-existing stale `subscriptions` row that says `plan='premium' /
  // status='active'` would otherwise survive (the client maps 404 to
  // `no_purchases`, invalidates queries, but the refetch reads the still-
  // active row and the user stays unlocked despite the empty-state
  // alert). Codex round 5 — this branch previously short-circuited
  // before the downgrade.
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
      // DB write failed — return 5xx so the client falls back to
      // `restored_pending` instead of mapping to `no_purchases` against
      // a row that may still say `plan='premium'`. Codex round 7.
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
    // 401/403 from RC = our REST key is bad/revoked. 4xx other than 404 are
    // also operator-fix errors (and not the user's fault). Treat as
    // misconfiguration so the client falls back to restored_pending without
    // a noisy alert.
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
  // Allowance key derivation. For the active path, key on the entitlement
  // expiration so a tight client retry within the same period dedups (no
  // double-credit). For the inactive path, key on a 1-second timestamp
  // bucket so each cancellation reconciliation gets a fresh key —
  // previously this used a permanent `none` tag, which meant a
  // subscribe → cancel → resubscribe → cancel cycle reused the same key
  // and `set_monthly_allowance_atomic` short-circuited the second
  // downgrade, leaving `monthly_allowance` stuck at the paid value while
  // the subscription row showed `plan='free'`. Codex M33 review round 4
  // surfaced the bug. The 1-second bucket preserves the original
  // tight-retry dedup intent (replay protection within a single request
  // lifecycle) while ensuring each genuine reconciliation transitions
  // the allowance.
  const periodTag = active
    ? String(active.expiresMs)
    : `inactive_${Math.floor(Date.now() / 1000)}`;
  const allowanceKey = `rc_sync_${userId}_${periodTag}`;

  if (active) {
    // Stripe-mode protection (Codex round 12 P1): if the existing row
    // is Stripe-managed (`stripe_mode='live'/'test'`), skip the upsert
    // entirely. Overwriting with `stripe_mode='revenuecat'` would
    // remove the marker that `markSubscriptionEnded` /
    // `downgradeSubscriptionToFree` rely on to skip Stripe rows — a
    // later RC EXPIRATION / BILLING_ISSUE / inactive sync could then
    // downgrade a valid Stripe subscription. Stripe-paid users with
    // an active Apple entitlement keep their Stripe ownership; the
    // sync response still claims success since the user IS active
    // (just paid via the other channel).
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
      // Don't write `subscriptions` / `user_subscriptions` / allowance.
      // Stripe's webhook owns this row; we report success so the
      // client unlocks its UI based on the existing Stripe-paid
      // state (which the cache invalidate will re-read from the row).
      logStep("Sync: reconciled (Stripe-preserved)", { userId }, correlationId);
      return jsonResponse({
        ok: true,
        action: "sync",
        state: { plan: "premium", status: "active", current_period_end: active.expiresAt },
      }, 200);
    }

    // Mirror upsertSubscriptionActive — RC says active premium. Use
    // wall-clock `now()` for `updated_at` (Codex round 12 P1 — the
    // round-7 synthetic 5-min backdating let older webhook deliveries
    // overwrite just-synced state). The TRANSFER staleness concern
    // that round-7 was trying to address is now handled at the event-
    // routing level: TRANSFER applies its own per-row staleness check
    // for the new-user upsert and runs origin cleanup
    // unconditionally, so a delayed TRANSFER no longer needs the
    // sync's `updated_at` to be backdated.
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
      // Permanent → 500 with a distinct reason so the client can avoid a
      // pointless retry; transient → also 500, the client falls back to
      // restored_pending either way (best-effort sync semantics).
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

  // No active entitlement — RC's source-of-truth says the user is not a
  // paying subscriber. Run the shared downgrade helper.
  const downgrade = await downgradeSubscriptionToFree(serviceClient, userId, correlationId, allowanceKey);
  if (!downgrade.ok) {
    // DB write failed — return 5xx so the client falls back to
    // `restored_pending` and re-tries on next mount. Codex round 7.
    return jsonResponse({ ok: false, reason: downgrade.reason ?? "downgrade_failed" }, 500);
  }
  logStep("Sync: no active entitlements — downgraded", { userId }, correlationId);
  return jsonResponse({
    ok: true,
    action: "sync",
    state: { plan: "free", status: "canceled", current_period_end: null },
  }, 200);
}

/**
 * Downgrade a user's subscription rows to free + zero their monthly
 * allowance. Mirrors EXPIRATION semantics (status='canceled', plan='free',
 * allowance reset). Used by both the inactive-entitlement branch and
 * the RC-subscriber-not-found 404 branch of `handleSyncRequest`.
 *
 * IMPORTANT — Stripe-managed rows are skipped (Codex round 7). A user
 * who is premium via Stripe (web checkout) tapping Restore on iOS
 * causes RC to return 404 / no entitlements (no Apple-side purchase
 * exists). Downgrading their `subscriptions` row would revoke a valid
 * paid Stripe subscription. Filter the UPDATE by
 * `stripe_mode='revenuecat' OR stripe_mode IS NULL` so Stripe-paid
 * users are unaffected by RC sync.
 *
 * `updated_at` is set to wall-clock `now()`. The original round-7
 * synthetic 5-min-backdate was reverted by Codex round 12 P1 — older
 * webhook deliveries within the replay window could overwrite just-
 * synced state. The TRANSFER staleness concern that motivated the
 * backdate is now handled at the event-routing level: TRANSFER applies
 * staleness to its new-user upsert per-row and always runs origin
 * cleanup unconditionally (origin cleanup is idempotent + Stripe-
 * protected, so re-running it is safe).
 *
 * Returns `{ ok }` so the caller can propagate a non-2xx when the
 * downgrade fails — without that, the client maps a successful 200
 * response to `'no_purchases'` while the stale `subscriptions` row
 * stays `plan='premium'`, leaving the user unlocked.
 */
async function downgradeSubscriptionToFree(
  serviceClient: SupabaseClient,
  userId: string,
  correlationId: string,
  allowanceKey: string,
): Promise<{ ok: boolean; reason?: string; skipped?: boolean }> {
  // SELECT first to determine if the row is Stripe-managed. The previous
  // approach used a `.or(stripe_mode.eq.revenuecat,stripe_mode.is.null)`
  // filter on the UPDATE, which correctly skipped Stripe rows on the
  // primary table — but the subsequent `user_subscriptions` UPDATE and
  // `setMonthlyAllowance(..., 0, ...)` calls fired unconditionally,
  // revoking render credits / legacy plan state for valid Stripe
  // subscribers (Codex round 8). Read-then-decide gates ALL three
  // writes off the same Stripe-mode check.
  const { data: existing, error: selectErr } = await serviceClient
    .from("subscriptions")
    .select("stripe_mode, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (selectErr) {
    logStep("Sync: subscriptions select-before-downgrade failed", { userId, error: selectErr.message, code: selectErr.code }, correlationId);
    return { ok: false, reason: "subscriptions_select_failed" };
  }
  // Skip the RC downgrade ONLY when Stripe is actively paying.
  // Stripe-managed rows whose status is `canceled` / `past_due` /
  // null fall through and let RC reconcile to free — they're no
  // longer paying via Stripe so RC's "no purchases" answer is
  // authoritative. Codex round 14 P1 caught the original
  // `stripe_mode in (live,test)` predicate; without the active-
  // payment gate, a user who cancelled Stripe and hadn't yet bought
  // via iOS would stay on a stale row.
  if (isStripeActivelyPaying(existing)) {
    logStep("Sync: skipping downgrade — row is Stripe-managed and actively paying", { userId, existingMode: existing?.stripe_mode, existingStatus: existing?.status }, correlationId);
    // Treat as success — there's nothing for us to reconcile, the user
    // is paid via Stripe and their state is correct as-is. The caller
    // returns the standard inactive response to the client which
    // surfaces the "no purchases on this Apple ID" UX (accurate; their
    // purchases are on the Stripe side).
    return { ok: true, skipped: true };
  }

  // Wall-clock `now()` for the staleness watermark — see header
  // doc-block. TRANSFER's per-row staleness handling decoupled the
  // sync watermark from the staleness-comparison-against-future-
  // webhooks concern.
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

  // Sync path dispatch — `?action=sync` switches to the authenticated
  // client-triggered reconciliation flow. Done before the HMAC check so
  // sync requests aren't rejected for missing the webhook signature header.
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

  // Provisional correlation id for early-failure logs — we'll switch to
  // the eventId-derived one after parse, but we want SOMETHING traceable
  // for signature-rejected payloads.
  let correlationId: string = crypto.randomUUID();

  let body: string;
  try {
    body = await req.text();
  } catch (err) {
    logStep("Failed to read body", { message: err instanceof Error ? err.message : String(err) }, correlationId);
    return jsonResponse({ error: "Invalid body" }, 400);
  }

  // Signature verification — wave-mandated HMAC SHA256 over body.
  const secret = await getCachedSecret(serviceClient);
  if (!secret) {
    logStep("Missing webhook secret in vault and env", undefined, correlationId);
    captureWarning("revenuecat_webhook_secret_missing", {
      function: "revenuecat_webhook",
      correlation_id: correlationId,
    });
    return jsonResponse({ error: "Webhook secret not configured" }, 500);
  }

  // Header lookup is already case-insensitive — no need for a second
  // lookup with a different casing.
  const headerSig = req.headers.get(SIGNATURE_HEADER);
  if (!headerSig) {
    logStep("Missing signature header", undefined, correlationId);
    return jsonResponse({ error: "Missing signature" }, 401);
  }

  let expectedHex: string;
  try {
    expectedHex = await computeHmacHex(secret, body);
  } catch (err) {
    logStep("HMAC compute failed", { message: err instanceof Error ? err.message : String(err) }, correlationId);
    return jsonResponse({ error: "Signature verification failure" }, 500);
  }

  const provided = normalizeSignature(headerSig);
  if (!timingSafeEqual(expectedHex, provided)) {
    logStep("Signature mismatch", undefined, correlationId);
    captureWarning("revenuecat_signature_mismatch", {
      function: "revenuecat_webhook",
      correlation_id: correlationId,
    });
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  // Parse payload (defensive — never crash on malformed input).
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

  // Replay protection — reject events older than the tolerance window.
  // Without this, a captured (body, signature) pair is valid forever.
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
    // Outside the 5-minute replay window. RevenueCat's documented retry
    // policy goes out to 80 minutes after a failed first attempt
    // (https://www.revenuecat.com/docs/integrations/webhooks); rejecting
    // every late event would permanently drop subscription state on any
    // transient DB / function outage. Codex round 6 P1: distinguish
    // "legitimate provider retry of a pending row" from "captured
    // payload replayed by an attacker" by looking up the event_id. If a
    // row exists with `processed_at` still NULL, this delivery is a
    // genuine RC retry — let it through to the idempotency / processing
    // logic below. Otherwise (no row, or already-processed row) reject
    // as before. HMAC validation has already passed by this point so an
    // attacker would need our shared secret to reach this branch
    // anyway; the pending-row check doesn't materially weaken the
    // replay surface.
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

  // Sandbox vs production gating. Default to production unless the
  // operator has flipped ALLOW_SANDBOX_EVENTS=true on the function (used
  // by preview branches that want to exercise the full path with RC
  // sandbox payloads).
  const allowSandbox = (Deno.env.get("ALLOW_SANDBOX_EVENTS") ?? "").toLowerCase() === "true";
  const eventEnv = typeof event.environment === "string" ? event.environment.toUpperCase() : null;
  if (!allowSandbox && eventEnv === "SANDBOX") {
    logStep("Rejecting SANDBOX event in production environment", { eventEnv }, correlationId);
    captureWarning("revenuecat_sandbox_on_prod", {
      function: "revenuecat_webhook",
      correlation_id: correlationId,
    });
    // Still log to events table so audit shows we received it. We
    // synthesize a minimal log row + return 200 so RC doesn't retry.
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
    // Upgrade the correlation id to a stable derivative of the event id
    // so logs across retries can be grouped.
    correlationId = `evt_${eventId.slice(0, 12)}`;
  }

  if (!eventId) {
    logStep("Event missing id; cannot dedupe — accepting once", { eventType }, correlationId);
    // Without an id we cannot dedupe. We still try to process so
    // RevenueCat doesn't endlessly retry, but we don't write the events
    // log row either. Return 200 to avoid retry storms.
    try {
      // Fabricate a one-off id for downstream allowance idempotency keys.
      await handleEvent(serviceClient, event, `noid_${crypto.randomUUID()}`, correlationId);
    } catch (err) {
      logStep("Processing failed (no id)", {
        message: err instanceof Error ? err.message : String(err),
      }, correlationId);
    }
    return jsonResponse({ received: true, deduped: false }, 200);
  }

  // Idempotency: atomic claim via PRIMARY KEY conflict (mirrors
  // stripe_events). Use `.maybeSingle()` so a duplicate insert (which
  // ignoreDuplicates collapses to zero rows) returns `data: null`
  // cleanly without an error code sentinel.
  //
  // Pending-row semantics (Codex P0 on PR #759):
  // - Fresh insert → `inserted` carries the row, `processed_at` is NULL.
  // - Duplicate insert → `inserted` is null. Read the existing row:
  //     processed_at non-null  → already processed; short-circuit.
  //     processed_at null      → previous attempt was transient-failed;
  //                              this is a retry. Bump attempts and
  //                              continue processing.
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
    // Existing row — check whether it was actually processed.
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
      // Disappeared between upsert and select (cleanup cron, manual
      // delete) — treat as fresh-claim and proceed.
      logStep("Existing row vanished between upsert and select; proceeding", undefined, correlationId);
    } else if (existing.processed_at) {
      logStep("Duplicate event — already processed", { eventId }, correlationId);
      return jsonResponse({ received: true, status: "already_processed" }, 200);
    } else {
      // Pending row — previous attempt was transient-failed. Bump
      // attempts and continue.
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
    classification = "permanent"; // success path: stamp processed_at, no retry needed
  } catch (err) {
    processingError = err instanceof Error ? err.message : String(err);
    // Stale-event tag and explicit non-uuid throw → permanent.
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

  // Update the events log with the outcome.
  //   - Success or PERMANENT failure → stamp processed_at (no retry).
  //   - TRANSIENT failure → leave processed_at NULL so RC's retry
  //     re-enters this function and re-processes the event.
  // Best-effort: failure to update the log row is a soft warning, never
  // a 5xx (the subscription mutation is the source of truth).
  try {
    if (processingError && classification === "transient") {
      // Record the transient error message but DO NOT stamp
      // processed_at — leave the row pending for the next RC retry.
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
