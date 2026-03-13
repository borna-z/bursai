/**
 * BURS AI — Unified AI abstraction layer v3
 *
 * Features: complexity-based model routing, prompt compression,
 * DB caching (via ai_response_cache table), request deduplication,
 * token budgets, temperature defaults, observability logging,
 * streaming keepalive, retry with backoff, rate limit handling.
 *
 * NOTE: No in-memory cache — Supabase Edge Function isolates are
 * stateless and cold-start on every invocation, so in-memory Maps
 * are always empty when a request arrives. DB cache is the only
 * caching layer.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GOOGLE_DIRECT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// ─── Complexity-based model routing ───────────────────────────
type Complexity = "trivial" | "standard" | "complex";

const COMPLEXITY_CHAINS: Record<Complexity, string[]> = {
  trivial: [
    "google/gemini-2.5-flash-lite",
    "google/gemini-2.5-flash",
  ],
  standard: [
    "google/gemini-3-flash-preview",
    "google/gemini-2.5-flash",
    "google/gemini-2.5-flash-lite",
  ],
  complex: [
    "google/gemini-2.5-pro",
    "google/gemini-3-flash-preview",
    "google/gemini-2.5-flash",
  ],
};

// Legacy model type chains (backward compat)
const MODEL_CHAINS: Record<string, string[]> = {
  default: COMPLEXITY_CHAINS.standard,
  vision: COMPLEXITY_CHAINS.complex,
  "image-gen": [
    "google/gemini-3-pro-image-preview",
    "google/gemini-2.5-flash-image",
  ],
  fast: COMPLEXITY_CHAINS.trivial,
  streaming: COMPLEXITY_CHAINS.standard,
};

// ─── Token budget defaults per complexity ─────────────────────
const DEFAULT_MAX_TOKENS: Record<Complexity, number> = {
  trivial: 300,
  standard: 600,
  complex: 1200,
};

// ─── Temperature defaults per complexity ──────────────────────
const DEFAULT_TEMPERATURE: Record<Complexity, number> = {
  trivial: 0.1,
  standard: 0.3,
  complex: 0.5,
};

// ─── Types ────────────────────────────────────────────────────
export interface BursAIOptions {
  messages: Array<{ role: string; content: any }>;
  tools?: any[];
  tool_choice?: any;
  stream?: boolean;
  /** Complexity level — auto-selects model chain, token budget & temperature */
  complexity?: Complexity;
  /** Legacy model chain type (overridden by complexity if set) */
  modelType?: string;
  /** Specific models to try (overrides both complexity and modelType) */
  models?: string[];
  /** Max tokens for AI response. Auto-set by complexity if not provided */
  max_tokens?: number;
  /** Timeout per model attempt in ms (default 30000) */
  timeout?: number;
  /** Cache TTL in seconds. 0 = no cache. Default 0 */
  cacheTtlSeconds?: number;
  /** Unique cache namespace to prevent collisions between functions */
  cacheNamespace?: string;
  /** Extra body params like temperature, modalities */
  extraBody?: Record<string, any>;
  /** Function name for observability logging */
  functionName?: string;
}

export interface BursAIResponse {
  data: any;
  model_used: string;
  from_cache: boolean;
}

export class BursAIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "BursAIError";
    this.status = status;
  }
}

// ─── Smart Token Estimation ───────────────────────────────────
export function estimateMaxTokens(opts: {
  inputItems?: number;
  outputItems?: number;
  perItemTokens?: number;
  baseTokens?: number;
  cap?: number;
}): number {
  const base = opts.baseTokens ?? 150;
  const perItem = opts.perItemTokens ?? 60;
  const items = opts.outputItems ?? Math.ceil((opts.inputItems ?? 5) * 0.6);
  return Math.min(base + items * perItem, opts.cap ?? 4096);
}

// ─── Prompt Compression ───────────────────────────────────────
export function compressPrompt(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^ +/gm, "")
    .replace(/ +$/gm, "")
    .trim();
}

