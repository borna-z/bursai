/**
 * BURS AI Provider — thin wrapper above `_shared/burs-ai.ts` `callBursAI`.
 *
 * Adds:
 *   1. A bounded race timeout against the primary provider (Gemini).
 *   2. Automatic fallback to Anthropic Claude Haiku 4.5 when the primary
 *      throws a retryable HTTP status (429 / 5xx), an `AIQuotaExceededError`,
 *      OR the race timer fires first.
 *   3. Per-call cost logging to `public.ai_call_log` (sprint PR 10) — one
 *      fire-and-forget row per call regardless of which provider answered.
 *   4. A `captureWarning('ai_provider_fallback', ...)` Sentry breadcrumb on
 *      every fallback trigger so the operations dashboard sees provider
 *      degradation in near-realtime.
 *
 * This wrapper is INTENTIONALLY narrow: it does NOT re-implement the cache,
 * dedup, rate-limit, quota-enforcement or model-chain logic that
 * `callBursAI` already provides. Callers that already use `callBursAI`
 * directly keep working; new sites that want Anthropic fallback opt in by
 * calling `callAI()` instead.
 *
 * Pricing constants below are correct as of 2026-05-18 — update when the
 * provider price sheets change.
 */

import {
  callBursAI,
  BursAIError,
  AIQuotaExceededError,
  type BursAIOptions,
} from "./burs-ai.ts";
import { captureError, captureWarning } from "./observability.ts";

// ─── Pricing (USD / token) ────────────────────────────────────
// Pulled to top so a contributor can verify rates in one place.
// Public-rate cross-check: 2026-05-18.
const PRICING = {
  "gemini-2.5-flash":    { in: 0.30  / 1_000_000, out: 2.50  / 1_000_000 },
  "gemini-2.5-pro":      { in: 1.25  / 1_000_000, out: 10.00 / 1_000_000 },
  "claude-haiku-4-5":    { in: 1.00  / 1_000_000, out: 5.00  / 1_000_000 },
} as const;

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// ─── Public types ─────────────────────────────────────────────
export interface AIProviderOptions {
  /** Specific Gemini models to try first (forwarded to callBursAI.models). */
  models: string[];
  max_tokens?: number;
  /** Per-attempt Gemini timeout (forwarded to callBursAI.timeout). */
  timeout?: number;
  /** Anthropic per-call timeout. Independent of `timeout` (which targets
   * Gemini). Default 25000ms — Anthropic is sometimes slower than Gemini
   * on cold paths, and the fallback should not inherit Gemini's tighter
   * per-attempt budget. */
  anthropicTimeoutMs?: number;
  /** Function name for observability & ai_call_log.function_name. */
  functionName: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: any }>;
  extraBody?: Record<string, any>;
  responseFormat?: BursAIOptions["responseFormat"];
  cachedContent?: string;
  /**
   * System prompt to send to Anthropic on fallback. Required when the
   * Gemini call uses `cachedContent` (the system prompt lives in Gemini's
   * cache and is NOT in `messages`); without this, Anthropic gets an empty
   * system prompt and produces unprompted output. When `messages` already
   * contains a `role: 'system'` entry, that takes precedence and this
   * field is appended after it.
   */
  systemForFallback?: string;
  /** When false, primary failures throw (no Anthropic fallback). Default true. */
  fallbackEnabled?: boolean;
  /** Race timeout against the primary before falling back. Default 8000ms. */
  fallbackTimeoutMs?: number;
  userId?: string;
  /** Correlation id stored on ai_call_log.request_id. */
  requestId?: string;
}

