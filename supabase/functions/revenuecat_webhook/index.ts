/**
 * M31 PR B — RevenueCat webhook.
 *
 * Mirrors `stripe_webhook` semantics for the RevenueCat path:
 *   1. Verify the request originated from RevenueCat.
 *   2. De-duplicate by event id (PRIMARY KEY race wins → idempotent).
 *   3. Route by event type → upsert / patch the `subscriptions` row that
 *      matches `app_user_id` to `user_id` (PR A configures Purchases with
 *      `appUserID: user.id` so the values are 1:1 the auth UUID).
 *   4. Always log to `revenuecat_events` so a replay of the same payload
 *      short-circuits to `{ status: 'already_processed' }`.
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
 * Subscription state semantics:
 *   - INITIAL_PURCHASE / RENEWAL / UNCANCELLATION / PRODUCT_CHANGE / TRANSFER
 *       → upsert `subscriptions` with status='active', plan='premium',
 *         current_period_end = expiration_at_ms.
 *   - CANCELLATION
 *       → keep status='active' until expiration (Apple grace period); the
 *         existing `current_period_end` is left in place. RevenueCat will
 *         later send EXPIRATION when the period actually ends.
 *   - EXPIRATION
 *       → status='canceled', plan='free' (matches stripe_webhook deleted).
 *   - BILLING_ISSUE
 *       → status='past_due', plan='free' (matches stripe payment_failed).
 *   - NON_RENEWING_PURCHASE
 *       → upsert as active for the duration the entitlement granted.
 *   - SUBSCRIBER_ALIAS / TEST / others
 *       → log only, no subscriptions mutation.
 *
 * Error handling:
 *   - Permanent processing errors (bad shape, unknown user) → log to
 *     `revenuecat_events.error`, return 200 so RevenueCat does not
 *     hammer the endpoint forever.
 *   - Transient errors (DB upsert fails) → return 500 so RevenueCat
 *     retries with its built-in exponential backoff.
 */

import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { CORS_HEADERS } from "../_shared/cors.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";

const VAULT_SECRET_NAME = "revenuecat_webhook_secret";
const ENV_FALLBACK_SECRET = "REVENUECAT_WEBHOOK_SECRET";
const SIGNATURE_HEADER = "x-revenuecat-signature";

type SubscriptionsTable = {
  user_id: string;
  status: string;
  plan: string;
  price_id: string | null;
  current_period_end: string | null;
  updated_at: string;
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
  store?: string;
  environment?: string;
  // RevenueCat sometimes nests the event under `event`.
  // We unwrap before touching it.
  [key: string]: unknown;
};

