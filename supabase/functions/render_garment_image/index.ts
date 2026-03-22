import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { bursAIErrorResponse } from '../_shared/burs-ai.ts';
import { allowedOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
const GEMINI_IMAGE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;


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

type GeminiGenerateContentResponse = {
  candidates?: GeminiCandidate[];
  promptFeedback?: GeminiPromptFeedback;
  prompt_feedback?: GeminiPromptFeedback;
  error?: {
    message?: string;
  };
};

class RenderProviderError extends Error {
  code: string;
  status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'RenderProviderError';
    this.code = code;
    this.status = status;
  }
}

function maskApiKey(apiKey: string | null | undefined): string {
  if (!apiKey) return 'missing';
  if (apiKey.length <= 8) return 'configured';
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

function classifyGeminiError(status: number, message: string): RenderProviderError {
  const lower = message.toLowerCase();

  if (status === 401 || status == 403) {
    return new RenderProviderError('gemini_auth', `Gemini auth failed (${status}): ${message}`, status);
  }

  if (status === 404 || lower.includes('model not found') || lower.includes('not supported for generatecontent')) {
    return new RenderProviderError('gemini_model_path', `Gemini model/path mismatch (${status}): ${message}`, status);
  }

  return new RenderProviderError('gemini_api', `Gemini API error (${status}): ${message}`, status);
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

function summarizeGeminiNoImageResponse(aiData: GeminiGenerateContentResponse | null): {
  reason: string;
  details: Record<string, unknown>;
} {
  const promptFeedback = aiData?.promptFeedback ?? aiData?.prompt_feedback;
  const candidates = aiData?.candidates ?? [];
  const finishReasons = candidates.map((candidate) => candidate.finishReason ?? candidate.finish_reason ?? 'unknown');
  const textParts = extractGeminiParts(aiData)
    .map((part) => part.text?.trim())
    .filter((value): value is string => Boolean(value));
  const promptBlockReason = promptFeedback?.blockReason ?? promptFeedback?.block_reason ?? null;
  const promptSafetyRatings = promptFeedback?.safetyRatings ?? promptFeedback?.safety_ratings ?? [];
  const candidateSafetyRatings = candidates.flatMap((candidate) => candidate.safetyRatings ?? candidate.safety_ratings ?? []);
  const blockedSafetyRatings = [...promptSafetyRatings, ...candidateSafetyRatings]
    .filter((rating) => rating?.blocked)
    .map((rating) => ({
      category: rating.category ?? 'unknown',
      probability: rating.probability ?? 'unknown',
    }));

  let reason = 'no_inline_image_parts';
  if (promptBlockReason || blockedSafetyRatings.length > 0) {
    reason = 'safety_or_policy_block';
  } else if (textParts.length > 0) {
    const combinedText = textParts.join(' ').toLowerCase();
    if (
      combinedText.includes("can't")
      || combinedText.includes('cannot')
      || combinedText.includes('unable')
      || combinedText.includes('instead')
      || combinedText.includes('i can describe')
      || combinedText.includes('policy')
      || combinedText.includes('safety')
    ) {
      reason = 'text_only_guidance';
    } else {
      reason = 'text_only_response';
    }
  } else if (finishReasons.some((value) => value.includes('IMAGE_'))) {
    reason = 'unsupported_or_incomplete_image_edit';
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

async function generateGarmentRenderWithGeminiDirect(opts: {
  garmentId: string;
  apiKey: string;
  prompt: string;
  dataUrl: string;
}): Promise<{ outputBytes: Uint8Array; mimeType: string }> {
  const sourceDataUrl = opts.dataUrl;

  const response = await fetch(GEMINI_IMAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': opts.apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: opts.prompt },
            {
              inlineData: {
                mimeType: sourceDataUrl.slice(5, sourceDataUrl.indexOf(';')),
                data: sourceDataUrl.split(',')[1],
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: '4:5',
        },
      },
    }),
  });

  const responseText = await response.text();
  let aiData: GeminiGenerateContentResponse | null = null;
  try {
    aiData = responseText ? JSON.parse(responseText) : null;
  } catch {
    aiData = null;
  }

  if (!response.ok) {
    const apiMessage = aiData?.error?.message || responseText || 'Unknown Gemini error';
    throw classifyGeminiError(response.status, apiMessage);
  }

  const imagePart = extractGeminiImagePart(aiData);
  if (!imagePart) {
    const summary = summarizeGeminiNoImageResponse(aiData);
    console.error('render_garment_image Gemini returned no inline image data', {
      garmentId: opts.garmentId,
      provider: 'gemini',
      model: GEMINI_IMAGE_MODEL,
      endpoint: GEMINI_IMAGE_API_URL,
      ...summary.details,
    });

    throw new RenderProviderError(
      'gemini_no_image',
      `Gemini returned no image output (${summary.reason}; finishReasons=${(summary.details.finishReasons as string[]).join(',') || 'unknown'})`,
      response.status,
    );
  }

  const binaryStr = atob(imagePart.data);
  const outputBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) outputBytes[i] = binaryStr.charCodeAt(i);

  return { outputBytes, mimeType: imagePart.mimeType };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'Unknown error');
}


