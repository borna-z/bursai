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

import { supabaseUrl } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
}

/** HTTP status from the most recent analyze call — null when no call has run or it threw before the response arrived. */
export type AnalyzeStatus = number | null;

export function useAnalyzeGarment() {
  const { session } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalyzeStatus>(null);

  const analyze = useCallback(
    async (storagePath: string): Promise<AnalysisResult | null> => {
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
        const response = await fetch(`${supabaseUrl}/functions/v1/analyze_garment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            storagePath,
            mode: 'fast',
            locale: 'en',
          }),
        });

        setStatus(response.status);

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          // Map known infrastructure failures to copy that gives the user something to do.
          // 402 callers (Step 2) are expected to also route to Paywall; 429 callers may
          // want to schedule a retry instead of just surfacing an error.
          let message = body.error ?? `Analysis failed: ${response.status}`;
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
        };

        setResult(normalized);
        return normalized;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Analysis failed';
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
