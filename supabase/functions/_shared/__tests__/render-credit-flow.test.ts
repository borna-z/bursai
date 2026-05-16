import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildInsufficientCreditsBody,
  buildRenderCreditKeys,
  classifyReplayBranch,
  consumeRenderCredit,
  healRenderCreditOnAlreadyReady,
  releaseRenderCreditOnFailure,
  reserveRenderCredit,
  resolveRenderJobId,
} from "../render-credit-flow";

/**
 * Tests cover the five credit-lifecycle invariants the extraction must
 * preserve byte-for-byte from the pre-extraction render_garment_image
 * handler:
 *
 *   1. Reserve + consume on the happy path
 *   2. Reserve + release on validator rejection (release after non-consume exit)
 *   3. Reserve + release on Gemini failure (release after non-consume exit)
 *   4. Reserve + release on upload failure (release after non-consume exit)
 *   5. Idempotent release: calling release after consume is a no-op or safe
 *
 * The shared module talks to Postgres via supabase-js RPC, so all tests
 * stub the client with vi.fn() return shapes that mirror the real
 * reserve_credit_atomic / consume_credit_atomic / release_credit_atomic
 * RPC payloads.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeRpcStub(perRpc: Record<string, unknown>): any {
  const rpc = vi.fn((name: string) => {
    const value = perRpc[name];
    if (value === undefined) {
      return Promise.resolve({ data: null, error: new Error(`unstubbed rpc: ${name}`) });
    }
    return Promise.resolve({ data: value, error: null });
  });
  return { rpc };
}

const userId = "aaaaaaaa-bbbb-cccc-dddd-000000000001";
const garmentId = "10000000-0000-0000-0000-0000000000aa";
const jobId = "20000000-0000-0000-0000-0000000000bb";
const presentation = "male";
const promptVersion = "v2";
const clientNonce = "nonce-abc";

// scale-guard records error counts on a module-local map; spy on it via
// reserveRenderCredit's transport-error branch.
vi.mock("../scale-guard.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../scale-guard.ts")>();
  return {
    ...actual,
    recordError: vi.fn(),
  };
});

import { recordError } from "../scale-guard";

beforeEach(() => {
  vi.mocked(recordError).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildRenderCreditKeys", () => {
  it("namespaces all three operations with ':' to prevent prefix collision", () => {
    const keys = buildRenderCreditKeys({
      userId,
      garmentId,
      presentation,
      promptVersion,
      clientNonce,
    });

    expect(keys.baseKey).toBe(`${userId}_${garmentId}_${presentation}_${promptVersion}_${clientNonce}`);
    expect(keys.reserveKey).toBe(`reserve:${keys.baseKey}`);
    expect(keys.consumeKey).toBe(`consume:${keys.baseKey}`);
    expect(keys.releaseKey).toBe(`release:${keys.baseKey}`);
  });

  it("produces a different base key when any segment changes", () => {
    const a = buildRenderCreditKeys({ userId, garmentId, presentation, promptVersion, clientNonce });
    const b = buildRenderCreditKeys({ userId, garmentId, presentation, promptVersion: "v3", clientNonce });
    expect(a.baseKey).not.toBe(b.baseKey);
  });
});

describe("resolveRenderJobId", () => {
  it("returns the worker-supplied jobId verbatim for internal invocations", async () => {
    const result = await resolveRenderJobId({
      isInternalInvocation: true,
      internalJobId: jobId,
      baseKey: "anything",
    });
    expect(result).toBe(jobId);
  });

  it("derives a deterministic UUID-shaped jobId for external invocations", async () => {
    const a = await resolveRenderJobId({
      isInternalInvocation: false,
      internalJobId: null,
      baseKey: "seed-A",
    });
    const b = await resolveRenderJobId({
      isInternalInvocation: false,
      internalJobId: null,
      baseKey: "seed-A",
    });
    const c = await resolveRenderJobId({
      isInternalInvocation: false,
      internalJobId: null,
      baseKey: "seed-B",
    });
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("classifyReplayBranch", () => {
  it("classifies a prior 'ready' state with a rendered path as cached", () => {
    const branch = classifyReplayBranch({
      priorRenderStatus: "ready",
      renderedImagePath: "u/g/rendered.jpg",
      renderedAt: "2026-05-16T00:00:00Z",
    });
    expect(branch).toEqual({
      kind: "cached",
      renderedImagePath: "u/g/rendered.jpg",
      renderedAt: "2026-05-16T00:00:00Z",
    });
  });

  it("classifies a 'pending' or 'rendering' prior state as in_progress", () => {
    expect(
      classifyReplayBranch({ priorRenderStatus: "pending", renderedImagePath: null, renderedAt: null }).kind,
    ).toBe("in_progress");
    expect(
      classifyReplayBranch({ priorRenderStatus: "rendering", renderedImagePath: null, renderedAt: null }).kind,
    ).toBe("in_progress");
  });

  it("classifies failed/skipped/none/null as terminal so the caller responds 409", () => {
    for (const priorRenderStatus of ["failed", "skipped", "none", null]) {
      const branch = classifyReplayBranch({
        priorRenderStatus,
        renderedImagePath: null,
        renderedAt: null,
      });
      expect(branch.kind).toBe("terminal");
    }
  });

  it("treats 'ready' without a rendered path as terminal (cannot return a cached path that does not exist)", () => {
    const branch = classifyReplayBranch({
      priorRenderStatus: "ready",
      renderedImagePath: null,
      renderedAt: null,
    });
    expect(branch.kind).toBe("terminal");
  });
});

describe("reserveRenderCredit", () => {
  it("returns the success result on a fresh reserve and does NOT touch the overload counter", async () => {
    const supabase = makeRpcStub({
      reserve_credit_atomic: { ok: true, source: "monthly", replay: false },
    });

    const result = await reserveRenderCredit(supabase, userId, jobId, "reserve:k", {
      garmentId,
      functionName: "render_garment_image",
    });

    expect(result).toEqual({ ok: true, source: "monthly", replay: false });
    expect(recordError).not.toHaveBeenCalled();
  });

  it("records overload pressure ONLY on transport (rpc_error) denials", async () => {
    const supabase = makeRpcStub({});
    supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error("connection reset") });

    const result = await reserveRenderCredit(supabase, userId, jobId, "reserve:k", {
      garmentId,
      functionName: "render_garment_image",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("rpc_error");
    }
    expect(recordError).toHaveBeenCalledWith("render_garment_image");
  });

  it("does NOT record overload pressure on business denials (insufficient credits)", async () => {
    const supabase = makeRpcStub({
      reserve_credit_atomic: { ok: false, reason: "insufficient" },
    });

    const result = await reserveRenderCredit(supabase, userId, jobId, "reserve:k", {
      garmentId,
      functionName: "render_garment_image",
    });

    expect(result).toEqual({ ok: false, reason: "insufficient" });
    expect(recordError).not.toHaveBeenCalled();
  });
});

describe("consumeRenderCredit (happy path → reserve + consume)", () => {
  it("calls consume_credit_atomic with the operation-prefixed key and returns the result", async () => {
    const supabase = makeRpcStub({
      consume_credit_atomic: { ok: true, source: "monthly" },
    });

    const result = await consumeRenderCredit(supabase, userId, jobId, "consume:k", { garmentId });

    expect(result.ok).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "consume_credit_atomic",
      expect.objectContaining({ p_idempotency_key: "consume:k" }),
    );
  });

  it("logs the rare 'reserve worked but consume failed' branch without throwing", async () => {
    const supabase = makeRpcStub({
      consume_credit_atomic: { ok: false, reason: "no_reservation" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await consumeRenderCredit(supabase, userId, jobId, "consume:k", { garmentId });

    expect(result.ok).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      "render_garment_image consume failed after successful render",
      expect.objectContaining({ garmentId, userId, reason: "no_reservation" }),
    );
  });
});

describe("releaseRenderCreditOnFailure (validator / Gemini / upload failure paths)", () => {
  it("releases when the external caller exits before consume (validator rejection)", async () => {
    const supabase = makeRpcStub({
      release_credit_atomic: { ok: true },
    });

    await releaseRenderCreditOnFailure(supabase, userId, jobId, "release:k", {
      isInternalInvocation: false,
      consumed: false,
      garmentIdForFailure: garmentId,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "release_credit_atomic",
      expect.objectContaining({ p_idempotency_key: "release:k" }),
    );
  });

  it("releases when the external caller exits before consume (Gemini provider failure)", async () => {
    const supabase = makeRpcStub({
      release_credit_atomic: { ok: true },
    });

    await releaseRenderCreditOnFailure(supabase, userId, jobId, "release:k", {
      isInternalInvocation: false,
      consumed: false,
      garmentIdForFailure: garmentId,
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("releases when the external caller exits before consume (storage upload failure)", async () => {
    const supabase = makeRpcStub({
      release_credit_atomic: { ok: true },
    });

    await releaseRenderCreditOnFailure(supabase, userId, jobId, "release:k", {
      isInternalInvocation: false,
      consumed: false,
      garmentIdForFailure: garmentId,
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — calling release after consume is a SKIP, not a duplicate RPC", async () => {
    const supabase = makeRpcStub({});

    await releaseRenderCreditOnFailure(supabase, userId, jobId, "release:k", {
      isInternalInvocation: false,
      consumed: true,
      garmentIdForFailure: garmentId,
    });

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("treats an idempotency-duplicate response from the RPC as safe (no error log)", async () => {
    const supabase = makeRpcStub({
      release_credit_atomic: { ok: false, duplicate: true, reason: "already_terminal" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await releaseRenderCreditOnFailure(supabase, userId, jobId, "release:k", {
      isInternalInvocation: false,
      consumed: false,
      garmentIdForFailure: garmentId,
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("never releases for INTERNAL (worker) callers — reserve survives until process_render_jobs terminalizes", async () => {
    const supabase = makeRpcStub({});

    await releaseRenderCreditOnFailure(supabase, userId, jobId, "release:k", {
      isInternalInvocation: true,
      consumed: false,
      garmentIdForFailure: garmentId,
    });

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("logs but does not throw when the release RPC itself rejects", async () => {
    const supabase = {
      rpc: vi.fn().mockRejectedValue(new Error("ledger unreachable")),
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await releaseRenderCreditOnFailure(supabase, userId, jobId, "release:k", {
      isInternalInvocation: false,
      consumed: false,
      garmentIdForFailure: garmentId,
    });

    expect(errorSpy).toHaveBeenCalledWith(
      "render_garment_image release crashed in finally",
      expect.objectContaining({ garmentId, error: "ledger unreachable" }),
    );
  });

  it("logs the non-duplicate failure branch separately from the crash branch", async () => {
    const supabase = makeRpcStub({
      release_credit_atomic: { ok: false, reason: "no_reservation" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await releaseRenderCreditOnFailure(supabase, userId, jobId, "release:k", {
      isInternalInvocation: false,
      consumed: false,
      garmentIdForFailure: garmentId,
    });

    expect(errorSpy).toHaveBeenCalledWith(
      "render_garment_image release failed in finally",
      expect.objectContaining({ reason: "no_reservation" }),
    );
  });
});

describe("healRenderCreditOnAlreadyReady (worker-crash recovery)", () => {
  it("issues a consume against the operation-prefixed heal key", async () => {
    const supabase = makeRpcStub({
      consume_credit_atomic: { ok: true, source: "monthly" },
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await healRenderCreditOnAlreadyReady(supabase, userId, jobId, "base", { garmentId });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "consume_credit_atomic",
      expect.objectContaining({ p_idempotency_key: "consume:base" }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      "render_garment_image already-ready healing consume",
      expect.objectContaining({ garmentId, jobId, healed: true, duplicate: false }),
    );
  });

  it("logs duplicate=true when the consume key was already written by a prior attempt", async () => {
    const supabase = makeRpcStub({
      consume_credit_atomic: { ok: true, source: "monthly", duplicate: true },
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await healRenderCreditOnAlreadyReady(supabase, userId, jobId, "base", { garmentId });

    expect(logSpy).toHaveBeenCalledWith(
      "render_garment_image already-ready healing consume",
      expect.objectContaining({ healed: false, duplicate: true }),
    );
  });

  it("swallows transport errors so the worker can still report success", async () => {
    const supabase = {
      rpc: vi.fn().mockRejectedValue(new Error("ledger down")),
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      healRenderCreditOnAlreadyReady(supabase, userId, jobId, "base", { garmentId }),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "render_garment_image healing consume threw",
      expect.objectContaining({ garmentId, error: "ledger down" }),
    );
  });
});

describe("buildInsufficientCreditsBody", () => {
  it("flags is_trial when monthly_allowance is 0 (trialing or canceled)", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                monthly_allowance: 0,
                used_this_period: 0,
                reserved: 0,
                trial_gift_remaining: 0,
                topup_balance: 0,
                period_start: "2026-05-01T00:00:00Z",
                period_end: "2026-06-01T00:00:00Z",
              },
              error: null,
            }),
          }),
        }),
      }),
    };

    const { body, isTrial } = await buildInsufficientCreditsBody(supabase, userId);

    expect(isTrial).toBe(true);
    expect(body).toMatchObject({
      error: "trial_studio_locked",
      is_trial: true,
      monthly_allowance: 0,
    });
  });

  it("emits 'insufficient_credits' when the user has an active monthly allowance", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                monthly_allowance: 30,
                used_this_period: 30,
                reserved: 0,
                trial_gift_remaining: 0,
                topup_balance: 0,
                period_start: "2026-05-01T00:00:00Z",
                period_end: "2026-06-01T00:00:00Z",
              },
              error: null,
            }),
          }),
        }),
      }),
    };

    const { body, isTrial } = await buildInsufficientCreditsBody(supabase, userId);

    expect(isTrial).toBe(false);
    expect(body).toMatchObject({
      error: "insufficient_credits",
      is_trial: false,
      remaining: 0,
    });
  });
});
