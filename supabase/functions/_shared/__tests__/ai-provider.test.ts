// `_shared/ai-provider.ts` — fallback smoke test.
//
// Mocks `callBursAI` so the primary path throws a 5xx BursAIError, then
// stubs `globalThis.fetch` to satisfy the Anthropic POST. Asserts the
// wrapper returns `provider: 'anthropic'` with the stub'd text content.
//
// Deliberately small: the full Anthropic SDK path is not exercised
// (this test runs without network), but the wire-level POST + JSON
// response shape ARE exercised, which is what the fallback decision
// actually depends on.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BursAIError } from "../burs-ai.ts";

const mockCallBursAI = vi.fn();

vi.mock("../burs-ai.ts", async () => {
  // Pull the real module so we keep `BursAIError`, `AIQuotaExceededError`
  // and the type exports — only `callBursAI` itself is stubbed.
  const actual = await vi.importActual<typeof import("../burs-ai.ts")>(
    "../burs-ai.ts",
  );
  return {
    ...actual,
    callBursAI: (...args: unknown[]) => mockCallBursAI(...args),
  };
});

function stubDenoEnv(values: Record<string, string | undefined>): void {
  // deno-lint-ignore no-explicit-any
  (globalThis as any).Deno = {
    env: { get: (k: string) => values[k] },
  };
}

beforeEach(() => {
  mockCallBursAI.mockReset();
  stubDenoEnv({ ANTHROPIC_API_KEY: "test-key" });
});

afterEach(() => {
  // deno-lint-ignore no-explicit-any
  delete (globalThis as any).Deno;
  vi.restoreAllMocks();
});

describe("callAI fallback to Anthropic", () => {
  it("returns provider:'anthropic' when primary throws a 503", async () => {
    mockCallBursAI.mockRejectedValueOnce(new BursAIError("upstream down", 503));

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [{ type: "text", text: '{"ok":true}' }],
            usage: { input_tokens: 12, output_tokens: 34 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    // No-op supabase client. `insert(...)` returns a thenable so the
    // fire-and-forget logCallRow path doesn't blow up the test.
    const supabase = {
      from: () => ({ insert: () => Promise.resolve({}) }),
    };

    // Late import so the vi.mock above is wired before module evaluation.
    const { callAI } = await import("../ai-provider.ts");

    const result = await callAI(
      {
        models: ["gemini-2.5-flash"],
        max_tokens: 256,
        functionName: "test_fn",
        messages: [
          { role: "system", content: "You are a tester." },
          { role: "user", content: "Reply with {\"ok\":true}." },
        ],
        fallbackEnabled: true,
        fallbackTimeoutMs: 500,
        userId: "user-1",
        requestId: "00000000-0000-0000-0000-000000000000",
      },
      supabase,
    );

    expect(result.provider).toBe("anthropic");
    expect(result.data).toBe('{"ok":true}');
    expect(result.inputTokens).toBe(12);
    expect(result.outputTokens).toBe(34);
    expect(result.estimatedCostUsd).toBeCloseTo(
      12 * (1 / 1_000_000) + 34 * (5 / 1_000_000),
      9,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe(
      "test-key",
    );
  });

  it("re-throws non-retryable errors instead of falling back", async () => {
    mockCallBursAI.mockRejectedValueOnce(new BursAIError("bad request", 400));
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const supabase = {
      from: () => ({ insert: () => Promise.resolve({}) }),
    };

    const { callAI } = await import("../ai-provider.ts");

    await expect(
      callAI(
        {
          models: ["gemini-2.5-flash"],
          functionName: "test_fn",
          messages: [{ role: "user", content: "x" }],
        },
        supabase,
      ),
    ).rejects.toThrow("bad request");

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
