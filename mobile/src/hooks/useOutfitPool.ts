// useOutfitPool — pool generator (M16). Fans out N parallel calls to the
// `burs_style_engine` edge function via M9's `callEdgeFunction`, returning
// the N drafted outfits as `ScoredOutfitDraft`s ready to render in a grid
// and persist on demand.
//
// Per-call failures isolated via `Promise.allSettled` — one engine failure
// doesn't kill the batch. The hook only surfaces a top-level `error` when
// EVERY call failed; otherwise it exposes `completed < count` so the
// consumer (`OutfitPoolScreen`) can render partial results without a
// generic error state.
//
// Subscription gating: a 402 / `subscription_required` from any single
// call short-circuits the batch and surfaces the same `'subscription_required'`
// sentinel `useGenerateOutfit` raises, so the pool screen can route to the
// PaywallScreen the same way `OutfitGenerateScreen` does.
//
// Anchor enforcement: when an `anchorGarmentId` is supplied, each
// successful response is post-validated via `isAnchorPresent`. Drafts that
// drop the anchor are dropped from the pool (the consumer doesn't need to
// see them) but tallied in `anchorMissed` so the screen can surface a
// "regenerate?" hint. Slot-rule validation mirrors `useGenerateOutfit` —
// invalid compositions (top + shoes without a bottom, dress + bottom, two
// non-layered tops, etc.) are also dropped.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
} from '../lib/edgeFunctionClient';
import { isAnchorPresent } from '../lib/outfitAnchoring';
import { validateOutfitItems } from '../lib/outfitRules';
import { Sentry } from '../lib/sentry';

/** A draft outfit returned by the engine — not yet persisted to `outfits`.
 *  The pool screen renders these as preview tiles; saving turns each draft
 *  into an `outfits` + `outfit_items` row pair. */
export type ScoredOutfitDraft = {
  /** Stable client-side id so React lists key cleanly across re-renders.
   *  Not the persisted outfit id (none exists until save). */
  draftId: string;
  items: { slot: string; garment_id: string }[];
  explanation: string;
  occasion?: string;
  family_label?: string | null;
  confidence_score?: number | null;
  confidence_level?: string | null;
};

export interface UseOutfitPoolResult {
  pool: ScoredOutfitDraft[];
  isGenerating: boolean;
  /** Top-level error: only set when ALL calls failed, OR when any call
   *  returned the `subscription_required` sentinel (which short-circuits
   *  the batch). */
  error: string | null;
  /** Count of fan-out calls whose response dropped the requested anchor.
   *  Surfaced to the screen so it can render a "regenerate?" affordance. */
  anchorMissed: number;
  /** How many of the requested `count` actually came back as a usable
   *  outfit. May be less than `count` due to per-call failures or
   *  validation drops. */
  completed: number;
  generatePool: (params: {
    count: number;
    anchorGarmentId?: string;
    occasion?: string;
  }) => Promise<void>;
  reset: () => void;
}

type EngineResponseItem = { slot?: string; garment_id?: string };
type EngineResponse = {
  items?: EngineResponseItem[];
  explanation?: string;
  family_label?: string | null;
  confidence_score?: number | null;
  confidence_level?: string | null;
  error?: string;
};

const SUBSCRIPTION_SENTINEL = 'subscription_required';

function adaptItems(items: EngineResponseItem[] | undefined): { slot: string; garment_id: string }[] {
  return (items ?? [])
    .filter((it): it is { slot?: string; garment_id: string } => typeof it.garment_id === 'string')
    .map((it) => ({
      slot: typeof it.slot === 'string' && it.slot ? it.slot : 'top',
      garment_id: it.garment_id,
    }));
}