function extensionForMimeType(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/jpeg':
    case 'image/jpg':
    default:
      return 'jpg';
  }
}

function normalizeImageMimeType(contentType: string | null, sourceImagePath: string): string {
  const normalizedHeader = contentType?.split(';')[0]?.trim().toLowerCase();
  if (normalizedHeader && normalizedHeader.startsWith('image/')) {
    return normalizedHeader;
  }

  const extension = sourceImagePath.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    const chunk = bytes.subarray(i, i + 8192);
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

async function updateGarmentRenderState(
  supabase: ReturnType<typeof createClient>,
  garmentId: string,
  updates: Record<string, unknown>,
  context: string,
) {
  const { error } = await supabase.from('garments').update(updates).eq('id', garmentId);
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

async function safeMarkRenderFailed(
  supabase: ReturnType<typeof createClient>,
  garmentId: string,
  updates: Record<string, unknown>,
  context: string,
) {
  try {
    const { error } = await supabase.from('garments').update({
      render_status: 'failed',
      render_provider: 'gemini',
      ...updates,
    }).eq('id', garmentId);

    if (error) {
      console.error('render_garment_image failed to persist failure state', {
        garmentId,
        context,
        updateError: error.message,
        attemptedRenderError: updates.render_error,
      });
    }
  } catch (updateError) {
    console.error('render_garment_image failure-state update crashed', {
      garmentId,
      context,
      updateError: getErrorMessage(updateError),
      attemptedRenderError: updates.render_error,
    });
  }
}

/**
 * render_garment_image — Gemini-based canonical garment render pipeline.
 *
 * Takes a garment ID, downloads the best available source image,
 * sends it with a structured prompt to Gemini image-gen, validates
 * the output, and stores the rendered canonical asset.
 *
 * Feature-gated via RENDER_PIPELINE_ENABLED env var.
 */
serve(async (req) => {
  let supabase: ReturnType<typeof createClient> | null = null;
  let garmentIdForFailure: string | null = null;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Feature gate ──
    const enabled = Deno.env.get('RENDER_PIPELINE_ENABLED') === 'true';
    if (!enabled) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'Render pipeline disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Auth ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    supabase = createClient(supabaseUrl, serviceKey);

    // ── Input ──
    const { garmentId } = await req.json();
    garmentIdForFailure = garmentId;

    if (!garmentId || typeof garmentId !== 'string') {
      return new Response(JSON.stringify({ error: 'garmentId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch garment ──
    const { data: garment, error: garmentError } = await supabase
      .from('garments')
      .select(
        'id, user_id, title, category, subcategory, color_primary, color_secondary, material, pattern, fit, ' +
        'original_image_path, processed_image_path, image_path, image_processing_status, render_status',
      )
      .eq('id', garmentId)
      .eq('user_id', user.id)
      .single();

    if (garmentError || !garment) {
      return new Response(JSON.stringify({ error: 'Garment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Don't re-render if already ready or currently rendering
    if (garment.render_status === 'ready' || garment.render_status === 'rendering') {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: `Already ${garment.render_status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Resolve best source image ──
    // Prefer background-removed image (cleaner input for Gemini), fall back to original
    const sourceImagePath =
      (garment.image_processing_status === 'ready' && garment.processed_image_path)
        ? garment.processed_image_path
        : garment.original_image_path || garment.image_path;

    if (!sourceImagePath) {
      await safeMarkRenderFailed(supabase, garment.id, {
        render_error: 'No source image available.',
      }, 'missing_source_image');

      return new Response(
        JSON.stringify({ ok: false, error: 'No source image' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Mark as rendering ──
    await updateGarmentRenderState(supabase, garment.id, {
      render_status: 'rendering',
      render_error: null,
      render_provider: 'gemini',
    }, 'Failed to mark garment as rendering');

    const hasGeminiApiKey = Boolean(Deno.env.get('GEMINI_API_KEY')?.trim());
    console.log('render_garment_image Gemini provider config', {
      garmentId: garment.id,
      provider: 'gemini',
      geminiApiKeyConfigured: hasGeminiApiKey,
      model: GEMINI_IMAGE_MODEL,
      endpoint: GEMINI_IMAGE_API_URL,
      sourceImagePath,
      usedProcessedSource: sourceImagePath === garment.processed_image_path,
    });

    if (!hasGeminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured for render_garment_image');
    }

    // ── Download source image as base64 ──
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('garments')
      .createSignedUrl(sourceImagePath, 900);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error(`Unable to read source garment image: ${signedUrlError?.message ?? 'missing signed URL'}`);
    }

    const imageResp = await fetch(signedUrlData.signedUrl);
    if (!imageResp.ok) {
      throw new Error(`Failed to download source image: ${imageResp.status}`);
    }

    const imageBytes = new Uint8Array(await imageResp.arrayBuffer());
    const contentType = imageResp.headers.get('content-type');
    const mimeType = normalizeImageMimeType(contentType, sourceImagePath);
    const base64 = uint8ArrayToBase64(imageBytes);
    const hasDataUrlPrefix = base64.startsWith('data:');

    if (hasDataUrlPrefix) {
      throw new Error('Source image base64 unexpectedly contains a data URL prefix');
    }

    const dataUrl = `data:${mimeType};base64,${base64}`;

    // ── Build prompt ──
    const parts = [garment.color_primary];
    if (garment.color_secondary) parts.push(`and ${garment.color_secondary}`);
    if (garment.material) parts.push(garment.material);
    if (garment.pattern && garment.pattern !== 'solid') parts.push(garment.pattern);
    if (garment.fit) parts.push(`${garment.fit} fit`);

    const itemName = garment.subcategory
      ? `${garment.subcategory} ${garment.category}`
      : garment.title;

    const prompt = [
      `Create one studio e-commerce product image of only the garment from the reference photo.`,
      `Output a ghost mannequin / shadow mannequin result, as if the garment is worn by an invisible form.`,
      `Garment description: ${parts.join(' ')} ${itemName}.`,
      `Hard requirements:`,
      `- Keep only the garment from the reference image`,
      `- Preserve the EXACT color, silhouette, fabric texture, print, logo placement, buttons, pockets, sleeve length, collar, hem, and proportions`,
      `- Remove the person, body, face, hair, hands, mannequin, hanger, props, and background completely`,
      `- Reconstruct any hidden or occluded garment areas naturally so the garment looks complete and commercially usable`,
      `- Center the single garment in frame`,
      `- Use a clean pure white studio background with soft realistic catalog lighting`,
      `- Maintain a premium fashion e-commerce product photo look`,
      `Negative requirements:`,
      `- No extra garments or layering`,
      `- No redesign, no embellishment, no color shift, no style change`,
      `- No text, labels, watermark, branding additions, or decorative props`,
      `- Do not describe the edit in text; return the edited image`,
    ].join('\n');

    console.log('render_garment_image Gemini request start', {
      garmentId: garment.id,
      provider: 'gemini',
      model: GEMINI_IMAGE_MODEL,
      endpoint: GEMINI_IMAGE_API_URL,
      responseModalities: ['TEXT', 'IMAGE'],
      imageAspectRatio: '4:5',
      promptPreview: prompt.split('\n').slice(0, 6),
      sourceContentType: contentType,
      sourceMimeType: mimeType,
      sourceBytes: imageBytes.length,
      sourceBase64Length: base64.length,
      sourceHasDataUrlPrefix: hasDataUrlPrefix,
    });

    // ── Call Gemini image-gen with direct generateContent endpoint ──
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')?.trim() ?? '';
    let outputBytes: Uint8Array;
    let outputMimeType: string;

    try {
      const result = await generateGarmentRenderWithGeminiDirect({
        garmentId: garment.id,
        apiKey: geminiApiKey,
        prompt,
        dataUrl,
      });
      outputBytes = result.outputBytes;
      outputMimeType = result.mimeType;
    } catch (providerError) {
      const errorMessage = getErrorMessage(providerError);
      const errorCode = providerError instanceof RenderProviderError ? providerError.code : 'gemini_unknown';

      console.error('render_garment_image Gemini direct request failed', {
        garmentId: garment.id,
        provider: 'gemini',
        model: GEMINI_IMAGE_MODEL,
        endpoint: GEMINI_IMAGE_API_URL,
        geminiApiKeyFingerprint: maskApiKey(geminiApiKey),
        errorCode,
        error: errorMessage,
      });

      if (errorCode === 'gemini_no_image') {
        await safeMarkRenderFailed(supabase, garment.id, {
          render_error: errorMessage,
        }, 'invalid_ai_output');

        return new Response(
          JSON.stringify({ ok: true, rendered: false, error: errorMessage }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      throw providerError;
    }

    console.log('render_garment_image Gemini response received', {
      garmentId: garment.id,
      provider: 'gemini',
      model: GEMINI_IMAGE_MODEL,
      endpoint: GEMINI_IMAGE_API_URL,
      outputBytes: outputBytes.length,
      outputMimeType,
    });

    // ── Quality gate v1: structural checks ──
    const MIN_SIZE_BYTES = 10240; // 10KB — catches blank/corrupt images
    const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB sanity cap

    if (outputBytes.length < MIN_SIZE_BYTES) {
      await safeMarkRenderFailed(supabase, garment.id, {
        render_error: `Quality gate rejected image: output too small (${outputBytes.length} bytes). Likely blank or corrupt.`,
      }, 'quality_gate_output_too_small');

      return new Response(
        JSON.stringify({ ok: true, rendered: false, error: 'Output too small' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (outputBytes.length > MAX_SIZE_BYTES) {
      await safeMarkRenderFailed(supabase, garment.id, {
        render_error: `Quality gate rejected image: output too large (${outputBytes.length} bytes).`,
      }, 'quality_gate_output_too_large');

      return new Response(
        JSON.stringify({ ok: true, rendered: false, error: 'Output too large' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Upload rendered image ──
    const renderedExtension = extensionForMimeType(outputMimeType);
    const renderedPath = `${garment.user_id}/${garment.id}/rendered.${renderedExtension}`;

    const { error: uploadError } = await supabase.storage
      .from('garments')
      .upload(renderedPath, outputBytes, {
        contentType: outputMimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed for rendered image: ${uploadError.message}`);
    }

    // ── Update garment record ──
    await updateGarmentRenderState(supabase, garment.id, {
      rendered_image_path: renderedPath,
      render_status: 'ready',
      render_provider: 'gemini',
      render_error: null,
      rendered_at: new Date().toISOString(),
    }, 'Failed to mark garment render as ready');

    console.log(`Rendered garment ${garment.id} → ${renderedPath}`);

    return new Response(
      JSON.stringify({ ok: true, rendered: true, renderedImagePath: renderedPath }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error('render_garment_image error', {
      garmentId: garmentIdForFailure,
      provider: 'gemini',
      geminiApiKeyConfigured: Boolean(Deno.env.get('GEMINI_API_KEY')?.trim()),
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (supabase && garmentIdForFailure) {
      await safeMarkRenderFailed(supabase, garmentIdForFailure, {
        render_error: errorMessage,
      }, 'top_level_catch');
    }

    return bursAIErrorResponse(error, corsHeaders);
  }
});
