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
  SUBSCRIPTION_SENTINEL,
} from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';
import { getLocale } from '../lib/i18n';
import type { ScoredOutfitDraft } from './useOutfitPool';

type SuggestCombinationsResponse = {
  suggestions?: {
    title?: string;
    garment_ids?: string[];
    explanation?: string;
    occasion?: string;
    // `garments[]` hydrated rows are returned by the function but no
    // longer consumed client-side (Codex P1.3 on PR #743 dropped the
    // local slot taxonomy in favour of `slot: 'unknown'`). Kept untyped
    // here so we don't fall out of sync with the function if it grows
    // a wider hydration shape; consumers can switch to a typed accessor
    // later if needed.
    garments?: unknown[];
  }[];
  message?: string;
  error?: string;
};

export interface UseSuggestCombinationsResult {
  combinations: ScoredOutfitDraft[];
  isSuggesting: boolean;
  error: string | null;
  /** Codex P1.6 on PR #743 — the function scores against the user's full
   *  wardrobe (not against a reference outfit), and the previous
   *  `outfit_id` parameter was dead validation: never sent on the wire,
   *  only used to early-error out. The hook now takes no arguments;
   *  callers don't need to plumb context through. */
  suggest: () => Promise<void>;
  reset: () => void;
}

function makeDraftId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useSuggestCombinations(): UseSuggestCombinationsResult {
  const { session } = useAuth();
  const [combinations, setCombinations] = useState<ScoredOutfitDraft[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const suggest = useCallback(
    async () => {
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }
      // Codex P1.6 on PR #743 — no outfit_id needed. The
      // `suggest_outfit_combinations` function scores against the user's
      // full wardrobe + recent outfits to surface unused garments; it
      // never consumed an outfit_id parameter. Earlier wave shipped a
      // dead `outfit_id` validator that only created a paper trail of
      // a forward-compat field that wasn't there. Removed.

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
        // Codex P2.11-style guard — defensively normalize to an array so a
        // malformed AI response (omitted/null `suggestions`) doesn't crash
        // the for…of with "is not iterable".
        const suggestionList = Array.isArray(data?.suggestions) ? data.suggestions : [];
        for (const sugg of suggestionList) {
          const ids = (sugg?.garment_ids ?? []).filter(
            (id): id is string => typeof id === 'string' && id.length > 0,
          );
          if (ids.length === 0) continue;
          // Codex P1.3 on PR #743 — drop the local `inferSlot` taxonomy.
          // It was wrong against the canonical taxonomy in
          // `mobile/src/lib/outfitRules.ts` (e.g. mapped 'jackets' →
          // 'outerwear' but emitted 'top' for 'shirts'), and the function's
          // garments[] hydration is hint-only — the server picks the real
          // slot per garment via its own `classifySlot`. Mark each item
          // `slot: 'unknown'` so consumers know to hydrate from the garment
          // row when slot context is needed (mirrors the optional-slot
          // contract `useCloneOutfitDNA` adopted alongside this fix).
          const items = ids.map((id) => ({
            slot: 'unknown',
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
