// useSuggestAccessories — M17 composition helper.
//
// Wraps the deployed `suggest_accessories` edge function. Body shape is
// `{ outfit_id }`; response is `{ suggestions: { garment_id, reason }[] }`
// (the function caps at 3, but the wave allows 3-5 — defensive accessor
// either way). Each id maps to a garment in the user's wardrobe (the
// function pre-filters by `category = 'accessories'` and `in_laundry =
// false`).
//
// Surfaces only the `garment_id`s — the screen looks up the full garment
// rows via existing `useGarments` infrastructure. Subscription gating
// surfaces the `'subscription_required'` sentinel pattern shared with
// `useGenerateOutfit` / `useOutfitPool`.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
} from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';

const SUBSCRIPTION_SENTINEL = 'subscription_required';

type SuggestAccessoriesResponse = {
  suggestions?: { garment_id?: string; reason?: string }[];
  message?: string;
  error?: string;
};

export interface UseSuggestAccessoriesResult {
  accessoryGarmentIds: string[];
  isSuggesting: boolean;
  error: string | null;
  suggest: (outfitId: string) => Promise<void>;
  reset: () => void;
}

export function useSuggestAccessories(): UseSuggestAccessoriesResult {
  const { session } = useAuth();
  const [accessoryGarmentIds, setAccessoryGarmentIds] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const suggest = useCallback(
    async (outfitId: string) => {
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }
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
        let data: SuggestAccessoriesResponse;
        try {
          data = await callEdgeFunction<SuggestAccessoriesResponse>('suggest_accessories', {
            body: { outfit_id: trimmed },
            signal: controller.signal,
          });
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

        const ids = (data?.suggestions ?? [])
          .map((s) => (typeof s?.garment_id === 'string' ? s.garment_id.trim() : ''))
          .filter((id): id is string => id.length > 0);
        // De-dupe while preserving order — the AI occasionally returns the
        // same garment twice with different reasons; the screen's `+ Add`
        // mutation would otherwise insert a duplicate `outfit_items` row.
        const seen = new Set<string>();
        const deduped: string[] = [];
        for (const id of ids) {
          if (seen.has(id)) continue;
          seen.add(id);
          deduped.push(id);
        }
        setAccessoryGarmentIds(deduped);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Accessory suggestion failed';
        if (message !== SUBSCRIPTION_SENTINEL) {
          Sentry.withScope((s) => {
            s.setTag('mutation', 'useSuggestAccessories');
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
    setAccessoryGarmentIds([]);
    setIsSuggesting(false);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { accessoryGarmentIds, isSuggesting, error, suggest, reset };
}
