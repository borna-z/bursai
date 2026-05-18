// DEPRECATED — web-only Stripe path, scheduled for deletion post-launch.
// Retained until web app removal. Do NOT add new callers; mobile uses RevenueCat exclusively.
// N10 hygiene marker: web-only Stripe trial mint endpoint. Mobile auto-trials are minted
// by RevenueCat introductory offers attached to the StoreKit product.
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
import { logger } from "../_shared/logger.ts";
import { getOrCreateRequestId } from "../_shared/request-id.ts";

const TRIAL_DAYS = 3;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // Request-id binds every log line emitted for this call. Honors mobile
  // `x-request-id`, mints a fresh uuid otherwise.
  const requestId = getOrCreateRequestId(req);
  const slog = logger("start_trial", requestId);
  // Back-compat shim: the original local `log(step, details)` API. Keeps
  // existing call sites unchanged while routing through the structured
  // logger (so every line now carries `level`, `fn`, `request_id`, `ts`).
  const log = (step: string, details?: unknown) => {
    slog.info(step, details as Record<string, unknown> | undefined);
  };

  slog.warn("deprecated web-only Stripe edge function called", { fn: "start_trial" });

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

    // Codex P1 round 7 on PR #698 — DO NOT call enforceRateLimit yet.
    // Rate-limiting must come AFTER all the cheap short-circuit paths
    // (idempotency cache, DB pre-check on stripe_subscription_id,
    // user_metadata.trial_pending gate) so that:
    //   1. Repeated SIGNED_IN events from focus changes / multi-tab
    //      re-establishments / token refresh don't burn the 2/min cap
    //      with no-op short-circuit calls. This previously meant a
    //      legitimate retry after a transient failure could 429 before
    //      the function even reached its idempotent paths.
    //   2. Already-trialing users hitting this endpoint via re-fires
    //      don't consume quota when they're going to short-circuit
    //      anyway.
    // We re-introduce enforceRateLimit just before the Stripe customer
    // creation, so only calls that ACTUALLY proceed to billing
    // operations consume rate-limit budget.

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
      // Codex P1 round 4 on PR #698 — fail CLOSED. A transient DB read
      // failure on a user who already has a Stripe subscription
      // (minted by create_checkout_session, NOT this function) would
      // mean we can't see their stripe_subscription_id. Without that
      // signal, we'd fall through to fresh Stripe customer +
      // subscription creation. The `start_trial_*` Stripe idempotency
      // keys are unique to THIS function — they don't deduplicate
      // against customers/subscriptions that other code paths created.
      // So we'd mint a duplicate customer, a duplicate subscription,
      // AND overwrite the row with trialing state, demoting an
      // already-subscribed user to a 3-day trial with bonus Stripe
      // billable objects.
      //
      // Return 503 so AuthContext's invoke-result-error rollback fires
      // and the next SIGNED_IN retries. By then, the DB blip is likely
      // resolved and we recover cleanly. Don't cache the failure (no
      // storeIdempotencyResult) — next call should retry, not replay
      // a stale 503.
      slog.error("subscriptions pre-check failed (failing closed)", { error: existingError.message });
      recordError("start_trial");
      return new Response(
        JSON.stringify({
          ok: false,
          reason: "precheck_failed",
          error: existingError.message,
        }),
        {
          status: 503,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
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

    // Codex P1 round 5 on PR #698 — scope gate via explicit per-signup
    // signal. The earlier 24h `subscriptions.created_at` recency check
    // had two failure modes: (a) auto-enrolled legacy users on their next
    // login (broader than P52's documented "on signup completion"); (b)
    // permanently locked out fresh signups whose first call failed
    // transiently OR whose email-confirm took >24h. Replaced with the
    // `trial_pending` flag set in raw_user_meta_data by the
    // `handle_new_user` AFTER INSERT trigger (covers email + OAuth) AND
    // by the email/password signUp() callback (defense in depth). Legacy
    // users (auth.users rows created before the migration) never carry
    // the flag — they re-subscribe via the paywall path (P54+ +
    // create_checkout_session + restore_subscription).
    //
    // Codex P1 round 8 on PR #698 — read the flag from a FRESH DB row,
    // NOT from `user.user_metadata` (which comes from the verified JWT
    // claims). The `handle_new_user` trigger is AFTER INSERT, so the
    // FIRST session JWT issued by Supabase auth can carry pre-trigger
    // metadata for OAuth and email-confirm signups. The JWT-based check
    // therefore silently skipped fresh signups, leaving them on the free
    // plan until token refresh. `adminClient.auth.admin.getUserById`
    // hits the database authoritatively and always sees the post-trigger
    // state.
    //
    // Defense in depth: the flag is in user_metadata which a malicious
    // user CAN set via updateUser({data: {...}}), but the worst-case
    // exploit is claiming ONE trial — DB pre-check above prevents
    // re-mints, and Stripe-side idempotency keys prevent duplicate
    // billing objects. Net per-user trial cap is 1, same as intended.
    const { data: freshUser, error: freshUserError } = await adminClient.auth.admin.getUserById(userId);
    if (freshUserError || !freshUser?.user) {
      // Failing closed: the user disappeared between auth and the metadata
      // read (account deletion race?), or the auth admin API blipped.
      // Either way, return 503 so AuthContext's invoke-error rollback
      // re-fires next SIGNED_IN.
      slog.error("auth.admin.getUserById failed (failing closed)", { error: freshUserError?.message });
      recordError("start_trial");
      return new Response(
        JSON.stringify({
          ok: false,
          reason: "user_lookup_failed",
          error: freshUserError?.message ?? "user not found",
        }),
        {
          status: 503,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const trialPending = (freshUser.user.user_metadata as { trial_pending?: unknown })?.trial_pending === true;
    if (!trialPending) {
      log("Pre-check short-circuit (not eligible — no trial_pending flag)", { userId });
      const response = new Response(
        JSON.stringify({
          ok: true,
          already_started: false,
          reason: "not_eligible",
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

    // Codex P1 round 7 on PR #698 — rate limit ONLY for calls that
    // actually proceed to Stripe billing. Idempotent / no-op short-
    // circuits above (cached responses, already-started, not-eligible)
    // don't consume quota. start_trial uses the same 10/hr, 2/min
    // budget as sibling Stripe-API endpoints (restore_subscription,
    // create_portal_session).
    await enforceRateLimit(adminClient, userId, "start_trial");

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
      slog.error("subscriptions upsert failed (Stripe ahead of DB)", { error: upsertError.message });
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
      slog.warn("profiles.stripe_customer_id mirror failed", { error: profileError.message });
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
      slog.warn("user_subscriptions mirror failed", { error: legacyMirrorError.message });
    }

    // Clear `trial_pending` from user_metadata so future SIGNED_IN events
    // short-circuit at the not_eligible gate above. Preserve existing keys
    // (display_name, full_name from OAuth, avatar_url, etc.) via spread —
    // supabase auth admin replaces user_metadata wholesale, not merge.
    // Spread `freshUser.user.user_metadata` rather than `user.user_metadata`
    // so we capture the post-trigger state (Codex round 8 — JWT claims may
    // be pre-trigger). Best-effort: failure here doesn't roll back; the DB
    // pre-check on `subscriptions.stripe_subscription_id` short-circuits
    // any subsequent re-fires anyway, and the metadata value catches up on
    // the next token refresh.
    const updatedMetadata = {
      ...(freshUser.user.user_metadata ?? {}),
      trial_pending: false,
    };
    const { error: clearMetadataError } = await adminClient.auth.admin.updateUserById(
      userId,
      { user_metadata: updatedMetadata },
    );
    if (clearMetadataError) {
      slog.warn("trial_pending metadata clear failed", { error: clearMetadataError.message });
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
    slog.error("unexpected error", { errorMessage, errorType });

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
