import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildBursAICacheShape,
  createBursAICacheKey,
  parseBursAIProviderResponse,
  resolveBursAIServiceClient,
  type BursAIOptions,
} from "../burs-ai.ts";

const baseOptions: BursAIOptions = {
  messages: [{ role: "user", content: "Build a sharp office outfit." }],
  cacheNamespace: "style_chat",
  extraBody: { response_format: { type: "json_object" } },
  functionName: "style_chat",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe("resolveBursAIServiceClient", () => {
  it("reuses an explicitly provided client", async () => {
    const provided = { provided: true };
    await expect(resolveBursAIServiceClient(provided, { cacheTtlSeconds: 300 })).resolves.toBe(provided);
  });

  it("does not create a client when caching is disabled", async () => {
    vi.stubGlobal("Deno", {
      env: { get: vi.fn(() => null) },
    });

    await expect(resolveBursAIServiceClient(undefined, { cacheTtlSeconds: 0 })).resolves.toBeNull();
  });
});
