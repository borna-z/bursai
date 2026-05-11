/**
 * BURS Scale Guard — Shared infrastructure for scale-hardening.
 *
 * Modules:
 * 1. Rate limiting policy (per-function tiered limits)
 * 2. AI cost estimation and token tracking
 * 3. Enhanced telemetry (latency, cost, cache, retries, failures)
 * 4. Job queue helpers (submit, claim, complete, fail)
 * 5. Overload protection (circuit breaker pattern for edge functions)
 * 6. Concurrency control for batch operations
 */

// ─── Rate Limit Policy ──────────────────────────────────────────
/**
 * Tiered rate limits per function. Expensive AI functions get
 * tighter limits; cheap reads get generous ones.
 *
 * Format: { maxPerHour, maxPerMinute (burst) }
 */
export interface RateLimitTier {
  maxPerHour: number;
  maxPerMinute: number;
  noTierMultiplier?: boolean;
}

const RATE_LIMIT_TIERS: Record<string, RateLimitTier> = {
  // Expensive AI generation — tight limits
  burs_style_engine:           { maxPerHour: 30, maxPerMinute: 5 },
  style_chat:                  { maxPerHour: 60, maxPerMinute: 15 },
  analyze_garment:             { maxPerHour: 500, maxPerMinute: 30, noTierMultiplier: true },
  generate_garment_images:     { maxPerHour: 20, maxPerMinute: 3 },
  generate_flatlay:            { maxPerHour: 15, maxPerMinute: 3 },
  render_garment_image:        { maxPerHour: 30, maxPerMinute: 3 },
  enqueue_render_job:          { maxPerHour: 60, maxPerMinute: 10 },
  outfit_photo_feedback:       { maxPerHour: 20, maxPerMinute: 4 },

  // Moderate AI usage
  mood_outfit:                 { maxPerHour: 30, maxPerMinute: 5 },
  suggest_outfit_combinations: { maxPerHour: 30, maxPerMinute: 5 },
  suggest_accessories:         { maxPerHour: 30, maxPerMinute: 5 },
  clone_outfit_dna:            { maxPerHour: 20, maxPerMinute: 4 },
  travel_capsule:              { maxPerHour: 15, maxPerMinute: 3 },
  shopping_chat:               { maxPerHour: 60, maxPerMinute: 10 },
  visual_search:               { maxPerHour: 30, maxPerMinute: 5 },

  // Light AI usage
  summarize_day:               { maxPerHour: 40, maxPerMinute: 8 },
  wardrobe_gap_analysis:       { maxPerHour: 15, maxPerMinute: 3 },
  wardrobe_aging:              { maxPerHour: 15, maxPerMinute: 3 },
  assess_garment_condition:    { maxPerHour: 30, maxPerMinute: 5 },
  detect_duplicate_garment:    { maxPerHour: 40, maxPerMinute: 8 },

  // Non-AI / utility functions (P9 — Wave 2-A)
  // generate_outfit: matches burs_style_engine because they call each other
  generate_outfit:             { maxPerHour: 30, maxPerMinute: 5 },
  // import_garments_from_links: expensive (scraping + AI enrichment)
  import_garments_from_links:  { maxPerHour: 10, maxPerMinute: 2 },
  // insights_dashboard: 8 parallel queries per call — moderate cost
  insights_dashboard:          { maxPerHour: 60, maxPerMinute: 15 },
  // send_push_notification: mass-notification abuse vector
  send_push_notification:      { maxPerHour: 30, maxPerMinute: 10 },
  // restore_subscription: Stripe API calls — cost + throttle concern
  restore_subscription:        { maxPerHour: 10, maxPerMinute: 2 },
  // create_portal_session: Stripe API calls
  create_portal_session:       { maxPerHour: 10, maxPerMinute: 2 },
  // delete_user_account: one-way action — no legitimate rapid repeat
  delete_user_account:         { maxPerHour: 3,  maxPerMinute: 1 },
  // grant_trial_gift (Wave 7 P48-followup): idempotent server-side on
  // `onboarding_gift_${userId}`, so retries are cheap, but tight limits
  // still bound retry-storm / abuse vectors against the trial credit ledger.
  // Onboarding tier multiplier (3x) is irrelevant — the gift is one-shot.
  grant_trial_gift:            { maxPerHour: 20, maxPerMinute: 5 },
  // start_trial (Wave 8 P52): Stripe customers.create + subscriptions.create
  // on first SIGNED_IN. Idempotent across three layers (DB pre-check,
  // request_idempotency, Stripe-side keys) so re-fires are cheap. Same budget
  // as sibling Stripe-API endpoints (restore_subscription, create_portal_session).
  // Onboarding tier multiplier (3x) is irrelevant — the trial start is one-shot.
  start_trial:                 { maxPerHour: 10, maxPerMinute: 2 },
  // memory_ingest (Wave 8.5 P85): canonical entry point for every Style
  // Memory write (save / wear / rate / skip / swap / reject / quick_reaction
  // / never_suggest / like_pair / dislike_pair). High-frequency by design —
  // active users tap save/wear/rate dozens of times per session — but bounded
  // against client-side bug loops (eg, runaway useEffect firing recordSignal
  // every render). Onboarding multiplier (3x) applies — new users explore
  // their wardrobe heavily and we want every tap captured.
  memory_ingest:               { maxPerHour: 200, maxPerMinute: 30 },
  // reset_style_memory (Wave 8.5 P90): destructive Style Memory wipe.
  // Tight cap — destructive op, no legitimate reason to fire more than
  // a few times per hour (the user already double-confirms via dialog).
  reset_style_memory:          { maxPerHour: 5, maxPerMinute: 1 },
  // calendar: sync + event read calls to Google Calendar API
  calendar:                    { maxPerHour: 30, maxPerMinute: 10 },
  // google_calendar_auth: OAuth handshake — low-frequency by design
  google_calendar_auth:        { maxPerHour: 10, maxPerMinute: 2 },

  // Default for unlisted functions
  __default:                   { maxPerHour: 60, maxPerMinute: 12 },
};

