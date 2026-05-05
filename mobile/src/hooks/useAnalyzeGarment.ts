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

import { supabase, supabaseUrl } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Sentry } from '../lib/sentry';

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
  confidence: number;
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
 * - base64: raw data URL (`data:image/jpeg;base64,...`). Lets the analyze call
 *   start before upload completes — main parallel-flow optimisation in PR 1.
 *   Edge function caps incoming base64 at 5MB; mobile resizer (1200px JPEG q=0.85)
 *   stays comfortably under that.
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

      try {
        const body: Record<string, unknown> = {
          mode: 'fast',
          locale: 'en',
        };
        if ('base64' in input) body.base64Image = input.base64;
        else body.storagePath = input.storagePath;

        const response = await fetch(`${supabaseUrl}/functions/v1/analyze_garment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
        });

        setStatus(response.status);

        if (!response.ok) {
          const errBody = (await response.json().catch(() => ({}))) as { error?: string };
          // Map known infrastructure failures to copy that gives the user something to do.
          // 402 callers (Step 2) are expected to also route to Paywall; 429 callers may
          // want to schedule a retry instead of just surfacing an error.
          let message = errBody.error ?? `Analysis failed: ${response.status}`;
          if (response.status === 402) {
            message = 'AI analysis is a Premium feature. Upgrade to keep adding pieces.';
          } else if (response.status === 429) {
            message = "You've hit the analysis rate limit. Try again in a minute.";
          } else if (response.status >= 500) {
            message = 'Our AI is having a moment. Please try again.';
          }
          throw new Error(message);
        }

        const data = (await response.json()) as AnalysisResult & { error?: string };
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
          confidence: typeof data.confidence === 'number' ? data.confidence : 0,
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
        return normalized;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Analysis failed';
        // Skip the expected paywall sentinel — those are gating, not failures.
        if (msg !== 'subscription_required') {
          Sentry.withScope((s) => {
            s.setTag('mutation', 'useAnalyzeGarment');
            Sentry.captureException(err);
          });
        }
        setError(msg);
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
  accessToken: string,
): Promise<void> {
  try {
    await supabase.from('garments').update({ enrichment_status: 'processing' }).eq('id', garmentId);

    const response = await fetch(`${supabaseUrl}/functions/v1/analyze_garment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ storagePath, mode: 'enrich' }),
    });

    if (!response.ok) {
      await supabase.from('garments').update({ enrichment_status: 'failed' }).eq('id', garmentId);
      return;
    }

    const data = (await response.json()) as { enrichment?: Record<string, unknown> | null };
    const e = data.enrichment;
    if (!e || typeof e !== 'object') {
      await supabase.from('garments').update({ enrichment_status: 'failed' }).eq('id', garmentId);
      return;
    }

    // Merge the enrichment payload into ai_raw so downstream consumers (web's
    // garmentIntelligence.ts:418-420 reads ai_raw.enrichment.refined_title etc.)
    // see the same shape as web-saved garments.
    const { data: existing } = await supabase
      .from('garments')
      .select('ai_raw')
      .eq('id', garmentId)
      .single();
    const currentRaw = (existing?.ai_raw as Record<string, unknown> | null) ?? {};
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

    await supabase.from('garments').update(updates).eq('id', garmentId);
  } catch (err) {
    Sentry.withScope((s) => {
      s.setTag('mutation', 'triggerGarmentEnrichment');
      s.setExtra('garmentId', garmentId);
      Sentry.captureException(err);
    });
    // Best-effort terminal write — if the network just dropped this also fails,
    // but the worst case is the row stays at 'processing' until the next save.
    try {
      await supabase.from('garments').update({ enrichment_status: 'failed' }).eq('id', garmentId);
    } catch {
      /* swallow — already logged */
    }
  }
}
