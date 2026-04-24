import { supabase } from '@/integrations/supabase/client';
import type { Json, TablesInsert } from '@/integrations/supabase/types';
import { invokeEdgeFunction, getHttpStatus } from '@/lib/edgeFunctionClient';
import { logger } from '@/lib/logger';
import {
  GARMENT_ENRICHMENT_RETRY_DELAY_MS,
} from '@/config/constants';

type RenderTriggerSource = 'add_photo' | 'batch_add' | 'live_scan' | 'manual_enhance' | 'retry';

export interface EnqueueRenderJobResult {
  /** Canonical render_jobs.id — stable across enqueue retries thanks to
      reserve's replay flag + the UNIQUE constraint on reserve_key. */
  jobId: string;
  /** The clientNonce actually used on the request. If the caller passed
      one via options.clientNonce, this is that value; otherwise it's the
      helper-generated UUID. **Callers that need to retry a failed enqueue
      with the same logical intent (e.g. after a 5xx transport error) MUST
      pass this value back in options.clientNonce on the retry** — a fresh
      nonce creates a new reserve_key and a new reservation, orphaning the
      first. The original credit can only be released by the post-launch
      orphan-reservation cleanup cron. */
  clientNonce: string;
  status: 'pending' | 'in_progress' | 'succeeded' | 'failed';
  source: string;
  /** True when either the ledger hit replay OR the render_jobs row already
      existed under this reserve_key. Either way, the canonical job row is
      the one that survived — this response targets it. */
  replay: boolean;
}

/**
 * Wave 3-B fix 4 (Codex P2 round 3 on PR #661).
 *
 * The old shape had only `status: number` but `status === 0` was overloaded
 * across two very different failure modes:
 *
 *   1. **transport**: `fetch()` rejected before reading the response body
 *      (network abort, DNS failure, CORS preflight fail, timeout). Server may
 *      have accepted the request and INSERTed a render_jobs row before the
 *      connection dropped. Banner/worker reconciliation is appropriate.
 *
 *   2. **no_job_confirmation**: a response arrived and parsed fine, but the
 *      body was missing the canonical `jobId`. This means no row is
 *      guaranteed to exist server-side, so no worker will ever reconcile
 *      `render_status='pending'` back to a terminal state.
 *
 * Consumers that leave the garment at `'pending'` on ambiguous errors (the
 * `RenderFailedBanner` retry flow) MUST distinguish these two — otherwise
 * a no_job_confirmation failure strands the garment in 'pending' forever,
 * the banner hides, and the user has no way to recover.
 *
 * `kind` defaults to `'http'` so existing throw sites / test fixtures that
 * construct `RenderEnqueueError` positionally aren't broken.
 */
export type RenderEnqueueErrorKind = 'http' | 'transport' | 'no_job_confirmation';

export class RenderEnqueueError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    /** The clientNonce used on the failing request. Callers that retry
        MUST reuse this value via options.clientNonce — see
        EnqueueRenderJobResult.clientNonce for the full rationale. */
    public readonly clientNonce?: string,
    public readonly kind: RenderEnqueueErrorKind = 'http',
  ) {
    super(message);
    this.name = 'RenderEnqueueError';
  }
}

/**
 * Classifies a RenderEnqueueError status as retryable-with-same-nonce.
 *
 * Returns true for:
 *   - `0` or undefined → transport-level failure (network/timeout/abort)
 *     where the request may or may not have reached the server. Reserve
 *     may have succeeded; retry with same nonce catches either case.
 *   - `5xx` → server-side error. Same reasoning — the edge function may
 *     have reserved the credit before the failure surfaced.
 *
 * Returns false for user-caused statuses (400 input, 401 auth, 402
 * credits, 403 forbidden, 404 not found, 429 rate limit) — retrying with
 * the same nonce won't change the outcome and the caller should surface
 * the specific error to the UI instead.
 *
 * Used by the three client call sites (SwipeableGarmentCard,
 * GarmentConfirmSheet, startGarmentRenderInBackground) to decide whether
 * to invoke enqueueRenderJob a second time with the preserved nonce.
 */
export function isRenderEnqueueRetryable(status: number | undefined): boolean {
  if (status === undefined || status === 0) return true;
  if (status >= 500) return true;
  return false;
}

