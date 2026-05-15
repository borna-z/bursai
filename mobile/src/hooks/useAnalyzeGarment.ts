// AI garment analysis hook — calls the analyze_garment edge function with a
// storage path and returns the structured result the edge function emits.
//
// Mirrors src/hooks/useAnalyzeGarment.ts on web, slimmed down: no
// invokeEdgeFunction (mobile has no shared client wrapper yet), no locale
// (single 'en' for the W5 wave; locale can come from LanguageContext later),
// no analysisProgress (the screen owns its own loading copy cycle).
//
// `mode: 'fast'` matches the web — the analyzer runs the cheaper prompt
// budget for the upload-then-fill UX. `'full'` is reserved for re-analyze
// flows where deeper detection is worth the extra latency.
//
// `description` is included on the response shape because the edge function
// can return it (used by future review surfaces), but the garments table
// has no `description` column — the AddGarment hook drops it on insert.
//
// Status surfacing: the hook returns the HTTP status alongside the error so
// the calling screen can branch on 402 (subscription_locked → Paywall) and
// 429 (rate-limited → "try again in a moment") rather than collapsing every
// failure into a generic "Couldn't analyze". W5 audit round 2.

import { useCallback, useState } from 'react';

import { supabase } from '../lib/supabase';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionRateLimitError,
  EdgeFunctionSubscriptionLockedError,
  SUBSCRIPTION_SENTINEL,
} from '../lib/edgeFunctionClient';
import { useAuth } from '../contexts/AuthContext';
import { Sentry } from '../lib/sentry';
import { trackEvent } from '../lib/analytics';

export interface DetectedGarmentSummary {
  title: string;
  category: string;
  subcategory?: string | null;
  color_primary: string;
  color_secondary?: string | null;
  pattern?: string | null;
  material?: string | null;
  fit?: string | null;
  season_tags?: string[] | null;
  formality?: number | null;
  confidence?: number | null;
}

export interface AnalysisResult {
  title: string;
  category: string;
  subcategory: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  material: string | null;
  fit: string | null;
  pattern: string | null;
  season_tags: string[];
  formality: number | null;
  description: string | null;
  confidence: number | null;
  ai_provider?: string | null;
  ai_raw?: Record<string, unknown> | null;
  // Multi-garment surface — analyze_garment in 'full' mode flips this when the
  // photo clearly contains separable items, populating detected_garments with one
  // entry per garment. PR 1 only forwards the data; PR 3's MultiGarmentReviewSheet
  // routes on it. 'fast' mode (used for the upload flow) typically returns false.
  image_contains_multiple_garments?: boolean;
  detected_garments?: DetectedGarmentSummary[];
}

/** HTTP status from the most recent analyze call — null when no call has run or it threw before the response arrived. */
export type AnalyzeStatus = number | null;

/**
 * Input shape for analyze(). Exactly one of storagePath / base64 must be set.
 * - storagePath: file already uploaded to the garments bucket — slower path
 *   (edge function generates a signed URL before forwarding to Gemini) but works
 *   for re-analyze flows where the file already lives on the server.
 * - base64: raw data URL (`data:image/webp;base64,...`). Lets the analyze call
 *   start before upload completes — main parallel-flow optimisation in PR 1.
 *   Edge function caps incoming base64 at 5MB; mobile resizer (1024px WebP q=0.85,
 *   matching web's `compressImage`) stays comfortably under that — typical photo
 *   lands ~150-300 KB versus ~400-700 KB on the prior 1200px JPEG. N6 (W-PERF1).
 */
export type AnalyzeInput = { storagePath: string } | { base64: string };

