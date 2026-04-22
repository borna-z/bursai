import { describe, expect, it } from "vitest";

import {
  buildBursAICacheShape,
  compactGarment,
  createBursAICacheKey,
  filterEnrichedGarments,
  parseBursAIProviderResponse,
  waitForEnrichment,
  type BursAIOptions,
} from "../burs-ai.ts";

const baseOptions: BursAIOptions = {
  messages: [{ role: "user", content: "Build a sharp office outfit." }],
  cacheNamespace: "style_chat",
  extraBody: { response_format: { type: "json_object" } },
  functionName: "style_chat",
};

describe("buildBursAICacheShape", () => {
  it("includes request-shaping inputs beyond messages and tools", () => {
    const shape = buildBursAICacheShape({
      options: {
        ...baseOptions,
        tool_choice: { type: "function", function: { name: "pick_outfit" } },
        complexity: "complex",
      },
      modelChain: ["gemini-2.5-flash"],
      maxTokens: 900,
      temperature: 0.4,
    });

    expect(shape).toMatchObject({
      ns: "style_chat",
      tool_choice: { type: "function", function: { name: "pick_outfit" } },
      complexity: "complex",
      models: ["gemini-2.5-flash"],
      max_tokens: 900,
      temperature: 0.4,
      extraBody: { response_format: { type: "json_object" } },
    });
  });
});

describe("createBursAICacheKey", () => {
  it("changes when tool choice changes", async () => {
    const withoutToolChoice = await createBursAICacheKey({
      options: baseOptions,
      modelChain: ["gemini-2.5-flash-lite"],
      maxTokens: 600,
      temperature: 0.3,
    });
    const withToolChoice = await createBursAICacheKey({
      options: {
        ...baseOptions,
        tool_choice: { type: "function", function: { name: "pick_outfit" } },
      },
      modelChain: ["gemini-2.5-flash-lite"],
      maxTokens: 600,
      temperature: 0.3,
    });

    expect(withoutToolChoice).not.toBe(withToolChoice);
  });

  it("changes when extra body or resolved model path changes", async () => {
    const baseKey = await createBursAICacheKey({
      options: baseOptions,
      modelChain: ["gemini-2.5-flash-lite"],
      maxTokens: 600,
      temperature: 0.3,
    });
    const changedExtraBodyKey = await createBursAICacheKey({
      options: {
        ...baseOptions,
        extraBody: { response_format: { type: "text" } },
      },
      modelChain: ["gemini-2.5-flash-lite"],
      maxTokens: 600,
      temperature: 0.3,
    });
    const changedModelChainKey = await createBursAICacheKey({
      options: baseOptions,
      modelChain: ["gemini-2.5-flash"],
      maxTokens: 600,
      temperature: 0.3,
    });

    expect(baseKey).not.toBe(changedExtraBodyKey);
    expect(baseKey).not.toBe(changedModelChainKey);
  });
});

