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

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// ─── Complexity-based model routing ───────────────────────────
type Complexity = "trivial" | "standard" | "complex";

const COMPLEXITY_CHAINS: Record<Complexity, string[]> = {
  trivial: [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
  ],
  standard: [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
  ],
  complex: [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
  ],
};

// Legacy model type chains (backward compat)
const MODEL_CHAINS: Record<string, string[]> = {
  default: COMPLEXITY_CHAINS.standard,
  vision: COMPLEXITY_CHAINS.complex,
  "image-gen": [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
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
  finish_reason?: string;
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
    input_tokens?: number;
    output_tokens?: number;
    estimated_cost_usd?: number;
    complexity?: string;
    retry_count?: number;
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
          ...(opts.input_tokens != null ? { input_tokens: opts.input_tokens } : {}),
          ...(opts.output_tokens != null ? { output_tokens: opts.output_tokens } : {}),
          ...(opts.estimated_cost_usd != null ? { cost_usd: opts.estimated_cost_usd } : {}),
          ...(opts.complexity ? { complexity: opts.complexity } : {}),
          ...(opts.retry_count != null ? { retries: opts.retry_count } : {}),
        },
      })
      .then(() => {});
  } catch {
    // Never block on observability
  }
}

// ─── Cost Estimation ─────────────────────────────────────────
const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash":      { input: 0.15, output: 0.60 },
  "gemini-2.5-flash-lite": { input: 0.075, output: 0.30 },
};

function extractUsageAndCost(aiData: any, model: string) {
  const usage = aiData?.usage;
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const rates = COST_PER_MILLION[model] || COST_PER_MILLION["gemini-2.5-flash"];
  const estimatedCostUsd = (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
  return { inputTokens, outputTokens, estimatedCostUsd };
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
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new BursAIError("GEMINI_API_KEY not configured", 500);

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
      const rawContent = typeof aiData.choices[0].message.content === "string"
        ? aiData.choices[0].message.content.trim()
        : "";
      if (rawContent.startsWith("{") || rawContent.startsWith("[")) {
        try {
          result = JSON.parse(rawContent);
          console.warn("burs-ai: tool_call returned as content, parsed as JSON fallback");
        } catch {
          result = aiData.choices[0].message.content;
        }
      } else {
        result = aiData.choices[0].message.content;
      }
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

    // ── Phase 1: Google Gemini ──
    for (const model of modelChain) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const outcome = await tryModel(
          GEMINI_URL,
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
        let result = parseResult(aiData);
        if (result?.__parseError) { lastError = new Error("Failed to parse AI tool call response"); break; }

        let finishReason = aiData.choices?.[0]?.finish_reason as string | undefined;

        // If response was truncated by token limit, retry once with more tokens
        if (finishReason === "length" && attempt === 0 && !stream) {
          console.warn(`burs-ai: response truncated (finish_reason=length), retrying with more tokens [${options.functionName}]`);
          const retryBody = { ...body, max_tokens: Math.min(Math.round((maxTokens || 600) * 1.5), 2000) };
          const retryOutcome = await tryModel(
            GEMINI_URL,
            { Authorization: `Bearer ${apiKey}` },
            model, retryBody, timeout,
          );
          if (!("error" in retryOutcome) && !("retry" in retryOutcome)) {
            const retryData = await retryOutcome.resp.json();
            const retryResult = parseResult(retryData);
            if (!retryResult?.__parseError) {
              result = retryResult;
              finishReason = retryData.choices?.[0]?.finish_reason as string | undefined;
            }
          }
        }

        if (cacheTtlSeconds > 0 && cacheKey) {
          if (supabaseServiceClient) storeCache(supabaseServiceClient, cacheKey, result, model, cacheTtlSeconds);
        }
        const costInfo = extractUsageAndCost(aiData, model);
        logUsage(supabaseServiceClient, {
          functionName: options.functionName, model_used: model,
          latency_ms: Date.now() - startTime, from_cache: false, status: "ok",
          input_tokens: costInfo.inputTokens,
          output_tokens: costInfo.outputTokens,
          estimated_cost_usd: costInfo.estimatedCostUsd,
          complexity: options.complexity,
          retry_count: attempt,
        });
        return { data: result, model_used: model, from_cache: false, finish_reason: finishReason };
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
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          aborted = true;
          clearInterval(keepaliveInterval);
        }
      }, 15000) as unknown as number;
    },
    async pull(controller) {
      if (aborted) { controller.close(); return; }
      try {
        const result = await Promise.race([
          reader.read(),
          new Promise<{ done: true; value?: Uint8Array }>((resolve) => {
            setTimeout(() => resolve({ done: true }), 45000);
          }),
        ]);
        const { done, value } = result;
        if (done) {
          clearInterval(keepaliveInterval);
          try {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch {
            // ignore enqueue failures during shutdown
          }
          controller.close();
          await reader.cancel();
          return;
        }
        controller.enqueue(value);
      } catch {
        clearInterval(keepaliveInterval);
        try {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch {
          // ignore enqueue failures during shutdown
        }
        controller.close();
        try { await reader.cancel(); } catch { /* ignore */ }
      }
    },
    async cancel() {
      clearInterval(keepaliveInterval);
      await reader.cancel();
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

// ─── Rate Limiting ────────────────────────────────────────────
/**
 * Check and enforce per-user rate limits for AI functions.
 * @param supabaseAdmin - Supabase client with service role
 * @param userId - The user's ID
 * @param functionName - Edge function name
 * @param maxPerHour - Max calls per hour (default 30)
 * @returns true if allowed, throws BursAIError if rate limited
 */
export async function checkRateLimit(
  supabaseAdmin: any,
  userId: string,
  functionName: string,
  maxPerHour = 30
): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Count recent calls
  const { count, error: countError } = await supabaseAdmin
    .from("ai_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("function_name", functionName)
    .gte("called_at", oneHourAgo);

  if (countError) {
    console.warn("Rate limit check failed:", countError.message);
    // Fail open — don't block users if the check fails
    return true;
  }

  if ((count ?? 0) >= maxPerHour) {
    throw new BursAIError(
      `Rate limit exceeded. Maximum ${maxPerHour} calls per hour for ${functionName}.`,
      429
    );
  }

  // Record this call
  await supabaseAdmin
    .from("ai_rate_limits")
    .insert({ user_id: userId, function_name: functionName });

  // Periodic cleanup (1% chance per request)
  if (Math.random() < 0.01) {
    await supabaseAdmin.rpc("cleanup_old_rate_limits").catch(() => {});
  }

  return true;
}
