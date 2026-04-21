/**
 * Gemini image-generation transport — shared between render_garment_image
 * (Priority 4) and any future image-gen callers.
 *
 * Owns raw fetch + request building + response parsing + Gemini-specific
 * error classification. The caller orchestrates rate limiting, credit
 * ledger, quality gates, storage upload, etc.
 */

// ─── Model + endpoint ──────────────────────────────────────
// Preserved exactly as they were in render_garment_image/index.ts.
// If you change these, bump GEMINI_IMAGE_PROMPT_VERSION in render_garment_image
// so stale reservations don't short-circuit the new pipeline.

export const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
// `GEMINI_IMAGE_URL_OVERRIDE` lets smoke-test mock servers intercept image-gen
// calls without touching prod behavior. Unset → identical to the original
// hardcoded Google endpoint below. Must be a full URL (callers fetch it
// directly without further path manipulation).
// `typeof Deno !== "undefined"` guards the module against non-Deno runtimes
// (Node/vitest unit tests that import this file transitively) where accessing
// `Deno.env` directly would throw `ReferenceError: Deno is not defined`.
export const GEMINI_IMAGE_API_URL = (typeof Deno !== "undefined" ? Deno.env.get("GEMINI_IMAGE_URL_OVERRIDE") : undefined)
  ?? `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;

// ─── Types ─────────────────────────────────────────────────

type GeminiInlineData = {
  mimeType?: string;
  mime_type?: string;
  data?: string;
};

type GeminiPart = {
  text?: string;
  inlineData?: GeminiInlineData;
  inline_data?: GeminiInlineData;
};

type GeminiSafetyRating = {
  category?: string;
  probability?: string;
  blocked?: boolean;
};

type GeminiPromptFeedback = {
  blockReason?: string;
  block_reason?: string;
  safetyRatings?: GeminiSafetyRating[];
  safety_ratings?: GeminiSafetyRating[];
};

type GeminiCandidate = {
  finishReason?: string;
  finish_reason?: string;
  safetyRatings?: GeminiSafetyRating[];
  safety_ratings?: GeminiSafetyRating[];
  content?: {
    parts?: GeminiPart[];
  };
};

export type GeminiGenerateContentResponse = {
  candidates?: GeminiCandidate[];
  promptFeedback?: GeminiPromptFeedback;
  prompt_feedback?: GeminiPromptFeedback;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    message?: string;
  };
};

export class RenderProviderError extends Error {
  code: string;
  status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "RenderProviderError";
    this.code = code;
    this.status = status;
  }
}

export interface GenerateGeminiImageParams {
  apiKey: string;
  prompt: string;
  /** Full data URL: `data:image/<type>;base64,<payload>` */
  dataUrl: string;
  /** Response modalities — defaults to ["TEXT", "IMAGE"]. */
  responseModalities?: string[];
  /** Output image aspect ratio — defaults to "4:5". */
  aspectRatio?: string;
  /** Caller-supplied identifier for structured log lines. */
  garmentId?: string;
}

export interface GenerateGeminiImageResult {
  outputBytes: Uint8Array;
  mimeType: string;
  model: string;
  latencyMs: number;
  tokenUsage: {
    prompt?: number;
    candidates?: number;
    total?: number;
  };
  /** Raw response JSON, useful for callers that want to inspect text parts. */
  rawResponse: GeminiGenerateContentResponse | null;
}

// ─── Helpers ───────────────────────────────────────────────

function classifyGeminiError(status: number, message: string): RenderProviderError {
  const lower = message.toLowerCase();

  if (status === 401 || status === 403) {
    return new RenderProviderError("gemini_auth", `Gemini auth failed (${status}): ${message}`, status);
  }

  if (status === 404 || lower.includes("model not found") || lower.includes("not supported for generatecontent")) {
    return new RenderProviderError("gemini_model_path", `Gemini model/path mismatch (${status}): ${message}`, status);
  }

  return new RenderProviderError("gemini_api", `Gemini API error (${status}): ${message}`, status);
}

/**
 * Wave 3-B P19: bounded-latency fetch. Without this, a hung Gemini connection
 * ties up the edge-function isolate indefinitely — eventually hitting the
 * platform's 60s global timeout, but only after consuming the full
 * render_garment_image time budget and starving other concurrent renders.
 *
 * Uses AbortController + setTimeout so the connection is hard-aborted
 * client-side at the requested deadline. Caller receives a TypeError/AbortError
 * which the outer retry logic classifies as `gemini_timeout`.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wave 3-B F15: sleep with jitter for exponential backoff. Jitter prevents
 * thundering-herd retries from synchronized worker pods (process_render_jobs
 * runs up to JOB_CONCURRENCY=2 parallel, cron fires every 60s).
 */
function sleepWithJitter(baseMs: number): Promise<void> {
  const jitter = Math.floor(Math.random() * baseMs * 0.25);
  return new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
}

function extractGeminiParts(aiData: GeminiGenerateContentResponse | null): GeminiPart[] {
  return aiData?.candidates?.flatMap((candidate) => candidate?.content?.parts ?? []) ?? [];
}

function extractGeminiImagePart(aiData: GeminiGenerateContentResponse | null): { mimeType: string; data: string } | null {
  const parts = extractGeminiParts(aiData);
  for (const part of parts) {
    const inlineData = part?.inlineData ?? part?.inline_data;
    const mimeType = inlineData?.mimeType ?? inlineData?.mime_type;
    if (inlineData?.data && mimeType) {
      return { mimeType, data: inlineData.data };
    }
  }
  return null;
}

export function summarizeGeminiNoImageResponse(aiData: GeminiGenerateContentResponse | null): {
  reason: string;
  details: Record<string, unknown>;
} {
  const promptFeedback = aiData?.promptFeedback ?? aiData?.prompt_feedback;
  const candidates = aiData?.candidates ?? [];
  const finishReasons = candidates.map((candidate) => candidate.finishReason ?? candidate.finish_reason ?? "unknown");
  const textParts = extractGeminiParts(aiData)
    .map((part) => part.text?.trim())
    .filter((value): value is string => Boolean(value));
  const promptBlockReason = promptFeedback?.blockReason ?? promptFeedback?.block_reason ?? null;
  const promptSafetyRatings = promptFeedback?.safetyRatings ?? promptFeedback?.safety_ratings ?? [];
  const candidateSafetyRatings = candidates.flatMap((candidate) => candidate.safetyRatings ?? candidate.safety_ratings ?? []);
  const blockedSafetyRatings = [...promptSafetyRatings, ...candidateSafetyRatings]
    .filter((rating) => rating?.blocked)
    .map((rating) => ({
      category: rating.category ?? "unknown",
      probability: rating.probability ?? "unknown",
    }));

  let reason = "no_inline_image_parts";
  if (promptBlockReason || blockedSafetyRatings.length > 0) {
    reason = "safety_or_policy_block";
  } else if (textParts.length > 0) {
    const combinedText = textParts.join(" ").toLowerCase();
    if (
      combinedText.includes("can't")
      || combinedText.includes("cannot")
      || combinedText.includes("unable")
      || combinedText.includes("instead")
      || combinedText.includes("i can describe")
      || combinedText.includes("policy")
      || combinedText.includes("safety")
    ) {
      reason = "text_only_guidance";
    } else {
      reason = "text_only_response";
    }
  } else if (finishReasons.some((value) => value.includes("IMAGE_"))) {
    reason = "unsupported_or_incomplete_image_edit";
  }

  return {
    reason,
    details: {
      finishReasons,
      promptBlockReason,
      blockedSafetyRatings,
      textPreview: textParts.slice(0, 3).map((text) => text.slice(0, 280)),
      candidateCount: candidates.length,
      partCount: extractGeminiParts(aiData).length,
    },
  };
}

// ─── Main transport ───────────────────────────────────────

/**
 * Call Gemini's generateContent endpoint with an inline reference image
 * and return the produced image bytes.
 *
 * Throws `RenderProviderError` for any failure — including HTTP errors,
 * auth/model issues, and the `gemini_no_image` case where the request
 * succeeded but Gemini returned text instead of an image.
 */
export async function generateGeminiImage(
  params: GenerateGeminiImageParams,
): Promise<GenerateGeminiImageResult> {
  const sourceDataUrl = params.dataUrl;
  const responseModalities = params.responseModalities ?? ["TEXT", "IMAGE"];
  const aspectRatio = params.aspectRatio ?? "4:5";

  // Wave 3-B P19 + F15: bounded-latency fetch with transport-level backoff on
  // retryable Gemini failures (429 / 5xx). Each attempt has its own timeout
  // so a single hang doesn't eat the whole budget. Up to 3 attempts total:
  //   attempt 1: immediate
  //   attempt 2: ~1.5s pause (+ jitter)
  //   attempt 3: ~3.5s pause (+ jitter)
  // Total worst-case wall clock with 60s per-attempt timeout = ~185s, but
  // realistic worst case (3x 25s) ≈ 80s — still under the caller's 300s
  // UI poll window. Non-retryable classes (auth, model_path, no_image)
  // throw immediately without wasting retry budget.
  const FETCH_TIMEOUT_MS = 60_000;
  const MAX_ATTEMPTS = 3;
  const BACKOFF_MS = [0, 1500, 3500];

  const requestBody = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          { text: params.prompt },
          {
            inlineData: {
              mimeType: sourceDataUrl.slice(5, sourceDataUrl.indexOf(";")),
              data: sourceDataUrl.split(",")[1],
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities,
      imageConfig: {
        aspectRatio,
      },
    },
  });

  let response: Response | null = null;
  let lastTransportError: unknown = null;
  let attempt = 0;
  const started = Date.now();

  for (attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      await sleepWithJitter(BACKOFF_MS[attempt - 1]);
    }

    try {
      response = await fetchWithTimeout(
        GEMINI_IMAGE_API_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": params.apiKey,
          },
          body: requestBody,
        },
        FETCH_TIMEOUT_MS,
      );
    } catch (transportError) {
      // AbortError (timeout) or network-level TypeError. Retry with backoff
      // unless we've exhausted attempts.
      lastTransportError = transportError;
      const isAbort = transportError instanceof DOMException && transportError.name === "AbortError";
      console.warn("gemini-image-client transport failure", {
        garmentId: params.garmentId,
        attempt,
        reason: isAbort ? "timeout" : "network",
        error: transportError instanceof Error ? transportError.message : String(transportError),
      });
      if (attempt >= MAX_ATTEMPTS) {
        throw new RenderProviderError(
          isAbort ? "gemini_timeout" : "gemini_network",
          isAbort
            ? `Gemini request timed out after ${FETCH_TIMEOUT_MS}ms (${MAX_ATTEMPTS} attempts)`
            : `Gemini network error: ${transportError instanceof Error ? transportError.message : String(transportError)}`,
        );
      }
      continue;
    }

    // Response received. Decide whether to retry based on HTTP status.
    if (response.ok) break;

    // 429 rate-limit and 5xx server errors are transient — back off + retry.
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_ATTEMPTS) {
      const peekText = await response.text().catch(() => "");
      console.warn("gemini-image-client retryable status", {
        garmentId: params.garmentId,
        attempt,
        status: response.status,
        bodyPreview: peekText.slice(0, 200),
      });
      // We've read the body — null out `response` so the post-loop parse
      // block doesn't try to re-read a consumed stream.
      response = null;
      continue;
    }

    // Non-retryable failure (4xx except 429, or exhausted attempts) — fall
    // through to the post-loop error classification.
    break;
  }

  if (!response) {
    // All attempts exhausted against retryable statuses. lastTransportError
    // will be null because we successfully got responses but they were
    // retryable. Construct a synthetic message.
    throw new RenderProviderError(
      "gemini_api",
      lastTransportError instanceof Error
        ? `Gemini retries exhausted: ${lastTransportError.message}`
        : `Gemini retries exhausted after ${MAX_ATTEMPTS} attempts`,
    );
  }

  const latencyMs = Date.now() - started;
  const responseText = await response.text();
  let aiData: GeminiGenerateContentResponse | null = null;
  try {
    aiData = responseText ? JSON.parse(responseText) : null;
  } catch {
    aiData = null;
  }

  if (!response.ok) {
    const apiMessage = aiData?.error?.message || responseText || "Unknown Gemini error";
    throw classifyGeminiError(response.status, apiMessage);
  }

  const imagePart = extractGeminiImagePart(aiData);
  if (!imagePart) {
    const summary = summarizeGeminiNoImageResponse(aiData);
    console.error("gemini-image-client: no inline image data returned", {
      garmentId: params.garmentId,
      provider: "gemini",
      model: GEMINI_IMAGE_MODEL,
      endpoint: GEMINI_IMAGE_API_URL,
      latencyMs,
      ...summary.details,
    });

    throw new RenderProviderError(
      "gemini_no_image",
      `Gemini returned no image output (${summary.reason}; finishReasons=${(summary.details.finishReasons as string[]).join(",") || "unknown"})`,
      response.status,
    );
  }

  const binaryStr = atob(imagePart.data);
  const outputBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) outputBytes[i] = binaryStr.charCodeAt(i);

  return {
    outputBytes,
    mimeType: imagePart.mimeType,
    model: GEMINI_IMAGE_MODEL,
    latencyMs,
    tokenUsage: {
      prompt: aiData?.usageMetadata?.promptTokenCount,
      candidates: aiData?.usageMetadata?.candidatesTokenCount,
      total: aiData?.usageMetadata?.totalTokenCount,
    },
    rawResponse: aiData,
  };
}

// ─── Utility exports ──────────────────────────────────────

export function maskApiKey(apiKey: string | null | undefined): string {
  if (!apiKey) return "missing";
  if (apiKey.length <= 8) return "configured";
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}