describe("parseBursAIProviderResponse", () => {
  it("parses tool call arguments deterministically", () => {
    const parsed = parseBursAIProviderResponse({
      choices: [{
        finish_reason: "stop",
        message: {
          tool_calls: [{
            function: {
              arguments: JSON.stringify({ garment_ids: ["top-1", "bottom-1", "shoe-1"] }),
            },
          }],
        },
      }],
    });

    expect(parsed).toEqual({
      ok: true,
      finishReason: "stop",
      result: { garment_ids: ["top-1", "bottom-1", "shoe-1"] },
    });
  });

  it("preserves image payloads on content responses", () => {
    const parsed = parseBursAIProviderResponse({
      choices: [{
        finish_reason: "stop",
        message: {
          content: "Here is the look.",
          images: [{ mime_type: "image/png", data: "abc123" }],
        },
      }],
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.result).toMatchObject({
      content: "Here is the look.",
      images: [{ mime_type: "image/png", data: "abc123" }],
    });
  });

  it("fails safely on malformed tool-call JSON", () => {
    const parsed = parseBursAIProviderResponse({
      choices: [{
        message: {
          tool_calls: [{
            function: {
              arguments: "{not-json}",
            },
          }],
        },
      }],
    });

    expect(parsed).toMatchObject({
      ok: false,
      error: "Malformed provider response: invalid tool call JSON",
    });
  });

  it("fails safely when the provider omits choices", () => {
    const parsed = parseBursAIProviderResponse({});

    expect(parsed).toMatchObject({
      ok: false,
      error: "Malformed provider response: missing choices[0].message",
    });
  });
});

describe("compactGarment (P23)", () => {
  it("emits the full UUID — no 8-char slice", () => {
    const uuid = "4ac65f3e-0a1b-4d38-9c7e-65b1c0f9a2d0";
    const out = compactGarment({
      id: uuid,
      title: "Navy oxford",
      category: "top",
      color_primary: "navy",
    });
    expect(out.startsWith(`${uuid}|`)).toBe(true);
    expect(out).toContain("Navy oxford");
  });

  it("prefers subcategory over category when present", () => {
    const out = compactGarment({
      id: "00000000-0000-0000-0000-000000000001",
      title: "Cord jacket",
      category: "outerwear",
      subcategory: "jacket",
      color_primary: "brown",
    });
    expect(out).toContain("jacket");
    expect(out).not.toContain("outerwear");
  });

  it("appends material + formality when provided", () => {
    const out = compactGarment({
      id: "00000000-0000-0000-0000-000000000002",
      title: "Wool trousers",
      category: "bottom",
      color_primary: "charcoal",
      material: "wool",
      formality: 3,
    });
    expect(out.endsWith("wool|f3")).toBe(true);
  });
});

describe("filterEnrichedGarments (P24)", () => {
  it("keeps rows marked ready (accepts BOTH 'complete' and 'completed')", () => {
    const rows = [
      { id: "a", enrichment_status: "completed" as const },
      { id: "b", enrichment_status: "complete" as const },
      { id: "c", enrichment_status: "pending" as const },
      { id: "d", enrichment_status: "in_progress" as const },
      { id: "e", enrichment_status: "processing" as const },
      { id: "f", enrichment_status: "failed" as const },
      { id: "g", enrichment_status: null },
      { id: "h" },
    ];
    expect(filterEnrichedGarments(rows).map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("returns [] on empty input", () => {
    expect(filterEnrichedGarments([])).toEqual([]);
  });

  it("preserves additional fields on the row (generic)", () => {
    const rows = [
      { id: "a", title: "tee", enrichment_status: "completed" },
      { id: "b", title: "oxford", enrichment_status: "complete" },
      { id: "c", title: "jeans", enrichment_status: "pending" },
    ];
    const out = filterEnrichedGarments(rows);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.title).sort()).toEqual(["oxford", "tee"]);
  });
});

function mockSupabaseReturning(rows: Array<{ id: string; enrichment_status?: string | null }>) {
  return {
    from() {
      return {
        select() {
          return {
            in(_column: string, ids: string[]) {
              const data = rows.filter((r) => ids.includes(r.id));
              return Promise.resolve({ data, error: null });
            },
          };
        },
      };
    },
  };
}

function mockSupabaseWithCounter(rows: Array<{ id: string; enrichment_status?: string | null }>) {
  let calls = 0;
  const supabase = {
    from() {
      return {
        select() {
          return {
            in(_column: string, ids: string[]) {
              calls += 1;
              const data = rows.filter((r) => ids.includes(r.id));
              return Promise.resolve({ data, error: null });
            },
          };
        },
      };
    },
  };
  return { supabase, getCalls: () => calls };
}

function mockSupabaseError() {
  return {
    from() {
      return {
        select() {
          return {
            in() {
              return Promise.resolve({ data: null, error: { message: "db unreachable" } });
            },
          };
        },
      };
    },
  };
}

describe("waitForEnrichment (P24)", () => {
  it("resolves immediately for empty id list", async () => {
    const result = await waitForEnrichment({} as unknown, []);
    expect(result).toEqual({ ready: [], pending: [], failed: [] });
  });

  it("buckets completed and failed on first poll", async () => {
    const supabase = mockSupabaseReturning([
      { id: "a", enrichment_status: "completed" },
      { id: "b", enrichment_status: "failed" },
    ]);
    const result = await waitForEnrichment(supabase, ["a", "b"], {
      timeoutMs: 100,
      pollIntervalMs: 10,
    });
    expect(result.ready).toEqual(["a"]);
    expect(result.failed).toEqual(["b"]);
    expect(result.pending).toEqual([]);
  });

  it("accepts both 'complete' and 'completed' as ready (spelling divergence between frontend + job-queue writers)", async () => {
    const supabase = mockSupabaseReturning([
      { id: "frontend", enrichment_status: "complete" },
      { id: "jobqueue", enrichment_status: "completed" },
    ]);
    const result = await waitForEnrichment(supabase, ["frontend", "jobqueue"], {
      timeoutMs: 100,
      pollIntervalMs: 10,
    });
    expect(result.ready.sort()).toEqual(["frontend", "jobqueue"]);
    expect(result.pending).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it("buckets phantom IDs (deleted or missing rows) as failed", async () => {
    const supabase = mockSupabaseReturning([
      { id: "a", enrichment_status: "completed" },
    ]);
    const result = await waitForEnrichment(supabase, ["a", "ghost"], {
      timeoutMs: 100,
      pollIntervalMs: 10,
    });
    expect(result.ready).toEqual(["a"]);
    expect(result.failed).toEqual(["ghost"]);
    expect(result.pending).toEqual([]);
  });

  it("returns pending when deadline elapses with rows still processing", async () => {
    const supabase = mockSupabaseReturning([
      { id: "a", enrichment_status: "pending" },
    ]);
    const result = await waitForEnrichment(supabase, ["a"], {
      timeoutMs: 30,
      pollIntervalMs: 10,
    });
    expect(result.pending).toEqual(["a"]);
    expect(result.ready).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it("returns all ids as pending on DB error", async () => {
    const supabase = mockSupabaseError();
    const result = await waitForEnrichment(supabase, ["a", "b"], {
      timeoutMs: 100,
      pollIntervalMs: 10,
    });
    expect([...result.pending].sort()).toEqual(["a", "b"]);
    expect(result.ready).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it("clamps pollIntervalMs to a 50ms floor so pollIntervalMs:0 cannot busy-poll the DB (Codex P2 r3)", async () => {
    const { supabase, getCalls } = mockSupabaseWithCounter([
      { id: "a", enrichment_status: "pending" },
    ]);
    const start = Date.now();
    const result = await waitForEnrichment(supabase, ["a"], {
      timeoutMs: 200,
      pollIntervalMs: 0,
    });
    const elapsed = Date.now() - start;

    expect(result.pending).toEqual(["a"]);
    expect(getCalls()).toBeLessThanOrEqual(6);
    expect(elapsed).toBeGreaterThanOrEqual(150);
  });

  it("clamps timeoutMs to >= 0 so callers passing negative values don't loop indefinitely", async () => {
    const supabase = mockSupabaseReturning([
      { id: "a", enrichment_status: "pending" },
    ]);
    const start = Date.now();
    const result = await waitForEnrichment(supabase, ["a"], {
      timeoutMs: -100,
      pollIntervalMs: 10,
    });
    const elapsed = Date.now() - start;

    expect(result.pending).toEqual(["a"]);
    expect(elapsed).toBeLessThan(500);
  });

  it("coerces non-finite pollIntervalMs (NaN) to default before clamping — no busy-poll (Codex P2 r4)", async () => {
    const { supabase, getCalls } = mockSupabaseWithCounter([
      { id: "a", enrichment_status: "pending" },
    ]);
    const result = await waitForEnrichment(supabase, ["a"], {
      timeoutMs: 200,
      pollIntervalMs: NaN,
    });
    expect(result.pending).toEqual(["a"]);
    expect(getCalls()).toBeLessThanOrEqual(3);
  });

  it("coerces non-finite pollIntervalMs (Infinity) to default — no infinite-Math.max cascade (Codex P2 r4)", async () => {
    const { supabase, getCalls } = mockSupabaseWithCounter([
      { id: "a", enrichment_status: "pending" },
    ]);
    const result = await waitForEnrichment(supabase, ["a"], {
      timeoutMs: 200,
      pollIntervalMs: Infinity,
    });
    expect(result.pending).toEqual(["a"]);
    expect(getCalls()).toBeLessThanOrEqual(3);
  });

  it("coerces non-finite timeoutMs (NaN, Infinity) so the deadline math stays bounded (Codex P2 r4)", async () => {
    const supabase = mockSupabaseReturning([
      { id: "a", enrichment_status: "completed" },
    ]);
    const start = Date.now();
    const result = await waitForEnrichment(supabase, ["a"], {
      timeoutMs: Infinity,
      pollIntervalMs: 50,
    });
    const elapsed = Date.now() - start;
    expect(result.ready).toEqual(["a"]);
    expect(elapsed).toBeLessThan(500);
  });
});