export function compactGarment(g: {
  id: string;
  title: string;
  category: string;
  color_primary: string;
  material?: string | null;
  formality?: number | null;
  subcategory?: string | null;
}): string {
  const parts = [
    g.id.slice(0, 8),
    g.title,
    g.subcategory || g.category,
    g.color_primary,
  ];
  if (g.material) parts.push(g.material);
  if (g.formality != null) parts.push(`f${g.formality}`);
  return parts.join("|");
}

// ─── DB Cache ─────────────────────────────────────────────────

// ─── Request Deduplication ────────────────────────────────────
const IN_FLIGHT = new Map<string, Promise<BursAIResponse>>();

// ─── Hashing ──────────────────────────────────────────────────
async function hashKey(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── DB Cache (Tier 2) ────────────────────────────────────────
async function checkCache(supabase: any, cacheKey: string): Promise<any | null> {
  try {
    const { data } = await supabase
      .from("ai_response_cache")
      .select("response, model_used")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      // Bump hit_count and extend TTL (sliding window) — fire and forget
      supabase
        .from("ai_response_cache")
        .update({
          hit_count: data.hit_count ? data.hit_count + 1 : 1,
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        })
        .eq("cache_key", cacheKey)
        .then(() => {});
    }
    return data;
  } catch {
    return null;
  }
}