export function getRateLimitTier(functionName: string): RateLimitTier {
  return RATE_LIMIT_TIERS[functionName] || RATE_LIMIT_TIERS.__default;
}

// ── Subscription-tier multipliers ───────────────────────────────
// Premium users get 2x the base limits; free users get 75%.
// Onboarding users (first 24h after onboarding_started_at, while
// onboarding_step is not 'completed') get 3x — the boost lets them populate
// their wardrobe and run the AI feature tour without bumping into rate limits.
// Wave 8 forward-compat: when the free tier is removed, the override below
// stays — only the TIER_MULTIPLIERS values change.
// Cache resolved plan per-isolate to avoid repeated DB hits.
type SubscriptionPlan = "free" | "premium" | "onboarding";

const TIER_MULTIPLIERS: Record<SubscriptionPlan, number> = {
  free: 0.75,
  premium: 2.0,
  onboarding: 3.0,
};

const subscriptionCache = new Map<string, { plan: SubscriptionPlan; fetchedAt: number }>();
// Default 5-minute TTL for stable plans (free/premium). Onboarding plans use a
// shorter TTL so completion (or the 24h-window expiry) is reflected within
// ~60 seconds — otherwise a freshly-completed user would keep the 3x boost for
// up to 5 minutes after they shouldn't have it (Wave 7 audit P0 #3).
const SUBSCRIPTION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ONBOARDING_CACHE_TTL_MS = 60 * 1000; // 60 seconds — short TTL for transient onboarding plan
const ONBOARDING_BOOST_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function ttlForPlan(plan: SubscriptionPlan): number {
  return plan === "onboarding" ? ONBOARDING_CACHE_TTL_MS : SUBSCRIPTION_CACHE_TTL_MS;
}

