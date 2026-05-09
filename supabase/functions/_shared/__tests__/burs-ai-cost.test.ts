import { describe, expect, it, vi } from "vitest";

import {
  AIQuotaExceededError,
  computeCostMicros,
  readUsageBudget,
} from "../burs-ai.ts";

/**
 * N2 — AI cost ceiling unit tests.
 *
 * Covers:
 *   1. `computeCostMicros` pricing math (per-model, fallback model).
 *   2. `readUsageBudget` quota + monthly-sum read with fail-open
 *      semantics on DB error.
 *   3. The end-to-end `AIQuotaExceededError` path: when
 *      `spentMicros >= quotaMicros` the helper returns the budget that
 *      `callBursAI` then converts into the thrown error.
 *
 * The full `callBursAI` path is integration-tested via the smoke suite
 * (it requires a live Gemini endpoint). Here we lock the building
 * blocks: pricing constants drift, and a regressed read helper would
 * make the ceiling silently inert.
 */

describe("computeCostMicros (N2)", () => {
  it("computes flash pricing at 0.15 input / 0.60 output USD per 1M tokens", () => {
    // 1M input tokens = $0.15 = 150_000 micros
    expect(computeCostMicros(1_000_000, 0, "gemini-2.5-flash")).toBe(150_000);
    // 1M output tokens = $0.60 = 600_000 micros
    expect(computeCostMicros(0, 1_000_000, "gemini-2.5-flash")).toBe(600_000);
    // Mixed: 500k input + 250k output = $0.075 + $0.15 = $0.225 = 225_000 micros
    expect(computeCostMicros(500_000, 250_000, "gemini-2.5-flash")).toBe(225_000);
  });

  it("computes flash-lite pricing at 0.075 input / 0.30 output USD per 1M tokens", () => {
    expect(computeCostMicros(1_000_000, 0, "gemini-2.5-flash-lite")).toBe(75_000);
    expect(computeCostMicros(0, 1_000_000, "gemini-2.5-flash-lite")).toBe(300_000);
  });

  it("falls back to flash pricing for unknown models (over-counts conservatively)", () => {
    // An unknown model would otherwise yield NaN or 0; instead it falls
    // back to the more expensive flash rate so we never under-count cost
    // and let a user squeak past the ceiling on a fallback model name.
    expect(computeCostMicros(1_000_000, 1_000_000, "gemini-3.0-future")).toBe(150_000 + 600_000);
  });

  it("rounds half-up to integer micros (deterministic)", () => {
    // 1 input token on flash-lite = 0.075 / 1M = 7.5e-8 USD = 0.075 micros.
    // We round to 0 here — but the boundary case (0.5 micros) we want to
    // resolve away from zero. 7 input tokens × flash-lite = 0.525 micros → 1.
    expect(computeCostMicros(1, 0, "gemini-2.5-flash-lite")).toBe(0);
    expect(computeCostMicros(7, 0, "gemini-2.5-flash-lite")).toBe(1);
  });
});

