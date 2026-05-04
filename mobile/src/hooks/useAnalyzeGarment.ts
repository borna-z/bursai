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
  occasion_tags: string[];
  formality: number | null;
  description: string | null;
  confidence: number;
  ai_provider?: string | null;
  ai_raw?: Record<string, unknown> | null;
}

export function useAnalyzeGarment() {
  const { session } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(
    async (storagePath: string): Promise<AnalysisResult | null> => {
      const accessToken = session?.access_token;
      if (!accessToken) {
        setError('Not signed in');
        return null;
      }

      setIsAnalyzing(true);
      setError(null);
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

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Analysis failed: ${response.status}`);
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
          occasion_tags: Array.isArray(data.occasion_tags) ? data.occasion_tags : [],
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
    setIsAnalyzing(false);
  }, []);

  return { analyze, isAnalyzing, result, error, reset };
}

