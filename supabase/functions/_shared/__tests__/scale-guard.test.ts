import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetSubscriptionCacheForTests,
  applyTierMultiplier,
  enforceRateLimit,
  enforceSubscription,
  getRateLimitTier,
  resolveUserPlan,
  subscriptionLockedResponse,
} from "../scale-guard.ts";

// ────────────────────────────────────────────────────────────────────
// Mock Supabase client
//
// The minimum builder shape resolveUserPlan calls into:
//   supabase.from(table).select(cols).eq(col, val).single() → { data, error }
//
// Both .from('subscriptions') and .from('profiles') are queried in parallel,
// so we route by table name and resolve identically (no error path here —
// resolveUserPlan's outer try/catch handles thrown errors).
// ────────────────────────────────────────────────────────────────────

interface MockRows {
  subscription?: { plan?: string; status?: string } | null;
  profile?: {
    onboarding_step?: string | null;
    onboarding_started_at?: string | null;
  } | null;
  /** Force `.single()` to throw — exercises the outer fail-safe ("free") path. */
  throwOnQuery?: boolean;
}

function createMockSupabaseClient(rows: MockRows) {
  return {
    from(table: string) {
      const data =
        table === "subscriptions"
          ? rows.subscription ?? null
          : table === "profiles"
            ? rows.profile ?? null
            : null;

      const builder: {
        select: () => typeof builder;
        eq: () => typeof builder;
        single: () => Promise<{ data: unknown; error: null }>;
      } = {
        select: () => builder,
        eq: () => builder,
        single: async () => {
          if (rows.throwOnQuery) throw new Error("simulated DB outage");
          return { data, error: null };
        },
      };
      return builder;
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// applyTierMultiplier — pure function
// ────────────────────────────────────────────────────────────────────

describe("applyTierMultiplier (Wave 7 P43)", () => {
  it("scales free to 0.75x with min-1 floor", () => {
    expect(applyTierMultiplier({ maxPerHour: 30, maxPerMinute: 5 }, "free")).toEqual({
      maxPerHour: 23, // 30 * 0.75 = 22.5 → round → 23
      maxPerMinute: 4, // 5 * 0.75 = 3.75 → round → 4
    });
  });

  it("scales premium to 2.0x", () => {
    expect(applyTierMultiplier({ maxPerHour: 30, maxPerMinute: 5 }, "premium")).toEqual({
      maxPerHour: 60,
      maxPerMinute: 10,
    });
  });

  it("scales onboarding to 3.0x (Wave 7 boost)", () => {
    expect(
      applyTierMultiplier({ maxPerHour: 30, maxPerMinute: 5 }, "onboarding"),
    ).toEqual({
      maxPerHour: 90,
      maxPerMinute: 15,
    });
  });

  it("never returns less than 1 per window even on tiny base limits", () => {
    expect(applyTierMultiplier({ maxPerHour: 1, maxPerMinute: 1 }, "free")).toEqual({
      maxPerHour: 1,
      maxPerMinute: 1,
    });
  });

  it("composes with getRateLimitTier for analyze_garment base values", () => {
    // analyze_garment has noTierMultiplier:true so the multiplier is normally
    // skipped at the enforceRateLimit layer — but the helper itself is pure
    // and applies the math regardless. This locks in the public contract.
    const base = getRateLimitTier("analyze_garment");
    expect(base.noTierMultiplier).toBe(true);
    expect(applyTierMultiplier(base, "onboarding")).toEqual({
      maxPerHour: 1500, // 500 * 3.0
      maxPerMinute: 90, // 30 * 3.0
    });
  });
});

// ────────────────────────────────────────────────────────────────────
// resolveUserPlan — onboarding boost detection
// ────────────────────────────────────────────────────────────────────

describe("resolveUserPlan — onboarding boost (Wave 7 P43)", () => {
  beforeEach(() => {
    __resetSubscriptionCacheForTests();
  });

  it("returns 'onboarding' when started_at is within 24h and step is mid-flow", async () => {
    const recentStart = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const supabase = createMockSupabaseClient({
      subscription: { plan: "free", status: "active" },
      profile: {
        onboarding_step: "batch_capture",
        onboarding_started_at: recentStart,
      },
    });

    expect(await resolveUserPlan(supabase, "user-1")).toBe("onboarding");
  });

  it("returns 'onboarding' even when subscription is premium (boost outranks plan)", async () => {
    const recentStart = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const supabase = createMockSupabaseClient({
      subscription: { plan: "premium", status: "active" },
      profile: {
        onboarding_step: "quiz",
        onboarding_started_at: recentStart,
      },
    });

    expect(await resolveUserPlan(supabase, "user-1")).toBe("onboarding");
  });

  it("falls through to subscription plan when onboarding_step is 'completed'", async () => {
    const recentStart = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const supabase = createMockSupabaseClient({
      subscription: { plan: "premium", status: "active" },
      profile: {
        onboarding_step: "completed",
        onboarding_started_at: recentStart,
      },
    });

    expect(await resolveUserPlan(supabase, "user-1")).toBe("premium");
  });

  it("falls through to subscription plan when started_at is older than 24h", async () => {
    const oldStart = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const supabase = createMockSupabaseClient({
      subscription: { plan: "free", status: "active" },
      profile: {
        onboarding_step: "batch_capture",
        onboarding_started_at: oldStart,
      },
    });

    expect(await resolveUserPlan(supabase, "user-1")).toBe("free");
  });

  it("falls through to subscription plan when onboarding_started_at is null", async () => {
    const supabase = createMockSupabaseClient({
      subscription: { plan: "free", status: "active" },
      profile: {
        onboarding_step: "not_started",
        onboarding_started_at: null,
      },
    });

    expect(await resolveUserPlan(supabase, "user-1")).toBe("free");
  });

  it("falls through to subscription when started_at is malformed (NaN-coercion safety)", async () => {
    const supabase = createMockSupabaseClient({
      subscription: { plan: "free", status: "active" },
      profile: {
        onboarding_step: "quiz",
        onboarding_started_at: "not-a-real-date",
      },
    });

    expect(await resolveUserPlan(supabase, "user-1")).toBe("free");
  });

  it("falls through to subscription when profile row is missing entirely", async () => {
    const supabase = createMockSupabaseClient({
      subscription: { plan: "premium", status: "trialing" },
      profile: null,
    });

    expect(await resolveUserPlan(supabase, "user-1")).toBe("premium");
  });

  it("returns 'free' when both rows missing (default-safe)", async () => {
    const supabase = createMockSupabaseClient({
      subscription: null,
      profile: null,
    });

    expect(await resolveUserPlan(supabase, "user-1")).toBe("free");
  });

  it("fails open to 'free' when DB throws (existing behavior preserved)", async () => {
    const supabase = createMockSupabaseClient({ throwOnQuery: true });

    expect(await resolveUserPlan(supabase, "user-1")).toBe("free");
  });
});

// ────────────────────────────────────────────────────────────────────
// resolveUserPlan — pre-existing subscription-only behavior (regression net)
// ────────────────────────────────────────────────────────────────────

describe("resolveUserPlan — subscription tier resolution (regression net)", () => {
  beforeEach(() => {
    __resetSubscriptionCacheForTests();
  });

  it("returns 'premium' when active subscription is plan='premium'", async () => {
    const supabase = createMockSupabaseClient({
      subscription: { plan: "premium", status: "active" },
      profile: { onboarding_step: "completed", onboarding_started_at: null },
    });

    expect(await resolveUserPlan(supabase, "user-1")).toBe("premium");
  });

  it("returns 'premium' when status='trialing'", async () => {
    const supabase = createMockSupabaseClient({
      subscription: { plan: "premium", status: "trialing" },
      profile: { onboarding_step: "completed", onboarding_started_at: null },
    });

    expect(await resolveUserPlan(supabase, "user-1")).toBe("premium");
  });

  it("returns 'free' when status='cancelled' even with plan='premium'", async () => {
    const supabase = createMockSupabaseClient({
      subscription: { plan: "premium", status: "cancelled" },
      profile: { onboarding_step: "completed", onboarding_started_at: null },
    });

    expect(await resolveUserPlan(supabase, "user-1")).toBe("free");
  });

  it("returns 'free' for plan='free'", async () => {
    const supabase = createMockSupabaseClient({
      subscription: { plan: "free", status: "active" },
      profile: { onboarding_step: "completed", onboarding_started_at: null },
    });

    expect(await resolveUserPlan(supabase, "user-1")).toBe("free");
  });
});

// ────────────────────────────────────────────────────────────────────
// resolveUserPlan — caching
// ────────────────────────────────────────────────────────────────────

describe("resolveUserPlan — per-isolate cache (5min TTL)", () => {
  beforeEach(() => {
    __resetSubscriptionCacheForTests();
  });

  it("re-uses cached plan on the second call (no extra DB read)", async () => {
    let callCount = 0;
    const supabase = {
      from() {
        callCount++;
        const builder: {
          select: () => typeof builder;
          eq: () => typeof builder;
          single: () => Promise<{ data: { plan: string; status: string } | null; error: null }>;
        } = {
          select: () => builder,
          eq: () => builder,
          single: async () => ({
            data: { plan: "premium", status: "active" },
            error: null,
          }),
        };
        return builder;
      },
    };

    const first = await resolveUserPlan(supabase, "user-cache-test");
    expect(first).toBe("premium");
    const callsAfterFirst = callCount;

    const second = await resolveUserPlan(supabase, "user-cache-test");
    expect(second).toBe("premium");
    expect(callCount).toBe(callsAfterFirst); // no new DB hits
  });
});

// ────────────────────────────────────────────────────────────────────
// Wave 7 audit P0 #3 — onboarding plan cache TTL is 60s, not 5min.
//
// Cache TTL must be short enough that a user finishing onboarding (or
// crossing the 24h boost window) sees the boost lift within ~60s. With
// the previous flat 5-min TTL, a freshly-completed user kept the 3x
// boost for up to 5 extra minutes after they shouldn't have it.
// ────────────────────────────────────────────────────────────────────

describe("resolveUserPlan — onboarding cache TTL (Wave 7 audit P0 #3)", () => {
  beforeEach(() => {
    __resetSubscriptionCacheForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("re-resolves onboarding plan after 90s (cache TTL 60s, not 5min)", async () => {
    // Simulate a fresh onboarding (started 1h ago, mid-flow).
    let queryCount = 0;
    let stepValue: string = "batch_capture";
    const startedAt = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const supabase = {
      from(table: string) {
        queryCount++;
        const builder: {
          select: () => typeof builder;
          eq: () => typeof builder;
          single: () => Promise<{ data: unknown; error: null }>;
        } = {
          select: () => builder,
          eq: () => builder,
          single: async () => {
            if (table === "subscriptions") {
              return { data: { plan: "free", status: "active" }, error: null };
            }
            return {
              data: {
                onboarding_step: stepValue,
                onboarding_started_at: startedAt,
              },
              error: null,
            };
          },
        };
        return builder;
      },
    };

    // First resolve — onboarding plan, populates cache.
    expect(await resolveUserPlan(supabase, "user-ttl-test")).toBe("onboarding");
    const queriesAfterFirst = queryCount;

    // Advance 30s — still inside 60s window, cache hit.
    vi.advanceTimersByTime(30_000);
    expect(await resolveUserPlan(supabase, "user-ttl-test")).toBe("onboarding");
    expect(queryCount).toBe(queriesAfterFirst); // cached, no new DB hit

    // Advance another 60s (total 90s) — past 60s onboarding TTL, cache miss.
    // Flip the step to 'completed' so the re-query proves we re-resolved.
    vi.advanceTimersByTime(60_000);
    stepValue = "completed";
    expect(await resolveUserPlan(supabase, "user-ttl-test")).toBe("free");
    expect(queryCount).toBeGreaterThan(queriesAfterFirst); // re-queried DB
  });

  it("free/premium plans still cache for the full 5min TTL", async () => {
    let queryCount = 0;
    const supabase = {
      from() {
        queryCount++;
        const builder: {
          select: () => typeof builder;
          eq: () => typeof builder;
          single: () => Promise<{ data: { plan: string; status: string } | null; error: null }>;
        } = {
          select: () => builder,
          eq: () => builder,
          single: async () => ({
            data: { plan: "premium", status: "active" },
            error: null,
          }),
        };
        return builder;
      },
    };

    // First resolve — premium, cached.
    expect(await resolveUserPlan(supabase, "user-ttl-stable")).toBe("premium");
    const queriesAfterFirst = queryCount;

    // Advance 4min — still within 5min TTL, cache hit (proves premium uses
    // the longer TTL, not the 60s onboarding TTL).
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(await resolveUserPlan(supabase, "user-ttl-stable")).toBe("premium");
    expect(queryCount).toBe(queriesAfterFirst); // still cached
  });
});

// ────────────────────────────────────────────────────────────────────
// Wave 7 audit P0 #2 — onboarding boost overrides noTierMultiplier.
//
// analyze_garment has noTierMultiplier:true (parity choice — same 30/min
// for free + premium). Pre-fix, that flag also skipped the onboarding 3x
// boost, throttling onboarding users at 30/min (BatchCapture's parallel
// analyze_garment calls would hit the limit immediately). The fix carves
// out onboarding so it ALWAYS gets the 3x boost regardless of the flag.
// ────────────────────────────────────────────────────────────────────

interface RateLimitMockOptions {
  subscription?: { plan?: string; status?: string } | null;
  profile?: { onboarding_step?: string | null; onboarding_started_at?: string | null } | null;
  hourCount?: number;
  minuteCount?: number;
}

function createEnforceRateLimitMock(opts: RateLimitMockOptions) {
  // Mock supports BOTH the resolveUserPlan query path
  // (.from(table).select.eq.single → { data, error }) AND the count path
  // (.from('ai_rate_limits').select(cols, { count, head }).eq.eq.gte → { count, error }).
  return {
    from(table: string) {
      const builder: {
        select: (
          _cols?: string,
          options?: { count?: string; head?: boolean },
        ) => typeof builder;
        eq: () => typeof builder;
        gte: () => Promise<{ count: number; error: null }>;
        single: () => Promise<{ data: unknown; error: null }>;
        // N15/BE-P0-B5 — insert is now awaited in enforceRateLimit. The mock
        // must resolve to a {data, error} shape; the previous fire-and-forget
        // thenable would hang an awaited call indefinitely.
        insert: () => Promise<{ data: null; error: null }>;
      } = {
        select: () => builder,
        eq: () => builder,
        gte: async () => ({
          count:
            table === "ai_rate_limits"
              ? // First gte() in the .single() chain consumes oneHourAgo,
                // second consumes oneMinuteAgo. The mock can't distinguish,
                // so return whichever is requested via opts; the test
                // asserting tier resolution sets both to 0.
                opts.minuteCount ?? opts.hourCount ?? 0
              : 0,
          error: null,
        }),
        single: async () => {
          if (table === "subscriptions") {
            return { data: opts.subscription ?? null, error: null };
          }
          if (table === "profiles") {
            return { data: opts.profile ?? null, error: null };
          }
          return { data: null, error: null };
        },
        insert: async () => ({ data: null, error: null }),
      };
      return builder;
    },
    rpc: () => ({ then: (_a: () => void, _b: () => void) => void 0 }),
  };
}

describe("enforceRateLimit — onboarding boost on noTierMultiplier endpoint (Wave 7 audit P0 #2)", () => {
  beforeEach(() => {
    __resetSubscriptionCacheForTests();
  });

  it("applies 3x boost to analyze_garment when plan='onboarding' (90/min, not 30/min)", async () => {
    const recentStart = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const supabase = createEnforceRateLimitMock({
      subscription: { plan: "free", status: "active" },
      profile: {
        onboarding_step: "batch_capture",
        onboarding_started_at: recentStart,
      },
      hourCount: 0,
      minuteCount: 0,
    });

    const result = await enforceRateLimit(supabase, "user-onboarding", "analyze_garment");

    // analyze_garment base is { maxPerHour: 500, maxPerMinute: 30 }.
    // Onboarding gets 3x → { maxPerHour: 1500, maxPerMinute: 90 }.
    // remaining = limit - count - 1 (the call we're recording).
    expect(result.allowed).toBe(true);
    expect(result.remaining.minute).toBe(89); // 90 - 0 - 1
    expect(result.remaining.hour).toBe(1499); // 1500 - 0 - 1
  });

  it("keeps base limits for free plan on noTierMultiplier endpoint (no scaling)", async () => {
    const supabase = createEnforceRateLimitMock({
      subscription: { plan: "free", status: "active" },
      profile: { onboarding_step: "completed", onboarding_started_at: null },
      hourCount: 0,
      minuteCount: 0,
    });

    const result = await enforceRateLimit(supabase, "user-free", "analyze_garment");

    // noTierMultiplier:true + non-onboarding plan → raw base values.
    expect(result.remaining.minute).toBe(29); // 30 - 0 - 1
    expect(result.remaining.hour).toBe(499); // 500 - 0 - 1
  });

  it("keeps base limits for premium plan on noTierMultiplier endpoint (no scaling)", async () => {
    const supabase = createEnforceRateLimitMock({
      subscription: { plan: "premium", status: "active" },
      profile: { onboarding_step: "completed", onboarding_started_at: null },
      hourCount: 0,
      minuteCount: 0,
    });

    const result = await enforceRateLimit(supabase, "user-premium", "analyze_garment");

    // noTierMultiplier:true + premium → raw base, NOT 60/min.
    expect(result.remaining.minute).toBe(29); // 30 - 0 - 1
    expect(result.remaining.hour).toBe(499); // 500 - 0 - 1
  });

  it("still scales non-noTierMultiplier endpoints normally for onboarding", async () => {
    const recentStart = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const supabase = createEnforceRateLimitMock({
      subscription: { plan: "free", status: "active" },
      profile: {
        onboarding_step: "batch_capture",
        onboarding_started_at: recentStart,
      },
      hourCount: 0,
      minuteCount: 0,
    });

    // mood_outfit base is { maxPerHour: 30, maxPerMinute: 5 }.
    // Onboarding 3x → { maxPerHour: 90, maxPerMinute: 15 }.
    const result = await enforceRateLimit(supabase, "user-onboarding-2", "mood_outfit");

    expect(result.remaining.minute).toBe(14); // 15 - 0 - 1
    expect(result.remaining.hour).toBe(89); // 90 - 0 - 1
  });
});

// ────────────────────────────────────────────────────────────────────
// enforceSubscription — Wave 8 P54 paywall gate
//
// The gate runs AFTER enforceRateLimit and BEFORE the AI call. It's
// allowed-states (return {allowed:true}):
//   1. resolveUserPlan → 'onboarding' (Wave 7 P43 boost still active)
//   2. status='trialing' AND (current_period_end is null OR future)
//   3. status='active' AND plan='premium'
// Everything else returns {allowed:false, reason}: 'expired' iff
// status='trialing' and current_period_end has passed; 'locked' otherwise.
// ────────────────────────────────────────────────────────────────────

interface EnforceSubMockOptions {
  // Drives both resolveUserPlan's subscription read AND enforceSubscription's
  // own subscription read. Pass distinct shapes when the test cares; otherwise
  // pass the same shape and the mock returns it for both.
  subscription?:
    | {
        plan?: string | null;
        status?: string | null;
        current_period_end?: string | null;
      }
    | null;
  // Drives the direct profile read in enforceSubscription (Codex P1 round 6
  // on PR #700). enforceSubscription now bypasses resolveUserPlan's cache
  // and reads profile directly via .maybeSingle() to avoid a stale-plan
  // race where enforceRateLimit cached 'free' before the user entered
  // onboarding.
  profile?: {
    onboarding_step?: string | null;
    onboarding_started_at?: string | null;
  } | null;
  // Drives resolveUserPlan's profile read via .single() (used by
  // enforceRateLimit's cache resolution — separate code path now). Defaults
  // to `profile` if unset; tests that want to exercise the cache-race
  // regression set this explicitly to null while leaving `profile` populated.
  legacyProfile?: {
    onboarding_step?: string | null;
    onboarding_started_at?: string | null;
  } | null;
  // Force the `subscriptions` SELECT (the second one — enforceSubscription's)
  // to return an error, exercising the fail-closed branch.
  subscriptionsErrorOnSecondRead?: boolean;
  // Throw inside the supabase builder to exercise the outer try/catch fail-closed path.
  throwOnQuery?: boolean;
}

function createEnforceSubscriptionMock(opts: EnforceSubMockOptions) {
  // We need to distinguish between resolveUserPlan's `.single()` chain on
  // `subscriptions` (returns {plan, status} only) and enforceSubscription's
  // `.maybeSingle()` chain on `subscriptions` (returns {status, plan,
  // current_period_end}). Both call .from('subscriptions').select(...).eq(...)
  // and then either .single() OR .maybeSingle(). The mock's `single` returns
  // the resolveUserPlan-shape; `maybeSingle` returns the full shape.
  let subscriptionsHits = 0;
  return {
    from(table: string) {
      const builder: {
        select: () => typeof builder;
        eq: () => typeof builder;
        single: () => Promise<{ data: unknown; error: unknown }>;
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      } = {
        select: () => builder,
        eq: () => builder,
        single: async () => {
          if (opts.throwOnQuery) throw new Error("simulated DB outage");
          if (table === "subscriptions") {
            subscriptionsHits++;
            return {
              data: opts.subscription
                ? { plan: opts.subscription.plan, status: opts.subscription.status }
                : null,
              error: null,
            };
          }
          if (table === "profiles") {
            // Used by resolveUserPlan (called from enforceRateLimit's cache
            // path). Defaults to `profile` for backward compat; tests
            // targeting the cache-race regression set `legacyProfile` to
            // null while leaving `profile` populated.
            const legacy = opts.legacyProfile === undefined
              ? opts.profile
              : opts.legacyProfile;
            return { data: legacy ?? null, error: null };
          }
          return { data: null, error: null };
        },
        maybeSingle: async () => {
          if (opts.throwOnQuery) throw new Error("simulated DB outage");
          if (table === "subscriptions") {
            subscriptionsHits++;
            // resolveUserPlan calls .single() first; this is enforceSubscription's
            // own call after the cache hit / miss path settles.
            if (opts.subscriptionsErrorOnSecondRead) {
              return { data: null, error: { message: "simulated read error" } };
            }
            return { data: opts.subscription ?? null, error: null };
          }
          if (table === "profiles") {
            // Used by enforceSubscription's direct profile read (Codex
            // P1 round 6 — bypasses resolveUserPlan's cache).
            return { data: opts.profile ?? null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
  };
}

describe("enforceSubscription — Wave 8 P54 gate", () => {
  beforeEach(() => {
    __resetSubscriptionCacheForTests();
  });

  it("returns {allowed:true} when profile shows onboarding bypass (boost overrides subscription)", async () => {
    // Onboarding boost: started 1h ago, mid-flow. enforceSubscription reads
    // profile directly (Codex P1 round 6). Even with NO subscription row,
    // the gate should allow.
    const recentStart = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const supabase = createEnforceSubscriptionMock({
      subscription: null,
      profile: {
        onboarding_step: "batch_capture",
        onboarding_started_at: recentStart,
      },
    });

    expect(await enforceSubscription(supabase, "user-onboarding")).toEqual({
      allowed: true,
    });
  });

  it("bypasses resolveUserPlan cache for onboarding check (Codex P1 round 6 cache-race regression)", async () => {
    // Cache-race scenario: enforceRateLimit fired earlier and cached the
    // user's plan as 'free' (5min TTL). Within that window, the user
    // entered onboarding (advance_onboarding_step set onboarding_started_at
    // and step='language'). enforceSubscription must NOT trust the stale
    // cache — it must read profile directly so the bypass fires.
    //
    // Mock: legacyProfile=null (resolveUserPlan would NOT see onboarding)
    // but profile=onboarding (direct read DOES). Subscription is the
    // signup-default 'free'/'active' shape, which would lock without bypass.
    const recentStart = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const supabase = createEnforceSubscriptionMock({
      subscription: { plan: "free", status: "active" },
      legacyProfile: null,
      profile: {
        onboarding_step: "batch_capture",
        onboarding_started_at: recentStart,
      },
    });

    expect(await enforceSubscription(supabase, "user-cache-race")).toEqual({
      allowed: true,
    });
  });

  it("returns {allowed:false, reason:'locked'} when no subscription row exists", async () => {
    const supabase = createEnforceSubscriptionMock({
      subscription: null,
      profile: { onboarding_step: "completed", onboarding_started_at: null },
    });

    expect(await enforceSubscription(supabase, "user-no-row")).toEqual({
      allowed: false,
      reason: "locked",
    });
  });

  it("returns {allowed:true} for status='trialing' with future current_period_end", async () => {
    const futureEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(); // +2 days
    const supabase = createEnforceSubscriptionMock({
      subscription: { status: "trialing", plan: "premium", current_period_end: futureEnd },
      profile: { onboarding_step: "completed", onboarding_started_at: null },
    });

    expect(await enforceSubscription(supabase, "user-trial-active")).toEqual({
      allowed: true,
    });
  });

  it("returns {allowed:false, reason:'expired'} for status='trialing' with past current_period_end", async () => {
    const pastEnd = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // -1h
    const supabase = createEnforceSubscriptionMock({
      subscription: { status: "trialing", plan: "premium", current_period_end: pastEnd },
      profile: { onboarding_step: "completed", onboarding_started_at: null },
    });

    expect(await enforceSubscription(supabase, "user-trial-expired")).toEqual({
      allowed: false,
      reason: "expired",
    });
  });

  it("returns {allowed:true} for status='trialing' with null current_period_end (webhook-lag tolerance)", async () => {
    // Brief window between Stripe-side trial creation and webhook-driven
    // current_period_end mirror — Wave 8 P52 acceptance criterion.
    const supabase = createEnforceSubscriptionMock({
      subscription: { status: "trialing", plan: "premium", current_period_end: null },
      profile: { onboarding_step: "completed", onboarding_started_at: null },
    });

    expect(await enforceSubscription(supabase, "user-trial-null")).toEqual({
      allowed: true,
    });
  });

  it("returns {allowed:true} for status='active' + plan='premium'", async () => {
    const supabase = createEnforceSubscriptionMock({
      subscription: {
        status: "active",
        plan: "premium",
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      profile: { onboarding_step: "completed", onboarding_started_at: null },
    });

    expect(await enforceSubscription(supabase, "user-paid")).toEqual({
      allowed: true,
    });
  });

  it("returns {allowed:false, reason:'locked'} for status='active' + plan='free'", async () => {
    // A row with status='active' but plan='free' is a free-tier user — denied
    // (Wave 8 explicitly removes the free tier; this guards the row shape).
    const supabase = createEnforceSubscriptionMock({
      subscription: { status: "active", plan: "free", current_period_end: null },
      profile: { onboarding_step: "completed", onboarding_started_at: null },
    });

    expect(await enforceSubscription(supabase, "user-active-free")).toEqual({
      allowed: false,
      reason: "locked",
    });
  });

  it("returns {allowed:false, reason:'locked'} for status='canceled' + plan='premium'", async () => {
    const supabase = createEnforceSubscriptionMock({
      subscription: {
        status: "canceled",
        plan: "premium",
        current_period_end: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      profile: { onboarding_step: "completed", onboarding_started_at: null },
    });

    expect(await enforceSubscription(supabase, "user-canceled")).toEqual({
      allowed: false,
      reason: "locked",
    });
  });

  it("returns {allowed:false, reason:'locked'} for status='past_due'", async () => {
    const supabase = createEnforceSubscriptionMock({
      subscription: {
        status: "past_due",
        plan: "premium",
        current_period_end: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      profile: { onboarding_step: "completed", onboarding_started_at: null },
    });

    expect(await enforceSubscription(supabase, "user-past-due")).toEqual({
      allowed: false,
      reason: "locked",
    });
  });

  it("returns {allowed:true} for onboarding plan even when subscription would otherwise lock", async () => {
    // Cross-check: onboarding boost overrides ANY subscription state.
    // Here the subscription is past_due (would normally lock) but the user
    // is mid-onboarding so the gate must allow. Verifies the bypass is the
    // FIRST check, not a fallthrough after the subscription read.
    const recentStart = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const supabase = createEnforceSubscriptionMock({
      subscription: { status: "past_due", plan: "premium", current_period_end: null },
      profile: {
        onboarding_step: "quiz",
        onboarding_started_at: recentStart,
      },
    });

    expect(await enforceSubscription(supabase, "user-onboarding-pastdue")).toEqual({
      allowed: true,
    });
  });

  it("fails closed with reason:'locked' when DB read errors (does NOT silently grant)", async () => {
    // Pre-check failures must NOT silently grant access — that's the entire
    // point of the gate. If the subscriptions table read fails after the
    // resolveUserPlan onboarding check returns 'free' or 'premium' (i.e.,
    // the cache miss path runs), the function denies with 'locked'.
    const supabase = createEnforceSubscriptionMock({
      subscription: null, // resolveUserPlan returns 'free'
      profile: { onboarding_step: "completed", onboarding_started_at: null },
      subscriptionsErrorOnSecondRead: true,
    });

    expect(await enforceSubscription(supabase, "user-db-error")).toEqual({
      allowed: false,
      reason: "locked",
    });
  });

  it("fails closed with reason:'locked' when resolveUserPlan throws unexpectedly", async () => {
    // Outer try/catch covers any thrown error from resolveUserPlan or the
    // subscriptions read — fail closed.
    const supabase = createEnforceSubscriptionMock({
      throwOnQuery: true,
    });

    // resolveUserPlan itself swallows throws and returns 'free' (its own
    // fail-safe), so this exercises the case where its returned 'free' value
    // then proceeds to the subscriptions read which also throws via the
    // same throwOnQuery flag. Either path lands at fail-closed 'locked'.
    expect(await enforceSubscription(supabase, "user-throws")).toEqual({
      allowed: false,
      reason: "locked",
    });
  });
});

describe("subscriptionLockedResponse — Wave 8 P54 response builder", () => {
  it("returns 402 with {error:'subscription_required', reason:'locked'} body", async () => {
    const cors = { "access-control-allow-origin": "*" };
    const res = subscriptionLockedResponse("locked", cors);

    expect(res.status).toBe(402);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");

    const body = await res.json();
    expect(body).toEqual({ error: "subscription_required", reason: "locked" });
  });

  it("returns 402 with reason:'expired' for trial-end UX", async () => {
    const cors = { "access-control-allow-origin": "*" };
    const res = subscriptionLockedResponse("expired", cors);

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body).toEqual({ error: "subscription_required", reason: "expired" });
  });
});