/**
 * Enqueue a render job via the enqueue_render_job edge function.
 *
 * Replaces the in-memory `queuedRenderKickoffs` queue + direct render_garment_image
 * invocation from P4. Returns as soon as the job row is INSERTed (typically
 * ~200-300ms). The edge function fires an internal POST to process_render_jobs
 * for low-latency worker pickup; pg_cron is the safety net if that POST is lost.
 *
 * Callers should NOT await the underlying render — they should poll
 * garments.render_status (via useRenderJobStatus or by refetching the garment)
 * until it flips to 'ready' or 'failed'.
 *
 * ## Retry contract
 *
 * **Distinct logical intents** (e.g. a user tapping "Studio photo" once, then
 * tapping "Try again" after a failure) → each call passes a **fresh** nonce.
 * That's the default behavior when `options.clientNonce` is omitted.
 *
 * **Transport-level retries of the same intent** (network error, 5xx) →
 * the caller MUST supply the SAME nonce on the retry via `options.clientNonce`.
 * The first call's nonce is returned on both success (result.clientNonce) and
 * failure (RenderEnqueueError.clientNonce). Persist that value somewhere the
 * retry can read.
 *
 * Why: if enqueue's INSERT fails after reserve succeeded (rare 500), the
 * reservation exists against the original reserve_key. A retry with a fresh
 * nonce creates a new reserve_key → new reservation → the first one is
 * orphaned and can only be cleaned by the post-launch orphan cron. A retry
 * with the same nonce hits reserve's replay flag and the row's UNIQUE
 * constraint, yielding idempotency in both directions.
 *
 * @throws RenderEnqueueError on 4xx/5xx — callers should surface the status
 *   to the UI (402 → upgrade CTA, 503 → "try again later", 5xx → error toast).
 */
export async function enqueueRenderJob(
  garmentId: string,
  source: RenderTriggerSource,
  options: { clientNonce?: string; force?: boolean } = {},
): Promise<EnqueueRenderJobResult> {
  const clientNonce = options.clientNonce ?? crypto.randomUUID();
  // Force: default false so first-time Studio photo generation still
  // respects the product-ready gate. Regenerate flows (SwipeableGarmentCard
  // on a garment with an existing rendered image) MUST pass force:true;
  // otherwise the worker's render_garment_image skips via the gate and
  // terminalizes as succeeded_skipped with no new image. Codex round 10
  // surfaced this as a P5 regression from the pre-queue direct-call path
  // where SwipeableGarmentCard passed force:true directly.
  const force = options.force === true;

  const { data, error } = await invokeEdgeFunction<EnqueueRenderJobResult & { error?: string }>(
    'enqueue_render_job',
    {
      body: { garmentId, source, clientNonce, force },
      retries: 0,
    },
  );

  if (error) {
    // supabase-js FunctionsHttpError stores the Response on `error.context`
    // (not on the error itself). Reading `error.status` returned `undefined`
    // on real 4xx/5xx responses → RenderEnqueueError.status = 0 → callers
    // (GarmentConfirmSheet's paywall, isRenderEnqueueRetryable) misrouted.
    // getHttpStatus extracts from context.status; falls back to 0 for
    // transport failures (no HTTP response) so isRenderEnqueueRetryable
    // still treats those as retryable.
    //
    // Wave 3-B fix 4: pass `kind` to distinguish 'http' (has a real status,
    // server returned a response) from 'transport' (no HTTP response at all
    // — server may or may not have processed). Banner uses this to decide
    // whether to keep the optimistic `'pending'` flip on ambiguous errors.
    //
    // Wave 3-B fix 5 (Codex P2 round 4): `getHttpStatus` returns
    // `number | null` (NEVER `undefined`), so the prior `!== undefined`
    // test mis-classified every transport failure as 'http'. Use `!= null`
    // (idiomatic double-equals check covers both null and undefined).
    const httpStatus = getHttpStatus(error);
    throw new RenderEnqueueError(
      error.message || 'render enqueue failed',
      httpStatus ?? 0,
      (error as { code?: string }).code,
      clientNonce,
      httpStatus != null ? 'http' : 'transport',
    );
  }
  if (!data || !data.jobId) {
    // Wave 3-B fix 4: no_job_confirmation. The response arrived (no transport
    // error, parsed fine) but lacked the canonical jobId. This path means no
    // row is guaranteed to exist server-side — worker/cron reconciliation
    // cannot recover the garment from `'pending'`. Banner MUST revert to
    // `'failed'` so the user sees the retry affordance.
    throw new RenderEnqueueError(
      'render enqueue returned no jobId',
      0,
      undefined,
      clientNonce,
      'no_job_confirmation',
    );
  }
  return {
    jobId: data.jobId,
    clientNonce,
    status: data.status,
    source: data.source,
    replay: data.replay,
  };
}

