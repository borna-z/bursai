// useSuggestCombinations — M17 composition helper.
//
// Wraps the deployed `suggest_outfit_combinations` edge function. Body
// shape is `{ locale }` (no outfit_id required — the function reads the
// user's wardrobe + recent outfits to surface 2-3 combinations that
// rediscover unused garments). Response is
// `{ suggestions: { title, garment_ids[], explanation, occasion, garments[] }[] }`.
//
// Surfaces results as `ScoredOutfitDraft[]` so screens can render them
// with the same shape they use for `useOutfitPool` drafts. Subscription
// gating raises the shared `'subscription_required'` sentinel.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
} from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';
import { getLocale } from '../lib/i18n';
import type { ScoredOutfitDraft } from './useOutfitPool';

const SUBSCRIPTION_SENTINEL = 'subscription_required';

type SuggestCombinationsResponse = {
  suggestions?: {
    title?: string;
    garment_ids?: string[];
    explanation?: string;
    occasion?: string;
    garments?: { id?: string; category?: string | null; subcategory?: string | null }[];
  }[];
  message?: string;
  error?: string;
};

export interface UseSuggestCombinationsResult {
  combinations: ScoredOutfitDraft[];
  isSuggesting: boolean;
  error: string | null;
  /** Per the wave spec the param is the source `outfit_id`; the deployed
   *  function ignores it (it scores against the full wardrobe) but we
   *  thread it through anyway so the contract surface is forward-compat
   *  if the function ever grows reference-outfit awareness. */
  suggest: (outfitId: string) => Promise<void>;
  reset: () => void;
}

function makeDraftId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function inferSlot(g: { category?: string | null; subcategory?: string | null } | undefined): string {
  // Defensive fallback only. The function's response includes hydrated
  // garment rows with category — map a few common categories to engine
  // slots so the variation cards render with sensible labels. Anything
  // we don't recognize lands in `top` to match the existing
  // `useGenerateOutfit.adaptItems` default.
  const cat = (g?.category || '').toLowerCase();
  if (cat === 'shoes' || cat === 'footwear') return 'shoes';
  if (cat === 'bottoms' || cat === 'pants' || cat === 'skirts') return 'bottom';
  if (cat === 'dresses') return 'dress';
  if (cat === 'outerwear' || cat === 'jackets' || cat === 'coats') return 'outerwear';
  if (cat === 'accessories') return 'accessory';
  return 'top';
}

export function useSuggestCombinations(): UseSuggestCombinationsResult {
  const { session } = useAuth();
  const [combinations, setCombinations] = useState<ScoredOutfitDraft[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const suggest = useCallback(
    async (outfitId: string) => {
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }
      // outfitId isn't sent on the wire (function doesn't accept it) but
      // we still trim-validate so a bad caller surfaces an error instead
      // of silently scoring against the wardrobe with no context. Logged
      // in code so a future contract change can flip this to a real send.
      const trimmed = outfitId?.trim();
      if (!trimmed) {
        setError('Missing outfit_id');
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsSuggesting(true);
      setError(null);

      try {
        let data: SuggestCombinationsResponse;
        try {
          data = await callEdgeFunction<SuggestCombinationsResponse>(
            'suggest_outfit_combinations',
            {
              body: { locale: getLocale() ?? 'en' },
              signal: controller.signal,
            },
          );
        } catch (callErr) {
          if (callErr instanceof EdgeFunctionSubscriptionLockedError) {
            setError(SUBSCRIPTION_SENTINEL);
            return;
          }
          if (callErr instanceof EdgeFunctionHttpError) {
            const parsed = (() => {
              try {
                return JSON.parse(callErr.bodyText) as { error?: string };
              } catch {
                return null;
              }
            })();
            setError(parsed?.error ?? `HTTP ${callErr.status}`);
            return;
          }
          throw callErr;
        }

        if (data?.error) {
          setError(data.error);
          return;
        }

        const drafts: ScoredOutfitDraft[] = [];
        for (const sugg of data?.suggestions ?? []) {
          const ids = (sugg?.garment_ids ?? []).filter(
            (id): id is string => typeof id === 'string' && id.length > 0,
          );
          if (ids.length === 0) continue;
          const garmentMap = new Map<
            string,
            { category?: string | null; subcategory?: string | null }
          >();
          for (const g of sugg?.garments ?? []) {
            if (g?.id) garmentMap.set(g.id, g);
          }
          const items = ids.map((id) => ({
            slot: inferSlot(garmentMap.get(id)),
            garment_id: id,
          }));
          drafts.push({
            draftId: makeDraftId(),
            items,
            explanation: sugg?.explanation ?? '',
            occasion: sugg?.occasion ?? undefined,
            family_label: sugg?.title ?? null,
            confidence_score: null,
            confidence_level: null,
          });
        }

        setCombinations(drafts);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Combination suggestion failed';
        if (message !== SUBSCRIPTION_SENTINEL) {
          Sentry.withScope((s) => {
            s.setTag('mutation', 'useSuggestCombinations');
            Sentry.captureException(err);
          });
        }
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsSuggesting(false);
        }
      }
    },
    [session?.access_token],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setCombinations([]);
    setIsSuggesting(false);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { combinations, isSuggesting, error, suggest, reset };
}
