import { describe, expect, it, vi } from "vitest";
import { reserveCredit } from "../render-credits.ts";

/**
 * Unit tests for the reserveCredit normalization layer.
 *
 * The transport between edge functions and Postgres RPC returns either
 * the new shape `{ ok: true, source, replay }` (migration 20260416233226)
 * or the legacy shape `{ ok: true, source, duplicate: true }` that ships
 * before that migration applies.
 *
 * The normalization layer must treat BOTH as replays so a function
 * deploy that lands ahead of the migration doesn't misclassify retries
 * as fresh reservations — which would re-call Gemini and produce a
 * free render when consume hits already_terminal.
 */

function makeSupabaseStub(rpcReturn: { data: unknown; error: null | Error }) {
  return {
    rpc: vi.fn().mockResolvedValue(rpcReturn),
  };
}

describe("reserveCredit normalization", () => {
  const userId = "aaaaaaaa-bbbb-cccc-dddd-000000000001";
  const jobId = "10000000-0000-0000-0000-000000000001";
  const idempotencyKey = "test_key_A";

  it("normalises the NEW shape: { ok:true, replay:true } → replay=true", async () => {
    const supabase = makeSupabaseStub({
      data: { ok: true, source: "monthly", replay: true },
      error: null,
    });

    const result = await reserveCredit(supabase, userId, jobId, idempotencyKey);

    expect(result).toEqual({ ok: true, source: "monthly", replay: true });
  });

  it("normalises the NEW shape: { ok:true, replay:false } → replay=false (fresh reserve)", async () => {
    const supabase = makeSupabaseStub({
      data: { ok: true, source: "monthly", replay: false },
      error: null,
    });

    const result = await reserveCredit(supabase, userId, jobId, idempotencyKey);

    expect(result).toEqual({ ok: true, source: "monthly", replay: false });
  });

  it("normalises the LEGACY shape: { ok:true, duplicate:true } → replay=true", async () => {
    // This is the critical deploy-window case. Pre-migration RPC emits
    // `duplicate: true` on idempotency hits. The normaliser MUST map
    // this to replay:true so render_garment_image short-circuits instead
    // of re-running Gemini.
    const supabase = makeSupabaseStub({
      data: { ok: true, source: "monthly", duplicate: true },
      error: null,
    });

    const result = await reserveCredit(supabase, userId, jobId, idempotencyKey);

    expect(result).toEqual({ ok: true, source: "monthly", replay: true });
  });

  it("normalises the LEGACY fresh shape: { ok:true, source:'monthly' } → replay=false", async () => {
    // Pre-migration RPC emits just { ok:true, source } on fresh reserves
    // (no replay, no duplicate). Must classify as fresh.
    const supabase = makeSupabaseStub({
      data: { ok: true, source: "monthly" },
      error: null,
    });

    const result = await reserveCredit(supabase, userId, jobId, idempotencyKey);

    expect(result).toEqual({ ok: true, source: "monthly", replay: false });
  });

  it("treats both replay=true AND duplicate=true as replay (defensive OR)", async () => {
    // Belt-and-suspenders: if either flag is set, treat as replay.
    const supabase = makeSupabaseStub({
      data: { ok: true, source: "trial_gift", replay: false, duplicate: true },
      error: null,
    });

    const result = await reserveCredit(supabase, userId, jobId, idempotencyKey);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.replay).toBe(true);
      expect(result.source).toBe("trial_gift");
    }
  });

  it("propagates business denial: { ok:false, reason:'insufficient' }", async () => {
    const supabase = makeSupabaseStub({
      data: { ok: false, reason: "insufficient" },
      error: null,
    });

    const result = await reserveCredit(supabase, userId, jobId, idempotencyKey);

    expect(result).toEqual({ ok: false, reason: "insufficient" });
  });

  it("maps transport/DB errors to rpc_error with original message", async () => {
    const supabase = makeSupabaseStub({
      data: null,
      error: new Error("connection reset"),
    });

    const result = await reserveCredit(supabase, userId, jobId, idempotencyKey);

    expect(result).toEqual({
      ok: false,
      reason: "rpc_error",
      error: "connection reset",
    });
  });
});
