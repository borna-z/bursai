/**
 * Wave 8 P52 — start_trial edge function.
 *
 * Auto-starts a 3-day Stripe trialing subscription on first SIGNED_IN. Called
 * fire-and-forget from `AuthContext.onAuthStateChange` — see
 * `src/contexts/AuthContext.tsx`. Idempotent across the three layers documented
 * below so re-fires from page reloads / reconnects / OAuth round-trips collapse
 * to a single Stripe customer + subscription pair per user.
 *
 * Runtime contract:
 *   POST /functions/v1/start_trial
 *   Authorization: Bearer <user JWT>
 *   Body: {} (none consumed; userId comes from the verified JWT)
 *
 * Success envelope:
 *   { ok: true, status: 'trialing', trial_end: '<ISO>' }              // first call
 *   { ok: true, already_started: true, status: '<existing>' }         // pre-check short-circuit
 *
 * Failure envelopes:
 *   { error: 'Missing authorization header' }      401
 *   { error: 'Unauthorized' }                       401
 *   { error: 'Stripe not configured' }              503  // missing env var (deploy issue)
 *   { ok: false, reason: 'stripe_error', ... }      502  // Stripe API failure
 *   { ok: false, error: '...' }                     500  // any other infra
 *
 * Why a dedicated edge function: handle_new_user trigger creates a free-tier
 * subscriptions row at signup; this function ELEVATES that row to plan='premium',
 * status='trialing' once Stripe customer + subscription objects are minted. Doing
 * the Stripe call from a Postgres trigger (via pg_net) was rejected — would put
 * 1-3s of HTTP latency in the auth path and require Stripe secrets in Postgres.
 *
 * Why fire-and-forget from the client: the function is idempotent on three
 * layers (DB pre-check, DB-backed request_idempotency, Stripe-side keys), so
 * re-firing on every reload is a no-op after the first success. The user is
 * never blocked on the Stripe API call.
 *
 * Idempotency layers (defense in depth):
 *   1. DB pre-check: if `subscriptions.stripe_subscription_id` is already set
 *      AND status != 'canceled', short-circuit with { ok:true, already_started:true }
 *      before touching Stripe.
 *   2. DB-backed request_idempotency (P12 helper): scoped on
 *      `(start_trial, userId)` + raw client header. Re-fires within the 5-min
 *      window collapse to the cached response.
 *   3. Stripe-side idempotency-key headers on customers.create + subscriptions.create:
 *      `start_trial_customer_${userId}` / `start_trial_sub_${userId}`. If our DB
 *      write crashes between Stripe call and subscriptions.upsert, the next call
 *      reuses the same Stripe objects instead of leaking duplicates.
 *
 * Spec divergence (Wave 8 spec vs. implementation):
 *   The wave file says start_trial should also set `profiles.onboarding_started_at = NOW()`.
 *   This implementation INTENTIONALLY does not. Wave 7's migration
 *   `20260426120000_onboarding_state.sql` REVOKE'd UPDATE on that column from
 *   authenticated roles — only the `advance_onboarding_step` SECURITY DEFINER
 *   RPC writes it. Letting start_trial (service-role) write it would bypass
 *   the defense-in-depth design AND start the 24h onboarding rate-limit boost
 *   from signup time instead of from when the user actually engages — a UX
 *   regression for users who sign up then return hours later.
 *
 * Auth pattern: user-facing function (matches grant_trial_gift / delete_user_account).
 * Anon client + getUser() to verify the JWT, then service-role client for the
 * Stripe write + DB upsert. Service-role bypasses the column-level GRANT/REVOKE
 * on `subscriptions` (Wave 7 didn't lock that table).
 */

import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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
import { getStripeConfig } from "../_shared/stripe-config.ts";
import { checkIdempotency, storeIdempotencyResult } from "../_shared/idempotency.ts";

const TRIAL_DAYS = 3;