/**
 * Resolve a user's effective rate-limit plan. Exported so tests can hit it
 * directly without mocking the full enforceRateLimit pipeline. Public consumers
 * outside scale-guard.ts and its tests should not import this — the contract
 * is "called by enforceRateLimit, output cached per-isolate".
 */
export async function resolveUserPlan(supabaseAdmin: any, userId: string): Promise<SubscriptionPlan> {
  const cached = subscriptionCache.get(userId);
  // Per-plan TTL: onboarding caches for 60s (so completion or 24h-window
  // expiry surfaces fast), free/premium for 5min (stable, low-churn).
  if (cached && Date.now() - cached.fetchedAt < ttlForPlan(cached.plan)) {
    return cached.plan;
  }

  try {
    // Both lookups in parallel — neither is on the caller's hot path under
    // cache, but we still want to avoid serial network round-trips on cache
    // miss. .single() returns { data, error: PGRST116 } for 0 rows (does not
    // throw), so a missing profile or subscription falls through cleanly.
    const [subRes, profileRes] = await Promise.all([
      supabaseAdmin
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", userId)
        .single(),
      supabaseAdmin
        .from("profiles")
        .select("onboarding_step, onboarding_started_at")
        .eq("id", userId)
        .single(),
    ]);

    // Onboarding boost takes precedence over subscription plan when active.
    // Onboarding plans cache for 60s (see ttlForPlan + Wave 7 audit P0 #3);
    // a user crossing the 24h window or completing onboarding mid-cache
    // sees the boost lift within 60 seconds.
    const profile = profileRes?.data as
      | { onboarding_step?: string | null; onboarding_started_at?: string | null }
      | null
      | undefined;
    if (
      profile &&
      profile.onboarding_started_at &&
      profile.onboarding_step !== "completed"
    ) {
      const startedMs = new Date(profile.onboarding_started_at).getTime();
      if (
        Number.isFinite(startedMs) &&
        Date.now() - startedMs < ONBOARDING_BOOST_WINDOW_MS
      ) {
        const plan: SubscriptionPlan = "onboarding";
        subscriptionCache.set(userId, { plan, fetchedAt: Date.now() });
        return plan;
      }
    }

    const sub = subRes?.data as { plan?: string; status?: string } | null | undefined;
    const isPremium =
      sub && sub.plan === "premium" && ["active", "trialing"].includes(sub.status ?? "");
    const plan: SubscriptionPlan = isPremium ? "premium" : "free";
    subscriptionCache.set(userId, { plan, fetchedAt: Date.now() });
    return plan;
  } catch {
    // Fail open — treat as free (tighter limits are safer default)
    return "free";
  }
}

/**
 * Test-only helper to clear the per-isolate subscription cache.
 * Not exported to other functions; only consumed by `__tests__/scale-guard.test.ts`.
 */
export function __resetSubscriptionCacheForTests(): void {
  subscriptionCache.clear();
}

export function applyTierMultiplier(tier: RateLimitTier, plan: SubscriptionPlan): RateLimitTier {
  const m = TIER_MULTIPLIERS[plan];
  return {
    maxPerHour: Math.max(1, Math.round(tier.maxPerHour * m)),
    maxPerMinute: Math.max(1, Math.round(tier.maxPerMinute * m)),
  };
}

/**
 * Enforce both hourly and burst (per-minute) rate limits.
 * Uses the ai_rate_limits table. Throws RateLimitError(429) when exceeded.
 *
 * Limits scale by subscription tier: premium=2x, free=0.75x of base.
 * Functions with noTierMultiplier:true bypass free/premium tier scaling — the
 * raw configured values apply to free AND premium users (parity choice for
 * abuse-sensitive endpoints like analyze_garment). Onboarding users (Wave 7
 * P43) ALWAYS get the 3x boost regardless of noTierMultiplier — the boost is
 * scoped to the first 24h post-onboarding-start AND requires onboarding_step
 * to still be mid-flow, so the abuse window is bounded. Without this carve-out,
 * BatchCapture's parallel analyze_garment calls would throttle at 30/min
 * instead of 90/min, breaking the onboarding UX (Wave 7 audit P0 #2).
 * Returns { allowed: true, remaining: { hour, minute } } on success.
 */