/**
 * Deprecated under Priority 5.
 *
 * Previously re-enqueued pending renders client-side on app open. With the
 * durable `render_jobs` table + pg_cron safety net, re-execution happens
 * server-side automatically. Client doesn't need to do anything.
 *
 * Kept as a no-op so existing call sites (useGarments.ts) don't need a
 * synchronized change to remove the call. Will be deleted in a follow-up.
 */
export async function resumePendingGarmentRenders(_userId: string): Promise<void> {
  return;
}


export const GARMENT_REVIEW_CONFIDENCE_THRESHOLD = 0.55;

export interface GarmentReviewDecision {
  needsReview: boolean;
  confidence: number | null;
  reason: 'low_confidence' | 'missing_confidence' | 'multiple_garments' | null;
}

interface GarmentReviewContext {
  imageContainsMultipleGarments?: boolean | null;
}

interface StandardizeGarmentAiRawOptions {
  aiRaw: Json | null | undefined;
  analysisConfidence?: number | null;
  source?: string | null;
  reviewDecision?: GarmentReviewDecision | null;
}

export function standardizeGarmentAiRaw({
  aiRaw,
  analysisConfidence,
  source,
  reviewDecision,
}: StandardizeGarmentAiRawOptions): Json | null {
  if (!aiRaw || typeof aiRaw !== 'object' || Array.isArray(aiRaw)) {
    if (analysisConfidence == null && !source && !reviewDecision) return aiRaw ?? null;

    return {
      system_signals: {
        analysis_confidence: analysisConfidence ?? null,
        source: source ?? null,
        needs_review: reviewDecision?.needsReview ?? null,
        review_reason: reviewDecision?.reason ?? null,
      },
    } as Json;
  }

  const record = aiRaw as Record<string, unknown>;
  const existingSignals =
    record.system_signals && typeof record.system_signals === 'object' && !Array.isArray(record.system_signals)
      ? record.system_signals as Record<string, unknown>
      : {};

  return {
    ...record,
    system_signals: {
      ...existingSignals,
      analysis_confidence:
        analysisConfidence ??
        (typeof existingSignals.analysis_confidence === 'number'
          ? existingSignals.analysis_confidence
          : typeof record.confidence === 'number'
            ? record.confidence
            : null),
      source: source ?? (typeof existingSignals.source === 'string' ? existingSignals.source : null),
      needs_review:
        reviewDecision?.needsReview ??
        (typeof existingSignals.needs_review === 'boolean' ? existingSignals.needs_review : null),
      review_reason:
        reviewDecision?.reason ??
        (typeof existingSignals.review_reason === 'string' ? existingSignals.review_reason : null),
    },
  } as Json;
}

export function getGarmentReviewDecision(
  analysisConfidence?: number | null,
  context: GarmentReviewContext = {},
): GarmentReviewDecision {
  if (context.imageContainsMultipleGarments) {
    return {
      needsReview: true,
      confidence: typeof analysisConfidence === 'number' && !Number.isNaN(analysisConfidence)
        ? Math.max(0, Math.min(1, analysisConfidence))
        : null,
      reason: 'multiple_garments',
    };
  }

  if (typeof analysisConfidence !== 'number' || Number.isNaN(analysisConfidence)) {
    return {
      needsReview: true,
      confidence: null,
      reason: 'missing_confidence',
    };
  }

  const confidence = Math.max(0, Math.min(1, analysisConfidence));
  if (confidence < GARMENT_REVIEW_CONFIDENCE_THRESHOLD) {
    return {
      needsReview: true,
      confidence,
      reason: 'low_confidence',
    };
  }

  return {
    needsReview: false,
    confidence,
    reason: null,
  };
}

interface BuildGarmentIntelligenceFieldsOptions {
  storagePath: string;
  /** Set render_status to 'pending' on insert for studio render flows. */
  enableRender?: boolean;
}

