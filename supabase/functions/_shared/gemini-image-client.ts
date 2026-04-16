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
export const GEMINI_IMAGE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;

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

  const started = Date.now();

  const response = await fetch(GEMINI_IMAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": params.apiKey,
    },
    body: JSON.stringify({
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
    }),
  });

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
