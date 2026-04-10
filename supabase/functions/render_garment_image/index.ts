import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { bursAIErrorResponse } from '../_shared/burs-ai.ts';
import { CORS_HEADERS } from '../_shared/cors.ts';
import { assessRenderEligibilityWithGemini, PRODUCT_READY_RENDER_GATE_PROVIDER, validateRenderedGarmentOutputWithGemini } from '../_shared/render-eligibility.ts';
import { mannequinPresentationInstruction, normalizeMannequinPresentation } from '../_shared/mannequin-presentation.ts';

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

type RenderPromptEnrichment = {
  neckline: string | null;
  sleeveLength: string | null;
  garmentLength: string | null;
  closure: string | null;
  fabricWeight: string | null;
  silhouette: string | null;
  drape: string | null;
  hemDetail: string | null;
  rise: string | null;
  legShape: string | null;
  textOnGarment: string | null;
  logoDescription: string | null;
  graphicDescription: string | null;
  collarStyle: string | null;
  constructionDetails: string | null;
  waistband: string | null;
  colorDescription: string | null;
  shoulderStructure: string | null;
  textureIntensity: string | null;
  visualWeight: string | null;
  occasionTags: string[] | null;
  styleArchetype: string | null;
};

function normalizeMetadataValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized === 'null' || normalized === 'unknown' || normalized === 'n/a') return null;
  return normalized;
}

function extractPromptEnrichment(aiRaw: unknown): RenderPromptEnrichment {
  const raw = aiRaw && typeof aiRaw === 'object' && !Array.isArray(aiRaw)
    ? aiRaw as Record<string, unknown>
    : null;
  const enrichment = raw?.enrichment && typeof raw.enrichment === 'object' && !Array.isArray(raw.enrichment)
    ? raw.enrichment as Record<string, unknown>
    : null;

  return {
    neckline: normalizeMetadataValue(enrichment?.neckline),
    sleeveLength: normalizeMetadataValue(enrichment?.sleeve_length),
    garmentLength: normalizeMetadataValue(enrichment?.garment_length),
    closure: normalizeMetadataValue(enrichment?.closure),
    fabricWeight: normalizeMetadataValue(enrichment?.fabric_weight),
    silhouette: normalizeMetadataValue(enrichment?.silhouette),
    drape: normalizeMetadataValue(enrichment?.drape),
    hemDetail: normalizeMetadataValue(enrichment?.hem_detail),
    rise: normalizeMetadataValue(enrichment?.rise),
    legShape: normalizeMetadataValue(enrichment?.leg_shape),
    textOnGarment: normalizeMetadataValue(enrichment?.text_on_garment),
    logoDescription: normalizeMetadataValue(enrichment?.logo_description),
    graphicDescription: normalizeMetadataValue(enrichment?.graphic_or_print_description),
    collarStyle: normalizeMetadataValue(enrichment?.collar_style),
    constructionDetails: normalizeMetadataValue(enrichment?.construction_details),
    waistband: normalizeMetadataValue(enrichment?.waistband),
    colorDescription: normalizeMetadataValue(enrichment?.color_description),
    shoulderStructure: normalizeMetadataValue(enrichment?.shoulder_structure),
    textureIntensity: normalizeMetadataValue(enrichment?.texture_intensity),
    visualWeight: normalizeMetadataValue(enrichment?.visual_weight),
    occasionTags: Array.isArray(enrichment?.occasion_tags)
      ? (enrichment?.occasion_tags as unknown[]).filter((t): t is string => typeof t === 'string')
      : null,
    styleArchetype: normalizeMetadataValue(enrichment?.style_archetype),
  };
}

