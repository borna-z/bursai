import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetSubscriptionCacheForTests,
  applyTierMultiplier,
  enforceRateLimit,
  getRateLimitTier,
  resolveUserPlan,
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
        insert: () => { then: (cb: () => void) => void };
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
        insert: () => ({ then: (_cb: () => void) => void 0 }),
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
