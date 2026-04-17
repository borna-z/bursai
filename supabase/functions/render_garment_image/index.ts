import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { bursAIErrorResponse } from '../_shared/burs-ai.ts';
import { CORS_HEADERS } from '../_shared/cors.ts';
import { assessRenderEligibilityWithGemini, PRODUCT_READY_RENDER_GATE_PROVIDER, validateRenderedGarmentOutputWithGemini } from '../_shared/render-eligibility.ts';
import { mannequinPresentationInstruction, normalizeMannequinPresentation } from '../_shared/mannequin-presentation.ts';
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, recordError, overloadResponse } from '../_shared/scale-guard.ts';
import { getBalance, reserveCredit, consumeCredit, releaseCredit } from '../_shared/render-credits.ts';
import {
  generateGeminiImage,
  maskApiKey,
  RenderProviderError,
  GEMINI_IMAGE_MODEL,
  GEMINI_IMAGE_API_URL,
} from '../_shared/gemini-image-client.ts';
import { deriveRenderJobId } from '../_shared/render-job-id.ts';
import { timingSafeEqual } from '../_shared/timing-safe.ts';

/**
 * Bump this when the render prompt or Gemini parameters change materially.
 * Folded into the credit-ledger idempotency key so stale reservations
 * don't short-circuit a pipeline change.
 */
const RENDER_PROMPT_VERSION = 'v1';

/** Monthly allowance of 0 → user is not a paying subscriber right now (trialing or canceled). */
function isTrialFromBalance(monthlyAllowance: number): boolean {
  return monthlyAllowance === 0;
}

type MannequinPresentation = 'male' | 'female' | 'mixed';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'Unknown error');
}

// deriveRenderJobId moved to _shared/render-job-id.ts in P5 Codex round 3
// so enqueue_render_job uses the same derivation. Previously called
// `deriveJobId` locally; kept the alias below for minimal diff in callers.
const deriveJobId = deriveRenderJobId;

