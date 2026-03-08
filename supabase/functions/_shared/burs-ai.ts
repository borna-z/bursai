/**
 * BURS AI — Unified AI abstraction layer
 * 
 * All edge functions use this module instead of calling AI models directly.
 * Provides: multi-model fallback, retry with backoff, rate limit handling,
 * timeout protection, and response caching.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Model fallback chains by type
const MODEL_CHAINS: Record<string, string[]> = {
  default: [
    "google/gemini-3-flash-preview",
    "google/gemini-2.5-flash",
    "google/gemini-2.5-flash-lite",
  ],
  vision: [
    "google/gemini-2.5-flash",
    "google/gemini-2.5-pro",
    "google/gemini-2.5-flash-lite",
  ],
  "image-gen": [
    "google/gemini-3-pro-image-preview",
    "google/gemini-2.5-flash-image",
  ],
  fast: [
    "google/gemini-2.5-flash-lite",
    "google/gemini-2.5-flash",
    "google/gemini-3-flash-preview",
  ],
  streaming: [
    "google/gemini-3-flash-preview",
    "google/gemini-2.5-flash",
    "google/gemini-2.5-flash-lite",
  ],
};

export interface BursAIOptions {
  messages: Array<{ role: string; content: any }>;
  tools?: any[];
  tool_choice?: any;
  stream?: boolean;
  /** Model chain type: "default" | "vision" | "image-gen" | "fast" | "streaming" */
  modelType?: string;
  /** Specific models to try (overrides modelType) */
  models?: string[];
  /** Timeout per model attempt in ms (default 30000) */
  timeout?: number;
  /** Cache TTL in seconds. 0 = no cache. Default 0 */
  cacheTtlSeconds?: number;
  /** Unique cache namespace to prevent collisions between functions */
  cacheNamespace?: string;
  /** Extra body params like max_tokens, temperature, modalities */
  extraBody?: Record<string, any>;
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

/** Simple hash for cache keys */
async function hashKey(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Check cache for existing response */
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
    return data;
  } catch {
    return null;
  }
}

/** Store response in cache */
async function storeCache(
  supabase: any, cacheKey: string, response: any, modelUsed: string, ttlSeconds: number
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await supabase.from("ai_response_cache").upsert(
      { cache_key: cacheKey, response, model_used: modelUsed, created_at: new Date().toISOString(), expires_at: expiresAt },
      { onConflict: "cache_key" }
    );
  } catch (e) {
    console.warn("BURS AI cache store failed:", e);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call BURS AI with automatic fallback, retry, caching, and error handling.
 */
export async function callBursAI(
  options: BursAIOptions,
  supabaseServiceClient?: any
): Promise<BursAIResponse> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new BursAIError("LOVABLE_API_KEY not configured", 500);

  const {
    messages, tools, tool_choice, stream = false,
    modelType = "default", models: customModels,
    timeout = 30000, cacheTtlSeconds = 0, cacheNamespace = "",
    extraBody = {},
  } = options;

  const modelChain = customModels ?? (MODEL_CHAINS[modelType] || MODEL_CHAINS.default);

  // Check cache if enabled
  if (cacheTtlSeconds > 0 && supabaseServiceClient && !stream) {
    const cacheInput = JSON.stringify({ ns: cacheNamespace, messages, tools });
    const cacheKey = await hashKey(cacheInput);
    const cached = await checkCache(supabaseServiceClient, cacheKey);
    if (cached) {
      return { data: cached.response, model_used: cached.model_used, from_cache: true };
    }
  }

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

        // Also expose images if present (for image generation)
        const images = aiData.choices?.[0]?.message?.images;
        if (images) {
          result = { __raw: aiData, content: result, images };
        }

        // Cache if enabled
        if (cacheTtlSeconds > 0 && supabaseServiceClient) {
          const cacheInput = JSON.stringify({ ns: cacheNamespace, messages, tools });
          const cacheKey = await hashKey(cacheInput);
          storeCache(supabaseServiceClient, cacheKey, result, model, cacheTtlSeconds);
        }

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

  throw lastError || new BursAIError("All AI models failed", 503);
}

/**
 * Call BURS AI for streaming responses (style_chat, shopping_chat).
 * Returns the raw Response to pipe back to client.
 */
export async function streamBursAI(
  options: Omit<BursAIOptions, "stream" | "tools" | "tool_choice" | "cacheTtlSeconds">
): Promise<Response> {
  const result = await callBursAI({ ...options, stream: true, modelType: options.modelType || "streaming" });
  return result.data as Response;
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
