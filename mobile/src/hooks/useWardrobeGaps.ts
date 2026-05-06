// useWardrobeGaps — drives WardrobeGapsScreen via the `wardrobe_gap_analysis`
// edge function (plain JSON POST, no SSE).
//
// Backed by React Query so a Wardrobe Gaps -> back -> Wardrobe Gaps round
// trip doesn't burn the rate-limited endpoint (15/hr free-tier base, 0.5x
// multiplier => ~7-8/hr). The query is held lazily — `analyze()` triggers
// `refetch()`, otherwise the screen renders the cached gaps from prior
// analyses for staleTime. Codex audit P1-4 (audit 2).
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

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
} from '../lib/edgeFunctionClient';

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

class GapAnalysisError extends Error {
  constructor(message: string, public readonly subscriptionLocked = false) {
    super(message);
    this.name = 'GapAnalysisError';
  }
}

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

async function runAnalysis(): Promise<WardrobeGap[]> {
  let data: EdgeResponse;
  try {
    data = await callEdgeFunction<EdgeResponse>('wardrobe_gap_analysis', {
      body: { locale: 'en' },
    });
  } catch (callErr) {
    if (callErr instanceof EdgeFunctionSubscriptionLockedError) {
      throw new GapAnalysisError('subscription_required', true);
    }
    if (callErr instanceof EdgeFunctionHttpError) {
      const parsed = (() => {
        try {
          return JSON.parse(callErr.bodyText) as { error?: string };
        } catch {
          return null;
        }
      })();
      throw new GapAnalysisError(parsed?.error ?? `HTTP ${callErr.status}`);
    }
    throw new GapAnalysisError(callErr instanceof Error ? callErr.message : String(callErr));
  }
  if (data.error) throw new GapAnalysisError(data.error);
  const raw = data.gaps ?? data.recommendations ?? [];
  return raw.map(adapt);
}

export function useWardrobeGaps() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const accessToken = session?.access_token;

  // Lazy query — disabled until `analyze()` triggers it via mutation, OR
  // until React Query already has cached gaps from a prior session.
  const query = useQuery<WardrobeGap[], GapAnalysisError>({
    queryKey: ['wardrobe_gaps', user?.id],
    // queryFn is unused when `enabled: false` + manual refetch — but RQ v5
    // still requires it to be a function.
    queryFn: async () => {
      if (!accessToken) throw new GapAnalysisError('Not authenticated');
      return runAnalysis();
    },
    enabled: false,
    // 30 min — long enough that normal back-and-forth navigation hits cache,
    // short enough that the user gets fresh data on a return-after-coffee.
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  const mutation = useMutation<WardrobeGap[], GapAnalysisError>({
    mutationFn: async () => {
      if (!accessToken) throw new GapAnalysisError('Not authenticated');
      return runAnalysis();
    },
    onSuccess: (data) => {
      // Land the freshly-fetched gaps in the cache so re-mounts read from
      // memory instead of triggering another (rate-limited) call.
      queryClient.setQueryData(['wardrobe_gaps', user?.id], data);
    },
    onError: captureMutationError('useWardrobeGaps'),
  });

  const analyze = useCallback(async () => {
    if (!accessToken) return;
    await mutation.mutateAsync();
  }, [accessToken, mutation]);

  const reset = useCallback(() => {
    queryClient.removeQueries({ queryKey: ['wardrobe_gaps', user?.id] });
    mutation.reset();
  }, [queryClient, user?.id, mutation]);

  // The screen treats `analyzed` as "we have a result (cached or freshly
  // fetched), regardless of staleness". A successful prior fetch persists
  // across screen re-mounts via the React Query cache.
  const gaps = query.data ?? mutation.data ?? [];
  const analyzed = (query.data?.length ?? 0) > 0
    || (mutation.data?.length ?? 0) > 0
    || mutation.isSuccess
    || query.isSuccess;
  const isLoading = mutation.isPending;
  const error = mutation.error?.message ?? null;

  return { gaps, isLoading, error, analyzed, analyze, reset };
}