interface TriggerGarmentPostSaveIntelligenceOptions {
  garmentId: string;
  storagePath: string;
  source: 'add_photo' | 'batch_add' | 'live_scan' | 'manual_enhance';
  // P15: 'edge' and 'full' variants removed when process_garment_image was
  // unwired. All current callers pass { mode: 'skip' }; 'local' is retained
  // for callers that might run client-side processing (e.g. Capacitor
  // camera integration in Wave 9).
  imageProcessing?:
    | { mode: 'local'; run: () => Promise<void> }
    | { mode: 'skip' };
  /** Skip Gemini render for this garment (default: auto based on source) */
  skipRender?: boolean;
  /**
   * Forwarded to `startGarmentRenderInBackground` when it fires after
   * enrichment settles. Used by re-render flows (Wave 4.5-B swap) that
   * must bypass the worker's product-ready gate on an already-rendered
   * garment. Default: first-time generation (force:false).
   */
  renderOptions?: { force?: boolean };
}

export function buildGarmentIntelligenceFields({
  storagePath,
  enableRender = false,
}: BuildGarmentIntelligenceFieldsOptions): Pick<
  TablesInsert<'garments'>,
  'enrichment_status' | 'original_image_path' | 'render_status'
> {
  return {
    enrichment_status: 'pending',
    original_image_path: storagePath,
    render_status: enableRender ? 'pending' : 'none',
  };
}

export function triggerGarmentPostSaveIntelligence({
  garmentId,
  storagePath,
  source,
  imageProcessing = { mode: 'skip' as const },
  skipRender,
  renderOptions,
}: TriggerGarmentPostSaveIntelligenceOptions): void {
  const shouldRender = !skipRender && (
    source === 'add_photo' || source === 'batch_add'
    || source === 'live_scan' || source === 'manual_enhance'
  );

  enrichGarmentInBackground(garmentId, storagePath)
    .then(() => {
      if (shouldRender) {
        startGarmentRenderInBackground(garmentId, source, renderOptions).catch((err) => {
          logger.error(`[${source}] render trigger error (post-enrichment):`, err);
        });
      }
    })
    .catch((err) => {
      logger.error(`[${source}] enrichment error:`, err);
      if (shouldRender) {
        startGarmentRenderInBackground(garmentId, source, renderOptions).catch((err2) => {
          logger.error(`[${source}] render trigger error (post-enrichment-failure):`, err2);
        });
      }
    });

  // imageProcessing stays separate and parallel — it does not affect render prompt content.
  // P15: 'edge'/'full' branch removed; only 'local' survives. 'skip' (default) does nothing.
  if (imageProcessing.mode === 'local') {
    imageProcessing.run().catch((err) => {
      logger.error(`[${source}] local garment image processing error (non-blocking):`, err);
    });
  }
}

async function enrichGarmentInBackground(garmentId: string, storagePath: string): Promise<void> {
  await supabase.from('garments').update({ enrichment_status: 'processing' }).eq('id', garmentId);

  const attempt = async (): Promise<boolean> => {
    const { data, error } = await invokeEdgeFunction<{ enrichment?: Record<string, unknown>; error?: string }>('analyze_garment', {
      body: { storagePath, mode: 'enrich' },
    });

    if (error || !data?.enrichment) {
      return false;
    }

    const { data: existing } = await supabase.from('garments').select('ai_raw').eq('id', garmentId).single();
    const currentRaw = (existing?.ai_raw as Record<string, unknown>) || {};
    const mergedRaw = { ...currentRaw, enrichment: data.enrichment };
    const updates: Record<string, unknown> = {
      ai_raw: mergedRaw as Json,
      enrichment_status: 'completed',
    };

    if (data.enrichment.refined_title && typeof data.enrichment.refined_title === 'string') {
      updates.title = data.enrichment.refined_title.substring(0, 50);
    }

    // Extract enrichment fields into dedicated garment columns
    const e = data.enrichment;
    if (typeof e.silhouette === 'string') updates.silhouette = e.silhouette;
    if (typeof e.visual_weight === 'string') {
      const vwMap: Record<string, number> = { light: 1, medium: 2, heavy: 3 };
      updates.visual_weight = vwMap[e.visual_weight] ?? 2;
    }
    if (typeof e.texture_intensity === 'string') {
      const tiMap: Record<string, number> = { smooth: 1, subtle: 2, moderate: 3, pronounced: 4, bold: 5 };
      updates.texture_intensity = tiMap[e.texture_intensity] ?? 3;
    }
    if (typeof e.style_archetype === 'string') updates.style_archetype = e.style_archetype;
    if (Array.isArray(e.occasion_tags)) updates.occasion_tags = e.occasion_tags.filter((t: unknown) => typeof t === 'string');
    if (typeof e.versatility_score === 'number') updates.versatility_score = Math.max(1, Math.min(10, Math.round(e.versatility_score)));

    await supabase.from('garments').update(updates).eq('id', garmentId);
    return true;
  };

  const success = await attempt();
  if (success) return;

  await new Promise((resolve) => setTimeout(resolve, GARMENT_ENRICHMENT_RETRY_DELAY_MS));
  const retrySuccess = await attempt();
  if (!retrySuccess) {
    await supabase.from('garments').update({ enrichment_status: 'failed' }).eq('id', garmentId);
  }
}