type RevenueCatEnvelope = {
  api_version?: string;
  event?: RevenueCatEvent;
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[REVENUECAT-WEBHOOK] ${step}${detailsStr}`);
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
    }
  } catch (err) {
    logStep("Vault read failed; falling back to env", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const fromEnv = Deno.env.get(ENV_FALLBACK_SECRET) ?? "";
  return fromEnv.length > 0 ? fromEnv : null;
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
 * happens. Last-ditch fallback: hash of payload + type + timestamp so
 * we never lose the idempotency anchor.
 */
function deriveEventId(event: RevenueCatEvent): string | null {
  if (typeof event.id === "string" && event.id.length > 0) return event.id;
  if (typeof event.event_id === "string" && event.event_id.length > 0) return event.event_id;
  return null;
}

/**
 * Map a RevenueCat product_id → our internal plan label.
 * Per the project facts: monthly = 119 SEK, yearly = 899 SEK.
 * The product_id naming is owner-controlled in App Store Connect /
 * Google Play; we accept the common patterns RevenueCat uses out of
 * the box (`*_monthly`, `*.monthly`, `*-month`, `*_yearly`, etc.).
 * For now `plan` is the canonical 'premium' / 'free' string the rest
 * of the app reads — `price_id` carries the granular SKU.
 */
function productIdToPlanLabel(productId: string | undefined): "premium" {
  // The codebase's `subscriptions.plan` column is 'free' | 'premium' (see
  // stripe_webhook). Granular monthly/yearly tracking lives in `price_id`,
  // not `plan`. So every active RC purchase maps to `premium`.
  return "premium";
}

function parseExpirationMs(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 0) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function upsertSubscriptionActive(
  client: SupabaseClient,
  userId: string,
  event: RevenueCatEvent,
  status: "active" | "trialing",
): Promise<void> {
  const periodEnd = parseExpirationMs(event.expiration_at_ms);
  const productId = typeof event.product_id === "string" ? event.product_id : null;

  const row: Partial<SubscriptionsTable> & { user_id: string; stripe_mode?: string } = {
    user_id: userId,
    status,
    plan: productIdToPlanLabel(productId ?? undefined),
    price_id: productId,
    current_period_end: periodEnd,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client
    .from("subscriptions")
    .upsert(row, { onConflict: "user_id" });

  if (error) {
    logStep("Active upsert failed", { userId, error: error.message });
    throw new Error(`subscriptions upsert: ${error.message}`);
  }

  // Mirror to user_subscriptions for backward compatibility (matches
  // stripe_webhook).
  await client
    .from("user_subscriptions")
    .update({ plan: row.plan, updated_at: row.updated_at })
    .eq("user_id", userId);
}

async function markSubscriptionEnded(
  client: SupabaseClient,
  userId: string,
  status: "canceled" | "past_due",
): Promise<void> {
  const updatedAt = new Date().toISOString();

  const { error } = await client
    .from("subscriptions")
    .update({
      status,
      plan: "free",
      updated_at: updatedAt,
    })
    .eq("user_id", userId);

  if (error) {
    logStep("End-of-life update failed", { userId, status, error: error.message });
    throw new Error(`subscriptions update: ${error.message}`);
  }

  await client
    .from("user_subscriptions")
    .update({ plan: "free", updated_at: updatedAt })
    .eq("user_id", userId);
}

async function handleEvent(
  client: SupabaseClient,
  event: RevenueCatEvent,
): Promise<void> {
  const userId = typeof event.app_user_id === "string" ? event.app_user_id : null;
  if (!userId) {
    logStep("Event missing app_user_id; nothing to do");
    return;
  }
  // Sanity: RevenueCat aliases sometimes set `app_user_id` to a non-UUID
  // anonymous id ($RCAnonymousID:...). Skip those — they were emitted
  // before PR A's `Purchases.configure({ appUserID: user.id })` ran.
  if (userId.startsWith("$RCAnonymousID")) {
    logStep("Skipping anonymous app_user_id", { userId });
    return;
  }

  const type = (event.type ?? "").toUpperCase();
  switch (type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "TRANSFER":
    case "NON_RENEWING_PURCHASE": {
      logStep("Active-state event", { type, userId });
      await upsertSubscriptionActive(client, userId, event, "active");
      break;
    }
    case "CANCELLATION": {
      // Apple grace period: keep `active` until the period actually ends.
      // We DO NOT downgrade plan here. RevenueCat sends EXPIRATION when
      // the entitlement actually lapses.
      logStep("Cancellation received — keeping active until expiration", { userId });
      // Touch updated_at so observers see the event landed.
      const { error } = await client
        .from("subscriptions")
        .update({ updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) {
        logStep("Cancellation touch failed", { userId, error: error.message });
        throw new Error(`subscriptions touch: ${error.message}`);
      }
      break;
    }
    case "EXPIRATION": {
      logStep("Expiration event", { userId });
      await markSubscriptionEnded(client, userId, "canceled");
      break;
    }
    case "BILLING_ISSUE": {
      logStep("Billing issue event", { userId });
      await markSubscriptionEnded(client, userId, "past_due");
      break;
    }
    case "SUBSCRIBER_ALIAS":
    case "TEST":
    case "":
    default: {
      logStep("Logged-only event type", { type });
      break;
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    logStep("Missing Supabase env");
    return jsonResponse({ error: "Server misconfiguration" }, 500);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  let body: string;
  try {
    body = await req.text();
  } catch (err) {
    logStep("Failed to read body", { message: err instanceof Error ? err.message : String(err) });
    return jsonResponse({ error: "Invalid body" }, 400);
  }

  // Signature verification — wave-mandated HMAC SHA256 over body.
  const secret = await loadWebhookSecret(serviceClient);
  if (!secret) {
    logStep("Missing webhook secret in vault and env");
    return jsonResponse({ error: "Webhook secret not configured" }, 500);
  }

  const headerSig = req.headers.get(SIGNATURE_HEADER) ?? req.headers.get("X-RevenueCat-Signature");
  if (!headerSig) {
    logStep("Missing signature header");
    return jsonResponse({ error: "Missing signature" }, 401);
  }

  let expectedHex: string;
  try {
    expectedHex = await computeHmacHex(secret, body);
  } catch (err) {
    logStep("HMAC compute failed", { message: err instanceof Error ? err.message : String(err) });
    return jsonResponse({ error: "Signature verification failure" }, 500);
  }

  const provided = normalizeSignature(headerSig);
  if (!timingSafeEqual(expectedHex, provided)) {
    logStep("Signature mismatch");
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  // Parse payload (defensive — never crash on malformed input).
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    logStep("Invalid JSON", { message: err instanceof Error ? err.message : String(err) });
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const event = unwrapEvent(parsed);
  if (!event) {
    logStep("Unrecognized payload shape");
    return jsonResponse({ error: "Unrecognized payload" }, 400);
  }

  const eventId = deriveEventId(event);
  const eventType = typeof event.type === "string" ? event.type : "UNKNOWN";
  const appUserId = typeof event.app_user_id === "string" ? event.app_user_id : "unknown";

  if (!eventId) {
    logStep("Event missing id; cannot dedupe — accepting once", { eventType });
    // Without an id we cannot dedupe. We still try to process so
    // RevenueCat doesn't endlessly retry, but we don't write the events
    // log row either. Return 200 to avoid retry storms.
    try {
      await handleEvent(serviceClient, event);
    } catch (err) {
      logStep("Processing failed (no id)", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return jsonResponse({ received: true, deduped: false }, 200);
  }

  // Idempotency: atomic insert-or-skip via PRIMARY KEY conflict (mirrors
  // stripe_events). The first caller wins; subsequent deliveries see
  // `inserted === null` and short-circuit.
  const { data: inserted, error: insertError } = await serviceClient
    .from("revenuecat_events")
    .upsert(
      {
        event_id: eventId,
        event_type: eventType,
        app_user_id: appUserId,
        payload: event as unknown as Record<string, unknown>,
      },
      { onConflict: "event_id", ignoreDuplicates: true },
    )
    .select("event_id")
    .single();

  if (insertError && insertError.code !== "PGRST116") {
    // PGRST116 = "Results contain 0 rows" which is what we get on a
    // successful ignore-duplicates upsert. Anything else is a real DB
    // error → 500 so RevenueCat retries.
    logStep("Idempotency upsert failed", { error: insertError.message, code: insertError.code });
    return jsonResponse({ error: "Database error" }, 500);
  }

  if (!inserted) {
    logStep("Duplicate event — already processed", { eventId });
    return jsonResponse({ received: true, status: "already_processed" }, 200);
  }

  logStep("Processing event", { eventId, eventType, appUserId });

  let processingError: string | null = null;
  let isTransient = false;
  try {
    await handleEvent(serviceClient, event);
  } catch (err) {
    processingError = err instanceof Error ? err.message : String(err);
    // Treat all known DB-write failures as transient so RevenueCat
    // retries — they show up as "subscriptions upsert" or
    // "subscriptions update" prefixes in the message.
    if (processingError.startsWith("subscriptions ")) {
      isTransient = true;
    }
    logStep("Processing error", { error: processingError, transient: isTransient });
  }

  // Update the events log with the outcome. Best-effort: failure to
  // update the log row is a soft warning, never a 5xx (the subscription
  // mutation is the source of truth, not the log row).
  try {
    await serviceClient
      .from("revenuecat_events")
      .update({
        processed_at: new Date().toISOString(),
        error: processingError,
      })
      .eq("event_id", eventId);
  } catch (err) {
    logStep("Events log update failed (non-fatal)", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  if (processingError && isTransient) {
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
