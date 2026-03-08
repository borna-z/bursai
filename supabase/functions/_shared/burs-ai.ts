/**
 * BURS AI — Unified AI abstraction layer
 * 
 * All edge functions use this module instead of calling AI models directly.
 * Provides: multi-model fallback, retry with backoff, rate limit handling,
 * timeout protection, and response caching.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Model fallback chain — tried in order
const DEFAULT_MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
];

const VISION_MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash-lite",
];

const IMAGE_GEN_MODELS = [
  "google/gemini-3-pro-image-preview",
  "google/gemini-2.5-flash-image",
];

export interface BursAIOptions {
  messages: Array<{ role: string; content: any }>;
  tools?: any[];
  tool_choice?: any;
  stream?: boolean;
  /** Override model chain. Use "vision" for image inputs, "image-gen" for generation */
  modelType?: "default" | "vision" | "image-gen";
  /** Specific models to try (overrides modelType) */
  models?: string[];
  /** Timeout per model attempt in ms (default 30000) */
  timeout?: number;
  /** Cache TTL in seconds. 0 = no cache. Default 0 */
  cacheTtlSeconds?: number;
  /** Unique cache namespace to prevent collisions between functions */
  cacheNamespace?: string;
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
async function checkCache(
  supabase: any,
  cacheKey: string
): Promise<any | null> {
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
  supabase: any,
  cacheKey: string,
  response: any,
  modelUsed: string,
  ttlSeconds: number
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
      },
      { onConflict: "cache_key" }
    );
  } catch (e) {
    console.warn("BURS AI cache store failed:", e);
  }
}

/** Sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call BURS AI with automatic fallback, retry, caching, and error handling.
 * 
 * @param options - AI call configuration
 * @param supabaseServiceClient - Optional supabase client for caching (service role)
 * @returns BursAIResponse with data, model used, and cache status
 */
export async function callBursAI(
  options: BursAIOptions,
  supabaseServiceClient?: any
): Promise<BursAIResponse> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new BursAIError("LOVABLE_API_KEY not configured", 500);

  const {
    messages,
    tools,
    tool_choice,
    stream = false,
    modelType = "default",
    models: customModels,
    timeout = 30000,
    cacheTtlSeconds = 0,
    cacheNamespace = "",
  } = options;

  // Determine model chain
  const modelChain = customModels ??
    (modelType === "vision" ? VISION_MODELS :
     modelType === "image-gen" ? IMAGE_GEN_MODELS :
     DEFAULT_MODELS);

  // Check cache if enabled
  if (cacheTtlSeconds > 0 && supabaseServiceClient) {
    const cacheInput = JSON.stringify({ ns: cacheNamespace, messages, tools });
    const cacheKey = await hashKey(cacheInput);
    const cached = await checkCache(supabaseServiceClient, cacheKey);
    if (cached) {
      return {
        data: cached.response,
        model_used: cached.model_used,
        from_cache: true,
      };
    }
  }

  let lastError: Error | null = null;

  for (const model of modelChain) {
    // Try each model with 1 retry on 5xx
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const body: any = { model, messages };
        if (tools) body.tools = tools;
        if (tool_choice) body.tool_choice = tool_choice;
        if (stream) body.stream = true;

        const resp = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timer);

        // Rate limit — backoff and try next model
        if (resp.status === 429) {
          const retryAfter = parseInt(resp.headers.get("Retry-After") || "2");
          await resp.text(); // consume body
          if (attempt === 0) {
            await sleep(retryAfter * 1000);
            continue;
          }
          lastError = new BursAIError("Rate limited", 429);
          break; // try next model
        }

        // Credits exhausted — no point trying other models
        if (resp.status === 402) {
          await resp.text();
          throw new BursAIError("AI credits exhausted. Please add funds.", 402);
        }

        // Server error — retry once
        if (resp.status >= 500) {
          await resp.text();
          if (attempt === 0) {
            await sleep(1000);
            continue;
          }
          lastError = new BursAIError(`AI server error: ${resp.status}`, resp.status);
          break; // try next model
        }

        if (!resp.ok) {
          const txt = await resp.text();
          lastError = new BursAIError(`AI error ${resp.status}: ${txt}`, resp.status);
          break; // try next model
        }

        // Streaming — return raw response
        if (stream) {
          return {
            data: resp,
            model_used: model,
            from_cache: false,
          };
        }

        // Parse response
        const aiData = await resp.json();

        // Extract tool call result if present
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        let result: any;
        if (toolCall?.function?.arguments) {
          try {
            result = JSON.parse(toolCall.function.arguments);
          } catch {
            lastError = new Error("Failed to parse AI tool call response");
            break;
          }
        } else if (aiData.choices?.[0]?.message?.content) {
          result = aiData.choices[0].message.content;
        } else {
          result = aiData;
        }

        // Cache if enabled
        if (cacheTtlSeconds > 0 && supabaseServiceClient) {
          const cacheInput = JSON.stringify({ ns: cacheNamespace, messages, tools });
          const cacheKey = await hashKey(cacheInput);
          // Fire and forget
          storeCache(supabaseServiceClient, cacheKey, result, model, cacheTtlSeconds);
        }

        return {
          data: result,
          model_used: model,
          from_cache: false,
        };
      } catch (e) {
        if (e instanceof BursAIError && e.status === 402) throw e;
        if (e instanceof DOMException && e.name === "AbortError") {
          lastError = new Error(`Model ${model} timed out`);
          break; // try next model
        }
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt === 0) {
          await sleep(500);
          continue;
        }
        break;
      }
    }
  }

  // All models failed
  throw lastError || new BursAIError("All AI models failed", 503);
}

/**
 * Call BURS AI for streaming responses (style_chat, shopping_chat).
 * Returns the raw Response object to pipe back to client.
 */
export async function streamBursAI(
  options: Omit<BursAIOptions, "stream" | "tools" | "tool_choice" | "cacheTtlSeconds">
): Promise<Response> {
  const result = await callBursAI({ ...options, stream: true });
  return result.data as Response;
}