export async function enforceRateLimit(
  supabaseAdmin: any,
  userId: string,
  functionName: string,
  overrides?: Partial<RateLimitTier>,
): Promise<{ allowed: true; remaining: { hour: number; minute: number } }> {
  const baseTier = { ...getRateLimitTier(functionName), ...overrides };

  // Always resolve the user's plan — we need to know if they're onboarding.
  // resolveUserPlan is cached per-isolate (60s for onboarding, 5min otherwise),
  // so the cost is one DB round-trip per user per cache window, not per call.
  const plan = await resolveUserPlan(supabaseAdmin, userId);

  let tier: { maxPerHour: number; maxPerMinute: number };
  if (baseTier.noTierMultiplier && plan !== "onboarding") {
    // free / premium with noTierMultiplier: raw base values, no scaling.
    tier = { maxPerHour: baseTier.maxPerHour, maxPerMinute: baseTier.maxPerMinute };
  } else {
    // Onboarding ALWAYS gets the 3x boost (even on noTierMultiplier endpoints);
    // free / premium without noTierMultiplier get their normal multiplier.
    tier = applyTierMultiplier(baseTier, plan);
  }

  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const oneMinuteAgo = new Date(now - 60 * 1000).toISOString();

  // Batch both counts in parallel
  const [hourResult, minuteResult] = await Promise.all([
    supabaseAdmin
      .from("ai_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("function_name", functionName)
      .gte("called_at", oneHourAgo),
    supabaseAdmin
      .from("ai_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("function_name", functionName)
      .gte("called_at", oneMinuteAgo),
  ]);

  // N15/B9 — Fail CLOSED on rate-limit DB errors. The previous fail-OPEN
  // branch unlocked unlimited expensive AI calls any time the ai_rate_limits
  // window-count query errored (transient DB blip, table-locked-during-purge,
  // statement timeout). Throwing forces the standard rate-limit response
  // path so the client backs off — a temporary user-visible degrade is the
  // safe trade vs. an uncapped Gemini bill.
  if (hourResult.error || minuteResult.error) {
    console.warn("Rate limit check failed:", hourResult.error?.message || minuteResult.error?.message);
    throw new RateLimitError(
      `Rate limit check unavailable. Please retry in a moment.`,
      functionName,
      "minute",
      tier.maxPerMinute,
    );
  }

  const hourCount = hourResult.count ?? 0;
  const minuteCount = minuteResult.count ?? 0;

  if (minuteCount >= tier.maxPerMinute) {
    throw new RateLimitError(
      `Too many requests. Please wait a moment before trying again.`,
      functionName,
      "minute",
      tier.maxPerMinute,
    );
  }

  if (hourCount >= tier.maxPerHour) {
    throw new RateLimitError(
      `Hourly limit reached for this feature. Please try again later.`,
      functionName,
      "hour",
      tier.maxPerHour,
    );
  }

  // N15/BE-P0-B5 — Await the INSERT instead of firing-and-forgetting.
  // Concurrent isolates that pass the count check before the row is
  // committed could each slip an extra call through, briefly doubling
  // the configured burst. Awaiting closes the window. Insert-failures
  // are logged but don't propagate — the call already passed the gate
  // and the missing-row only affects FUTURE counts (worst case: the
  // user gets one extra call in their window).
  const { error: insertErr } = await supabaseAdmin
    .from("ai_rate_limits")
    .insert({ user_id: userId, function_name: functionName });
  if (insertErr) {
    console.warn("Rate limit record failed:", insertErr.message);
  }

  // Periodic cleanup (1% chance)
  if (Math.random() < 0.01) {
    // `.then(_, _)` instead of `.catch` — newer supabase-js typings model
    // the rpc builder as a thenable, not a full Promise, so `.catch` is
    // missing on the type. Fire-and-forget: ignore both paths.
    supabaseAdmin.rpc("cleanup_old_rate_limits").then(() => {}, () => {});
  }

  return {
    allowed: true,
    remaining: {
      hour: tier.maxPerHour - hourCount - 1,
      minute: tier.maxPerMinute - minuteCount - 1,
    },
  };
}

export class RateLimitError extends Error {
  status = 429;
  functionName: string;
  window: string;
  limit: number;
  retryAfterSeconds: number;

  constructor(message: string, functionName: string, window: string, limit: number) {
    super(message);
    this.name = "RateLimitError";
    this.functionName = functionName;
    this.window = window;
    this.limit = limit;
    this.retryAfterSeconds = window === "minute" ? 60 : 300;
  }
}

/**
 * Build a standard 429 response with Retry-After header.
 */
export function rateLimitResponse(
  error: RateLimitError,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: error.message,
      retryAfter: error.retryAfterSeconds,
      limit: error.limit,
      window: error.window,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(error.retryAfterSeconds),
      },
    },
  );
}

