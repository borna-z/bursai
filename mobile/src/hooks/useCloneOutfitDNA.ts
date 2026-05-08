// useCloneOutfitDNA — M17 composition helper.
//
// Wraps the deployed `clone_outfit_dna` edge function. Body shape is
// `{ outfit_id, locale }`; response is
// `{ variations: { name, garment_ids[], explanation }[] }` — the function
// returns up to 3 variations that mirror the source's style profile but
// use DIFFERENT pieces from the user's wardrobe.
//
// The wave spec says "result is a single outfit; show a banner + new
// OutfitCard". Per the contract that's the FIRST variation. We surface
// `cloned` as a single `ScoredOutfitDraft` (variations[0]) plus the full
// `variations` array so a future depth pass can expose the alternates.
// Subscription gating raises the shared `'subscription_required'`
// sentinel.

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

type CloneVariation = {
  name?: string;
  garment_ids?: string[];
  explanation?: string;
};

type CloneOutfitDNAResponse = {
  variations?: CloneVariation[];
  error?: string;
};

export interface UseCloneOutfitDNAResult {
  /** Primary cloned look — `variations[0]` mapped to a draft. Null until
   *  `clone()` resolves successfully. */
  cloned: ScoredOutfitDraft | null;
  /** Full variation set (up to 3). Surfaced for future depth; the wave's
   *  MVP only renders `cloned`. */
  variations: ScoredOutfitDraft[];
  isCloning: boolean;
  error: string | null;
  clone: (outfitId: string) => Promise<void>;
  reset: () => void;
}

function makeDraftId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function variationToDraft(v: CloneVariation): ScoredOutfitDraft | null {
  const ids = (v?.garment_ids ?? []).filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  if (ids.length === 0) return null;
  // Slot data isn't returned by clone_outfit_dna — the function lets the
  // server-side `classifySlot` pick per garment. Codex P1.2 on PR #743:
  // omit the `slot` field entirely instead of presuming `'top'` for every
  // garment (which trickled into anchor / restyle paths and labelled e.g.
  // shoes as "TOP"). `ScoredOutfitDraft.items[].slot` is now optional —
  // consumers that need a slot must hydrate it from the garment row.
  const items = ids.map((id) => ({ garment_id: id }));
  return {
    draftId: makeDraftId(),
    items,
    explanation: v?.explanation ?? '',
    occasion: undefined,
    family_label: v?.name ?? null,
    confidence_score: null,
    confidence_level: null,
  };
}

export function useCloneOutfitDNA(): UseCloneOutfitDNAResult {
  const { session } = useAuth();
  const [variations, setVariations] = useState<ScoredOutfitDraft[]>([]);
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clone = useCallback(
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

      setIsCloning(true);
      setError(null);

      try {
        let data: CloneOutfitDNAResponse;
        try {
          const raw = await callEdgeFunction<CloneOutfitDNAResponse>(
            'clone_outfit_dna',
            {
              body: { outfit_id: trimmed, locale: getLocale() ?? 'en' },
              signal: controller.signal,
            },
          );
          if (!raw) {
            // Unparseable 2xx body — surface as a real failure rather than
            // masquerading as an empty `variations` array (which would render
            // a silent no-op against a bug we should see).
            setError('clone_invalid_response');
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

        // Codex P2.11 on PR #743 — defensively guard the response shape so a
        // malformed AI response (variations omitted, set to null, or shipped
        // as a non-array like `{}`) doesn't crash the `for…of` with
        // "is not iterable". Falls back to an empty draft list.
        const variationList = Array.isArray(data?.variations) ? data.variations : [];
        const drafts: ScoredOutfitDraft[] = [];
        for (const variation of variationList) {
          const draft = variationToDraft(variation);
          if (draft) drafts.push(draft);
        }
        setVariations(drafts);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Clone failed';
        if (message !== SUBSCRIPTION_SENTINEL) {
          Sentry.withScope((s) => {
            s.setTag('mutation', 'useCloneOutfitDNA');
            Sentry.captureException(err);
          });
        }
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsCloning(false);
        }
      }
    },
    [session?.access_token],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setVariations([]);
    setIsCloning(false);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    cloned: variations[0] ?? null,
    variations,
    isCloning,
    error,
    clone,
    reset,
  };
}