function makeDraftId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useOutfitPool(): UseOutfitPoolResult {
  const { session } = useAuth();
  const [pool, setPool] = useState<ScoredOutfitDraft[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anchorMissed, setAnchorMissed] = useState(0);
  const [completed, setCompleted] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const generatePool = useCallback(
    async ({
      count,
      anchorGarmentId,
      occasion,
    }: {
      count: number;
      anchorGarmentId?: string;
      occasion?: string;
    }) => {
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }
      // Clamp to the wave's stated 5-10 envelope and guard against zero —
      // an idle pool screen would otherwise sit forever on "0/0 ready".
      const safeCount = Math.max(1, Math.min(10, Math.floor(count)));

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsGenerating(true);
      setError(null);
      setPool([]);
      setAnchorMissed(0);
      setCompleted(0);

      const anchorId = anchorGarmentId?.trim() || undefined;
      const safeOccasion = occasion?.trim() || 'Everyday';

      const callOne = async (): Promise<ScoredOutfitDraft | null> => {
        const data = await callEdgeFunction<EngineResponse>('burs_style_engine', {
          body: {
            mode: 'generate',
            generator_mode: 'standard',
            occasion: safeOccasion,
            style: null,
            // Mild placeholder weather — same as `useGenerateOutfit`.
            // M35 will wire a real weather provider; until then the
            // engine's `normalizeWeather` accepts this shape cleanly.
            weather: { precipitation: 'none', wind: 'none' },
            locale: 'en',
            prefer_garment_ids: anchorId ? [anchorId] : [],
          },
          signal: controller.signal,
        });

        if (data?.error) {
          throw new Error(data.error);
        }

        const items = adaptItems(data?.items);
        if (items.length === 0) {
          // Engine returned no garments — drop this draft from the pool,
          // count it toward `completed` only as a failure.
          return null;
        }

        // Anchor enforcement (mobile parity with `useGenerateOutfit`).
        if (anchorId) {
          const ids = items.map((it) => it.garment_id);
          if (!isAnchorPresent(ids, anchorId)) {
            return null; // counted as anchor-missed by the caller
          }
        }

        // Slot-rule validation (mirror `useGenerateOutfit` — drop invalid
        // compositions rather than expose a broken outfit on the grid).
        const validation = validateOutfitItems(
          items.map((it) => ({ slot: it.slot })),
          { requireShoes: true, allowLayeredTops: true },
        );
        const topCount = items.filter((it) => it.slot === 'top').length;
        const nonLayeredDuplicates = validation.duplicateSlots.filter(
          (slot) => slot !== 'top' || topCount > 2,
        );
        if (
          validation.missing.length > 0
          || validation.conflictingSlots.length > 0
          || nonLayeredDuplicates.length > 0
        ) {
          return null;
        }

        return {
          draftId: makeDraftId(),
          items,
          explanation: data?.explanation ?? '',
          occasion: safeOccasion,
          family_label: data?.family_label ?? null,
          confidence_score: data?.confidence_score ?? null,
          confidence_level: data?.confidence_level ?? null,
        };
      };

      try {
        const settled = await Promise.allSettled(
          Array.from({ length: safeCount }, () => callOne()),
        );

        if (controller.signal.aborted) return;

        let subscriptionLocked = false;
        let allFailed = true;
        let anchorMissedLocal = 0;
        let completedLocal = 0;
        const drafts: ScoredOutfitDraft[] = [];

        for (const result of settled) {
          if (result.status === 'fulfilled') {
            allFailed = false;
            const draft = result.value;
            if (draft) {
              drafts.push(draft);
              completedLocal++;
            } else if (anchorId) {
              // The only `null`-returning branch that ties to the anchor
              // semantically is the `isAnchorPresent` drop. Drops for
              // empty items / invalid composition still happen but are
              // bucketed under "completed shortfall" in the screen. We
              // can't disambiguate post-hoc without threading a richer
              // return; the screen surfaces both via `completed < count`.
              anchorMissedLocal++;
            }
          } else {
            const err = result.reason;
            if (err instanceof EdgeFunctionSubscriptionLockedError) {
              subscriptionLocked = true;
              allFailed = false; // sentinel takes precedence over batch failure
              continue;
            }
            // Any other rejection is a per-call failure — keep going.
            // Capture once into Sentry so a sustained engine outage shows
            // up; per-call failures are otherwise expected (rate limit
            // bursts, transient 5xx).
            Sentry.withScope((s) => {
              s.setTag('mutation', 'useOutfitPool.callFailure');
              if (err instanceof EdgeFunctionHttpError) {
                s.setExtra('status', err.status);
                s.setExtra('body', err.bodyText);
              }
              Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
            });
          }
        }

        if (subscriptionLocked) {
          setError(SUBSCRIPTION_SENTINEL);
          return;
        }

        setPool(drafts);
        setAnchorMissed(anchorMissedLocal);
        setCompleted(completedLocal);

        if (allFailed) {
          setError('Generation failed');
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        // `Promise.allSettled` should never throw — anything that lands
        // here is a true unexpected. Surface a generic error and breadcrumb.
        Sentry.withScope((s) => {
          s.setTag('mutation', 'useOutfitPool');
          Sentry.captureException(err);
        });
        setError(err instanceof Error ? err.message : 'Generation failed');
      } finally {
        if (!controller.signal.aborted) {
          setIsGenerating(false);
        }
      }
    },
    [session?.access_token],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPool([]);
    setError(null);
    setAnchorMissed(0);
    setCompleted(0);
    setIsGenerating(false);
  }, []);

  // Cancel any in-flight batch when the consumer screen unmounts so trailing
  // setStates don't fire against a torn-down tree.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { pool, isGenerating, error, anchorMissed, completed, generatePool, reset };
}