export function useAnalyzeGarment() {
  const { session } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalyzeStatus>(null);

  const analyze = useCallback(
    async (input: AnalyzeInput): Promise<AnalysisResult | null> => {
      const accessToken = session?.access_token;
      if (!accessToken) {
        setError('Not signed in');
        setStatus(401);
        return null;
      }

      setIsAnalyzing(true);
      setError(null);
      setStatus(null);
      setResult(null);

      // Wave S-C.6 — client-side perceived-speed timing. We mark the moment
      // analyze() is invoked (the user has handed us a payload and the call
      // is about to fire) and emit `addpiece.analyze.timing` once it
      // resolves. Dashboards join with the screen-emitted `addpiece.capture`
      // and `addpiece.save` events on session_id (added at the call sites
      // that own those checkpoints). Failures (rate-limit / 5xx) still emit
      // the timing event so p99 + error-rate dashboards aren't blind.
      const tStart = Date.now();
      const inputKind: 'base64' | 'storagePath' = 'base64' in input ? 'base64' : 'storagePath';

      try {
        const body: Record<string, unknown> = {
          mode: 'fast',
          locale: 'en',
        };
        if ('base64' in input) body.base64Image = input.base64;
        else body.storagePath = input.storagePath;

        // M9: callEdgeFunction handles auth + retry + 4xx classification.
        // 200 → returns parsed JSON; 402/429/4xx → throws typed error we
        // map to the existing user-facing copy below.
        let data: AnalysisResult & { error?: string };
        try {
          const raw = await callEdgeFunction<AnalysisResult & { error?: string }>(
            'analyze_garment',
            { body },
          );
          if (!raw) {
            // 2xx but unparseable JSON — surface as a real failure rather
            // than crash on `data.error` access. Same UX bucket as a 5xx.
            setStatus(502);
            throw new Error('Our AI is having a moment. Please try again.');
          }
          data = raw;
          setStatus(200);
        } catch (callErr) {
          if (callErr instanceof EdgeFunctionSubscriptionLockedError) {
            setStatus(402);
            throw new Error('AI analysis is a Premium feature. Upgrade to keep adding pieces.');
          }
          if (callErr instanceof EdgeFunctionRateLimitError) {
            setStatus(429);
            throw new Error("You've hit the analysis rate limit. Try again in a minute.");
          }
          if (callErr instanceof EdgeFunctionHttpError) {
            setStatus(callErr.status);
            const parsed = (() => {
              try {
                return JSON.parse(callErr.bodyText) as { error?: string };
              } catch {
                return null;
              }
            })();
            if (callErr.status >= 500) {
              throw new Error('Our AI is having a moment. Please try again.');
            }
            throw new Error(parsed?.error ?? `Analysis failed: ${callErr.status}`);
          }
          throw callErr;
        }
        if (data.error) throw new Error(data.error);

        // Defensive normalization — the edge function occasionally omits
        // optional arrays / numbers when the model can't decide. Downstream
        // consumers (form pre-fill) are happier with [] / null than undefined.
        const normalized: AnalysisResult = {
          title: data.title ?? '',
          category: data.category ?? '',
          subcategory: data.subcategory ?? null,
          color_primary: data.color_primary ?? null,
          color_secondary: data.color_secondary ?? null,
          material: data.material ?? null,
          fit: data.fit ?? null,
          pattern: data.pattern ?? null,
          season_tags: Array.isArray(data.season_tags) ? data.season_tags : [],
          formality: typeof data.formality === 'number' ? data.formality : null,
          description: data.description ?? null,
          // Leave confidence as null when the model didn't return a number —
          // garmentSave.deriveReviewDecision treats `typeof c !== 'number'`
          // as `missing_confidence` (a distinct review reason from
          // `low_confidence`). Coercing to 0 here would misclassify the
          // missing case as low-confidence and lose the signal. Codex P2
          // round on PR #738.
          confidence: typeof data.confidence === 'number' ? data.confidence : null,
          ai_provider: data.ai_provider ?? null,
          ai_raw: data.ai_raw ?? null,
          image_contains_multiple_garments:
            typeof data.image_contains_multiple_garments === 'boolean'
              ? data.image_contains_multiple_garments
              : false,
          detected_garments: Array.isArray(data.detected_garments)
            ? (data.detected_garments as DetectedGarmentSummary[])
            : undefined,
        };

        setResult(normalized);
        trackEvent('addpiece.analyze.timing', {
          input_kind: inputKind,
          duration_ms: Date.now() - tStart,
          ok: true,
        });
        return normalized;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Analysis failed';
        // Skip the expected paywall sentinel — those are gating, not failures.
        if (msg !== SUBSCRIPTION_SENTINEL) {
          Sentry.withScope((s) => {
            s.setTag('mutation', 'useAnalyzeGarment');
            Sentry.captureException(err);
          });
        }
        setError(msg);
        trackEvent('addpiece.analyze.timing', {
          input_kind: inputKind,
          duration_ms: Date.now() - tStart,
          ok: false,
          error_class: msg.slice(0, 80),
        });
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [session?.access_token],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setStatus(null);
    setIsAnalyzing(false);
  }, []);

  return { analyze, isAnalyzing, result, error, status, reset };
}

/**
 * Mirror of web's `enrichGarmentInBackground` — fires analyze_garment in `enrich`
 * mode against an already-uploaded image, then writes the deeper metadata fields
 * onto the garments row. Single attempt, fire-and-forget. On failure the row's
 * `enrichment_status` flips to 'failed' so consumers (Insights/StyleDNA) can
 * filter out unenriched rows. Web's two-attempt retry is intentionally NOT
 * mirrored — the cron-driven garment_enrichment job in supabase already retries
 * via the worker's queue, and a second client-side attempt right after a failure
 * doubles the rate-limit cost without meaningfully improving success rate on
 * mobile (transient network errors are likelier than transient model errors).
 */
export async function triggerGarmentEnrichment(
  storagePath: string,
  garmentId: string,
  userId: string,
): Promise<void> {
  // Best-effort terminal write — if a transient supabase outage dropped the AI
  // call, this status flip also has a chance of failing. We capture the result
  // so callers (the outer catch + every status branch below) can log when even
  // the recovery write didn't land. Returning the error lets the caller decide
  // whether to surface to Sentry separately or roll up.
  const writeStatus = async (
    status: 'processing' | 'completed' | 'failed',
  ): Promise<{ ok: boolean; reason?: string }> => {
    // Defense-in-depth: pin every write to (id, user_id) so a future RLS
    // regression can't let one user's row update another's. RLS already
    // gates this; the explicit filter is belt-and-suspenders. Codex P2
    // round on PR #738.
    const { error } = await supabase
      .from('garments')
      .update({ enrichment_status: status })
      .eq('id', garmentId)
      .eq('user_id', userId);
    if (error) {
      console.warn(
        `[triggerGarmentEnrichment] status='${status}' write failed for ${garmentId}: ${error.message}`,
      );
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  };

  try {
    // Codex round 3 P2: don't blindly assume the 'processing' flip landed. If
    // RLS or a transient PostgREST failure rejects this write, abort early —
    // attempting an enrichment we can't reliably mark `failed` is worse than
    // not running it at all (the cron worker will pick the row up via its own
    // pending-status sweep).
    const procWrite = await writeStatus('processing');
    if (!procWrite.ok) return;

    let data: { enrichment?: Record<string, unknown> | null } | null;
    try {
      data = await callEdgeFunction<{ enrichment?: Record<string, unknown> | null }>(
        'analyze_garment',
        { body: { storagePath, mode: 'enrich' } },
      );
    } catch {
      await writeStatus('failed');
      return;
    }
    if (!data) {
      // Unparseable JSON body — same recovery path as a thrown failure.
      await writeStatus('failed');
      return;
    }
    const e = data.enrichment;
    if (!e || typeof e !== 'object') {
      await writeStatus('failed');
      return;
    }

    // Merge the enrichment payload into ai_raw so downstream consumers (web's
    // garmentIntelligence.ts:418-420 reads ai_raw.enrichment.refined_title etc.)
    // see the same shape as web-saved garments.
    //
    // Codex round 3 P1: NEVER fall through to `{}` on a select error or a
    // missing row. The insert path just wrote `system_signals` into ai_raw;
    // overwriting that with `{ enrichment: e }` would silently drop the
    // analysis_confidence / needs_review / source signals downstream consumers
    // depend on. If the read fails, mark enrichment failed and return — the
    // cron worker can retry the enrichment from a clean state later.
    const { data: existing, error: fetchErr } = await supabase
      .from('garments')
      .select('ai_raw')
      .eq('id', garmentId)
      .eq('user_id', userId)
      .single();
    if (fetchErr || !existing) {
      console.warn(
        `[triggerGarmentEnrichment] ai_raw read failed for ${garmentId}: ${fetchErr?.message ?? 'no row'}`,
      );
      await writeStatus('failed');
      return;
    }
    const currentRaw = (existing.ai_raw as Record<string, unknown> | null) ?? {};
    const mergedRaw = { ...currentRaw, enrichment: e };

    const updates: Record<string, unknown> = {
      ai_raw: mergedRaw,
      enrichment_status: 'completed',
    };

    if (typeof e.refined_title === 'string') {
      updates.title = e.refined_title.substring(0, 50);
    }
    if (typeof e.silhouette === 'string') updates.silhouette = e.silhouette;
    if (typeof e.visual_weight === 'string') {
      const vwMap: Record<string, number> = { light: 1, medium: 2, heavy: 3 };
      updates.visual_weight = vwMap[e.visual_weight] ?? 2;
    }
    if (typeof e.texture_intensity === 'string') {
      const tiMap: Record<string, number> = {
        smooth: 1,
        subtle: 2,
        moderate: 3,
        pronounced: 4,
        bold: 5,
      };
      updates.texture_intensity = tiMap[e.texture_intensity] ?? 3;
    }
    if (typeof e.style_archetype === 'string') updates.style_archetype = e.style_archetype;
    if (Array.isArray(e.occasion_tags)) {
      updates.occasion_tags = e.occasion_tags.filter((tag): tag is string => typeof tag === 'string');
    }
    if (typeof e.versatility_score === 'number') {
      updates.versatility_score = Math.max(1, Math.min(10, Math.round(e.versatility_score)));
    }

    // Codex round 3 P2: capture the final-write error. Without this, an RLS
    // or transient PostgREST failure here would leave enrichment_status at
    // 'processing' forever — caller assumes success, the row stays half-baked.
    // On error: roll the status to 'failed' so cron retry kicks in and Sentry
    // gets a signal we can monitor post-launch.
    const { error: updateErr } = await supabase
      .from('garments')
      .update(updates)
      .eq('id', garmentId)
      .eq('user_id', userId);
    if (updateErr) {
      console.warn(
        `[triggerGarmentEnrichment] enrichment update failed for ${garmentId}: ${updateErr.message}`,
      );
      Sentry.withScope((s) => {
        s.setTag('mutation', 'triggerGarmentEnrichment');
        s.setExtra('garmentId', garmentId);
        s.setExtra('phase', 'enrichment_update');
        Sentry.captureException(new Error(updateErr.message));
      });
      await writeStatus('failed');
    }
  } catch (err) {
    Sentry.withScope((s) => {
      s.setTag('mutation', 'triggerGarmentEnrichment');
      s.setExtra('garmentId', garmentId);
      Sentry.captureException(err);
    });
    // writeStatus already logs on its own failure — no extra wrapping needed.
    await writeStatus('failed');
  }
}
