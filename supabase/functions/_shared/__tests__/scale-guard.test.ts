import { describe, expect, it, vi } from "vitest";

import { enforceRateLimit } from "../scale-guard.ts";

function createSupabaseAdminStub(overrides?: {
  hourCount?: number;
  minuteCount?: number;
  insertError?: { message: string } | null;
}) {
  const hourCount = overrides?.hourCount ?? 0;
  const minuteCount = overrides?.minuteCount ?? 0;
  const insertError = overrides?.insertError ?? null;
  let rateLimitSelectCount = 0;

  const deleteEq = vi.fn(async () => ({ error: null }));
  const deleteFn = vi.fn(() => ({ eq: deleteEq }));
  const insert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({
        data: insertError ? null : { id: "rate-limit-row-1" },
        error: insertError,
      })),
    })),
  }));

  const select = vi.fn((_columns: string, opts?: { count?: string; head?: boolean }) => {
    if (opts?.count === "exact" && opts?.head) {
      rateLimitSelectCount += 1;
      const resultCount = rateLimitSelectCount === 1 ? hourCount : minuteCount;
      return {
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(async () => ({ count: resultCount, error: null })),
          })),
        })),
      };
    }

    return {
      eq,
      insert,
    };
  });

  return {
    from: vi.fn((table: string) => {
      if (table === "subscriptions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        };
      }

      if (table === "ai_rate_limits") {
        return {
          select,
          insert,
          delete: deleteFn,
        };
      }

      return { select, insert };
    }),
    rpc: vi.fn(async () => ({ data: null })),
    __spies: {
      deleteEq,
    },
  };
}

describe("enforceRateLimit", () => {
  it("records the request before returning success", async () => {
    const supabaseAdmin = createSupabaseAdminStub();

    const result = await enforceRateLimit(supabaseAdmin, "user-1", "burs_style_engine");

    expect(result.allowed).toBe(true);
    expect(supabaseAdmin.from).toHaveBeenCalledWith("ai_rate_limits");
  });

  it("throws when the rate-limit insert fails instead of silently allowing the request", async () => {
    const supabaseAdmin = createSupabaseAdminStub({
      insertError: { message: "insert failed" },
    });

    await expect(enforceRateLimit(supabaseAdmin, "user-1", "burs_style_engine"))
      .rejects
      .toThrow("Rate limit recording failed");
  });

  it("rolls back the reservation row when the burst limit is exceeded", async () => {
    const supabaseAdmin = createSupabaseAdminStub({
      hourCount: 1,
      minuteCount: 6,
    });

    await expect(enforceRateLimit(supabaseAdmin, "user-1", "burs_style_engine"))
      .rejects
      .toThrow("Too many requests");

    expect(supabaseAdmin.__spies.deleteEq).toHaveBeenCalledWith("id", "rate-limit-row-1");
  });
});
