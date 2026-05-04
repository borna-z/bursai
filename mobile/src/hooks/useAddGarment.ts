// Insert a new garment row from an AI analysis result + (optional) user
// overrides, then fire a non-blocking enqueue_render_job for the
// ghost-mannequin render. Mirrors the web's create-garment + render-queue
// chain in finalizeCandidate, slimmed for mobile (no studio-quality toggle,
// no duplicate-detection, no subscription gating yet — those land in W6).
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
// Fire-and-forget: a render-queue failure must not block the garment save —
// the user already sees the row in their wardrobe. The cron safety net
// (process_render_jobs every 60s) picks up any row whose render_status is
// still 'pending'. We DO console.warn on queue failure though, so dev builds
// surface contract regressions instead of silently shipping renders that
// never enqueue (Codex round 1: prior version POSTed only `{ garmentId }` and
// got 400s end-to-end with no observable signal).

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase, supabaseUrl } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { GarmentInsert } from '../types/garment';
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
    // Surface non-2xx so dev builds catch contract drift instead of swallowing it
    // (the 60s cron safety-net only re-runs already-inserted pending rows; a 400
    // from enqueue means the row was never inserted in the first place).
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.warn(`[useAddGarment] enqueue_render_job failed ${response.status}: ${body}`);
    }
  } catch (err) {
    // Fire-and-forget — render failure must never block the garment save. We still
    // warn so the network-failure case isn't completely invisible in dev.
    // eslint-disable-next-line no-console
    console.warn('[useAddGarment] enqueue_render_job threw:', err);
  }
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
        ai_raw: (params.analysis.ai_raw ?? null) as GarmentInsert['ai_raw'],
      };

      const { data, error } = await supabase
        .from('garments')
        .insert(insert)
        .select()
        .single();

      if (error) throw error;

      // Fire-and-forget render queue — see file header.
      const accessToken = session?.access_token;
      if (accessToken) {
        void queueRender(data.id, params.source, accessToken);
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
  });
}
