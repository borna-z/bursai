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
// "regenerate?" hint. Drops for empty items / invalid composition are
// bucketed separately (`dropped`) so a noisy validation outage doesn't
// inflate `anchorMissed` and trigger a misleading "couldn't honour the
// anchor" affordance.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
  SUBSCRIPTION_SENTINEL,
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
  /** Per-item slot is OPTIONAL — some upstreams (clone_outfit_dna,
   *  suggest_outfit_combinations) don't return a server-side slot per
   *  garment, and presuming a slot client-side ('top' as a blanket
   *  default) was misleading downstream rendering (Codex P1.2 / P1.3 on
   *  PR #743). Consumers that need a slot should hydrate it from the
   *  garment row via `useGarments` / `inferCanonicalOutfitSlot`.
   *  Engine-driven sources (`useGenerateOutfit`, `useOutfitPool`) still
   *  populate it because `burs_style_engine` returns explicit slots. */
  items: { slot?: string; garment_id: string }[];
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
   *  Surfaced to the screen so it can render a "regenerate?" affordance.
   *  Drops for empty items / invalid composition land in a separate
   *  bucket and are absorbed in `completed = drafts.length`. */
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

/** Discriminated outcome per engine call. Lets the accumulator bucket
 *  anchor-missed and other drops into separate counters so the screen
 *  doesn't surface a "couldn't honour the anchor" affordance when the
 *  real problem is the engine returning empty / invalid items.
 *  - `ok`: usable draft, push into `drafts`
 *  - `anchor_missed`: anchor was requested + dropped → counts toward `anchorMissed`
 *  - `empty` / `invalid`: returned no items / failed slot validation → silently absorbed
 */
type CallOneResult =
  | { kind: 'ok'; draft: ScoredOutfitDraft }
  | { kind: 'anchor_missed' }
  | { kind: 'empty' }
  | { kind: 'invalid' };

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
      // Clamp to the wave's stated 5-10 envelope and guard against zero +
      // NaN — `Math.floor(NaN)` is NaN, and `Math.max(1, Math.min(10, NaN))`
      // returns NaN, so a malformed route param would otherwise yield zero
      // requests and a stuck "0/0 ready" screen.
      const safeCount = Number.isFinite(count)
        ? Math.max(1, Math.min(10, Math.floor(count)))
        : 5;

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

      const callOne = async (): Promise<CallOneResult> => {
        const data = await callEdgeFunction<EngineResponse>('burs_style_engine', {
          body: {
            mode: 'generate',
            generator_mode: 'standard',
            occasion: safeOccasion,
            style: null,
            // Mild placeholder weather — same as `useGenerateOutfit` and
            // `useWeekGenerator`. M35 will wire a real weather provider;
            // until then the engine's `normalizeWeather` accepts this
            // shape cleanly.
            weather: { temperature: 18, precipitation: 'none', wind: 'none' },
            locale: 'en',
            // Only include the field when an anchor exists — keeps the
            // body terse and avoids sending an empty array the engine
            // would otherwise have to ignore.
            ...(anchorId ? { prefer_garment_ids: [anchorId] } : {}),
          },
          signal: controller.signal,
        });

        if (data?.error) {
          throw new Error(data.error);
        }

        const items = adaptItems(data?.items);
        if (items.length === 0) {
          // Engine returned no garments — drop this draft from the pool.
          // Bucketed as `empty`, NOT as `anchor_missed`, so a flaky AI
          // response doesn't poison the anchor counter.
          return { kind: 'empty' };
        }

        // Anchor enforcement (mobile parity with `useGenerateOutfit`).
        if (anchorId) {
          const ids = items.map((it) => it.garment_id);
          if (!isAnchorPresent(ids, anchorId)) {
            return { kind: 'anchor_missed' };
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
          return { kind: 'invalid' };
        }

        return {
          kind: 'ok',
          draft: {
            draftId: makeDraftId(),
            items,
            explanation: data?.explanation ?? '',
            occasion: safeOccasion,
            family_label: data?.family_label ?? null,
            confidence_score: data?.confidence_score ?? null,
            confidence_level: data?.confidence_level ?? null,
          },
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
        const drafts: ScoredOutfitDraft[] = [];

        for (const result of settled) {
          if (result.status === 'fulfilled') {
            allFailed = false;
            const outcome = result.value;
            if (outcome.kind === 'ok') {
              drafts.push(outcome.draft);
            } else if (outcome.kind === 'anchor_missed') {
              anchorMissedLocal++;
            }
            // `empty` and `invalid` are silently absorbed — the consumer
            // sees the shortfall via `completed < count`.
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
        setCompleted(drafts.length);

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
        // Always reset isGenerating regardless of abort state — matches
        // `useGenerateOutfit`. Leaving it `true` after an abort would
        // strand the screen in a permanent "Generating…" state if the
        // user re-enters without unmounting (e.g. param change races
        // a regenerate tap).
        setIsGenerating(false);
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