async function storeCache(
  supabase: any, cacheKey: string, response: any, modelUsed: string, ttlSeconds: number
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await supabase.from("ai_response_cache").upsert(
      {
        cache_key: cacheKey,
        response,
        model_used: modelUsed,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
        hit_count: 0,
        compressed: false,
      },
      { onConflict: "cache_key" }
    );
  } catch (e) {
    console.warn("BURS AI cache store failed:", e);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Observability (fire-and-forget) ──────────────────────────
function logUsage(
  supabase: any | null,
  opts: {
    functionName?: string;
    model_used: string;
    latency_ms: number;
    from_cache: boolean;
    status: "ok" | "error";
    error_message?: string;
  }
): void {
  if (!supabase) return;
  try {
    supabase
      .from("analytics_events")
      .insert({
        event_type: "ai_usage",
        metadata: {
          fn: opts.functionName || "unknown",
          model: opts.model_used,
          latency_ms: opts.latency_ms,
          cached: opts.from_cache,
          status: opts.status,
          ...(opts.error_message ? { error: opts.error_message } : {}),
        },
      })
      .then(() => {});
  } catch {
    // Never block on observability
  }
}

// ─── Core AI Call ─────────────────────────────────────────────
function resolveModelChain(options: BursAIOptions): string[] {
  if (options.models) return options.models;
  if (options.complexity) return COMPLEXITY_CHAINS[options.complexity];
  return MODEL_CHAINS[options.modelType || "default"] || MODEL_CHAINS.default;
}

function resolveMaxTokens(options: BursAIOptions): number | undefined {
  if (options.max_tokens) return options.max_tokens;
  if (options.complexity) return DEFAULT_MAX_TOKENS[options.complexity];
  return undefined;
}

function resolveTemperature(options: BursAIOptions): number | undefined {
  // Explicit temperature in extraBody takes precedence
  if (options.extraBody?.temperature != null) return undefined; // already set
  if (options.complexity) return DEFAULT_TEMPERATURE[options.complexity];
  return undefined;
}

export async function callBursAI(
  options: BursAIOptions,
  supabaseServiceClient?: any
): Promise<BursAIResponse> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new BursAIError("LOVABLE_API_KEY not configured", 500);

  const startTime = Date.now();
  const {
    messages, tools, tool_choice, stream = false,
    cacheTtlSeconds = 0, cacheNamespace = "",
    extraBody = {},
  } = options;

  const modelChain = resolveModelChain(options);
  const maxTokens = resolveMaxTokens(options);
  const temperature = resolveTemperature(options);
  const timeout = options.timeout ?? 30000;

  // ── Build cache key ──
  const cacheInput = JSON.stringify({ ns: cacheNamespace, messages, tools });
  let cacheKey = "";

  if ((cacheTtlSeconds > 0 || !stream) && !stream) {
    cacheKey = await hashKey(cacheInput);

    // Tier 1: in-memory cache removed — Edge Function isolates are
    // stateless, so in-memory Maps reset on every cold start.

    // DB cache
    if (cacheTtlSeconds > 0 && supabaseServiceClient) {
      const cached = await checkCache(supabaseServiceClient, cacheKey);
      if (cached) {
        logUsage(supabaseServiceClient, {
          functionName: options.functionName, model_used: cached.model_used,
          latency_ms: Date.now() - startTime, from_cache: true, status: "ok",
        });
        return { data: cached.response, model_used: cached.model_used, from_cache: true };
      }
    }

    // ── Request deduplication ──
    if (cacheTtlSeconds > 0) {
      const existing = IN_FLIGHT.get(cacheKey);
      if (existing) {
        return existing;
      }
    }
  }

  // Shared fetch logic for a single model attempt against a given endpoint
  async function tryModel(
    url: string,
    authHeader: Record<string, string>,
    model: string,
    body: any,
    timeout: number,
  ): Promise<{ resp: Response } | { retry: true } | { error: Error; fatal?: boolean }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, model }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (resp.status === 429) {
        const retryAfter = parseInt(resp.headers.get("Retry-After") || "2");
        await resp.text();
        await sleep(retryAfter * 1000);
        return { retry: true };
      }
      if (resp.status === 402) {
        await resp.text();
        return { error: new BursAIError("AI credits exhausted. Please add funds.", 402), fatal: true };
      }
      if (resp.status >= 500) {
        await resp.text();
        return { error: new BursAIError(`AI server error: ${resp.status}`, resp.status) };
      }
      if (!resp.ok) {
        const txt = await resp.text();
        return { error: new BursAIError(`AI error ${resp.status}: ${txt}`, resp.status) };
      }
      return { resp };
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof BursAIError && e.status === 402) return { error: e, fatal: true };
      if (e instanceof DOMException && e.name === "AbortError") {
        return { error: new Error(`Model ${model} timed out`) };
      }
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  function buildBody(): any {
    const body: any = { messages, ...extraBody };
    if (tools) body.tools = tools;
    if (tool_choice) body.tool_choice = tool_choice;
    if (stream) body.stream = true;
    if (maxTokens) body.max_tokens = maxTokens;
    if (temperature != null && !extraBody.temperature) body.temperature = temperature;
    return body;
  }

  function parseResult(aiData: any): any {
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let result: any;
    if (toolCall?.function?.arguments) {
      try { result = JSON.parse(toolCall.function.arguments); }
      catch { return { __parseError: true }; }
    } else if (aiData.choices?.[0]?.message?.content !== undefined) {
      result = aiData.choices[0].message.content;
    } else {
      result = aiData;
    }
    const images = aiData.choices?.[0]?.message?.images;
    if (images) result = { __raw: aiData, content: result, images };
    return result;
  }

  const executeCall = async (): Promise<BursAIResponse> => {
    let lastError: Error | null = null;
    let gatewayHad5xxOrTimeout = false;
    const body = buildBody();

    // ── Phase 1: Lovable Gateway ──
    for (const model of modelChain) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const outcome = await tryModel(
          GATEWAY_URL,
          { Authorization: `Bearer ${apiKey}` },
          model, body, timeout,
        );

        if ("fatal" in outcome && outcome.fatal) throw (outcome as any).error;
        if ("retry" in outcome) continue;
        if ("error" in outcome) {
          const err = outcome.error;
          if (err instanceof BursAIError && err.status >= 500) gatewayHad5xxOrTimeout = true;
          if (err.message.includes("timed out")) gatewayHad5xxOrTimeout = true;
          lastError = err;
          if (attempt === 0) { await sleep(500); continue; }
          break;
        }

        // Success
        const resp = outcome.resp;
        if (stream) return { data: resp, model_used: model, from_cache: false };

        const aiData = await resp.json();
        const result = parseResult(aiData);
        if (result?.__parseError) { lastError = new Error("Failed to parse AI tool call response"); break; }

        if (cacheTtlSeconds > 0 && cacheKey) {
          if (supabaseServiceClient) storeCache(supabaseServiceClient, cacheKey, result, model, cacheTtlSeconds);
        }
        logUsage(supabaseServiceClient, {
          functionName: options.functionName, model_used: model,
          latency_ms: Date.now() - startTime, from_cache: false, status: "ok",
        });
        return { data: result, model_used: model, from_cache: false };
      }
    }

    // ── Phase 2: Google AI Studio direct fallback ──
    const googleApiKey = Deno.env.get("GOOGLE_API_KEY");
    const googleModels = modelChain.filter((m) => m.startsWith("google/"));

    if (gatewayHad5xxOrTimeout && googleApiKey && googleModels.length > 0) {
      console.log("BURS AI: Lovable gateway failed with 5xx/timeout, falling back to Google AI Studio");

      for (const model of googleModels) {
        const directModel = model.replace(/^google\//, "");
        for (let attempt = 0; attempt < 2; attempt++) {
          const outcome = await tryModel(
            GOOGLE_DIRECT_URL,
            { Authorization: `Bearer ${googleApiKey}` },
            directModel, body, timeout,
          );

          if ("fatal" in outcome && outcome.fatal) throw (outcome as any).error;
          if ("retry" in outcome) continue;
          if ("error" in outcome) {
            lastError = outcome.error;
            if (attempt === 0) { await sleep(500); continue; }
            break;
          }

          const resp = outcome.resp;
          const usedModel = `google/${directModel} (direct)`;
          if (stream) return { data: resp, model_used: usedModel, from_cache: false };

          const aiData = await resp.json();
          const result = parseResult(aiData);
          if (result?.__parseError) { lastError = new Error("Failed to parse AI tool call response"); break; }

          if (cacheTtlSeconds > 0 && cacheKey) {
            memSet(cacheKey, result, usedModel);
            if (supabaseServiceClient) storeCache(supabaseServiceClient, cacheKey, result, usedModel, cacheTtlSeconds);
          }
          logUsage(supabaseServiceClient, {
            functionName: options.functionName, model_used: usedModel,
            latency_ms: Date.now() - startTime, from_cache: false, status: "ok",
          });
          return { data: result, model_used: usedModel, from_cache: false };
        }
      }
    }

    logUsage(supabaseServiceClient, {
      functionName: options.functionName, model_used: modelChain[0] || "unknown",
      latency_ms: Date.now() - startTime, from_cache: false, status: "error",
      error_message: lastError?.message,
    });

    throw lastError || new BursAIError("All AI models failed", 503);
  };

  // Dedup wrapper
  if (cacheKey && cacheTtlSeconds > 0) {
    const promise = executeCall();
    IN_FLIGHT.set(cacheKey, promise);
    try {
      const result = await promise;
      return result;
    } finally {
      IN_FLIGHT.delete(cacheKey);
    }
  }

  return executeCall();
}

