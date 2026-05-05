// Insert a new garment row from an AI analysis result + (optional) user
// overrides, then conditionally fire enqueue_render_job for the ghost-mannequin
// render and trigger background enrichment. Mirrors the web's
// finalizeCandidate + triggerGarmentPostSaveIntelligence chain, slimmed for
// mobile (no duplicate-detection branch yet — that lands in PR 3).
//
// Render queue: enqueue_render_job's contract is `{ garmentId, source,
// clientNonce }`. `source` must be one of 'add_photo' | 'batch_add' |
// 'live_scan' | 'manual_enhance' | 'retry'. `clientNonce` is a ≥8-char string
// the edge function folds into a deterministic SHA-256 → UUID jobId so a
// network-retry with the same nonce + garment hits the reserve_credit_atomic
// replay path (no double-charge). A fresh nonce per save attempt is correct
// here — each save is a distinct new garment row and the row-level UNIQUE
// constraint on reserve_key prevents duplicate render_jobs. Codex round 1.
//
// PR 1 changes (parity with web):
//  - `enableStudioQuality` gates the render-queue call AND the
//    `render_status: 'pending' | 'none'` write. Without it, the row saves with
//    just the original photo and never enters the render pipeline.
//  - `system_signals` wrap on `ai_raw` so downstream consumers (Insights,
//    StyleDNA, future review surfaces) can read analysis_confidence /
//    needs_review without re-deriving from the raw model output. Mirrors web's
//    standardizeGarmentAiRaw.
//  - `enrichment_status: 'pending'` on insert + post-insert triggerGarmentEnrichment
//    fire-and-forget. 13 schema columns (silhouette/visual_weight/texture_intensity/
//    style_archetype/occasion_tags/versatility_score plus the system_signals
//    sub-fields) populate within ~10s.
//  - `imported_via: source` for analytics on which entry surface produced the row.
//
// Fire-and-forget: a render-queue failure must not block the garment save —
// the user already sees the row in their wardrobe. The cron safety net
// (process_render_jobs every 60s) picks up any row whose render_status is
// still 'pending'. We DO console.warn on queue failure so dev builds surface
// contract regressions instead of silently shipping renders that never enqueue.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase, supabaseUrl } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';
import type { GarmentInsert } from '../types/garment';
import { triggerGarmentEnrichment } from './useAnalyzeGarment';
import type { AnalysisResult } from './useAnalyzeGarment';

/**
 * Source of a garment-add round-trip — threaded through Step 1/LiveScan → Step 2 → Step 3
 * so the render queue tags the job with where the user actually came in. Must match the
 * VALID_SOURCES set in supabase/functions/enqueue_render_job/index.ts; widening here
 * without widening there will 400 the request.
 */
export type AddGarmentSource = 'add_photo' | 'batch_add' | 'live_scan' | 'manual_enhance' | 'retry';

export interface AddGarmentParams {
  storagePath: string;
  analysis: AnalysisResult;
  source: AddGarmentSource;
  /**
   * Studio-quality render toggle from the save-choice sheet. When `true`, the row
   * inserts with `render_status: 'pending'` and an enqueue_render_job kickoff
   * fires; the user sees the rendered ghost-mannequin image once the worker lands.
   * When `false` (Original photo), no render is requested — `render_status: 'none'`
   * tells the wardrobe UI to keep using the original_image_path forever.
   */
  enableStudioQuality: boolean;
  // User overrides from the Step 3 form. Each is optional — if missing, we
  // fall back to the analysis value.
  title?: string;
  category?: string;
  price?: number | null;
}

// Generates a clientNonce satisfying the edge function's `length >= 8` check. Doesn't
// need cryptographic strength — the deterministic-jobId derivation downstream uses
// SHA-256, so the nonce just needs to vary per save attempt. Avoids depending on
// crypto.randomUUID() (not consistently polyfilled in RN without expo-crypto).
function makeClientNonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Reset garment.render_status to 'none' after an enqueue failure so the row
 * doesn't strand forever at 'pending' (Codex P1 on PR #725 — mirrors web's
 * resetGarmentRenderStateOnEnqueueFailure in src/lib/garmentIntelligence.ts).
 *
 * Why 'none' and not 'failed': no render attempt actually exists server-side
 * (the failure happened BEFORE any render_jobs row was written), and the
 * wardrobe UI surfaces a "Studio photo" CTA when render_status === 'none'. So
 * the row reverts to a state that lets the user retry from GarmentDetail. A
 * 'failed' status would be misleading — there's no failed job to retry.
 */
async function resetRenderStatusOnEnqueueFailure(garmentId: string, source: string, originalErr: unknown): Promise<void> {
  try {
    const { error } = await supabase
      .from('garments')
      .update({ render_status: 'none' })
      .eq('id', garmentId);
    if (error) {
      console.warn(
        `[useAddGarment] [${source}] reset-to-none after enqueue failure also failed — garment may strand at 'pending'`,
        { garmentId, updateError: error.message, originalError: originalErr instanceof Error ? originalErr.message : String(originalErr) },
      );
    }
  } catch (resetErr) {
    console.warn('[useAddGarment] reset render_status threw:', resetErr);
  }
}

async function queueRender(
  garmentId: string,
  source: AddGarmentSource,
  accessToken: string,
): Promise<void> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/enqueue_render_job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        garmentId,
        source,
        clientNonce: makeClientNonce(),
      }),
    });
    // Non-2xx: log AND reset render_status. The cron safety net only re-runs
    // already-inserted render_jobs rows; a 4xx/5xx here means no row was written,
    // so leaving render_status='pending' permanently strands the garment.
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn(`[useAddGarment] enqueue_render_job failed ${response.status}: ${body}`);
      await resetRenderStatusOnEnqueueFailure(garmentId, source, new Error(`HTTP ${response.status}: ${body}`));
    }
  } catch (err) {
    // Network / transport failure — same recovery: revert to 'none' so the user can
    // retry from the wardrobe UI. (Web's parity logic does a same-nonce retry first;
    // mobile leaves that to PR 2 where useRenderJobStatus + retry UI lands. For now,
    // the simpler reset matches what web does in the terminal-failure case.)
    console.warn('[useAddGarment] enqueue_render_job threw:', err);
    await resetRenderStatusOnEnqueueFailure(garmentId, source, err);
  }
}

