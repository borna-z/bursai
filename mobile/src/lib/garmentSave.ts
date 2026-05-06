// Garment-save core. Extracted from `useAddGarment.ts` so the offline-queue
// replay handler (registered in AuthContext) and the React Query hook can
// share the exact same code path WITHOUT a circular import — AuthContext
// can pull `persistGarment` from here, and `useAddGarment.ts` does too,
// breaking the prior `AuthContext ↔ useAddGarment` cycle.
//
// Anything not React-bound lives here: the insert builder, the render-queue
// fire-and-forget, the offline-detection helpers, the AddGarmentParams +
// AddGarmentSource types, and the OfflineQueuedError sentinel. The hook
// stays in useAddGarment.ts and is a thin React Query wrapper.

import NetInfo from '@react-native-community/netinfo';

import { supabase } from './supabase';
import { callEdgeFunction } from './edgeFunctionClient';
import { enqueue as enqueueOffline } from './offlineQueue';
import type { Garment, GarmentInsert } from '../types/garment';
import type { AnalysisResult } from '../hooks/useAnalyzeGarment';
import { triggerGarmentEnrichment } from '../hooks/useAnalyzeGarment';

/**
 * Source of a garment-add round-trip. Threaded through Step 1/LiveScan →
 * Step 2 → Step 3 so the render queue tags the job with where the user
 * actually came in. Must match the VALID_SOURCES set in
 * `supabase/functions/enqueue_render_job/index.ts`; widening here without
 * widening there will 400 the request.
 */
export type AddGarmentSource =
  | 'add_photo'
  | 'batch_add'
  | 'live_scan'
  | 'manual_enhance'
  | 'retry';

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

/**
 * Sentinel error thrown when a save was queued for offline replay instead
 * of completed live. The screen layer (AddPieceStep3) catches it as a
 * success-with-side-effect — toast the user and unwind the AddPiece flow
 * without the GarmentDetail nav hop (there's no row id yet).
 */
export class OfflineQueuedError extends Error {
  constructor() {
    super('Saved offline — will sync when you are back online.');
    this.name = 'OfflineQueuedError';
  }
}

export const ADD_GARMENT_ACTION = 'add-garment-save';

/** NetInfo-backed connectivity probe. Defaults to "online" on probe failure
 * (simulators with no native module wired, doctor's unit-test env) — the
 * subsequent network call surfaces real failure, then the post-error
 * recheck enqueues if NetInfo confirms offline. */
export async function isOnlineNow(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    if (state.isConnected === false) return false;
    if (state.isInternetReachable === false) return false;
    return true;
  } catch {
    return true;
  }
}

/** Wrap pending offline saves: pre-check connectivity, enqueue + throw if
 * offline, otherwise run `persistGarment` and re-check on failure. Both the
 * React hook and the offline-replay handler use this so they branch on
 * connectivity identically. */
export async function persistGarmentWithOfflineFallback(
  params: AddGarmentParams,
): Promise<Garment> {
  if (!(await isOnlineNow())) {
    await enqueueOffline(ADD_GARMENT_ACTION, params);
    throw new OfflineQueuedError();
  }
  try {
    return await persistGarment(params);
  } catch (err) {
    // Re-check connectivity — a transient drop during the call surfaces as
    // a fetch failure that's hard to distinguish from a real DB error.
    // Only treat it as offline-queueable if NetInfo confirms we lost the
    // network. A real DB error (RLS, validation) propagates as before.
    if (!(await isOnlineNow())) {
      await enqueueOffline(ADD_GARMENT_ACTION, params);
      throw new OfflineQueuedError();
    }
    throw err;
  }
}

/**
 * Insert a garment row + fire post-save side effects. Reads the live session
 * via `supabase.auth.getSession()` rather than closing over AuthContext
 * state so a token rotation between enqueue and replay still works.
 */
export async function persistGarment(params: AddGarmentParams): Promise<Garment> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
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
    // formality is conditionally added below — sending NULL here would
    // override the column's schema default of 3. Codex P2 round on PR #738.
    original_image_path: params.storagePath,
    wear_count: 0,
    in_laundry: false,
    purchase_price: params.price ?? null,
    ai_analyzed_at: new Date().toISOString(),
    ai_provider: params.analysis.ai_provider ?? null,
    ai_raw: buildAiRawWithSystemSignals(params.analysis, params.source) as GarmentInsert['ai_raw'],
    enrichment_status: 'pending',
    render_status: params.enableStudioQuality ? 'pending' : 'none',
    imported_via: params.source,
  };

  // Only set formality when the model actually returned a number — leaving
  // the field absent lets Postgres apply the column's schema default (3)
  // instead of writing NULL into a NOT-NULL-defaulted column. Codex P2
  // round on PR #738.
  if (typeof params.analysis.formality === 'number') {
    insert.formality = params.analysis.formality;
  }

  const { data, error } = await supabase
    .from('garments')
    .insert(insert)
    .select()
    .single();
  if (error) throw error;

  // Post-save fan-out: render is gated on the studio-quality choice;
  // enrichment is unconditional. Fire-and-forget — the row is already saved.
  // M9: queueRender now reads its own session via callEdgeFunction so the
  // access-token plumbing is gone. triggerGarmentEnrichment still takes a
  // token until its own migration in this same wave (below).
  if (params.enableStudioQuality) {
    void queueRender(data.id, params.source);
  }
  // .catch() to swallow synchronous rejections — without it a throw inside
  // triggerGarmentEnrichment before its first await would surface as an
  // unhandled-promise-rejection (RN logs it; production crashlytics flags
  // it). Same shape as queueRender. Codex P2 round on PR #738.
  void triggerGarmentEnrichment(params.storagePath, data.id, user.id).catch(() => {});

  return data as Garment;
}

// ─── helpers ──────────────────────────────────────────────────────────────

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

function makeClientNonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function resetRenderStatusOnEnqueueFailure(
  garmentId: string,
  source: string,
  originalErr: unknown,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('garments')
      .update({ render_status: 'none' })
      .eq('id', garmentId);
    if (error) {
      console.warn(
        `[garmentSave] [${source}] reset-to-none after enqueue failure also failed — garment may strand at 'pending'`,
        {
          garmentId,
          updateError: error.message,
          originalError: originalErr instanceof Error ? originalErr.message : String(originalErr),
        },
      );
    }
  } catch (resetErr) {
    console.warn('[garmentSave] reset render_status threw:', resetErr);
  }
}

async function queueRender(
  garmentId: string,
  source: AddGarmentSource,
): Promise<void> {
  try {
    await callEdgeFunction('enqueue_render_job', {
      body: {
        garmentId,
        source,
        clientNonce: makeClientNonce(),
      },
      // The edge function is idempotent on (garmentId, clientNonce) via
      // its server-side reserve_credit_atomic replay — a network retry
      // here is safe. Default 2 retries suffice.
    });
  } catch (err) {
    console.warn('[garmentSave] enqueue_render_job failed:', err);
    await resetRenderStatusOnEnqueueFailure(garmentId, source, err);
  }
}