// ─── Prompt building (unchanged from prior implementation) ───

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
}, mannequinPresentation: MannequinPresentation): string {
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

// ─── Image helpers (unchanged) ───

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

// ─── Garment state helpers (unchanged) ───

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
 * When a force re-render fails and a prior good render exists, restore it
 * so the user's wardrobe is not left in a degraded state.
 * Falls back to safeMarkRenderFailed when there is no prior image to restore.
 */
async function safeRestoreOrFailRender(
  supabase: ReturnType<typeof createClient>,
  garmentId: string,
  updates: Record<string, unknown>,
  context: string,
  priorRenderedPath: string | null,
  isForce: boolean,
) {
  if (isForce && priorRenderedPath) {
    console.warn('render_garment_image force-render failed; restoring prior render', {
      garmentId,
      context,
      priorRenderedPath,
      renderError: updates.render_error,
    });
    try {
      const { error } = await supabase.from('garments').update({
        render_status: 'ready',
        render_provider: 'gemini',
        rendered_image_path: priorRenderedPath,
        image_path: priorRenderedPath,
        render_error: null,
      }).eq('id', garmentId);
      if (error) {
        console.error('render_garment_image failed to restore prior render', {
          garmentId,
          context,
          updateError: error.message,
        });
      }
    } catch (restoreError) {
      console.error('render_garment_image prior-render restore crashed', {
        garmentId,
        context,
        restoreError: getErrorMessage(restoreError),
      });
    }
  } else {
    await safeMarkRenderFailed(supabase, garmentId, updates, context);
  }
}

// ─── Handler ───

/**
 * render_garment_image — Gemini-based canonical garment render pipeline.
 *
 * Flow:
 *   1. checkOverload — short-circuit before any work
 *   2. feature gate
 *   3. auth
 *   4. enforceRateLimit (30/hr, 3/min)
 *   5. claim the garment atomically (race-safe)
 *   6. reserve one render credit (402 if insufficient)
 *   7. try: Gemini render + quality gates + upload → consume
 *      finally: if no consume, release (guarantees no charge on failure)
 *
 * Feature-gated via RENDER_PIPELINE_ENABLED env var.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // ── Scale guard: overload short-circuit (no auth/DB needed) ──
  if (checkOverload('render_garment_image')) {
    return overloadResponse(CORS_HEADERS);
  }

  let supabase: ReturnType<typeof createClient> | null = null;
  let garmentIdForFailure: string | null = null;
  let priorRenderedPath: string | null = null;
  let isForceRender = false;

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

    // ── Input parsing + validation (isolated from overload counter) ──
    // Parsed upfront so the internal-vs-external auth branch can inspect
    // body.internal before we choose between service-role trust + body.userId
    // and getUser(). Parse error paths return 400 without recordError — same
    // DoS-guard rationale as P4 Bug 10.
    let garmentId: string;
    let force: boolean | undefined;
    let clientNonce: string;
    let isInternalInvocation = false;
    let internalUserId: string | null = null;
    let internalJobId: string | null = null;
    // Queued metadata forwarded by process_render_jobs from the render_jobs row.
    // Authoritative when present — prevents base-key drift if profile or
    // RENDER_PROMPT_VERSION change between enqueue and worker run (Codex
    // round 6). Null for external (P4 legacy) callers; they fall back to
    // live profile + current constant below.
    let internalPresentation: string | null = null;
    let internalPromptVersion: string | null = null;
    try {
      const rawBody: unknown = await req.json();
      if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
        return new Response(
          JSON.stringify({ error: 'Request body must be a JSON object' }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
      const bodyObj = rawBody as Record<string, unknown>;

      if (typeof bodyObj.garmentId !== 'string' || bodyObj.garmentId.length === 0) {
        return new Response(
          JSON.stringify({ error: 'garmentId is required' }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
      garmentId = bodyObj.garmentId;
      force = typeof bodyObj.force === 'boolean' ? bodyObj.force : undefined;

      const rawNonce = (typeof bodyObj.clientNonce === 'string' && bodyObj.clientNonce.length > 0)
        ? bodyObj.clientNonce
        : null;

      // clientNonce is REQUIRED on every render path (force and non-force).
      //
      // If we fell back to crypto.randomUUID() on the server, a client that
      // retries a transient failure (edgeFunctionClient does this automatically)
      // sends the same body back with no nonce → server generates a NEW random
      // nonce on each retry → each retry creates a DISTINCT reservation →
      // user is charged N times for N retries AND N concurrent Gemini calls
      // fire. Every caller in this repo (SwipeableGarmentCard, GarmentConfirmSheet,
      // garmentIntelligence) now passes clientNonce, and the app ships as a web
      // bundle (Median.co wrapper, no separate native layer), so there's no
      // "old client" back-compat to preserve.
      if (!rawNonce) {
        return new Response(
          JSON.stringify({
            error: 'client_nonce_required',
            message: 'clientNonce is required for idempotent render requests',
          }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }

      clientNonce = rawNonce;
      garmentIdForFailure = garmentId;

      // P5 internal path: worker (process_render_jobs) calls us with
      // { internal: true, jobId, userId, ... } + service-role Bearer.
      // We skip getUser and use body.userId directly. Reserve is already
      // claimed at enqueue; reserve's replay flag ensures the re-reserve
      // call below hits the idempotency path without double-charging.
      if (bodyObj.internal === true) {
        // Constant-time compare — see _shared/timing-safe.ts for why.
        // A misconfigured empty serviceKey is rejected at the env-load
        // level by the length check below.
        if (!serviceKey || serviceKey.length < 32 || !timingSafeEqual(token, serviceKey)) {
          return new Response(
            JSON.stringify({ error: 'internal mode requires service role' }),
            { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
          );
        }
        if (typeof bodyObj.userId !== 'string' || bodyObj.userId.length === 0) {
          return new Response(
            JSON.stringify({ error: 'internal mode requires userId' }),
            { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
          );
        }
        if (typeof bodyObj.jobId !== 'string' || bodyObj.jobId.length === 0) {
          return new Response(
            JSON.stringify({ error: 'internal mode requires jobId' }),
            { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
          );
        }
        isInternalInvocation = true;
        internalUserId = bodyObj.userId;
        internalJobId = bodyObj.jobId;
        // Read queued metadata forwarded by process_render_jobs. Absence is
        // tolerated (older worker versions, or a direct internal call that
        // predates P5 round 6) → we fall back to live profile + constant.
        if (typeof bodyObj.presentation === 'string' && bodyObj.presentation.length > 0) {
          internalPresentation = normalizeMannequinPresentation(bodyObj.presentation);
        }
        if (typeof bodyObj.promptVersion === 'string' && bodyObj.promptVersion.length > 0) {
          internalPromptVersion = bodyObj.promptVersion;
        }
      }
    } catch (parseError) {
      // SyntaxError from req.json(), TypeError from destructuring a non-object,
      // or anything else originating in user-supplied input. NOT a system issue —
      // do not record against the overload counter.
      console.warn('render_garment_image invalid request body', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Resolve user (either via JWT or internal trust) ──
    let user: { id: string };
    if (isInternalInvocation) {
      user = { id: internalUserId! };
    } else {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user: authedUser },
        error: userError,
      } = await authClient.auth.getUser(token);

      if (userError || !authedUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      user = { id: authedUser.id };
    }

    supabase = createClient(supabaseUrl, serviceKey);

    // ── Scale guard: per-user rate limit ──
    // Internal invocations skip this: the worker (process_render_jobs) is
    // not a user — it's our own code. Rate-limiting the worker would limit
    // the whole queue throughput, not the user; the user was already rate
    // limited in enqueue_render_job.
    if (!isInternalInvocation) {
      await enforceRateLimit(supabase, user.id, 'render_garment_image');
    }

    // ── Fetch garment ──
    // Selecting render_provider so we can snapshot + restore it on unclaim
    // paths (Bug 2 fix). claimGarmentRender overwrites it to 'gemini'; if
    // reserve fails after claim, we restore prior provider along with status.
    const { data: garment, error: garmentError } = await supabase
      .from('garments')
      .select(
        'id, user_id, title, category, subcategory, color_primary, color_secondary, material, pattern, fit, formality, ai_raw, ' +
        'original_image_path, image_path, render_status, render_error, rendered_image_path, render_presentation_used, render_provider, rendered_at',
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

    // Don't re-render if already ready/rendering/skipped, unless caller forces.
    // Note: these early returns happen BEFORE claim + reserve so no credit is charged.
    if (!force && (garment.render_status === 'ready' || garment.render_status === 'rendering' || garment.render_status === 'skipped')) {
      // Include renderedImagePath when present so P5 worker (process_render_jobs)
      // can recognize this as an already-rendered success rather than a
      // generic "skipped" (no path) result — matters for the narrow
      // worker-crash-after-render-before-status-update path where stale
      // recovery re-claims the row.
      const alreadyReadyBody: Record<string, unknown> = {
        ok: true,
        skipped: true,
        reason: `Already ${garment.render_status}`,
      };
      if (garment.render_status === 'ready' && garment.rendered_image_path) {
        alreadyReadyBody.rendered = true;
        alreadyReadyBody.renderedImagePath = garment.rendered_image_path;
        alreadyReadyBody.renderedAt = garment.rendered_at;

        // Ledger-healing consume for the worker-crash-between-render-and-consume
        // scenario: garments.render_status was flipped to 'ready' at line ~1190
        // in a prior attempt, but the Deno isolate crashed before the consume
        // RPC fired. Stale recovery reset the job, the worker re-claimed, and
        // we're now here with a rendered garment but (possibly) an un-consumed
        // reserve. Calling consumeCredit with the operation-prefixed consume
        // key is idempotent: if the prior attempt did consume, this hits the
        // idempotency short-circuit (duplicate=true, balance untouched). If
        // the prior attempt crashed pre-consume, this writes the consume tx
        // and moves `reserved` → `used_this_period` (or decrements source
        // counters for trial_gift/topup). Either way the ledger converges.
        //
        // Only runs on internal (worker) calls — for P4 external callers,
        // this path was a pure no-op and we preserve that behavior.
        if (isInternalInvocation && internalJobId) {
          try {
            // Prefer queued values from the render_jobs row (forwarded by
            // process_render_jobs) so healBaseKey matches the reserve_key
            // persisted at enqueue even if the user's profile or
            // RENDER_PROMPT_VERSION changed since. Fall back to profile
            // only if the worker didn't forward presentation (e.g. older
            // worker, or a direct internal call predating round 6).
            let presentationForHeal = internalPresentation;
            if (!presentationForHeal) {
              const { data: profileForHeal } = await supabase
                .from('profiles')
                .select('mannequin_presentation')
                .eq('id', user.id)
                .maybeSingle();
              presentationForHeal = normalizeMannequinPresentation(
                profileForHeal?.mannequin_presentation,
              );
            }
            const promptVersionForHeal = internalPromptVersion ?? RENDER_PROMPT_VERSION;
            const healBaseKey =
              `${user.id}_${garment.id}_${presentationForHeal}_${promptVersionForHeal}_${clientNonce}`;
            const healResult = await consumeCredit(
              supabase,
              user.id,
              internalJobId,
              `consume:${healBaseKey}`,
            );
            console.log('render_garment_image already-ready healing consume', {
              garmentId: garment.id,
              jobId: internalJobId,
              healed: healResult.ok && !healResult.duplicate,
              duplicate: Boolean(healResult.duplicate),
              reason: healResult.reason,
            });
          } catch (healErr) {
            // Non-fatal — worst case, orphan-reservation cron eventually
            // releases. We still report the render as successful to the
            // worker so it can mark the job succeeded.
            console.warn('render_garment_image healing consume threw', {
              garmentId: garment.id,
              jobId: internalJobId,
              error: healErr instanceof Error ? healErr.message : String(healErr),
            });
          }
        }
      }
      return new Response(
        JSON.stringify(alreadyReadyBody),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }
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

    // For internal (worker) invocations, use the queued presentation from the
    // render_jobs row. For external (P4 legacy) callers, fetch live from the
    // profile. This keeps the base key / reserve_key stable across the
    // enqueue→worker delay, so a profile change mid-queue doesn't produce a
    // second reserve transaction (Codex round 6).
    let mannequinPresentation: string;
    if (internalPresentation) {
      mannequinPresentation = internalPresentation;
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('mannequin_presentation')
        .eq('id', garment.user_id)
        .maybeSingle();
      mannequinPresentation = normalizeMannequinPresentation(profile?.mannequin_presentation);
    }
    // Same reasoning for prompt version — constant value can change across
    // deploys; the queued value pins the version that was current at enqueue.
    const effectivePromptVersion = internalPromptVersion ?? RENDER_PROMPT_VERSION;

    console.log('render_garment_image Gemini provider config', {
      garmentId: garment.id,
      provider: 'gemini',
      geminiApiKeyConfigured: hasGeminiApiKey,
      model: GEMINI_IMAGE_MODEL,
      endpoint: GEMINI_IMAGE_API_URL,
      sourceImagePath,
      mannequinPresentation,
    });

    // ── Snapshot prior state BEFORE claim ──
    // claimGarmentRender overwrites render_status, render_presentation_used,
    // render_error, and render_provider. If reserve (or anything else before
    // consume) fails, we restore this snapshot instead of forcing 'none' —
    // otherwise a force re-render that fails reservation would destroy the
    // user's existing 'ready' state and leave the UI showing no render.
    const priorState = {
      render_status: garment.render_status as string | null,
      render_error: garment.render_error as string | null,
      render_presentation_used: garment.render_presentation_used as string | null,
      render_provider: garment.render_provider as string | null,
    };

    const restorePriorState = async (reason: string) => {
      // Preserve prior state verbatim when it was:
      //   - 'ready'   : successful prior render the client still sees
      //   - 'skipped' : eligibility gate decided no render was needed
      //   - 'pending' : a queued render intent kicked off elsewhere that
      //                 we haven't yet executed — resetting to 'none' would
      //                 silently drop the queue entry for that garment
      // All other prior states (failed, none, rendering) get reset to 'none'
      // so the user (or a retry) can re-attempt cleanly.
      const restoredStatus = (
        priorState.render_status === 'ready'
        || priorState.render_status === 'skipped'
        || priorState.render_status === 'pending'
      )
        ? priorState.render_status
        : 'none';
      const { error: unclaimError } = await supabase!
        .from('garments')
        .update({
          render_status: restoredStatus,
          render_error: priorState.render_error,
          render_presentation_used: priorState.render_presentation_used,
          render_provider: priorState.render_provider,
        })
        .eq('id', garment.id);
      if (unclaimError) {
        console.error('render_garment_image prior-state restore failed', {
          garmentId: garment.id,
          reason,
          restoredStatus,
          priorStatus: priorState.render_status,
          error: unclaimError.message,
        });
      }
    };

    // ── Claim render atomically before expensive prep ──
    const claimed = await claimGarmentRender(supabase, garment.id, mannequinPresentation, force);
    if (!claimed) {
      // Claim lost to a race — garment was updated by another process.
      // Nothing to revert (render_status wasn't touched, no credit reserved yet).
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

    // Store prior render so a failed force-regeneration can be restored
    priorRenderedPath = force ? (garment.rendered_image_path ?? null) : null;
    isForceRender = Boolean(force);

    // ── Reserve credit AFTER claim ──
    // Build a base key that uniquely identifies this logical render request:
    //   user × garment × presentation × prompt_version × clientNonce
    // Then namespace the three ledger operations with explicit prefixes:
    //   reserve:<base> / consume:<base> / release:<base>
    //
    // The prefixes use ':' (a char that can't appear in UUIDs or the underscored
    // base segments) so an attacker can't craft a clientNonce like "abc_consume"
    // that makes their reserve key collide with another request's consume key.
    //
    // render_job_id is derived from the BASE key (not any prefixed variant)
    // so all three ops share the same job_id — required for the ledger's
    // partial unique index terminal guard to work correctly.
    const baseKey =
      `${user.id}_${garment.id}_${mannequinPresentation}_${effectivePromptVersion}_${clientNonce}`;
    const reserveKey = `reserve:${baseKey}`;
    const consumeKey = `consume:${baseKey}`;
    const releaseKey = `release:${baseKey}`;

    // P5 internal invocations supply the canonical render_jobs.id as
    // jobId — this is the value reserve_credit_atomic recorded at enqueue,
    // so consume/release resolve the reserve row by the same ID. External
    // (legacy P4) callers still fall back to the deterministic SHA-256
    // derivation from baseKey; reserve's replay flag keeps either path
    // idempotent against retries.
    const jobId = isInternalInvocation
      ? (internalJobId as string)
      : await deriveJobId(baseKey);

    const reserveResult = await reserveCredit(supabase, user.id, jobId, reserveKey);

    if (!reserveResult.ok) {
      // Reserve denied (insufficient credits or RPC transport failure).
      // Restore prior state instead of forcing 'none' — keeps the existing
      // 'ready' render visible in the UI on force-regen 402s.
      await restorePriorState('reserve_denied');

      if (reserveResult.reason === 'rpc_error') {
        // Credit ledger transport/DB failure — this is a system-health
        // signal, not a user/business issue. Feed the overload counter so
        // checkOverload() can trip if the ledger stays flaky.
        recordError('render_garment_image');
        console.error('render_garment_image credit reservation failed (transport)', {
          garmentId: garment.id,
          userId: user.id,
          error: reserveResult.error,
        });
        return new Response(
          JSON.stringify({ ok: false, error: 'credit_ledger_unavailable' }),
          { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }

      // insufficient / no_credit_row / no_reservation / already_terminal — all boil down to 402
      const balance = await getBalance(supabase, user.id);
      const isTrial = isTrialFromBalance(balance.monthly_allowance);
      return new Response(
        JSON.stringify({
          error: isTrial ? 'trial_studio_locked' : 'insufficient_credits',
          remaining: balance.remaining,
          is_trial: isTrial,
          monthly_allowance: balance.monthly_allowance,
          period_end: balance.period_end,
        }),
        { status: 402, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Idempotency replay handling ──
    // Reserve returned { ok: true, replay: true } — the idempotency key was
    // already in the ledger, meaning this is a retry of a prior request.
    //
    // TWO CLASSES OF REPLAY:
    //
    // 1. External (P4 legacy) path: client called render_garment_image
    //    directly, retried the same clientNonce. The ONLY reason replay
    //    fires here is that a prior attempt actually reached reserveCredit
    //    on this function — so either there's a cached render or a prior
    //    in-flight attempt. Short-circuit: return cached / 202 / 409.
    //
    // 2. Internal (P5 queue) path: enqueue_render_job already reserved with
    //    this exact reserveKey before handing off to the queue, and
    //    process_render_jobs invokes us with internal:true + the same
    //    jobId + the same clientNonce. The reserve call above is EXPECTED
    //    to replay — that's correct by design (the ledger is idempotent on
    //    the key). Short-circuiting here would break the happy path: the
    //    worker would never call Gemini, attempts would tick up, and the
    //    job would eventually flip to 'failed' for a user who did nothing
    //    wrong.
    //
    //    For the internal path, treat replay as "reservation was made at
    //    enqueue, proceed" and fall through to the render pipeline. The
    //    consume at the end uses the same jobId — the ledger's
    //    terminal-uniqueness guard still prevents double-consume because
    //    consume's own idempotency key (consume:<baseKey>) is independent
    //    of the reserve replay state.
    if (reserveResult.replay && !isInternalInvocation) {
      // CRITICAL: Decide the replay branch from the pre-claim snapshot
      // (priorState.render_status), NOT a live re-fetch. Our own
      // claimGarmentRender() just set render_status to 'rendering' a few
      // lines up; reading it back would falsely report the prior job as
      // "in progress" on same-nonce retries after a failed/terminal
      // attempt and strand the client polling a dead request.
      // The rendered_image_path we captured at initial fetch is reliable
      // because any concurrent request that finished successfully would
      // have been short-circuited by the early-return at 'ready' state.
      const replayStatus = priorState.render_status;
      const replayPath = garment.rendered_image_path;
      const replayRenderedAt = garment.rendered_at;

      console.log('render_garment_image reserve replay', {
        garmentId: garment.id,
        userId: user.id,
        baseKey,
        reserveSource: reserveResult.source,
        priorStatus: replayStatus,
        hasRenderedPath: Boolean(replayPath),
      });

      // Release our claim — we are NOT running the render. Restore the
      // pre-claim snapshot so the garment is back in the state the client
      // saw before this retry.
      await restorePriorState('replay_unclaim');

      if (replayStatus === 'ready' && replayPath) {
        // Prior attempt succeeded — return the cached render without
        // calling Gemini. No consume fires (the original consume already
        // charged the credit).
        return new Response(
          JSON.stringify({
            ok: true,
            rendered: true,
            replay: true,
            renderedImagePath: replayPath,
            renderedAt: replayRenderedAt,
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }

      if (replayStatus === 'pending' || replayStatus === 'rendering') {
        // Prior attempt still in flight under a different request. Client
        // should poll the garment row for completion. Note: 'rendering' is
        // unreachable in practice because line ~510 early-returns when the
        // initial fetch sees 'rendering' — kept for defensive correctness
        // in case that early-return is ever relaxed.
        return new Response(
          JSON.stringify({
            ok: true,
            rendered: false,
            replay: true,
            inProgress: true,
            reason: `Render already in progress (status=${replayStatus})`,
          }),
          { status: 202, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }

      // failed / skipped / none on replay — the reservation has already
      // been terminated (via finally's release in the prior attempt, or
      // by a consume against an already-rendered job). Re-running Gemini
      // here would render for free because the ledger's terminal-uniqueness
      // guard blocks a second consume. Ask the client to retry with a
      // fresh clientNonce so a new reservation can be made.
      console.warn('render_garment_image replay against non-ready/non-inflight state', {
        garmentId: garment.id,
        userId: user.id,
        priorStatus: replayStatus,
        baseKey,
      });
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'replay_terminal',
          replay: true,
          message: 'Prior render attempt has completed. Retry with a fresh clientNonce.',
          render_status: replayStatus,
        }),
        { status: 409, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Expensive work: if we exit this try{} without consumed=true, the finally releases ──
    let consumed = false;

    try {
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

      // When force is true, bypass the product-ready gate — caller explicitly wants a new render
      if (!force && eligibilityAssessment?.decision === 'skip_product_ready') {
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

        // Credit is released by the outer finally — eligibility skip means Gemini never ran
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

      // ── Call Gemini image-gen via shared transport ──
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY')?.trim() ?? '';
      let outputBytes: Uint8Array;
      let outputMimeType: string;

      try {
        const result = await generateGeminiImage({
          apiKey: geminiApiKey,
          prompt,
          dataUrl,
          garmentId: garment.id,
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
          // Provider anomaly: Gemini returned 200 but with text instead of
          // an image. Record as a system-health signal — repeated hits
          // mean the model is misbehaving and checkOverload() should trip.
          recordError('render_garment_image');
          await safeRestoreOrFailRender(supabase, garment.id, {
            render_error: errorMessage,
          }, 'invalid_ai_output', priorRenderedPath, isForceRender);

          // Credit released by outer finally
          return new Response(
            JSON.stringify({ ok: true, rendered: false, error: errorMessage }),
            { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
          );
        }

        // Any other gemini_* error (auth, model path, API 5xx, unknown)
        // bubbles to the outer catch, which calls recordError there.
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
        await safeRestoreOrFailRender(supabase, garment.id, {
          render_error: `Quality gate rejected image: output too small (${outputBytes.length} bytes). Likely blank or corrupt.`,
        }, 'quality_gate_output_too_small', priorRenderedPath, isForceRender);

        return new Response(
          JSON.stringify({ ok: true, rendered: false, error: 'Output too small' }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }

      if (outputBytes.length > MAX_SIZE_BYTES) {
        await safeRestoreOrFailRender(supabase, garment.id, {
          render_error: `Quality gate rejected image: output too large (${outputBytes.length} bytes).`,
        }, 'quality_gate_output_too_large', priorRenderedPath, isForceRender);

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
          const retryResult = await generateGeminiImage({
            apiKey: geminiApiKey,
            prompt: retryPrompt,
            dataUrl,
            garmentId: garment.id,
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

          await safeRestoreOrFailRender(supabase, garment.id, {
            render_error: `Quality gate rejected render after retry: ${validationAssessment.reason} (confidence=${confidenceLabel})`,
            rendered_image_path: null,
            rendered_at: null,
          }, 'quality_gate_visible_mannequin_retry', priorRenderedPath, isForceRender);

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

      // ── Consume credit — the render succeeded end-to-end ──
      // Using the operation-prefixed consumeKey built above (consume:<base>).
      const consumeResult = await consumeCredit(supabase, user.id, jobId, consumeKey);
      if (!consumeResult.ok) {
        // Extremely unlikely: reserve worked but consume failed. Log loudly and proceed —
        // the user got a render, the ledger is slightly inconsistent but never over-charged.
        // The orphaned-reservation cleanup cron will catch this case later.
        console.error('render_garment_image consume failed after successful render', {
          garmentId: garment.id,
          userId: user.id,
          reason: consumeResult.reason,
          error: consumeResult.error,
        });
      }
      consumed = true;

      console.log(`Rendered garment ${garment.id} → ${renderedPath}`);

      return new Response(
        JSON.stringify({ ok: true, rendered: true, renderedImagePath: renderedPath }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    } finally {
      // Any non-success path (thrown error, quality-gate-rejected return, eligibility-skip return,
      // gemini_no_image return) leaves consumed=false, so we release the reservation.
      // Failure in release is non-fatal — the orphan cleanup cron will eventually reconcile.
      if (!consumed) {
        try {
          // Using the operation-prefixed releaseKey built above (release:<base>).
          const releaseResult = await releaseCredit(supabase, user.id, jobId, releaseKey);
          if (!releaseResult.ok && !releaseResult.duplicate) {
            console.error('render_garment_image release failed in finally', {
              garmentId: garmentIdForFailure,
              userId: user.id,
              reason: releaseResult.reason,
              error: releaseResult.error,
            });
          }
        } catch (releaseError) {
          console.error('render_garment_image release crashed in finally', {
            garmentId: garmentIdForFailure,
            error: getErrorMessage(releaseError),
          });
        }
      }
    }
  } catch (error) {
    // Rate-limit rejections are expected back-pressure signals, not
    // system failures — don't feed the overload counter. All other
    // uncategorised throws (Gemini auth/model/API 5xx, storage failures,
    // unexpected DB errors) ARE system-health signals — record them so
    // checkOverload() can short-circuit if failures stack up.
    if (error instanceof RateLimitError) {
      return rateLimitResponse(error, CORS_HEADERS);
    }

    recordError('render_garment_image');

    const errorMessage = getErrorMessage(error);
    console.error('render_garment_image error', {
      garmentId: garmentIdForFailure,
      provider: 'gemini',
      geminiApiKeyConfigured: Boolean(Deno.env.get('GEMINI_API_KEY')?.trim()),
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (supabase && garmentIdForFailure) {
      await safeRestoreOrFailRender(supabase, garmentIdForFailure, {
        render_error: errorMessage,
      }, 'top_level_catch', priorRenderedPath, isForceRender);
    }

    return bursAIErrorResponse(error, CORS_HEADERS);
  }
});
