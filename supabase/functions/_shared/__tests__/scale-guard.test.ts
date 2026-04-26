import { describe, expect, it, beforeEach } from "vitest";

import {
  __resetSubscriptionCacheForTests,
  applyTierMultiplier,
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