/**
 * Wrap the raw model output with a `system_signals` envelope so downstream
 * consumers see the same shape as web-saved garments. Mirrors
 * src/lib/garmentIntelligence.ts:240-285 (`standardizeGarmentAiRaw`).
 *
 * `needs_review` and `review_reason` are derived from confidence + the
 * multi-garment flag — same threshold (0.55) as web. Web's
 * GARMENT_REVIEW_CONFIDENCE_THRESHOLD lives in src/lib/garmentIntelligence.ts;
 * mobile re-declares the constant rather than reach across the type-only carve-out
 * (the file exports runtime symbols too, which mobile/CLAUDE.md forbids importing).
 * If the threshold ever changes, both sides need updating — Findings Log row.
 */
const GARMENT_REVIEW_CONFIDENCE_THRESHOLD = 0.55;

interface ReviewDecision {
  needsReview: boolean;
  reason: 'low_confidence' | 'missing_confidence' | 'multiple_garments' | null;
}

function deriveReviewDecision(analysis: AnalysisResult): ReviewDecision {
  if (analysis.image_contains_multiple_garments) {
    return { needsReview: true, reason: 'multiple_garments' };
  }
  const c = analysis.confidence;
  if (typeof c !== 'number' || Number.isNaN(c)) {
    return { needsReview: true, reason: 'missing_confidence' };
  }
  if (c < GARMENT_REVIEW_CONFIDENCE_THRESHOLD) {
    return { needsReview: true, reason: 'low_confidence' };
  }
  return { needsReview: false, reason: null };
}

function buildAiRawWithSystemSignals(
  analysis: AnalysisResult,
  source: AddGarmentSource,
): Record<string, unknown> {
  const review = deriveReviewDecision(analysis);
  const baseRaw =
    analysis.ai_raw && typeof analysis.ai_raw === 'object' && !Array.isArray(analysis.ai_raw)
      ? analysis.ai_raw
      : {};

  const existingSignals =
    baseRaw.system_signals && typeof baseRaw.system_signals === 'object' && !Array.isArray(baseRaw.system_signals)
      ? (baseRaw.system_signals as Record<string, unknown>)
      : {};

  return {
    ...baseRaw,
    system_signals: {
      ...existingSignals,
      analysis_confidence: typeof analysis.confidence === 'number' ? analysis.confidence : null,
      source,
      needs_review: review.needsReview,
      review_reason: review.reason,
    },
  };
}

export function useAddGarment() {
  const queryClient = useQueryClient();
  const { user, session } = useAuth();

  return useMutation({
    mutationFn: async (params: AddGarmentParams) => {
      if (!user) throw new Error('Not authenticated');

      const insert: GarmentInsert = {
        user_id: user.id,
        title: params.title?.trim() || params.analysis.title || 'Untitled',
        category: params.category || params.analysis.category || 'top',
        subcategory: params.analysis.subcategory,
        color_primary: params.analysis.color_primary,
        color_secondary: params.analysis.color_secondary,
        material: params.analysis.material,
        fit: params.analysis.fit,
        pattern: params.analysis.pattern,
        season_tags: params.analysis.season_tags,
        // occasion_tags intentionally omitted — analyze_garment in `fast`/`full` mode
        // does NOT return occasion data (only `enrich` mode prompts for it). Inserting
        // the empty array would override any later enrichment write. Audit round 2.
        formality: params.analysis.formality,
        original_image_path: params.storagePath,
        wear_count: 0,
        in_laundry: false,
        purchase_price: params.price ?? null,
        ai_analyzed_at: new Date().toISOString(),
        ai_provider: params.analysis.ai_provider ?? null,
        ai_raw: buildAiRawWithSystemSignals(params.analysis, params.source) as GarmentInsert['ai_raw'],
        // PR 1 parity adds — schema fields web fills via buildGarmentIntelligenceFields
        // and buildGarmentInsert. Without these, mobile-saved garments never enter the
        // enrichment pipeline (Insights stays sparse) and the render pipeline silently
        // skips the row (Studio quality choice has no effect on the user's wardrobe).
        enrichment_status: 'pending',
        render_status: params.enableStudioQuality ? 'pending' : 'none',
        imported_via: params.source,
      };

      const { data, error } = await supabase
        .from('garments')
        .insert(insert)
        .select()
        .single();

      if (error) throw error;

      // Post-save fan-out: enrichment is unconditional (deeper metadata never hurts);
      // render is gated on the studio-quality choice. Both fire-and-forget so the user
      // doesn't wait on either before the save callback resolves.
      const accessToken = session?.access_token;
      if (accessToken) {
        if (params.enableStudioQuality) {
          void queueRender(data.id, params.source, accessToken);
        }
        void triggerGarmentEnrichment(params.storagePath, data.id, accessToken);
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate every cached garments list (filters / smart filters /
      // search variants) so the new row shows up everywhere immediately.
      queryClient.invalidateQueries({ queryKey: ['garments'] });
      // Insights derives totals + palette + utilisation from garments — refresh
      // so the new piece is reflected next time the user opens the tab.
      queryClient.invalidateQueries({ queryKey: ['insights_dashboard'] });
    },
    onError: captureMutationError('useAddGarment'),
  });
}