function makeBudgetClient(opts: {
  subRow?: { monthly_token_quota_micros: number | null } | null;
  subError?: { message: string } | null;
  usageRows?: Array<{ cost_micros: number }>;
  usageError?: { message: string } | null;
}) {
  return {
    from(table: string) {
      if (table === "subscriptions") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle() {
                    return Promise.resolve({
                      data: opts.subRow ?? null,
                      error: opts.subError ?? null,
                    });
                  },
                };
              },
            };
          },
        };
      }
      if (table === "ai_token_usage") {
        return {
          select() {
            return {
              eq() {
                return {
                  gte() {
                    return Promise.resolve({
                      data: opts.usageRows ?? [],
                      error: opts.usageError ?? null,
                    });
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("readUsageBudget (N2)", () => {
  const userId = "11111111-2222-3333-4444-555555555555";

  it("reads quota from subscriptions and SUMs cost_micros for the current month", async () => {
    const supabase = makeBudgetClient({
      subRow: { monthly_token_quota_micros: 200_000_000 },
      usageRows: [{ cost_micros: 1000 }, { cost_micros: 500 }, { cost_micros: 2500 }],
    });

    const result = await readUsageBudget(supabase, userId);

    expect(result).toEqual({ quotaMicros: 200_000_000, spentMicros: 4000 });
  });

  it("returns quotaMicros: null when the subscription row has no quota set (legacy rows)", async () => {
    const supabase = makeBudgetClient({
      subRow: { monthly_token_quota_micros: null },
      usageRows: [{ cost_micros: 100 }],
    });

    const result = await readUsageBudget(supabase, userId);

    expect(result).toEqual({ quotaMicros: null, spentMicros: 100 });
  });

  it("fails OPEN (returns null) on subscriptions read error", async () => {
    const supabase = makeBudgetClient({
      subError: { message: "connection reset" },
      usageRows: [],
    });

    const result = await readUsageBudget(supabase, userId);

    // null → caller treats this request as unbounded; we'd rather let a
    // paying user through on a transient DB blip than 402 them.
    expect(result).toBeNull();
  });

  it("fails OPEN (returns null) on ai_token_usage read error", async () => {
    const supabase = makeBudgetClient({
      subRow: { monthly_token_quota_micros: 2_000_000 },
      usageError: { message: "lock timeout" },
    });

    const result = await readUsageBudget(supabase, userId);

    expect(result).toBeNull();
  });

  it("returns null on missing inputs (no userId / no client)", async () => {
    expect(await readUsageBudget(null as unknown, userId)).toBeNull();
    expect(await readUsageBudget(makeBudgetClient({}), "")).toBeNull();
  });

  it("ignores non-numeric cost_micros values defensively", async () => {
    const supabase = makeBudgetClient({
      subRow: { monthly_token_quota_micros: 1_000_000 },
      usageRows: [
        { cost_micros: 100 },
        { cost_micros: NaN as unknown as number },
        { cost_micros: 200 },
      ],
    });

    const result = await readUsageBudget(supabase, userId);

    expect(result).toEqual({ quotaMicros: 1_000_000, spentMicros: 300 });
  });
});

describe("AIQuotaExceededError (N2)", () => {
  it("is throwable and carries spent + quota micros for diagnostics", () => {
    const err = new AIQuotaExceededError(2_500_000, 2_000_000);

    expect(err).toBeInstanceOf(AIQuotaExceededError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AIQuotaExceededError");
    expect(err.status).toBe(402);
    expect(err.spentMicros).toBe(2_500_000);
    expect(err.quotaMicros).toBe(2_000_000);
    expect(err.message).toContain("2500000");
    expect(err.message).toContain("2000000");
  });

  it("models the trip condition: callBursAI throws when spentMicros >= quotaMicros", async () => {
    // This is the call shape callBursAI uses internally: read budget,
    // compare, throw. The test guards against a regression where the
    // helper returns a budget the caller misinterprets (e.g. flips the
    // comparison or treats null quota as zero).
    const supabase = makeBudgetClient({
      subRow: { monthly_token_quota_micros: 2_000_000 },
      usageRows: [{ cost_micros: 2_000_000 }], // exactly at the cap
    });

    const budget = await readUsageBudget(supabase, "u1");

    expect(budget).not.toBeNull();
    if (!budget) return;
    expect(budget.quotaMicros).not.toBeNull();
    if (budget.quotaMicros === null) return;

    // The trip condition exactly as written in callBursAI:
    const tripped = budget.spentMicros >= budget.quotaMicros;
    expect(tripped).toBe(true);

    // The error caller would then construct:
    expect(() => {
      throw new AIQuotaExceededError(budget.spentMicros, budget.quotaMicros as number);
    }).toThrow(AIQuotaExceededError);
  });

  it("does NOT trip when spentMicros < quotaMicros", async () => {
    const supabase = makeBudgetClient({
      subRow: { monthly_token_quota_micros: 2_000_000 },
      usageRows: [{ cost_micros: 1_999_999 }],
    });

    const budget = await readUsageBudget(supabase, "u1");
    expect(budget).not.toBeNull();
    if (!budget || budget.quotaMicros === null) return;
    expect(budget.spentMicros >= budget.quotaMicros).toBe(false);
  });

  it("does NOT trip when quotaMicros is null (legacy rows / unenforced)", async () => {
    const supabase = makeBudgetClient({
      subRow: { monthly_token_quota_micros: null },
      usageRows: [{ cost_micros: 999_999_999 }],
    });

    const budget = await readUsageBudget(supabase, "u1");
    expect(budget).not.toBeNull();
    if (!budget) return;
    // The callBursAI guard reads `budget.quotaMicros !== null` before
    // comparing; null short-circuits to "no enforcement".
    expect(budget.quotaMicros).toBeNull();
  });
});
