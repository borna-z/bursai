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
  SUBSCRIPTION_SENTINEL,
} from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';

type SuggestAccessoriesResponse = {
  suggestions?: { garment_id?: string; reason?: string }[];
  message?: string;
  error?: string;
};

/** A single AI-suggested accessory. `reason` is the rationale string the
 *  function returns (e.g. "Adds a warm tone to balance the cool palette");
 *  null when the response omitted it (defensive — recent prompt versions
 *  always include one). Codex P1.1 on PR #743 — earlier shape dropped the
 *  reason and the screen could only surface color/category, losing the
 *  human-readable narrative the function was already producing. */
export interface AccessorySuggestion {
  garment_id: string;
  reason: string | null;
}

export interface UseSuggestAccessoriesResult {
  /** Suggestion list with both id + rationale. Use `accessorySuggestions[i].reason`
   *  to surface the AI's explanation in the UI. */
  accessorySuggestions: AccessorySuggestion[];
  /** Convenience id-only projection for callers that only need to look up
   *  garment rows. Order matches `accessorySuggestions`. */
  accessoryGarmentIds: string[];
  isSuggesting: boolean;
  error: string | null;
  suggest: (outfitId: string) => Promise<void>;
  reset: () => void;
}

export function useSuggestAccessories(): UseSuggestAccessoriesResult {
  const { session } = useAuth();
  const [accessorySuggestions, setAccessorySuggestions] = useState<AccessorySuggestion[]>([]);
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
          const raw = await callEdgeFunction<SuggestAccessoriesResponse>(
            'suggest_accessories',
            {
              body: { outfit_id: trimmed },
              signal: controller.signal,
            },
          );
          if (!raw) {
            // 2xx with unparseable JSON body — surface as a real failure
            // rather than a silent empty suggestion list.
            setError('Suggestion failed');
            return;
          }
          data = raw;
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

        const rawSuggestions = (data?.suggestions ?? [])
          .map((s) => {
            const id = typeof s?.garment_id === 'string' ? s.garment_id.trim() : '';
            const reasonRaw = typeof s?.reason === 'string' ? s.reason.trim() : '';
            return {
              garment_id: id,
              reason: reasonRaw.length > 0 ? reasonRaw : null,
            };
          })
          .filter((s): s is AccessorySuggestion => s.garment_id.length > 0);
        // De-dupe while preserving order — the AI occasionally returns the
        // same garment twice with different reasons; the screen's `+ Add`
        // mutation would otherwise insert a duplicate `outfit_items` row.
        // Keep the FIRST occurrence's reason on a collision (matches the
        // wave's "surface the AI's narrative" intent — first one wins).
        const seen = new Set<string>();
        const deduped: AccessorySuggestion[] = [];
        for (const sugg of rawSuggestions) {
          if (seen.has(sugg.garment_id)) continue;
          seen.add(sugg.garment_id);
          deduped.push(sugg);
        }
        setAccessorySuggestions(deduped);
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
    setAccessorySuggestions([]);
    setIsSuggesting(false);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Stable id-only projection — exposed for callers that just need to look
  // up garment rows (the AccessoryCard subtitle now reads `reason` from the
  // suggestion list directly). Computing here keeps a single source of
  // truth so the two arrays can never drift.
  const accessoryGarmentIds = accessorySuggestions.map((s) => s.garment_id);

  return {
    accessorySuggestions,
    accessoryGarmentIds,
    isSuggesting,
    error,
    suggest,
    reset,
  };
}
