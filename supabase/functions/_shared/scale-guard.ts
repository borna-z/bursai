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
  smart_shopping_list:         { maxPerHour: 20, maxPerMinute: 4 },
  shopping_chat:               { maxPerHour: 60, maxPerMinute: 10 },
  visual_search:               { maxPerHour: 30, maxPerMinute: 5 },

  // Light AI usage
  summarize_day:               { maxPerHour: 40, maxPerMinute: 8 },
  wardrobe_gap_analysis:       { maxPerHour: 15, maxPerMinute: 3 },
  wardrobe_aging:              { maxPerHour: 15, maxPerMinute: 3 },
  style_twin:                  { maxPerHour: 15, maxPerMinute: 3 },
  assess_garment_condition:    { maxPerHour: 30, maxPerMinute: 5 },
  detect_duplicate_garment:    { maxPerHour: 40, maxPerMinute: 8 },

  // Default for unlisted functions
  __default:                   { maxPerHour: 60, maxPerMinute: 12 },
};

export function getRateLimitTier(functionName: string): RateLimitTier {
  return RATE_LIMIT_TIERS[functionName] || RATE_LIMIT_TIERS.__default;
}

// ── Subscription-tier multipliers ───────────────────────────────
// Premium users get 2x the base limits; free users get 75%.
// Cache subscription lookups per-isolate to avoid repeated DB hits.
type SubscriptionPlan = "free" | "premium";

const TIER_MULTIPLIERS: Record<SubscriptionPlan, number> = {
  free: 0.75,
  premium: 2.0,
};

const subscriptionCache = new Map<string, { plan: SubscriptionPlan; fetchedAt: number }>();
const SUBSCRIPTION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function resolveUserPlan(supabaseAdmin: any, userId: string): Promise<SubscriptionPlan> {
  const cached = subscriptionCache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < SUBSCRIPTION_CACHE_TTL_MS) {
    return cached.plan;
  }

  try {
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", userId)
      .single();

    const isPremium =
      data && data.plan === "premium" && ["active", "trialing"].includes(data.status);
    const plan: SubscriptionPlan = isPremium ? "premium" : "free";
    subscriptionCache.set(userId, { plan, fetchedAt: Date.now() });
    return plan;
  } catch {
    // Fail open — treat as free (tighter limits are safer default)
    return "free";
  }
}

function applyTierMultiplier(tier: RateLimitTier, plan: SubscriptionPlan): RateLimitTier {
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
 * Functions with noTierMultiplier:true bypass tier scaling entirely —
 * the raw configured values apply equally to all users regardless of plan.
 * Returns { allowed: true, remaining: { hour, minute } } on success.
 */
export async function enforceRateLimit(
  supabaseAdmin: any,
  userId: string,
  functionName: string,
  overrides?: Partial<RateLimitTier>,
): Promise<{ allowed: true; remaining: { hour: number; minute: number } }> {
  const baseTier = { ...getRateLimitTier(functionName), ...overrides };

  // noTierMultiplier: skip plan resolution and multiplier entirely — use raw base values.
  // All other functions resolve the user's subscription plan and scale accordingly.
  let tier: { maxPerHour: number; maxPerMinute: number };
  if (baseTier.noTierMultiplier) {
    tier = { maxPerHour: baseTier.maxPerHour, maxPerMinute: baseTier.maxPerMinute };
  } else {
    const plan = await resolveUserPlan(supabaseAdmin, userId);
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

  // Fail open on DB errors
  if (hourResult.error || minuteResult.error) {
    console.warn("Rate limit check failed:", hourResult.error?.message || minuteResult.error?.message);
    return { allowed: true, remaining: { hour: tier.maxPerHour, minute: tier.maxPerMinute } };
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

  // Record this call — fire-and-forget
  supabaseAdmin
    .from("ai_rate_limits")
    .insert({ user_id: userId, function_name: functionName })
    .then(() => {});

  // Periodic cleanup (1% chance)
  if (Math.random() < 0.01) {
    supabaseAdmin.rpc("cleanup_old_rate_limits").catch(() => {});
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

  // Atomic claim: find pending job where lock is expired or null
  const { data, error } = await supabase
    .from("job_queue")
    .update({
      status: "processing",
      started_at: now,
      locked_until: lockedUntil,
      attempts: supabase.rpc ? undefined : undefined, // handled below
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