// ─── Subscription Enforcement (Wave 8 P54) ──────────────────────
/**
 * Subscription gate result. Discriminated union — callers branch on `allowed`.
 *
 * - allowed:true  → user has an active subscription OR is mid-onboarding
 *   (the P43 boost grants AI access during the first 24h post-onboarding-start
 *   regardless of subscription state, so BatchCapture's analyze_garment storm
 *   isn't gated by missing trial signup).
 * - allowed:false, reason:'expired' → status='trialing' but current_period_end
 *   has passed. Distinct UX signal — paywall can show "Your free trial ended".
 * - allowed:false, reason:'locked'  → everything else (no subscription row,
 *   status='canceled' / 'past_due' / 'incomplete', plan='free' on a row whose
 *   status is 'active', etc). Generic paywall.
 */
export type EnforceSubscriptionResult =
  | { allowed: true }
  | { allowed: false; reason: "locked" | "expired" };

/**
 * Gate AI work on subscription state. Call AFTER `enforceRateLimit` and
 * BEFORE the expensive AI call.
 *
 * Allowed states (return `{allowed:true}`):
 *   1. resolveUserPlan → 'onboarding' (Wave 7 P43 boost still active)
 *   2. subscription.status='trialing' AND current_period_end is null OR > NOW()
 *      (null tolerance handles the brief window between Stripe-side trial
 *      creation and webhook-driven `current_period_end` mirror — Wave 8 P52)
 *   3. subscription.status='active' AND plan='premium'
 *
 * Everything else returns `{allowed:false, reason}`. Reason classification:
 *   - 'expired' if status='trialing' and current_period_end is in the past
 *   - 'locked'  for every other denied path (no row, canceled, past_due,
 *     active+free, incomplete, etc).
 *
 * Cost: 0-1 DB reads. resolveUserPlan caches per-isolate (60s onboarding /
 * 5min stable), so onboarding-plan callers short-circuit on the cache hit.
 * Non-onboarding callers do one `subscriptions` SELECT. Telemetry: none —
 * the caller's outer telemetry already covers the "denied" signal via the
 * 402 response, and adding a write here would cost more than the gate saves.
 *
 * Failure mode: any thrown error (transport, auth, unexpected schema) is
 * caught and treated as `{allowed:false, reason:'locked'}` — fail closed.
 * Pre-check failures must NOT silently grant access; that's the entire
 * point of the gate. The caller's outer try/catch handles the 402 response.
 */
