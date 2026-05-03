// useWardrobeGaps — drives WardrobeGapsScreen via the `wardrobe_gap_analysis`
// edge function (plain JSON POST, no SSE).
//
// Engine response shape (per supabase/functions/wardrobe_gap_analysis/index.ts
// fallbackGapAnalysis + AI candidate ranking):
//   { gaps: [{ score, item, category, color, reason, new_outfits,
//              price_range, search_query, pairing_garment_ids,
//              key_insight }], shopping_recommendations?: [...] }
//
// We adapt that to the screen-friendly `WardrobeGap` (item_name + priority +
// estimated_price), deriving priority from the score band (>=80 high,
// 50-79 medium, <50 low). Subscription-locked → error string
// 'subscription_required' so the screen can pivot to the paywall.

import { useCallback, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { supabaseUrl } from '../lib/supabase';
import { getEdgeFunctionUrl } from '../lib/sse';

export type WardrobeGapPriority = 'high' | 'medium' | 'low';

export type WardrobeGap = {
  category: string;
  item_name: string;
  reason: string;
  priority: WardrobeGapPriority;
  estimated_price?: string;
};

type EdgeGap = {
  score?: number;
  item?: string;
  category?: string;
  reason?: string;
  price_range?: string;
  // Older fallback variants used these names — kept for forward-compat.
  item_name?: string;
  priority?: string;
  estimated_price?: string;
};

type EdgeResponse = {
  gaps?: EdgeGap[];
  recommendations?: EdgeGap[];
  error?: string;
};

function deriveScorePriority(score: number | undefined): WardrobeGapPriority {
  if (score === undefined) return 'low';
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function normalizePriority(value: string | undefined, fallback: WardrobeGapPriority): WardrobeGapPriority {
  const v = (value ?? '').toLowerCase();
  if (v === 'high' || v === 'medium' || v === 'low') return v;
  if (v === 'med') return 'medium';
  return fallback;
}

function adapt(gap: EdgeGap): WardrobeGap {
  const fallbackPriority = deriveScorePriority(gap.score);
  return {
    category: gap.category ?? 'general',
    item_name: gap.item_name ?? gap.item ?? 'Unknown',
    reason: gap.reason ?? '',
    priority: normalizePriority(gap.priority, fallbackPriority),
    estimated_price: gap.estimated_price ?? gap.price_range,
  };
}

export function useWardrobeGaps() {
  const { session } = useAuth();
  const [gaps, setGaps] = useState<WardrobeGap[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState(false);

  const analyze = useCallback(async () => {
    if (!session?.access_token) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        getEdgeFunctionUrl(supabaseUrl, 'wardrobe_gap_analysis'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ locale: 'en' }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        const errorMsg = body.error ?? `HTTP ${response.status}`;
        if (response.status === 402 || errorMsg === 'subscription_required') {
          setError('subscription_required');
        } else {
          setError(errorMsg);
        }
        return;
      }

      const data = (await response.json()) as EdgeResponse;
      if (data.error) {
        setError(data.error);
        return;
      }

      const raw = data.gaps ?? data.recommendations ?? [];
      setGaps(raw.map(adapt));
      setAnalyzed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);
  // (No AbortController on this hook — wardrobe_gap_analysis is a single-
  // shot JSON request; the screen guards against late setState by setting
  // `analyzed`/`isLoading` from a useEffect that early-returns when its own
  // unmount cleanup has fired.)

  const reset = useCallback(() => {
    setGaps([]);
    setAnalyzed(false);
    setError(null);
  }, []);

  return { gaps, isLoading, error, analyzed, analyze, reset };
}
