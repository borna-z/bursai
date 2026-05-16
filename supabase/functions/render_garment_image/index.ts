import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { bursAIErrorResponse } from '../_shared/burs-ai.ts';
import { CORS_HEADERS } from '../_shared/cors.ts';
import { assessRenderEligibilityWithGemini, PRODUCT_READY_RENDER_GATE_PROVIDER, validateRenderedGarmentOutputWithGemini } from '../_shared/render-eligibility.ts';
import { captureWarning, classifyValidatorError } from '../_shared/observability.ts';
import { normalizeMannequinPresentation } from '../_shared/mannequin-presentation.ts';
import { classifyCategory } from '../_shared/render-category.ts';
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, recordError, overloadResponse, enforceSubscription, subscriptionLockedResponse } from '../_shared/scale-guard.ts';
import {
  buildInsufficientCreditsBody,
  buildRenderCreditKeys,
  classifyReplayBranch,
  consumeRenderCredit,
  healRenderCreditOnAlreadyReady,
  releaseRenderCreditOnFailure,
  reserveRenderCredit,
  resolveRenderJobId,
} from '../_shared/render-credit-flow.ts';
import {
  generateGeminiImage,
  maskApiKey,
  RenderProviderError,
  GEMINI_IMAGE_MODEL,
  GEMINI_IMAGE_API_URL,
} from '../_shared/gemini-image-client.ts';
import { timingSafeEqual } from '../_shared/timing-safe.ts';
import {
  type MannequinPresentation,
  RETRY_VARIANTS,
  runRenderRetryChain,
  sourceHasBranding,
} from '../_shared/render-prompt-builder.ts';
import {
  extractImageDimensions,
  isValidImageMagic,
  validateInputImage,
} from '../_shared/render-validator.ts';

/**
 * Bump this when the render prompt or Gemini parameters change materially.
 * Folded into the credit-ledger idempotency key so stale reservations
 * don't short-circuit a pipeline change.
 *
 * v1 → v2 (Wave 3-B, 2026-04-21):
 *   - Category-aware prompts (P16): shoes/bags/jewelry get product-shot
 *     treatment instead of forced ghost-mannequin.
 *   - Category-first prompt ordering (F2): "A {category}: {subcategory}"
 *     is now the first line Gemini sees.
 *   - Enriched mannequin presentation (F5): richer body-shape hints.
 *   - Multi-prompt retry chain (P17): 3 attempts with distinct strategies.
 *   - Category-aware validation (P18): shoe-on-mannequin is now rejected;
 *     wrong-category outputs are rejected; silent logo loss is rejected.
 */
const RENDER_PROMPT_VERSION = 'v2';