export async function enforceSubscription(
  supabaseAdmin: any,
  userId: string,
): Promise<EnforceSubscriptionResult> {
  try {
    // Codex P1 round 6 on PR #700 — read profile.onboarding_* directly
    // instead of going through resolveUserPlan's cache. resolveUserPlan
    // is shared with enforceRateLimit, which caches non-onboarding plans
    // for 5 min per-isolate. If a user transitions INTO onboarding within
    // that 5-min window after a 'free'/'premium' cache hit, the cached
    // value misses the new onboarding state and enforceSubscription
    // would 402 the user despite backend intent to bypass. Reading
    // profile fresh per-call closes the cache-race window. Acceptable
    // perf hit: this query is 1 row by primary key, and we already do
    // one DB read here for the subscriptions row — paralellize them.
    const [profileResult, subResult] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("onboarding_started_at, onboarding_step")
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("subscriptions")
        .select("status, plan, current_period_end")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    // Profile read failure is non-fatal for subscription gating — fall
    // through to the subscription row check. The onboarding bypass is
    // an additive permit, not a denial signal.
    const profile = profileResult.data as
      | { onboarding_started_at?: string | null; onboarding_step?: string | null }
      | null
      | undefined;
    if (
      profile &&
      profile.onboarding_started_at &&
      profile.onboarding_step !== "completed"
    ) {
      const startedMs = new Date(profile.onboarding_started_at).getTime();
      if (
        Number.isFinite(startedMs) &&
        Date.now() - startedMs < ONBOARDING_BOOST_WINDOW_MS
      ) {
        return { allowed: true };
      }
    }

    if (subResult.error) {
      console.warn("enforceSubscription: subscriptions read failed:", subResult.error.message ?? subResult.error);
      return { allowed: false, reason: "locked" };
    }

    const sub = subResult.data as
      | { status?: string | null; plan?: string | null; current_period_end?: string | null }
      | null
      | undefined;

    if (!sub) {
      return { allowed: false, reason: "locked" };
    }

    if (sub.status === "trialing") {
      // null current_period_end → tolerated (webhook-lag at trial start).
      // current_period_end > NOW() → still inside trial window.
      if (!sub.current_period_end) {
        return { allowed: true };
      }
      const periodEndMs = new Date(sub.current_period_end).getTime();
      if (Number.isFinite(periodEndMs) && periodEndMs > Date.now()) {
        return { allowed: true };
      }
      return { allowed: false, reason: "expired" };
    }

    if (sub.status === "active" && sub.plan === "premium") {
      return { allowed: true };
    }

    return { allowed: false, reason: "locked" };
  } catch (err) {
    // Fail closed — never grant access on unexpected errors. Existing
    // resolveUserPlan / supabase-js paths shouldn't throw, but a transient
    // outage or schema drift must not become an open gate.
    console.warn(
      "enforceSubscription: unexpected error, denying:",
      err instanceof Error ? err.message : String(err),
    );
    return { allowed: false, reason: "locked" };
  }
}

/**
 * Build a standard 402 Payment Required response for a denied subscription gate.
 *
 * Body shape: `{ error: 'subscription_required', reason }` — frontends switch
 * on `reason` to choose paywall copy ('expired' → "Your trial ended",
 * 'locked' → generic "Subscribe to continue").
 */
export function subscriptionLockedResponse(
  reason: "locked" | "expired",
  cors: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({ error: "subscription_required", reason }),
    {
      status: 402,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
    },
  );
}


// ─── AI Cost Estimation ─────────────────────────────────────────
/**
 * Estimated cost per 1M tokens for Gemini models (USD).
 * Used for cost visibility, not billing.
 */
const MODEL_COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash":      { input: 0.15, output: 0.60 },
  "gemini-2.5-flash-lite": { input: 0.075, output: 0.30 },
};

