/**
 * BURS AI — Unified AI abstraction layer v3
 *
 * Features: complexity-based model routing, prompt compression,
 * two-tier caching (in-memory + DB), request deduplication,
 * token budgets, temperature defaults, observability logging,
 * streaming keepalive, retry with backoff, rate limit handling.
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

// ─── In-Memory Cache (Tier 1) ─────────────────────────────────
const MEM_CACHE = new Map<string, { data: any; model_used: string; expires: number }>();
const MEM_TTL_MS = 30_000;
const MEM_MAX_SIZE = 50;

function memGet(key: string): { data: any; model_used: string } | null {
  const entry = MEM_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    MEM_CACHE.delete(key);
    return null;
  }
  return { data: entry.data, model_used: entry.model_used };
}

function memSet(key: string, data: any, model_used: string): void {
  if (MEM_CACHE.size >= MEM_MAX_SIZE) {
    const firstKey = MEM_CACHE.keys().next().value;
    if (firstKey) MEM_CACHE.delete(firstKey);
  }
  MEM_CACHE.set(key, { data, model_used, expires: Date.now() + MEM_TTL_MS });
}

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

    // Tier 1: in-memory
    if (cacheTtlSeconds > 0) {
      const memHit = memGet(cacheKey);
      if (memHit) {
        logUsage(supabaseServiceClient, {
          functionName: options.functionName, model_used: memHit.model_used,
          latency_ms: Date.now() - startTime, from_cache: true, status: "ok",
        });
        return { data: memHit.data, model_used: memHit.model_used, from_cache: true };
      }
    }

    // Tier 2: DB cache
    if (cacheTtlSeconds > 0 && supabaseServiceClient) {
      const cached = await checkCache(supabaseServiceClient, cacheKey);
      if (cached) {
        memSet(cacheKey, cached.response, cached.model_used);
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

  const executeCall = async (): Promise<BursAIResponse> => {
    let lastError: Error | null = null;

    for (const model of modelChain) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeout);

          const body: any = { model, messages, ...extraBody };
          if (tools) body.tools = tools;
          if (tool_choice) body.tool_choice = tool_choice;
          if (stream) body.stream = true;
          if (maxTokens) body.max_tokens = maxTokens;
          if (temperature != null && !extraBody.temperature) body.temperature = temperature;

          const resp = await fetch(GATEWAY_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          clearTimeout(timer);

          if (resp.status === 429) {
            const retryAfter = parseInt(resp.headers.get("Retry-After") || "2");
            await resp.text();
            if (attempt === 0) { await sleep(retryAfter * 1000); continue; }
            lastError = new BursAIError("Rate limited", 429);
            break;
          }

          if (resp.status === 402) {
            await resp.text();
            throw new BursAIError("AI credits exhausted. Please add funds.", 402);
          }

          if (resp.status >= 500) {
            await resp.text();
            if (attempt === 0) { await sleep(1000); continue; }
            lastError = new BursAIError(`AI server error: ${resp.status}`, resp.status);
            break;
          }

          if (!resp.ok) {
            const txt = await resp.text();
            lastError = new BursAIError(`AI error ${resp.status}: ${txt}`, resp.status);
            break;
          }

          // Streaming — return raw response
          if (stream) {
            return { data: resp, model_used: model, from_cache: false };
          }

          const aiData = await resp.json();

          // Extract tool call result if present
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          let result: any;
          if (toolCall?.function?.arguments) {
            try { result = JSON.parse(toolCall.function.arguments); }
            catch { lastError = new Error("Failed to parse AI tool call response"); break; }
          } else if (aiData.choices?.[0]?.message?.content !== undefined) {
            result = aiData.choices[0].message.content;
          } else {
            result = aiData;
          }

          // Expose images if present (for image generation)
          const images = aiData.choices?.[0]?.message?.images;
          if (images) {
            result = { __raw: aiData, content: result, images };
          }

          // Store in caches
          if (cacheTtlSeconds > 0 && cacheKey) {
            memSet(cacheKey, result, model);
            if (supabaseServiceClient) {
              storeCache(supabaseServiceClient, cacheKey, result, model, cacheTtlSeconds);
            }
          }

          logUsage(supabaseServiceClient, {
            functionName: options.functionName, model_used: model,
            latency_ms: Date.now() - startTime, from_cache: false, status: "ok",
          });

          return { data: result, model_used: model, from_cache: false };
        } catch (e) {
          if (e instanceof BursAIError && e.status === 402) throw e;
          if (e instanceof DOMException && e.name === "AbortError") {
            lastError = new Error(`Model ${model} timed out`);
            break;
          }
          lastError = e instanceof Error ? e : new Error(String(e));
          if (attempt === 0) { await sleep(500); continue; }
          break;
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