export async function startGarmentRenderInBackground(
  garmentId: string,
  source: RenderTriggerSource,
  options: { force?: boolean } = {},
): Promise<void> {
  // Single transport-level retry with the SAME nonce on any retryable
  // failure (network/timeout/abort = status 0/undefined, or server 5xx).
  // See isRenderEnqueueRetryable for the full classification. Any
  // subsequent retries happen via the server-side cron safety net (which
  // reclaims the reserved row) or the user's next app-open — we don't
  // loop client-side to avoid hammering a distressed backend.
  //
  // options.force is forwarded to every enqueueRenderJob call so callers
  // regenerating an already-rendered garment (e.g. Wave 4.5-B swap flow
  // in SecondaryImageManager) can bypass the worker's product-ready gate.
  // Default false preserves the first-time generation behaviour.
  try {
    await enqueueRenderJob(garmentId, source, { force: options.force });
    return;
  } catch (err) {
    if (err instanceof RenderEnqueueError && err.status === 402) {
      // Trial locked or insufficient credit — business denial, not a
      // transport failure. We still must reset render_status to 'none'
      // because nothing else recovers it: under P5, resumePendingGarment-
      // Renders is a no-op, and no render_jobs row was ever created (the
      // 402 returns BEFORE the insert), so the worker has nothing to
      // process. Leaving it 'pending' stranded the garment in "Refining…"
      // forever, even after the user upgraded. Falling through to the
      // reset below flips the garment to 'none' so the UI re-shows the
      // Studio photo CTA and the user can retry after upgrading.
      // (Round 14 fix — Codex caught that round 11's 402-preserves-pending
      // branch was wrong in aggregate with P5's queue-owned recovery.)
      logger.info(
        `[${source}] render enqueue 402 — resetting garment to 'none' so user can retry after upgrade`,
        { garmentId, code: err.code },
      );
      await resetGarmentRenderStateOnEnqueueFailure(garmentId, source, err);
      return;
    }

    if (
      err instanceof RenderEnqueueError &&
      err.clientNonce &&
      isRenderEnqueueRetryable(err.status)
    ) {
      // Retryable transport/server failure — retry once with the SAME
      // nonce so reserve's replay flag catches any successful-reserve-
      // but-failed-insert state. Without the nonce preservation, a second
      // attempt would create a new reservation and orphan the first.
      logger.warn(
        `[${source}] render enqueue retryable (status=${err.status}); retrying once with same nonce`,
        err,
      );
      try {
        await enqueueRenderJob(garmentId, source, {
          clientNonce: err.clientNonce,
          force: options.force,
        });
        return;
      } catch (retryErr) {
        logger.warn(`[${source}] render enqueue retry failed`, retryErr);

        // Round-16 Bug 1 — server-state check before reset.
        //
        // A retryable transport/server failure does NOT prove the enqueue
        // failed server-side. The server can complete the reserve +
        // render_jobs INSERT and then return 5xx (or have the connection
        // drop) before the client sees success. Both the first attempt
        // AND the nonce-preserving retry can land in that state — the
        // server's ON CONFLICT (reserve_key) / reserve-replay path makes
        // the retry a no-op INSERT, still returning 5xx from the same
        // crash point.
        //
        // Resetting render_status='none' in that case leaves the row
        // live in the queue AND shows the user a "re-trigger" UI. If
        // they tap Studio photo again, they fire a fresh enqueue with a
        // new clientNonce → new reserve_key → second reservation AND a
        // second render_jobs row. Double-charge (two reservations),
        // wasted Gemini call (two renders for the same intent). The
        // original orphaned row still ticks forward under the worker.
        //
        // Server-state check: query render_jobs by (user_id, garment_id,
        // reserve_key suffix-match on clientNonce). The clientNonce is a
        // UUID — globally unique — so the suffix-match is safe without
        // duplicating the server's full reserve_key derivation
        // (presentation, RENDER_PROMPT_VERSION) on the client. If a row
        // exists, the worker owns the garment's render_status transition
        // — we leave it alone. If no row exists, reset as before.
        //
        // Any failure of the check itself (network blip, RLS unexpected
        // result) falls through to the reset — the pre-round-16 behavior
        // — because the alternative (leaving the garment at 'pending'
        // forever when we also couldn't talk to the DB) is worse UX than
        // the narrow double-charge case we're trying to prevent.
        const nonce = err.clientNonce;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && nonce) {
            const { data: existingJob, error: checkErr } = await supabase
              .from('render_jobs')
              .select('id, status')
              .eq('user_id', user.id)
              .eq('garment_id', garmentId)
              .like('reserve_key', `%${nonce}`)
              .maybeSingle();
            if (checkErr) {
              logger.warn(
                `[${source}] server-state check query failed — falling through to reset`,
                { garmentId, error: checkErr.message },
              );
            } else if (existingJob) {
              logger.info(
                `[${source}] server-state check: render_jobs row exists despite client retry failure — leaving garment state to worker`,
                {
                  garmentId,
                  jobId: existingJob.id,
                  jobStatus: existingJob.status,
                },
              );
              return;
            }
          }
        } catch (stateCheckErr) {
          logger.warn(
            `[${source}] server-state check threw — falling through to reset`,
            {
              garmentId,
              error: stateCheckErr instanceof Error ? stateCheckErr.message : String(stateCheckErr),
            },
          );
        }

        await resetGarmentRenderStateOnEnqueueFailure(garmentId, source, retryErr);
        return;
      }
    }

    logger.warn(`[${source}] render enqueue failed`, err);
    await resetGarmentRenderStateOnEnqueueFailure(garmentId, source, err);
  }
}