const log = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[start_trial] ${step}${detailsStr}`);
};

serve(async (req) => {
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

  if (checkOverload("start_trial")) {
    return overloadResponse(CORS_HEADERS);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth FIRST. Mirrors create_checkout_session's ordering — idempotency
    // check below must run AFTER auth so the verified user.id can scope the
    // DB key (per P12 / Codex P1 round 2 on PR #658).
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
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limit AFTER auth. start_trial uses the same 10/hr, 2/min budget as
    // sibling Stripe-API endpoints (restore_subscription, create_portal_session).
    await enforceRateLimit(adminClient, userId, "start_trial");

    // Layer 2: DB-backed idempotency. Only meaningful if the client passes
    // x-idempotency-key (AuthContext does not — re-fires across the same
    // session are guarded by the per-tab Set, and re-fires across tabs are
    // guarded by layer 1 (DB pre-check) + layer 3 (Stripe-side keys)).
    const idempotencyScope = { functionName: "start_trial", userId };
    const cached = await checkIdempotency(req, adminClient, idempotencyScope);
    if (cached) {
      log("Returning cached idempotent response", { status: cached.status });
      return cached;
    }

    // Layer 1: pre-check existing subscription state. If we already minted
    // a Stripe subscription for this user (regardless of current status),
    // short-circuit with ok:true and skip Stripe entirely.
    //
    // Codex P1 round 2 on PR #698 — DO NOT carve out 'canceled' status
    // here. Stripe caches idempotency-key responses for ~24h. If we let a
    // canceled user re-enter this Stripe call with the fixed key
    // `start_trial_sub_${userId}`, Stripe replays the ORIGINAL trialing
    // subscription payload, and we write status='trialing' + the OLD
    // stripe_subscription_id back to the DB — silently restoring premium
    // state for up to 24h until the next webhook reconciliation. Worse,
    // it's a trial-cycling vector (cancel → wait → re-trigger → another
    // 3 free days). Re-subscribe paths (paywall + create_checkout_session
    // + restore_subscription) own the canceled-account flow; start_trial
    // is exclusively for the FIRST trial mint per user.
    //
    // Status enum spread across all paths: `'incomplete'`,
    // `'incomplete_expired'`, `'trialing'`, `'active'`, `'past_due'`,
    // `'unpaid'`, `'canceled'`. We treat any non-null
    // `stripe_subscription_id` as a definitive "already started" signal —
    // user's actual entitlement comes from `subscriptions.status` read by
    // P54+ enforce + the frontend paywall.
    const { data: existing, error: existingError } = await adminClient
      .from("subscriptions")
      .select("status, plan, stripe_subscription_id, stripe_customer_id, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      // DB read failure on a hot path. Log and fail soft — let the rest of
      // the flow proceed; if there really is an existing subscription, the
      // Stripe-side idempotency key will prevent a duplicate customer mint,
      // and the upsert at the end will overwrite cleanly. Log loud so we
      // see this if it ever happens in prod.
      console.warn("[start_trial] subscriptions pre-check failed (continuing):", existingError.message);
    }

    if (existing?.stripe_subscription_id) {
      log("Pre-check short-circuit (already started)", {
        userId,
        status: existing.status,
        stripe_subscription_id: existing.stripe_subscription_id,
      });
      const response = new Response(
        JSON.stringify({
          ok: true,
          already_started: true,
          status: existing.status,
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
      await storeIdempotencyResult(req, response, adminClient, idempotencyScope);
      return response;
    }

    // Stripe configuration. Mirrors create_checkout_session pattern.
    const stripeConfig = getStripeConfig();
    if (!stripeConfig.secretKey) {
      log("ERROR Stripe secret missing", { mode: stripeConfig.mode });
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        {
          status: 503,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }
    if (!stripeConfig.priceIdMonthly) {
      log("ERROR Stripe monthly price ID missing", { mode: stripeConfig.mode });
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        {
          status: 503,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const stripe = new Stripe(stripeConfig.secretKey, { apiVersion: "2025-08-27.basil" });

    // Layer 3a: Stripe-side idempotency on customer creation. Key is derived
    // from userId so retries across isolates / sessions / TTL windows reuse
    // the same Stripe customer. Reuse the existing customer if one is on
    // file (rescues a partial run that minted the customer but failed before
    // creating the subscription).
    let customerId = existing?.stripe_customer_id ?? null;
    if (!customerId) {
      log("Creating Stripe customer", { userId, hasEmail: !!user.email });
      const customer = await stripe.customers.create(
        {
          email: user.email ?? undefined,
          metadata: { supabase_user_id: userId },
        },
        { idempotencyKey: `start_trial_customer_${userId}` },
      );
      customerId = customer.id;
      log("Stripe customer created", { customerId });
    } else {
      log("Reusing existing Stripe customer", { customerId });
    }

    // Layer 3b: Stripe-side idempotency on subscription creation. Same
    // userId-derived key — Stripe will return the existing subscription if
    // we've already minted one with this key.
    log("Creating Stripe subscription", { customerId, trialDays: TRIAL_DAYS });
    const subscription = await stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ price: stripeConfig.priceIdMonthly }],
        trial_period_days: TRIAL_DAYS,
        // default_incomplete lets the subscription enter the trial immediately
        // without a payment method on file. The user is prompted to add one
        // before trial end via P54+ paywall flow.
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        metadata: { supabase_user_id: userId },
      },
      { idempotencyKey: `start_trial_sub_${userId}` },
    );
    log("Stripe subscription created", {
      subscriptionId: subscription.id,
      status: subscription.status,
      trial_end: subscription.trial_end,
    });

    // Persist to subscriptions row. (user_id) is UNIQUE so upsert is safe
    // against the row that handle_new_user trigger inserted at signup.
    // stripe_webhook will also write this row on customer.subscription.created
    // (1-30s later); both writers carry the same authoritative columns so the
    // last write wins benignly.
    const trialEnd = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null;

    const { error: upsertError } = await adminClient
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          status: "trialing",
          plan: "premium",
          stripe_mode: stripeConfig.mode,
          price_id: stripeConfig.priceIdMonthly,
          current_period_end: trialEnd,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      // Stripe state is now ahead of our DB. The next start_trial fire will
      // hit layer 3 (Stripe idempotency keys) and reuse the same customer +
      // subscription objects, then the upsert here will succeed. Mirror to
      // profiles.stripe_customer_id is also skipped — same recovery path.
      console.error("[start_trial] subscriptions upsert failed (Stripe ahead of DB):", upsertError.message);
      recordError("start_trial");
      return new Response(
        JSON.stringify({
          ok: false,
          reason: "db_upsert_failed",
          error: upsertError.message,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // Mirror customer id onto profiles. Matches stripe_webhook line ~131
    // pattern — the profile row is the canonical place other code looks for
    // the Stripe customer (e.g. create_portal_session). This write is
    // best-effort; failure here doesn't roll back the upsert above because
    // subscriptions is the source of truth and a re-fire will retry this.
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);
    if (profileError) {
      console.warn("[start_trial] profiles.stripe_customer_id mirror failed:", profileError.message);
    }

    // Codex P1 round 1 on PR #698 — mirror plan into the legacy
    // `user_subscriptions` table. The frontend `useSubscription` hook still
    // reads `user_subscriptions` (P53 will migrate it to `subscriptions`),
    // so without this mirror the UI would keep showing free-tier gating
    // (paywall + limits) until `stripe_webhook` fires its own dual-write
    // 1-30 seconds later on `customer.subscription.created`. Same dual-write
    // pattern stripe_webhook uses (lines 304-308). UPSERT (not UPDATE like
    // the webhook) because `start_trial` runs from the AuthContext listener
    // which fires BEFORE useSubscription's bootstrap upsert — so the row
    // may not exist yet. Best-effort: failure here doesn't roll back the
    // canonical `subscriptions` upsert above.
    const { error: legacyMirrorError } = await adminClient
      .from("user_subscriptions")
      .upsert(
        {
          user_id: userId,
          plan: "premium",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (legacyMirrorError) {
      console.warn("[start_trial] user_subscriptions mirror failed:", legacyMirrorError.message);
    }

    log("Trial started", { userId, customerId, subscriptionId: subscription.id, trialEnd });

    const response = new Response(
      JSON.stringify({
        ok: true,
        status: "trialing",
        trial_end: trialEnd,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
    await storeIdempotencyResult(req, response, adminClient, idempotencyScope);
    return response;
  } catch (err) {
    if (err instanceof RateLimitError) {
      return rateLimitResponse(err, CORS_HEADERS);
    }

    // Stripe SDK throws StripeError subclasses with a `type` field. Map the
    // most actionable ones; treat the rest as infrastructure failures.
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorType = (err as { type?: string })?.type;

    recordError("start_trial");
    console.error("[start_trial] unexpected error:", { errorMessage, errorType });

    // Stripe API failures (rate-limited, idempotency-key-conflict, etc.)
    // surface as 502 so the client can distinguish them from our own infra
    // problems.
    if (typeof errorType === "string" && errorType.startsWith("Stripe")) {
      return new Response(
        JSON.stringify({
          ok: false,
          reason: "stripe_error",
          type: errorType,
          error: errorMessage,
        }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
});