/**
 * Call BURS AI for streaming responses (style_chat, shopping_chat).
 * Returns a Response with keepalive pings and abort detection.
 */
export async function streamBursAI(
  options: Omit<BursAIOptions, "stream" | "tools" | "tool_choice" | "cacheTtlSeconds">
): Promise<Response> {
  const result = await callBursAI({
    ...options,
    stream: true,
    complexity: options.complexity || "standard",
    max_tokens: options.max_tokens || 1000,
  });

  const upstreamResponse = result.data as Response;
  const upstreamBody = upstreamResponse.body;
  if (!upstreamBody) return upstreamResponse;

  // Wrap with keepalive pings every 15s
  const reader = upstreamBody.getReader();
  let keepaliveInterval: number | undefined;
  let aborted = false;

  const stream = new ReadableStream({
    start(controller) {
      keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": keepalive\n\n"));
        } catch {
          aborted = true;
          clearInterval(keepaliveInterval);
        }
      }, 15000) as unknown as number;
    },
    async pull(controller) {
      if (aborted) { controller.close(); return; }
      try {
        const { done, value } = await reader.read();
        if (done) {
          clearInterval(keepaliveInterval);
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch {
        clearInterval(keepaliveInterval);
        controller.close();
      }
    },
    cancel() {
      clearInterval(keepaliveInterval);
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: upstreamResponse.headers,
  });
}

/**
 * Helper: standard CORS error response for BursAIError
 */
export function bursAIErrorResponse(e: unknown, corsHeaders: Record<string, string>): Response {
  if (e instanceof BursAIError) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  console.error("BURS AI error:", e);
  return new Response(
    JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