/**
 * Reset garment.render_status to 'none' when `startGarmentRenderInBackground`
 * exhausts its retries without ever creating a render_jobs row.
 *
 * Why this function exists (Codex round 11 Bug 2):
 *
 * `buildGarmentIntelligenceFields` (line ~326) sets `render_status='pending'`
 * on the garment INSERT for studio-render flows. If the subsequent
 * `enqueueRenderJob` call fails AND its retry also fails, no render_jobs
 * row ever gets created, and `resumePendingGarmentRenders` is a no-op
 * under P5 (P5 delegates recovery to the durable queue — but the queue
 * can't recover a job that was never enqueued). Without this reset, the
 * garment is orphaned at `render_status='pending'` forever. The UI shows
 * the "Refining…" state indefinitely; refreshing the app doesn't help.
 *
 * Resetting to `'none'` (rather than `'failed'`) signals "no render
 * attempted" — lets the user re-trigger a render from the UI on next
 * interaction (Studio photo button reappears because
 * `showGenerateAction` triggers on `render_status==='none'`). Marking
 * as `'failed'` would be misleading: no attempt was ever made.
 *
 * Round 14 fix: 402 (trial locked / insufficient credits) now also
 * routes here. Round 11 initially excluded 402 on the theory that the
 * upgrade flow would re-trigger enqueue and `render_status='pending'`
 * would preserve intent across the upgrade UX. That theory was wrong
 * in aggregate with P5: `resumePendingGarmentRenders` is a no-op under
 * the durable queue, and a 402 returns from `enqueue_render_job`
 * BEFORE any `render_jobs` row is written — the worker has literally
 * nothing to process. Result pre-round-14: garment stranded at
 * `render_status='pending'` forever, UI shows "Refining…" even after
 * the user upgraded. Falling through to this reset flips the garment
 * to `'none'` so the Studio photo CTA reappears and the user can
 * retry from the wardrobe after upgrading.
 */
async function resetGarmentRenderStateOnEnqueueFailure(
  garmentId: string,
  source: string,
  err: unknown,
): Promise<void> {
  try {
    const { error: updateError } = await supabase
      .from('garments')
      .update({ render_status: 'none' })
      .eq('id', garmentId);
    if (updateError) {
      logger.error(
        `[${source}] reset-to-none after enqueue failure also failed — garment may be stuck in 'pending'`,
        { garmentId, updateError: updateError.message, originalError: err instanceof Error ? err.message : String(err) },
      );
    } else {
      logger.info(
        `[${source}] enqueue exhausted — reset garment render_status to 'none' so user can retry`,
        { garmentId, originalError: err instanceof Error ? err.message : String(err) },
      );
    }
  } catch (resetErr) {
    logger.error(
      `[${source}] reset-to-none threw unexpectedly`,
      { garmentId, resetError: resetErr instanceof Error ? resetErr.message : String(resetErr) },
    );
  }
}