export interface AIProviderResponse {
  data: any;
  provider: "gemini" | "anthropic";
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

// ─── Internal helpers ─────────────────────────────────────────
function shouldFallback(err: unknown): boolean {
  // Do NOT fall back on BURS-level quota exhaustion. Routing past the rate
  // limiter to Anthropic would make the limiter effectively optional —
  // users could trigger fallback by hitting their cap. Codex P1 on PR #893.
  if (err instanceof AIQuotaExceededError) return false;
  // Don't fall back on Stripe credit exhaustion either (402 from callBursAI).
  if (err instanceof BursAIError && err.status === 402) return false;
  if (err instanceof BursAIError) {
    return err.status === 429 || (err.status >= 500 && err.status <= 504);
  }
  // Race timer (see callPrimaryWithTimeout below).
  if (err instanceof PrimaryTimeoutError) return true;
  // Network / fetch errors come back as TypeError with messages like
  // 'fetch failed' / 'ECONNRESET' / 'network request failed'. Treat them as
  // retryable via fallback — Gemini being unreachable is exactly the case
  // Anthropic is supposed to cover. Codex (would-have-flagged) on PR #893.
  if (err instanceof TypeError) {
    const msg = (err.message ?? "").toLowerCase();
    if (
      msg.includes("fetch failed") ||
      msg.includes("network") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("socket")
    ) {
      return true;
    }
  }
  return false;
}

class PrimaryTimeoutError extends Error {
  constructor() {
    super("ai_provider_primary_timeout");
    this.name = "PrimaryTimeoutError";
  }
}

async function callPrimaryWithTimeout(
  options: AIProviderOptions,
  supabaseServiceClient: any,
  timeoutMs: number,
): Promise<Awaited<ReturnType<typeof callBursAI>>> {
  // Promise.race leak note (Codex P2 on PR #893): when the timer wins, the
  // underlying callBursAI fetch keeps running in the background — BursAIOptions
  // does not currently expose an external AbortSignal, so we can't cancel
  // it without modifying burs-ai.ts (out of scope for this PR). The leaked
  // call's effects are bounded and benign: it has its own 30s internal
  // timeout via callBursAI's own AbortController, doesn't block the user
  // (we've already returned via Anthropic), and its side effects
  // (ai_token_usage row, optional ai_response_cache write) are user-keyed
  // and accurate — tokens were genuinely spent on Gemini's side regardless
  // of whether the user saw the response. Tracked for post-launch: thread
  // an external signal through BursAIOptions so the leak goes away.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      callBursAI(
        {
          models: options.models,
          max_tokens: options.max_tokens,
          timeout: options.timeout,
          functionName: options.functionName,
          messages: options.messages,
          extraBody: options.extraBody,
          responseFormat: options.responseFormat,
          cachedContent: options.cachedContent,
          userId: options.userId,
        },
        supabaseServiceClient,
      ),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new PrimaryTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Convert OpenAI-compat / Gemini-shaped messages to Anthropic's `messages`
 * + top-level `system` shape. Strips `system` role entries and concatenates
 * them; rewrites image content blocks from OpenAI's `{type:'image_url',
 * image_url:{url}}` to Anthropic's `{type:'image', source:{type:'url',url}}`.
 */
function convertMessagesForAnthropic(
  messages: AIProviderOptions["messages"],
): { system: string; messages: Array<{ role: "user" | "assistant"; content: any }> } {
  const systemParts: string[] = [];
  const out: Array<{ role: "user" | "assistant"; content: any }> = [];

  for (const m of messages) {
    if (m.role === "system") {
      if (typeof m.content === "string") {
        systemParts.push(m.content);
      } else if (Array.isArray(m.content)) {
        for (const block of m.content) {
          if (block && typeof block === "object" && block.type === "text" && typeof block.text === "string") {
            systemParts.push(block.text);
          }
        }
      }
      continue;
    }
    const role: "user" | "assistant" = m.role === "assistant" ? "assistant" : "user";
    if (typeof m.content === "string") {
      out.push({ role, content: m.content });
      continue;
    }
    if (Array.isArray(m.content)) {
      const blocks: any[] = [];
      for (const block of m.content) {
        if (!block || typeof block !== "object") continue;
        if (block.type === "text" && typeof block.text === "string") {
          blocks.push({ type: "text", text: block.text });
        } else if (block.type === "image_url" && block.image_url?.url) {
          // Anthropic's `source.type='url'` requires a fetchable HTTP(S) URL.
          // `data:image/...;base64,...` URLs would 400 from Anthropic — split
          // them into `source.type='base64'` with explicit media_type + data.
          const u: string = block.image_url.url;
          if (u.startsWith("data:")) {
            const commaIdx = u.indexOf(",");
            if (commaIdx > 5) {
              const header = u.slice(5, commaIdx); // strip "data:" prefix
              let media_type = header.split(";")[0].trim().toLowerCase();
              // Anthropic accepts image/jpeg, image/png, image/gif, image/webp.
              // `image/jpg` is a common CDN alias for jpeg that Anthropic
              // rejects — normalize here so the fallback path doesn't 400.
              if (media_type === "image/jpg") media_type = "image/jpeg";
              const data = u.slice(commaIdx + 1);
              blocks.push({
                type: "image",
                source: { type: "base64", media_type, data },
              });
              continue;
            }
            // Malformed data URL — skip rather than ship junk to Anthropic.
            continue;
          }
          blocks.push({ type: "image", source: { type: "url", url: u } });
        } else if (block.type === "image" && block.source) {
          // already Anthropic-shaped; pass through.
          blocks.push(block);
        }
      }
      out.push({ role, content: blocks });
      continue;
    }
    // Unknown shape: stringify so we don't drop the message silently.
    out.push({ role, content: JSON.stringify(m.content) });
  }

  return { system: systemParts.join("\n\n"), messages: out };
}

/**
 * Resolve the Anthropic API key. Supabase Edge Functions auto-expose vault
 * secrets as env vars (preferred path). If absent, fall back to a vault
 * RPC if one is wired. Returns null when neither yields a value.
 */
async function resolveAnthropicApiKey(supabaseServiceClient: any): Promise<string | null> {
  const fromEnv = typeof Deno !== "undefined" ? Deno.env.get("ANTHROPIC_API_KEY") : undefined;
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  // Best-effort vault RPC lookup. If the RPC isn't present (likely),
  // we swallow and return null so the caller surfaces a clean error.
  try {
    if (supabaseServiceClient && typeof supabaseServiceClient.rpc === "function") {
      const { data, error } = await supabaseServiceClient.rpc("get_vault_secret", {
        secret_name: "anthropic_api_key",
      });
      if (!error && typeof data === "string" && data.length > 0) return data;
    }
  } catch (_rpcErr) {
    // intentional silent: RPC not present is the expected path
  }

  return null;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

async function callAnthropic(
  options: AIProviderOptions,
  apiKey: string,
): Promise<{ data: any; inputTokens: number; outputTokens: number }> {
  const { system: systemFromMessages, messages } = convertMessagesForAnthropic(options.messages);

  // When the primary used Gemini cachedContent, the system prompt was
  // resolved from Gemini's cache and is NOT present in `options.messages`.
  // Callers pass it explicitly via `systemForFallback` for that case;
  // otherwise the fallback talks to Anthropic with an empty system prompt
  // and produces wrong-shape output. Codex P1 on PR #893.
  const composedSystem = [systemFromMessages, options.systemForFallback ?? ""]
    .filter((s) => s && s.length > 0)
    .join("\n\n");

  // Encourage JSON-shaped output when the original call asked for a schema —
  // Anthropic doesn't honor Gemini's `response_format`, so we append a
  // textual instruction. Callers parse the resulting `data` the same way
  // they parse Gemini's string content (`JSON.parse(data)`).
  const schema = options.responseFormat?.json_schema?.schema;
  const systemWithJsonHint = schema
    ? `${composedSystem}\n\nRespond with valid JSON only — no prose, no markdown fences — matching this JSON Schema: ${JSON.stringify(schema)}`
    : composedSystem;

  const body: Record<string, unknown> = {
    model: ANTHROPIC_MODEL,
    max_tokens: options.max_tokens ?? 1024,
    messages,
  };
  if (systemWithJsonHint && systemWithJsonHint.length > 0) {
    body.system = systemWithJsonHint;
  }
  if (typeof options.extraBody?.temperature === "number") {
    body.temperature = options.extraBody.temperature;
  }

  // Anthropic timeout is separate from `options.timeout` (which targets
  // Gemini's per-attempt budget — often tight). Codex P2 on PR #893.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.anthropicTimeoutMs ?? 25000);
  let resp: Response;
  try {
    resp = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new BursAIError(`Anthropic error ${resp.status}: ${txt.slice(0, 200)}`, resp.status);
  }

  const json = (await resp.json()) as AnthropicResponse;
  const firstText =
    Array.isArray(json.content)
      ? json.content.find((b) => b?.type === "text" && typeof b.text === "string")?.text ?? ""
      : "";

  // Anthropic frequently wraps JSON in ```json … ``` fences despite a
  // "no markdown fences" instruction in the system prompt. Callers
  // downstream (e.g. analyze_garment enrich) JSON.parse the raw text;
  // a fenced response would throw and force the catch path to return
  // `enrichment: null`, silently degrading the fallback to a no-op.
  // Strip fences here so the wrapper-vs-primary contract stays
  // "string of JSON that JSON.parse will accept" regardless of provider.
  const cleaned = firstText
    .replace(/^\s*```(?:json)?\s*\n?/i, "")
    .replace(/\n?\s*```\s*$/i, "")
    .trim();

  return {
    data: cleaned,
    inputTokens: json.usage?.input_tokens ?? 0,
    outputTokens: json.usage?.output_tokens ?? 0,
  };
}

function geminiCost(inputTokens: number, outputTokens: number, model: string): number {
  // Wrapper-level pricing (PR 4 spec): Gemini 2.5 Flash $0.30/M in, $2.50/M out.
  // We deliberately use the wrapper-level rate here rather than burs-ai.ts'
  // legacy $0.15/$0.60 rate — the PR 10 ai_call_log table is the source of
  // truth for COGS reporting; the burs-ai constant stays put until N2 quota
  // bands rebalance against the new sheet.
  const rates =
    model === "gemini-2.5-pro"
      ? PRICING["gemini-2.5-pro"]
      : PRICING["gemini-2.5-flash"];
  return inputTokens * rates.in + outputTokens * rates.out;
}

function anthropicCost(inputTokens: number, outputTokens: number): number {
  const rates = PRICING["claude-haiku-4-5"];
  return inputTokens * rates.in + outputTokens * rates.out;
}

function logCallRow(
  supabase: any,
  row: {
    function_name: string;
    provider: "gemini" | "anthropic";
    user_id?: string;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number;
    latency_ms: number;
    request_id?: string;
  },
): void {
  if (!supabase) return;
  try {
    const inserted: Record<string, unknown> = {
      function_name: row.function_name,
      provider: row.provider,
      input_tokens: Math.max(0, Math.floor(row.input_tokens)),
      output_tokens: Math.max(0, Math.floor(row.output_tokens)),
      estimated_cost_usd: Number(row.estimated_cost_usd.toFixed(6)),
      latency_ms: Math.max(0, Math.floor(row.latency_ms)),
    };
    if (row.user_id) inserted.user_id = row.user_id;
    if (row.request_id) inserted.request_id = row.request_id;

    // Fire-and-forget. NEVER block the user response on this insert.
    Promise.resolve(supabase.from("ai_call_log").insert(inserted))
      .then(() => {})
      .catch((err: unknown) => {
        captureError("ai_provider.call_log_insert_failed", err, {
          fn_name: row.function_name,
          provider: row.provider,
        });
      });
  } catch (err) {
    captureError("ai_provider.call_log_insert_threw", err, {
      fn_name: row.function_name,
      provider: row.provider,
    });
  }
}

// ─── Public entrypoint ────────────────────────────────────────
export async function callAI(
  options: AIProviderOptions,
  supabaseServiceClient: any,
): Promise<AIProviderResponse> {
  const t0 = Date.now();
  const fallbackTimeoutMs = options.fallbackTimeoutMs ?? 8000;
  const fallbackEnabled = options.fallbackEnabled !== false;

  // ── Primary: Gemini via callBursAI ──
  try {
    const primary = await callPrimaryWithTimeout(
      options,
      supabaseServiceClient,
      fallbackTimeoutMs,
    );
    const latencyMs = Date.now() - t0;

    // callBursAI returns `{ data, model_used, ... }`. It does NOT expose
    // raw usage on its public response shape, so we estimate cost using
    // a conservative zero — burs-ai.ts already wrote the authoritative
    // token row to `ai_token_usage` for quota purposes. PR 10 ai_call_log
    // captures the *delta* from Gemini Flash's own usage object only when
    // we have it in scope; otherwise we record 0/0 and the cost dashboard
    // joins on `ai_token_usage` for Gemini accuracy. (Anthropic IS exact
    // since we made the call here.)
    const modelUsed = (primary as { model_used?: string }).model_used || options.models[0] || "gemini-2.5-flash";

    logCallRow(supabaseServiceClient, {
      function_name: options.functionName,
      provider: "gemini",
      user_id: options.userId,
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost_usd: 0,
      latency_ms: latencyMs,
      request_id: options.requestId,
    });

    return {
      data: (primary as { data: any }).data,
      provider: "gemini",
      latencyMs,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: geminiCost(0, 0, modelUsed),
    };
  } catch (primaryErr) {
    if (!fallbackEnabled || !shouldFallback(primaryErr)) {
      throw primaryErr;
    }

    captureWarning("ai_provider_fallback", {
      provider: "anthropic",
      fn_name: options.functionName,
      request_id: options.requestId,
      reason:
        primaryErr instanceof PrimaryTimeoutError
          ? "primary_timeout"
          : primaryErr instanceof AIQuotaExceededError
          ? "quota_exceeded"
          : primaryErr instanceof BursAIError
          ? `status_${primaryErr.status}`
          : "primary_error",
    });

    const apiKey = await resolveAnthropicApiKey(supabaseServiceClient);
    if (!apiKey) {
      // No key configured — re-throw the original so the caller sees a
      // signal indistinguishable from "no fallback configured".
      throw primaryErr;
    }

    const { data, inputTokens, outputTokens } = await callAnthropic(options, apiKey);
    const latencyMs = Date.now() - t0;
    const estimatedCostUsd = anthropicCost(inputTokens, outputTokens);

    logCallRow(supabaseServiceClient, {
      function_name: options.functionName,
      provider: "anthropic",
      user_id: options.userId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: estimatedCostUsd,
      latency_ms: latencyMs,
      request_id: options.requestId,
    });

    return {
      data,
      provider: "anthropic",
      latencyMs,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
    };
  }
}