function sanitizeEnrichmentValue(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function formalityLabel(score: number): string {
  if (score <= 1) return 'very casual';
  if (score <= 2) return 'casual';
  if (score <= 3) return 'smart casual';
  if (score <= 4) return 'semi-formal';
  return 'formal';
}

function buildGarmentRenderPrompt(garment: {
  title: string;
  category: string;
  subcategory: string | null;
  color_primary: string;
  color_secondary: string | null;
  material: string | null;
  pattern: string | null;
  fit: string | null;
  formality: number | null;
  ai_raw: unknown;
}, mannequinPresentation: 'male' | 'female' | 'mixed'): string {
  const enrichment = extractPromptEnrichment(garment.ai_raw);
  const metadataLines = [
    garment.category ? `- Category: ${garment.category}` : null,
    garment.subcategory ? `- Subcategory: ${garment.subcategory}` : null,
    garment.color_primary ? `- Primary color: ${garment.color_primary}` : null,
    garment.color_secondary ? `- Secondary color: ${garment.color_secondary}` : null,
    garment.pattern && garment.pattern !== 'solid' ? `- Pattern or print: ${garment.pattern}` : null,
    garment.material ? `- Material or fabric: ${garment.material}` : null,
    garment.fit ? `- Fit: ${garment.fit}` : null,
    enrichment.silhouette ? `- Silhouette: ${enrichment.silhouette}` : null,
    enrichment.sleeveLength ? `- Sleeve length: ${enrichment.sleeveLength}` : null,
    enrichment.neckline ? `- Collar or neckline: ${enrichment.neckline}` : null,
    enrichment.closure ? `- Closure: ${enrichment.closure}` : null,
    enrichment.fabricWeight ? `- Fabric weight: ${enrichment.fabricWeight}` : null,
    enrichment.garmentLength ? `- Garment length: ${enrichment.garmentLength}` : null,
    enrichment.rise ? `- Rise: ${enrichment.rise}` : null,
    enrichment.legShape ? `- Leg shape: ${enrichment.legShape}` : null,
    enrichment.drape ? `- Drape: ${enrichment.drape}` : null,
    enrichment.hemDetail ? `- Hem detail: ${enrichment.hemDetail}` : null,
    sanitizeEnrichmentValue(enrichment.textOnGarment) ? `- Text on garment (reproduce EXACTLY): ${sanitizeEnrichmentValue(enrichment.textOnGarment)}` : null,
    sanitizeEnrichmentValue(enrichment.logoDescription) ? `- Logo or brand mark (reproduce EXACTLY): ${sanitizeEnrichmentValue(enrichment.logoDescription)}` : null,
    sanitizeEnrichmentValue(enrichment.graphicDescription) ? `- Graphic or print (reproduce EXACTLY): ${sanitizeEnrichmentValue(enrichment.graphicDescription)}` : null,
    enrichment.collarStyle ? `- Collar style: ${enrichment.collarStyle}` : null,
    sanitizeEnrichmentValue(enrichment.constructionDetails) ? `- Construction details: ${sanitizeEnrichmentValue(enrichment.constructionDetails)}` : null,
    enrichment.waistband ? `- Waistband: ${enrichment.waistband}` : null,
    sanitizeEnrichmentValue(enrichment.colorDescription) ? `- Precise color: ${sanitizeEnrichmentValue(enrichment.colorDescription)}` : null,
    enrichment.shoulderStructure ? `- Shoulder structure: ${enrichment.shoulderStructure}` : null,
    enrichment.textureIntensity ? `- Texture intensity: ${enrichment.textureIntensity}` : null,
    enrichment.visualWeight ? `- Visual weight: ${enrichment.visualWeight}` : null,
    enrichment.styleArchetype ? `- Style archetype: ${enrichment.styleArchetype}` : null,
    enrichment.occasionTags && enrichment.occasionTags.length > 0
      ? `- Occasion context: ${enrichment.occasionTags.join(', ')}`
      : null,
    garment.formality != null ? `- Formality: ${formalityLabel(garment.formality)} (${garment.formality}/5)` : null,
  ].filter((value): value is string => Boolean(value));

  const garmentLabel = garment.subcategory ?? garment.category ?? garment.title;

  return [
    'Create exactly one premium studio e-commerce image of the single garment shown in the reference photo.',
    'Use the reference image as the source of truth. Metadata below is only a steering hint when it matches the image.',
    `Garment type: ${garmentLabel}.`,
    metadataLines.length > 0
      ? ['Use these confirmed garment details when visible in the reference image:', ...metadataLines].join('\n')
      : 'No extra garment metadata is available beyond the reference image.',
    'Hard requirements:',
    '- Show one garment only',
    '- Convert it into a garment-only ghost mannequin / shadow mannequin product render',
    `- ${mannequinPresentationInstruction(mannequinPresentation)}`,
    '- FIDELITY IS THE HIGHEST PRIORITY. Reproduce the garment EXACTLY as it appears in the reference image — same color, silhouette, proportions, material texture, pattern, fit, and every construction detail',
    '- REPRODUCE ALL LOGOS, TEXT, GRAPHICS, AND BRAND MARKS EXACTLY. If the garment has a logo, brand name, printed text, or graphic — it must appear in the output in the same position, same size, same color, same font. Never remove or alter garment branding.',
    '- Reconstruct hidden interior or occluded garment areas only as needed to complete the garment naturally and realistically',
    '- Remove the person, body, head, skin, hair, hands, mannequin, hanger, props, and the original background completely',
    '- The final image must show the garment only: no visible mannequin head shape, no neck block, no shoulder block, no torso form, no hip or pelvis block, and no visible arms, hands, legs, or feet',
    '- Internal shaping must be subtle and limited to natural garment volume; do not leave behind any visible anatomy silhouette',
    '- Keep the garment centered with clean soft catalog lighting on a pure white background',
    '- Make the result commercially usable and photorealistic',
    'Negative requirements:',
    '- No extra garments, no layering, no duplicate pieces',
    '- No redesign, no embellishment, no color shift, no silhouette change, no invented details',
    '- No external text overlays, watermarks, photographer credits, or post-production labels NOT part of the garment itself',
    '- No packaging, accessories, or decorative props that are not part of the garment',
    '- Do NOT remove logos, brand names, printed text, or graphics that are part of the garment design',
    '- No color shift — match the exact color from the reference photo, not a generic version of that color name',
    '- No simplification — do not smooth out distinctive construction details, stitching patterns, or seam lines',
    '- Return only the edited image',
  ].join('\n');
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

async function claimGarmentRender(
  supabase: ReturnType<typeof createClient>,
  garmentId: string,
  mannequinPresentation: MannequinPresentation,
  force?: boolean,
): Promise<boolean> {
  const allowedStatuses = force
    ? ['pending', 'failed', 'none', 'skipped', 'ready']
    : ['pending', 'failed', 'none'];

  const { data, error } = await supabase
    .from('garments')
    .update({
      render_status: 'rendering',
      render_presentation_used: mannequinPresentation,
      render_error: null,
      render_provider: 'gemini',
    })
    .eq('id', garmentId)
    .in('render_status', allowedStatuses)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
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
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // ── Feature gate ──
    const enabled = Deno.env.get('RENDER_PIPELINE_ENABLED') === 'true';
    if (!enabled) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'Render pipeline disabled' }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Auth ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
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
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    supabase = createClient(supabaseUrl, serviceKey);

    // ── Input ──
    const { garmentId, force } = await req.json() as { garmentId: string; force?: boolean };
    garmentIdForFailure = garmentId;

    if (!garmentId || typeof garmentId !== 'string') {
      return new Response(JSON.stringify({ error: 'garmentId is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch garment ──
    const { data: garment, error: garmentError } = await supabase
      .from('garments')
      .select(
        'id, user_id, title, category, subcategory, color_primary, color_secondary, material, pattern, fit, formality, ai_raw, ' +
        'original_image_path, image_path, render_status, render_error, rendered_image_path, render_presentation_used',
      )
      .eq('id', garmentId)
      .eq('user_id', user.id)
      .single();

    if (garmentError || !garment) {
      return new Response(JSON.stringify({ error: 'Garment not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Don't re-render if already ready or currently rendering, unless caller forces a re-render
    if (!force && (garment.render_status === 'ready' || garment.render_status === 'rendering' || garment.render_status === 'skipped')) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: `Already ${garment.render_status}` }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }
    // Always block while rendering is in flight to prevent double-claim
    if (garment.render_status === 'rendering') {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'Already rendering' }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Resolve source image ──
    const sourceImagePath = garment.original_image_path || garment.image_path;

    if (!sourceImagePath) {
      await safeMarkRenderFailed(supabase, garment.id, {
        render_error: 'No source image available.',
      }, 'missing_source_image');

      return new Response(
        JSON.stringify({ ok: false, error: 'No source image' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const hasGeminiApiKey = Boolean(Deno.env.get('GEMINI_API_KEY')?.trim());
    if (!hasGeminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured for render_garment_image');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('mannequin_presentation')
      .eq('id', garment.user_id)
      .maybeSingle();

    const mannequinPresentation = normalizeMannequinPresentation(profile?.mannequin_presentation);

    console.log('render_garment_image Gemini provider config', {
      garmentId: garment.id,
      provider: 'gemini',
      geminiApiKeyConfigured: hasGeminiApiKey,
      model: GEMINI_IMAGE_MODEL,
      endpoint: GEMINI_IMAGE_API_URL,
      sourceImagePath,
      mannequinPresentation,
    });

    // ── Claim render atomically before expensive prep ──
    const claimed = await claimGarmentRender(supabase, garment.id, mannequinPresentation, force);
    if (!claimed) {
      const { data: latestGarment } = await supabase
        .from('garments')
        .select('render_status')
        .eq('id', garment.id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: `Already ${latestGarment?.render_status ?? 'claimed'}`,
        }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Re-fetch garment after claim to get latest enrichment data ──
    const { data: freshGarment } = await supabase
      .from('garments')
      .select('id, user_id, title, category, subcategory, color_primary, color_secondary, material, pattern, fit, formality, ai_raw, original_image_path, image_path')
      .eq('id', garment.id)
      .maybeSingle();
    const garmentForPrompt = freshGarment ?? garment;

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

    let eligibilityAssessment = null;
    try {
      eligibilityAssessment = await assessRenderEligibilityWithGemini({
        apiKey: Deno.env.get('GEMINI_API_KEY')?.trim() ?? '',
        garmentId: garment.id,
        mimeType,
        imageBase64: base64,
      });
    } catch (eligibilityError) {
      console.warn('render_garment_image eligibility gate failed open', {
        garmentId: garment.id,
        error: getErrorMessage(eligibilityError),
      });
    }

    if (eligibilityAssessment?.decision === 'skip_product_ready') {
      const confidenceLabel = eligibilityAssessment.confidence == null
        ? 'unknown'
        : eligibilityAssessment.confidence.toFixed(2);
      await updateGarmentRenderState(supabase, garment.id, {
        render_status: 'skipped',
        render_presentation_used: mannequinPresentation,
        render_provider: PRODUCT_READY_RENDER_GATE_PROVIDER,
        render_error: `Skipped render: ${eligibilityAssessment.reason} (confidence=${confidenceLabel})`,
        rendered_image_path: null,
        rendered_at: null,
      }, 'Failed to mark garment render as skipped');

      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: eligibilityAssessment.reason,
          eligibility: eligibilityAssessment,
        }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Build prompt ──
    const prompt = buildGarmentRenderPrompt(garmentForPrompt, mannequinPresentation);

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
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
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
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    if (outputBytes.length > MAX_SIZE_BYTES) {
      await safeMarkRenderFailed(supabase, garment.id, {
        render_error: `Quality gate rejected image: output too large (${outputBytes.length} bytes).`,
      }, 'quality_gate_output_too_large');

      return new Response(
        JSON.stringify({ ok: true, rendered: false, error: 'Output too large' }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Quality gate v2: mannequin anatomy validation ──
    const renderedBase64 = uint8ArrayToBase64(outputBytes);
    const validationAssessment = await validateRenderedGarmentOutputWithGemini({
      apiKey: geminiApiKey,
      garmentId: garment.id,
      mimeType: outputMimeType,
      imageBase64: renderedBase64,
    });

    if (validationAssessment?.decision === 'reject_visible_mannequin') {
      console.warn('render_garment_image quality gate rejected: visible mannequin; attempting retry', {
        garmentId: garment.id,
        reason: validationAssessment.reason,
        confidence: validationAssessment.confidence,
      });

      const retryPrompt = prompt + '\n\nCRITICAL CORRECTION: The previous attempt showed visible mannequin anatomy. This time: completely remove ALL traces of the mannequin form. The garment must appear completely self-supporting with NO visible body shape, NO shoulder form, NO torso silhouette, NO hip shape underneath the fabric. Use only natural fabric volume and gravity.';

      let retryPassed = false;
      try {
        const retryResult = await generateGarmentRenderWithGeminiDirect({
          garmentId: garment.id,
          apiKey: geminiApiKey,
          prompt: retryPrompt,
          dataUrl,
        });

        const retryValidation = await validateRenderedGarmentOutputWithGemini({
          apiKey: geminiApiKey,
          garmentId: garment.id,
          mimeType: retryResult.mimeType,
          imageBase64: uint8ArrayToBase64(retryResult.outputBytes),
        });

        if (retryValidation?.decision !== 'reject_visible_mannequin') {
          outputBytes = retryResult.outputBytes;
          outputMimeType = retryResult.mimeType;
          retryPassed = true;
        }
      } catch (retryError) {
        console.error('render_garment_image retry attempt failed', {
          garmentId: garment.id,
          error: getErrorMessage(retryError),
        });
      }

      if (!retryPassed) {
        const confidenceLabel = validationAssessment.confidence == null
          ? 'unknown'
          : validationAssessment.confidence.toFixed(2);

        await safeMarkRenderFailed(supabase, garment.id, {
          render_error: `Quality gate rejected render after retry: ${validationAssessment.reason} (confidence=${confidenceLabel})`,
          rendered_image_path: null,
          rendered_at: null,
        }, 'quality_gate_visible_mannequin_retry');

        return new Response(
          JSON.stringify({
            ok: true,
            rendered: false,
            error: 'Rendered output still showed visible mannequin anatomy after retry',
            validation: validationAssessment,
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
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
      image_path: renderedPath,
      rendered_image_path: renderedPath,
      render_presentation_used: mannequinPresentation,
      render_status: 'ready',
      render_provider: 'gemini',
      render_error: null,
      rendered_at: new Date().toISOString(),
    }, 'Failed to mark garment render as ready');

    console.log(`Rendered garment ${garment.id} → ${renderedPath}`);

    return new Response(
      JSON.stringify({ ok: true, rendered: true, renderedImagePath: renderedPath }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
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

    return bursAIErrorResponse(error, CORS_HEADERS);
  }
});