// Wave 3-B P16: category classification for prompt + validation routing.
// Moved to `_shared/render-category.ts` in Wave 3-B fix 10 (Codex P2 r7) so
// render-eligibility's validator uses the same branching decision — before
// the extract, the two sides disagreed on unknown-category defaults and
// systematically rejected valid renders as `reject_wrong_category`.

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'Unknown error');
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js
  // generic narrowing (same as calendar.ts + prefetch_suggestions + the inner
  // `garment` cast above). `.update()` / `.from()` narrow to `never` here when
  // the caller passes the real service-role client, breaking deno-check on
  // every write. Runtime behaviour is unchanged.
  supabase: any,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js
  // generic narrowing (same as calendar.ts + prefetch_suggestions + the inner
  // `garment` cast above). `.update()` / `.from()` narrow to `never` here when
  // the caller passes the real service-role client, breaking deno-check on
  // every write. Runtime behaviour is unchanged.
  supabase: any,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js
  // generic narrowing (same as calendar.ts + prefetch_suggestions + the inner
  // `garment` cast above). `.update()` / `.from()` narrow to `never` here when
  // the caller passes the real service-role client, breaking deno-check on
  // every write. Runtime behaviour is unchanged.
  supabase: any,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js
  // generic narrowing (same as calendar.ts + prefetch_suggestions + the inner
  // `garment` cast above). `.update()` / `.from()` narrow to `never` here when
  // the caller passes the real service-role client, breaking deno-check on
  // every write. Runtime behaviour is unchanged.
  supabase: any,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
  let supabase: any = null;
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
    // Decoupled inter-function bearer for the worker chain. See
    // process_render_jobs/index.ts auth block for the full rationale and
    // rotation procedure. Used ONLY by the `internal: true` worker path
    // below; the user-JWT path (getUser) is untouched.
    const workerBearer = Deno.env.get('RENDER_WORKER_BEARER') ?? '';

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
        // We compare against RENDER_WORKER_BEARER (a shared secret we own)
        // instead of SUPABASE_SERVICE_ROLE_KEY, which is baked into the
        // function image at deploy time and drifts when Supabase rotates
        // the project signing secret. See process_render_jobs/index.ts
        // auth block for the full rationale.
        if (!workerBearer || workerBearer.length < 32 || !timingSafeEqual(token, workerBearer)) {
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

      // Wave 8 P54 — paywall gate. Skipped on internal worker invocations
      // for the same reason as the rate limit above: the worker is not a
      // user, the user was already gated by enqueue_render_job's credit
      // reservation upstream.
      const subCheck = await enforceSubscription(supabase, user.id);
      if (!subCheck.allowed) {
        return subscriptionLockedResponse(subCheck.reason, CORS_HEADERS);
      }
    }

    // ── Fetch garment ──
    // Selecting render_provider so we can snapshot + restore it on unclaim
    // paths (Bug 2 fix). claimGarmentRender overwrites it to 'gemini'; if
    // reserve fails after claim, we restore prior provider along with status.
    // Cast to `any` after the null guard. Same supabase-js generic-narrowing
    // issue as in calendar.ts + prefetch_suggestions.ts: the recent typings
    // collapse `.single()` return to `SupabaseClient<unknown, ..., never, never>`
    // which makes every downstream `garment.<field>` access fail deno-check
    // with TS2339 'Property X does not exist on type never'. All field
    // accesses below are runtime-safe — the select list enumerates them
    // explicitly.
    const { data: garmentRaw, error: garmentError } = await supabase
      .from('garments')
      .select(
        'id, user_id, title, category, subcategory, color_primary, color_secondary, material, pattern, fit, formality, ai_raw, ' +
        // Wave R-B — mask_status branches the system prompt below: 'masked'
        // input tells Gemini the background is already transparent so it
        // can skip the "remove background" instruction and focus on
        // lighting + product framing. Other values fall back to today's
        // full-removal prompt.
        'original_image_path, image_path, mask_status, render_status, render_error, rendered_image_path, render_presentation_used, render_provider, rendered_at',
      )
      .eq('id', garmentId)
      .eq('user_id', user.id)
      .single();
    const garment = garmentRaw as any;

    if (garmentError || !garment) {
      return new Response(JSON.stringify({ error: 'Garment not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Don't re-render if already ready/rendering/skipped, unless caller forces.
    // Note: these early returns happen BEFORE claim + reserve so no credit is charged.
    if (!force && (garment.render_status === 'ready' || garment.render_status === 'rendering' || garment.render_status === 'skipped')) {
      // For INTERNAL (P5 worker) invocations only: `render_status='rendering'`
      // means a concurrent in-flight render is underway (either worker N's
      // Deno isolate that still hasn't completed its Gemini call, or an
      // external caller mid-render). The worker's `deferred` contract needs
      // a distinct response so `handleRenderJob` keeps the job pending
      // WITHOUT writing a release tx — releasing here would race the
      // in-flight consume and produce a free render (user pays nothing,
      // gets the render). Codex round 9 caught that this guard was
      // unreachable before — the old duplicate `deferred` branch further
      // down was dead code because this earlier guard returned first. See
      // state-machine doc Scenario 13.
      //
      // External (P4 legacy) callers still get skipped:true for
      // backward compatibility with the pre-queue contract.
      if (garment.render_status === 'rendering' && isInternalInvocation) {
        return new Response(
          JSON.stringify({ ok: true, deferred: true, reason: 'Already rendering' }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
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

        // Only runs on internal (worker) calls — for P4 external callers,
        // this path was a pure no-op and we preserve that behavior.
        if (isInternalInvocation && internalJobId) {
          // Prefer queued values from the render_jobs row (forwarded by
          // process_render_jobs) so healBaseKey matches the reserve_key
          // persisted at enqueue even if the user's profile or
          // RENDER_PROMPT_VERSION changed since. Fall back to profile
          // only if the worker didn't forward presentation (e.g. older
          // worker, or a direct internal call predating round 6).
          let presentationForHeal = internalPresentation;
          if (!presentationForHeal) {
            const { data: profileForHealRaw } = await supabase
              .from('profiles')
              .select('mannequin_presentation')
              .eq('id', user.id)
              .maybeSingle();
            const profileForHeal = profileForHealRaw as { mannequin_presentation?: string | null } | null;
            presentationForHeal = normalizeMannequinPresentation(
              profileForHeal?.mannequin_presentation,
            );
          }
          const promptVersionForHeal = internalPromptVersion ?? RENDER_PROMPT_VERSION;
          const healBaseKey =
            `${user.id}_${garment.id}_${presentationForHeal}_${promptVersionForHeal}_${clientNonce}`;
          await healRenderCreditOnAlreadyReady(
            supabase,
            user.id,
            internalJobId,
            healBaseKey,
            { garmentId: garment.id },
          );
        }
      }
      return new Response(
        JSON.stringify(alreadyReadyBody),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }
    // NOTE: the earlier guard (line ~611) handles every `render_status='rendering'`
    // case — it returns `deferred:true` for internal invocations and
    // `skipped:true` for external. The standalone `if (render_status === 'rendering')`
    // check that used to live here in the round-7 patch was dead code (Codex
    // round 9). Removed to avoid confusing future readers.

    // ── Resolve source image ──
    //
    // Wave R-B — when `mask_status='masked'` the row's `image_path` is an
    // on-device-segmented WebP with a transparent background. Feeding that
    // to Gemini instead of the raw original lets the model focus on
    // lighting + product framing instead of redoing background removal
    // server-side, and it ships the cleaner cutout straight through if
    // Gemini's vision step has trouble isolating the subject. Any other
    // mask_status value (including NULL on legacy rows) falls back to
    // today's behaviour: prefer the unaltered original.
    //
    // Codex P2 round 1 — after the FIRST successful render the row's
    // `image_path` is overwritten to the rendered output path (see lines
    // ~638 and ~1831), but `mask_status` stays `'masked'`. A subsequent
    // force-regenerate would then feed the previous studio render back
    // to Gemini as the "masked source" — wrong on its face and quality-
    // drift inducing. Guard: only treat `image_path` as the masked
    // capture when it has NOT been overwritten by a prior render
    // (`image_path !== rendered_image_path` AND there is no prior
    // rendered output). When the guard fails, fall back to
    // `original_image_path` which is preserved across renders and is
    // always the raw user capture.
    const imagePathIsStillMaskedCapture =
      typeof garment.image_path === 'string' &&
      garment.image_path.length > 0 &&
      garment.image_path !== garment.rendered_image_path;
    const maskedRender =
      garment.mask_status === 'masked' &&
      imagePathIsStillMaskedCapture;
    const sourceImagePath = maskedRender
      ? garment.image_path
      : (garment.original_image_path || garment.image_path);

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
    // Typed as MannequinPresentation so downstream calls into
    // mannequinPresentationInstruction() + claimGarmentRender() see the
    // literal-union type Deno expects. `internalPresentation` is already
    // normalized at parse time (see internal-mode branch at ~line 536) so the
    // assignment is safe; `normalizeMannequinPresentation` also returns
    // MannequinPresentation.
    let mannequinPresentation: MannequinPresentation;
    if (internalPresentation) {
      mannequinPresentation = internalPresentation as MannequinPresentation;
    } else {
      const { data: profileRaw } = await supabase
        .from('profiles')
        .select('mannequin_presentation')
        .eq('id', garment.user_id)
        .maybeSingle();
      // Same supabase-js `any` cast as `garment` / `garmentForPrompt` — the
      // profile query narrows to `never` under Deno's strict inference.
      const profile = profileRaw as { mannequin_presentation?: string | null } | null;
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
      // Claim lost to a race — garment was updated by another process between
      // our earlier fetch and now. Inspect the landing state:
      //   * 'rendering'  → concurrent in-flight render. Use the `deferred`
      //                    response so the worker keeps the job pending
      //                    instead of prematurely releasing the reservation
      //                    (would race with the in-flight consume).
      //   * 'ready' / 'skipped' / anything else → prior terminal state,
      //     safe for worker to terminalize with release (no consume is
      //     coming from the other branch).
      const { data: latestGarment } = await supabase
        .from('garments')
        .select('render_status')
        .eq('id', garment.id)
        .maybeSingle();

      const latestStatus = latestGarment?.render_status ?? 'claimed';
      if (latestStatus === 'rendering') {
        return new Response(
          JSON.stringify({
            ok: true,
            deferred: true,
            reason: 'Already rendering',
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: `Already ${latestStatus}`,
        }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Store prior render so a failed force-regeneration can be restored
    priorRenderedPath = force ? (garment.rendered_image_path ?? null) : null;
    isForceRender = Boolean(force);

    // ── Reserve credit AFTER claim ──
    // render_job_id is derived from the BASE key (not any prefixed variant)
    // so all three ops share the same job_id — required for the ledger's
    // partial unique index terminal guard to work correctly.
    const { baseKey, reserveKey, consumeKey, releaseKey } = buildRenderCreditKeys({
      userId: user.id,
      garmentId: garment.id,
      presentation: mannequinPresentation,
      promptVersion: effectivePromptVersion,
      clientNonce,
    });

    const jobId = await resolveRenderJobId({
      isInternalInvocation,
      internalJobId,
      baseKey,
    });

    const reserveResult = await reserveRenderCredit(
      supabase,
      user.id,
      jobId,
      reserveKey,
      { garmentId: garment.id, functionName: 'render_garment_image' },
    );

    if (!reserveResult.ok) {
      // Reserve denied (insufficient credits or RPC transport failure).
      // Restore prior state instead of forcing 'none' — keeps the existing
      // 'ready' render visible in the UI on force-regen 402s.
      await restorePriorState('reserve_denied');

      if (reserveResult.reason === 'rpc_error') {
        return new Response(
          JSON.stringify({ ok: false, error: 'credit_ledger_unavailable' }),
          { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }

      // insufficient / no_credit_row / no_reservation / already_terminal — all boil down to 402
      const { body } = await buildInsufficientCreditsBody(supabase, user.id);
      return new Response(
        JSON.stringify(body),
        { status: 402, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Idempotency replay handling ──
    // External (P4 legacy) replays short-circuit: a prior attempt already
    // reached this function, so either there's a cached render, an
    // in-flight one, or a terminal state we can't safely re-render
    // (the ledger's terminal-uniqueness guard would block a second
    // consume → free render).
    //
    // Internal (P5 worker) replays fall through: enqueue_render_job
    // already reserved with this exact reserveKey, so the call above is
    // EXPECTED to replay. Short-circuiting would never call Gemini,
    // attempts would tick up, and the job would fail for a user who did
    // nothing wrong. The consume at the end uses the same jobId and the
    // consume:<baseKey> key is independent of reserve replay state.
    if (reserveResult.replay && !isInternalInvocation) {
      const replayBranch = classifyReplayBranch({
        priorRenderStatus: priorState.render_status,
        renderedImagePath: garment.rendered_image_path,
        renderedAt: garment.rendered_at,
      });

      console.log('render_garment_image reserve replay', {
        garmentId: garment.id,
        userId: user.id,
        baseKey,
        reserveSource: reserveResult.source,
        priorStatus: priorState.render_status,
        branch: replayBranch.kind,
      });

      await restorePriorState('replay_unclaim');

      if (replayBranch.kind === 'cached') {
        return new Response(
          JSON.stringify({
            ok: true,
            rendered: true,
            replay: true,
            renderedImagePath: replayBranch.renderedImagePath,
            renderedAt: replayBranch.renderedAt,
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }

      if (replayBranch.kind === 'in_progress') {
        return new Response(
          JSON.stringify({
            ok: true,
            rendered: false,
            replay: true,
            inProgress: true,
            reason: replayBranch.reason,
          }),
          { status: 202, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }

      // terminal — fresh clientNonce required to write a new reservation.
      console.warn('render_garment_image replay against non-ready/non-inflight state', {
        garmentId: garment.id,
        userId: user.id,
        priorStatus: replayBranch.priorStatus,
        baseKey,
      });
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'replay_terminal',
          replay: true,
          message: 'Prior render attempt has completed. Retry with a fresh clientNonce.',
          render_status: replayBranch.priorStatus,
        }),
        { status: 409, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Expensive work: if we exit this try{} without consumed=true, the finally releases ──
    let consumed = false;

    try {
      // ── Re-fetch garment after claim to get latest enrichment data ──
      // Same supabase-js `any` cast as above — `.maybeSingle()` collapses to
      // `never` under strict inference, breaking downstream `.category`,
      // `.subcategory`, `.ai_raw` accesses inside the retry loop.
      const { data: freshGarment } = await supabase
        .from('garments')
        .select('id, user_id, title, category, subcategory, color_primary, color_secondary, material, pattern, fit, formality, ai_raw, original_image_path, image_path, mask_status')
        .eq('id', garment.id)
        .maybeSingle();
      const garmentForPrompt: any = freshGarment ?? garment;

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

      // Wave 3-B F13: input preflight. Reject obviously unusable sources
      // BEFORE burning eligibility-gate + Gemini-image-gen tokens. Flagging
      // here also means we don't eat a credit on a "garbage in → garbage
      // out" render the user will just regenerate.
      //
      // Min dimensions are set at 400x400 — lower than the ideal 4:5 source
      const inputValidation = validateInputImage(imageBytes);
      if (!inputValidation.ok) {
        const failureContext = inputValidation.code === 'input_too_small'
          ? 'input_preflight_too_small'
          : inputValidation.code === 'input_too_large'
          ? 'input_preflight_too_large'
          : 'input_preflight_low_resolution';
        const errorLabel = inputValidation.code === 'input_too_small'
          ? 'Source image too small'
          : inputValidation.code === 'input_too_large'
          ? 'Source image too large'
          : 'Source resolution too low';
        await safeRestoreOrFailRender(supabase, garment.id, {
          render_error: inputValidation.message,
        }, failureContext, priorRenderedPath, isForceRender);
        const responseBody: Record<string, unknown> = { ok: true, rendered: false, error: errorLabel };
        if (inputValidation.code === 'input_low_resolution') {
          responseBody.dims = { width: inputValidation.width, height: inputValidation.height };
        }
        return new Response(
          JSON.stringify(responseBody),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
      const inputFormat = isValidImageMagic(imageBytes);
      if (!inputFormat) {
        console.warn('render_garment_image input preflight: unknown image format', {
          garmentId: garment.id,
          bytes: imageBytes.length,
          firstBytes: Array.from(imageBytes.slice(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join(' '),
        });
      }
      const inputDims = extractImageDimensions(imageBytes);
      console.log('render_garment_image input preflight', {
        garmentId: garment.id,
        format: inputFormat,
        bytes: imageBytes.length,
        dims: inputDims,
      });

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

      // ── Wave 3-B P17: 3-attempt retry chain with distinct prompt variants ──
      //
      // Each attempt uses a different prompt strategy so a retry isn't just
      // a re-roll of the same instructions. We run the FULL pipeline per
      // attempt — Gemini generate → structural bytes/dims check → Gemini
      // validation gate — and only accept when all three pass. On retryable
      // rejections (mannequin-visible, wrong-category, logo-missing, or
      // Gemini's own "no-image" text response), we advance to the next
      // variant. Hard provider errors (auth / model_path) bubble out
      // immediately without consuming retry budget.
      //
      // Variants: primary → tightened → minimal (see buildGarmentRenderPrompt).
      // Empirically, most first-attempt failures are mannequin-bleed; the
      // tightened variant fixes those. The minimal variant is a safety net
      // for the "Gemini refused to edit" pathology where over-constrained
      // prompts trigger safety or text-only responses.

      const geminiApiKey = Deno.env.get('GEMINI_API_KEY')?.trim() ?? '';
      const expectLogoOrText = sourceHasBranding(garmentForPrompt.ai_raw);
      const categoryClass = classifyCategory(garmentForPrompt.category, garmentForPrompt.subcategory);

      const retryResult = await runRenderRetryChain({
        garment: garmentForPrompt,
        mannequinPresentation,
        maskedInput: maskedRender,
        onAttemptRejected: ({ variant, attemptIndex, errorCode, errorMessage, outputBytes }) => {
          // Per-attempt structural-rejection logs — restores the
          // observability the pre-extraction retry loop emitted for each of
          // `output_bad_magic` / `output_too_small` / `output_too_large` /
          // `output_low_resolution`. Keeps the chain itself context-agnostic
          // (no garmentId / no logger inside `_shared/`).
          if (errorCode === 'output_bad_magic') {
            console.warn('render_garment_image attempt rejected: bad magic bytes', {
              garmentId: garment.id,
              attempt: attemptIndex + 1,
              variant,
              firstBytes: Array.from(outputBytes.slice(0, 8))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join(' '),
              bytes: outputBytes.length,
            });
          } else if (errorCode === 'output_too_small') {
            console.warn('render_garment_image attempt rejected: output too small', {
              garmentId: garment.id,
              attempt: attemptIndex + 1,
              variant,
              bytes: outputBytes.length,
              errorMessage,
            });
          } else if (errorCode === 'output_too_large') {
            console.warn('render_garment_image attempt rejected: output too large', {
              garmentId: garment.id,
              attempt: attemptIndex + 1,
              variant,
              bytes: outputBytes.length,
              errorMessage,
            });
          } else if (errorCode === 'output_low_resolution') {
            console.warn('render_garment_image attempt rejected: output dimensions too low', {
              garmentId: garment.id,
              attempt: attemptIndex + 1,
              variant,
              dims: extractImageDimensions(outputBytes),
              errorMessage,
            });
          } else {
            console.warn('render_garment_image attempt rejected: structural', {
              garmentId: garment.id,
              attempt: attemptIndex + 1,
              variant,
              errorCode,
              errorMessage,
            });
          }
        },
        generate: async ({ prompt, variant, attemptIndex }) => {
          console.log('render_garment_image Gemini attempt', {
            garmentId: garment.id,
            attempt: attemptIndex + 1,
            totalAttempts: RETRY_VARIANTS.length,
            variant,
            provider: 'gemini',
            model: GEMINI_IMAGE_MODEL,
            endpoint: GEMINI_IMAGE_API_URL,
            categoryClass,
            expectLogoOrText,
            promptPreview: prompt.split('\n').slice(0, 4),
            sourceMimeType: mimeType,
            sourceBytes: imageBytes.length,
          });
          try {
            const result = await generateGeminiImage({
              apiKey: geminiApiKey,
              prompt,
              dataUrl,
              garmentId: garment.id,
            });
            return { ok: true, outputBytes: result.outputBytes, outputMimeType: result.mimeType };
          } catch (providerError) {
            const errorMessage = getErrorMessage(providerError);
            const errorCode = providerError instanceof RenderProviderError ? providerError.code : 'gemini_unknown';
            console.error('render_garment_image Gemini attempt failed', {
              garmentId: garment.id,
              attempt: attemptIndex + 1,
              variant,
              provider: 'gemini',
              model: GEMINI_IMAGE_MODEL,
              geminiApiKeyFingerprint: maskApiKey(geminiApiKey),
              errorCode,
              error: errorMessage,
            });
            if (errorCode === 'gemini_auth' || errorCode === 'gemini_model_path') {
              return { ok: false, errorCode, errorMessage, bubble: true };
            }
            recordError('render_garment_image');
            return { ok: false, errorCode, errorMessage };
          }
        },
        validateContent: async ({ outputBytes, outputMimeType, variant, attemptIndex }) => {
          const renderedBase64 = uint8ArrayToBase64(outputBytes);
          let validationAssessment = null;
          try {
            validationAssessment = await validateRenderedGarmentOutputWithGemini({
              apiKey: geminiApiKey,
              garmentId: garment.id,
              mimeType: outputMimeType,
              imageBase64: renderedBase64,
              category: garmentForPrompt.category,
              subcategory: garmentForPrompt.subcategory,
              expectLogoOrText,
            });
          } catch (validationError) {
            if (attemptIndex === 0) {
              captureWarning('render_validator_unavailable', {
                attempt: attemptIndex + 1,
                category: categoryClass,
                reason: classifyValidatorError(validationError),
              });
              console.warn('render_garment_image validator unavailable — accepting attempt', {
                garmentId: garment.id,
                attempt: attemptIndex + 1,
                variant,
                error: getErrorMessage(validationError),
              });
              validationAssessment = null;
            } else {
              console.warn('render_garment_image validator unavailable on retry — skipping variant', {
                garmentId: garment.id,
                attempt: attemptIndex + 1,
                variant,
                error: getErrorMessage(validationError),
              });
              return {
                ok: false,
                errorCode: 'validator_unavailable',
                errorMessage: `Validator unavailable on retry: ${getErrorMessage(validationError)}`,
              };
            }
          }
          if (validationAssessment && validationAssessment.decision !== 'accept') {
            const confidenceLabel = validationAssessment.confidence == null
              ? 'unknown'
              : validationAssessment.confidence.toFixed(2);
            console.warn('render_garment_image attempt rejected by validator', {
              garmentId: garment.id,
              attempt: attemptIndex + 1,
              variant,
              decision: validationAssessment.decision,
              reason: validationAssessment.reason,
              confidence: confidenceLabel,
              signals: validationAssessment.signals,
            });
            return {
              ok: false,
              errorCode: validationAssessment.decision,
              errorMessage: `Validator ${validationAssessment.decision}: ${validationAssessment.reason} (confidence=${confidenceLabel})`,
              validationDecision: validationAssessment.decision,
            };
          }
          console.log('render_garment_image attempt accepted', {
            garmentId: garment.id,
            attempt: attemptIndex + 1,
            variant,
            outputBytes: outputBytes.length,
            outputMimeType,
            outputDims: extractImageDimensions(outputBytes),
            validatorDecision: validationAssessment?.decision ?? 'skipped',
          });
          return { ok: true };
        },
      });

      if (!retryResult.ok) {
        const finalError = retryResult.errorMessage;
        console.error('render_garment_image all retry variants exhausted', {
          garmentId: garment.id,
          lastErrorCode: retryResult.errorCode,
          lastError: finalError,
          hadPriorRender: Boolean(priorRenderedPath),
        });
        await safeRestoreOrFailRender(supabase, garment.id, {
          render_error: `Render retries exhausted: ${finalError}`,
          rendered_image_path: null,
          rendered_at: null,
        }, 'retry_chain_exhausted', priorRenderedPath, isForceRender);

        return new Response(
          JSON.stringify({
            ok: true,
            rendered: false,
            error: 'retry_chain_exhausted',
            lastErrorCode: retryResult.errorCode,
            lastError: finalError,
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }

      const outputBytes = retryResult.outputBytes;
      const outputMimeType = retryResult.outputMimeType;

      console.log('render_garment_image Gemini response committed', {
        garmentId: garment.id,
        provider: 'gemini',
        model: GEMINI_IMAGE_MODEL,
        endpoint: GEMINI_IMAGE_API_URL,
        outputBytes: outputBytes.length,
        outputMimeType,
        acceptedVariant: retryResult.variant,
      });

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
      // Extremely unlikely: reserve worked but consume failed. The shared
      // wrapper logs that case loudly; we still flip `consumed` so the
      // finally's release is skipped — the user got a render and the
      // orphaned-reservation cleanup cron will heal the ledger later.
      await consumeRenderCredit(supabase, user.id, jobId, consumeKey, {
        garmentId: garment.id,
      });
      consumed = true;

      console.log(`Rendered garment ${garment.id} → ${renderedPath}`);

      return new Response(
        JSON.stringify({ ok: true, rendered: true, renderedImagePath: renderedPath }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    } finally {
      // Release policy is owned by releaseRenderCreditOnFailure:
      //   - External (direct / P4 legacy) callers release on any non-consume
      //     exit (preserves the pre-P5 single-shot contract).
      //   - Internal (P5 worker) callers NEVER release here — reserve lives
      //     until process_render_jobs terminalizes at attempts=max_attempts
      //     (Codex round 7 Bug 1: releasing per attempt would cause the
      //     next retry's consume to hit already_terminal and free-render).
      //   - Skip responses from internal callers similarly rely on the
      //     worker owning terminal release (round 7 Bug 2).
      await releaseRenderCreditOnFailure(supabase, user.id, jobId, releaseKey, {
        isInternalInvocation,
        consumed,
        garmentIdForFailure,
      });
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