export interface CostEstimate {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

/**
 * Estimate cost from a Gemini API response's usage field.
 */
export function estimateCost(model: string, usage?: { prompt_tokens?: number; completion_tokens?: number }): CostEstimate {
  const rates = MODEL_COST_PER_MILLION[model] || MODEL_COST_PER_MILLION["gemini-2.5-flash"];
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const estimatedCostUsd =
    (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;

  return { model, inputTokens, outputTokens, estimatedCostUsd };
}


// ─── Enhanced Telemetry ─────────────────────────────────────────
export interface TelemetryEvent {
  functionName: string;
  model_used: string;
  latency_ms: number;
  from_cache: boolean;
  status: "ok" | "error" | "rate_limited";
  error_message?: string;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost_usd?: number;
  cache_hit?: boolean;
  retry_count?: number;
  complexity?: string;
  user_id?: string;
}

/**
 * Log enhanced telemetry event. Fire-and-forget.
 */
export function logTelemetry(supabase: any | null, event: TelemetryEvent): void {
  if (!supabase) return;
  try {
    supabase
      .from("analytics_events")
      .insert({
        event_type: "ai_usage",
        user_id: event.user_id || null,
        metadata: {
          fn: event.functionName,
          model: event.model_used,
          latency_ms: event.latency_ms,
          cached: event.from_cache,
          status: event.status,
          ...(event.input_tokens != null ? { input_tokens: event.input_tokens } : {}),
          ...(event.output_tokens != null ? { output_tokens: event.output_tokens } : {}),
          ...(event.estimated_cost_usd != null ? { cost_usd: event.estimated_cost_usd } : {}),
          ...(event.retry_count != null ? { retries: event.retry_count } : {}),
          ...(event.complexity ? { complexity: event.complexity } : {}),
          ...(event.error_message ? { error: event.error_message } : {}),
        },
      })
      .then(() => {});
  } catch {
    // Never block on telemetry
  }
}


// ─── Job Queue ──────────────────────────────────────────────────
/**
 * Lightweight job queue using a `job_queue` database table.
 *
 * Table schema (create via migration):
 *   id           uuid primary key default gen_random_uuid()
 *   job_type     text not null
 *   payload      jsonb not null default '{}'
 *   status       text not null default 'pending'  -- pending | processing | completed | failed | dead
 *   priority     int default 0
 *   attempts     int default 0
 *   max_attempts int default 3
 *   user_id      uuid references auth.users(id)
 *   result       jsonb
 *   error        text
 *   created_at   timestamptz default now()
 *   updated_at   timestamptz default now()
 *   started_at   timestamptz
 *   completed_at timestamptz
 *   locked_until timestamptz  -- pessimistic lock for claim
 */

export interface JobSubmission {
  jobType: string;
  payload: Record<string, unknown>;
  // Required — every job must belong to a user so process_job_queue handlers
  // can enforce cross-user ownership checks (P7). System-level jobs without a
  // user are not a supported shape; if that need arises, add an explicit
  // `systemJob` discriminator rather than reverting this field to optional.
  userId: string;
  priority?: number;
  maxAttempts?: number;
}

export interface JobRecord {
  id: string;
  job_type: string;
  payload: Record<string, unknown>;
  status: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  user_id: string | null;
  result: any;
  error: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  locked_until: string | null;
}

/**
 * Submit a job to the queue. Returns the job ID immediately.
 */
export async function submitJob(
  supabase: any,
  job: JobSubmission,
): Promise<string> {
  const { data, error } = await supabase
    .from("job_queue")
    .insert({
      job_type: job.jobType,
      payload: job.payload,
      user_id: job.userId,
      priority: job.priority ?? 0,
      max_attempts: job.maxAttempts ?? 3,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to submit job: ${error.message}`);
  return data.id;
}

/**
 * Claim the next available job of a given type.
 * Uses locked_until for pessimistic locking (5-minute lock window).
 */
export async function claimJob(
  supabase: any,
  jobType: string,
  lockDurationMs = 300_000,
): Promise<JobRecord | null> {
  const now = new Date().toISOString();
  const lockedUntil = new Date(Date.now() + lockDurationMs).toISOString();

  // Atomic claim: find pending job where lock is expired or null. The
  // increment of `attempts` happens below as a separate UPDATE because
  // supabase-js's `.update()` body can't reference the existing row's
  // value (no `attempts: attempts + 1` shorthand). Wave 7.9 cleanup:
  // dropped a stale `supabase.rpc ? undefined : undefined` no-op that
  // pre-dated the split.
  const { data, error } = await supabase
    .from("job_queue")
    .update({
      status: "processing",
      started_at: now,
      locked_until: lockedUntil,
    })
    .eq("job_type", jobType)
    .in("status", ["pending", "processing"])
    .or(`locked_until.is.null,locked_until.lt.${now}`)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .select("*")
    .single();

  if (error || !data) return null;

  // Increment attempts
  await supabase
    .from("job_queue")
    .update({ attempts: (data.attempts ?? 0) + 1 })
    .eq("id", data.id);

  return { ...data, attempts: (data.attempts ?? 0) + 1 };
}

/**
 * Mark a job as completed with optional result data.
 */
export async function completeJob(
  supabase: any,
  jobId: string,
  result?: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("job_queue")
    .update({
      status: "completed",
      result: result || null,
      completed_at: new Date().toISOString(),
      locked_until: null,
    })
    .eq("id", jobId);
}

/**
 * Mark a job as failed. Moves to 'dead' if max_attempts exceeded.
 */
export async function failJob(
  supabase: any,
  jobId: string,
  errorMessage: string,
  maxAttempts: number,
  currentAttempts: number,
): Promise<void> {
  const isDead = currentAttempts >= maxAttempts;
  await supabase
    .from("job_queue")
    .update({
      status: isDead ? "dead" : "pending",
      error: errorMessage,
      locked_until: isDead ? null : new Date(Date.now() + currentAttempts * 30_000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

/**
 * Get job status by ID (for polling from client).
 */
export async function getJobStatus(
  supabase: any,
  jobId: string,
  userId?: string,
): Promise<{ status: string; result?: any; error?: string } | null> {
  let query = supabase
    .from("job_queue")
    .select("status, result, error")
    .eq("id", jobId);

  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}


// ─── Concurrency Limiter ────────────────────────────────────────
/**
 * Process items with bounded concurrency.
 * Prevents batch operations from overwhelming downstream services.
 */
export async function withConcurrencyLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  const executing = new Set<Promise<void>>();

  for (const item of items) {
    const p = fn(item).then((r) => {
      results.push(r);
    });
    const wrapped = p.then(() => {
      executing.delete(wrapped);
    });
    executing.add(wrapped);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}


// ─── Overload Guard ─────────────────────────────────────────────
/**
 * Simple overload detection for edge functions.
 * Tracks recent error counts and can short-circuit when error rate is high.
 *
 * NOTE: Per-isolate only — each cold start resets. This is intentional;
 * it prevents cascading failures within a hot isolate without requiring
 * external state.
 */
const errorCounts = new Map<string, { count: number; windowStart: number }>();
const OVERLOAD_WINDOW_MS = 60_000;
const OVERLOAD_THRESHOLD = 10; // errors per minute before circuit opens

export function checkOverload(functionName: string): boolean {
  const now = Date.now();
  const entry = errorCounts.get(functionName);

  if (!entry || now - entry.windowStart > OVERLOAD_WINDOW_MS) {
    return false; // no recent errors or window expired
  }

  return entry.count >= OVERLOAD_THRESHOLD;
}

export function recordError(functionName: string): void {
  const now = Date.now();
  const entry = errorCounts.get(functionName);

  if (!entry || now - entry.windowStart > OVERLOAD_WINDOW_MS) {
    errorCounts.set(functionName, { count: 1, windowStart: now });
  } else {
    entry.count++;
  }
}

export function overloadResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: "Service is temporarily overloaded. Please try again in a moment.",
      retryAfter: 30,
    }),
    {
      status: 503,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": "30",
      },
    },
  );
}
