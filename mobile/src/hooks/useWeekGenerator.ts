// useWeekGenerator — mobile port of `src/hooks/useWeekGenerator.ts` (web).
//
// 7 sequential calls to `burs_style_engine` (one per ISO date) via M9's
// `callEdgeFunction`. Sequential, not parallel — matches the web's intent
// of avoiding rate-limit bursts on a single user (the engine is rate-limited
// per-user and a 7-shot fan-out would burn the per-minute budget on the
// premium tier in a single second). Each per-day failure is caught and
// stored on the entry's `error`; the loop continues so a single bad day
// doesn't drop the rest of the week.
//
// Day context (M15): each call carries `day_context` derived from
// `buildDayIntelligence(events, weather)`. Until the calendar (M36) and
// weather (M35) hooks ship, events default to `[]` and weather to the
// same mild placeholder used by `useSmartDayRecommendation` so the
// engine produces a sane composition rather than refusing to score.
// Recently-worn garment IDs come from `useFlatGarments` and are passed
// to the engine as `exclude_garment_ids` to bias against repetition
// across the week.
//
// Subscription gating: a 402 / `subscription_required` from any single
// day short-circuits the loop and surfaces the same sentinel error
// `useGenerateOutfit` raises so the screen can route to the paywall.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
} from '../lib/edgeFunctionClient';
import { useFlatGarments } from './useGarments';
import {
  buildDayIntelligence,
  type DayEventInput,
  type DayWeatherInput,
} from '../lib/dayIntelligence';
import { localISODate } from '../lib/outfitDisplay';
import { Sentry } from '../lib/sentry';
import { validateOutfitItems } from '../lib/outfitRules';
import type { ScoredOutfitDraft } from './useOutfitPool';

const RECENTLY_WORN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const FALLBACK_WEATHER: DayWeatherInput = {
  temperature: 18,
  precipitation: 'unknown',
};

const SUBSCRIPTION_SENTINEL = 'subscription_required';

export interface WeekGeneratorEntry {
  /** ISO `YYYY-MM-DD` for this slot, in the user's local timezone. */
  date: string;
  outfit: ScoredOutfitDraft | null;
  /** Per-day error sentinel (`'no_items'`, `'invalid_outfit'`, raw HTTP
   *  message, etc.). Null when generation succeeded. The screen uses this
   *  to render a "tap to retry" affordance per row. */
  error: string | null;
}

export interface UseWeekGeneratorResult {
  entries: WeekGeneratorEntry[];
  isGenerating: boolean;
  /** How many of the 7 days produced a usable outfit. */
  completed: number;
  /** Top-level error: only set on subscription_required (loop short-circuit)
   *  or when the wrapper itself throws. Per-day errors live on
   *  `entries[i].error`. */
  error: string | null;
  generateWeek: (params?: {
    startDate?: Date;
    locale?: string;
  }) => Promise<void>;
  /** Re-run generation for a single day and replace that entry. Used by the
   *  "tap to retry" / "swap" affordances on `WeekPlanPreview`. */
  regenerateDay: (date: string) => Promise<void>;
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

function computeWeekIsos(startDate: Date): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    out.push(localISODate(d));
  }
  return out;
}

export function useWeekGenerator(): UseWeekGeneratorResult {
  const { session } = useAuth();
  const flatGarmentsQ = useFlatGarments();
  const [entries, setEntries] = useState<WeekGeneratorEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Snapshot the last-generation params so `regenerateDay` can re-run a
  // single slot with the same locale + recently-worn set the original
  // batch saw. Without this the day swap would silently change context.
  const lastParamsRef = useRef<{ locale: string; recentlyWornIds: string[] } | null>(null);

  const callOneDay = useCallback(
    async ({
      date,
      locale,
      recentlyWornIds,
      signal,
    }: {
      date: string;
      locale: string;
      recentlyWornIds: string[];
      signal: AbortSignal;
    }): Promise<WeekGeneratorEntry> => {
      // Build per-day context. Until M35/M36 land, events are empty and
      // weather is the placeholder; the engine still produces a sane
      // composition (no rain → no umbrella bias, mild temp → no thermal
      // gating, no event tags → defaults to dominant 'casual').
      const events: DayEventInput[] = [];
      const intelligence = buildDayIntelligence(events, FALLBACK_WEATHER);

      try {
        const data = await callEdgeFunction<EngineResponse>('burs_style_engine', {
          body: {
            mode: 'generate',
            generator_mode: 'standard',
            occasion: intelligence.dominant_occasion,
            style: null,
            weather: FALLBACK_WEATHER,
            locale,
            day_context: {
              date,
              intelligence,
              weather: FALLBACK_WEATHER,
            },
            // Bias the engine away from already-worn garments to reduce
            // week-over-week repetition. Soft hint, not a hard exclude —
            // mirrors web's web reference.
            exclude_garment_ids: recentlyWornIds,
          },
          signal,
        });

        if (data?.error) {
          return { date, outfit: null, error: data.error };
        }

        const items = adaptItems(data?.items);
        if (items.length === 0) {
          return { date, outfit: null, error: 'no_items' };
        }

        // Validate composition — drop weeks where the engine returned
        // something the user couldn't actually wear.
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
          return { date, outfit: null, error: 'invalid_outfit' };
        }

        return {
          date,
          outfit: {
            draftId: makeDraftId(),
            items,
            explanation: data?.explanation ?? '',
            occasion: intelligence.dominant_occasion,
            family_label: data?.family_label ?? null,
            confidence_score: data?.confidence_score ?? null,
            confidence_level: data?.confidence_level ?? null,
          },
          error: null,
        };
      } catch (err) {
        if (err instanceof EdgeFunctionSubscriptionLockedError) {
          // Re-throw so the loop can short-circuit.
          throw err;
        }
        // Per-day error — record it on the entry and let the loop continue.
        Sentry.withScope((s) => {
          s.setTag('mutation', 'useWeekGenerator.dayFailure');
          s.setExtra('date', date);
          if (err instanceof EdgeFunctionHttpError) {
            s.setExtra('status', err.status);
            s.setExtra('body', err.bodyText);
          }
          Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
        });
        const message = err instanceof Error ? err.message : 'Generation failed';
        return { date, outfit: null, error: message };
      }
    },
    [],
  );

  const generateWeek = useCallback(
    async (params?: { startDate?: Date; locale?: string }) => {
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const start = params?.startDate ?? new Date();
      const locale = params?.locale ?? 'en';
      const isos = computeWeekIsos(start);

      // Recently-worn = last 7 days. Pulled from the flat garment cache,
      // not refetched — matches `useSmartDayRecommendation`'s approach.
      const cutoffMs = Date.now() - RECENTLY_WORN_WINDOW_MS;
      const recentlyWornIds: string[] = [];
      for (const g of flatGarmentsQ.data ?? []) {
        const lastWorn = g.last_worn_at ? new Date(g.last_worn_at).getTime() : NaN;
        if (Number.isFinite(lastWorn) && lastWorn >= cutoffMs) {
          recentlyWornIds.push(g.id);
        }
      }

      lastParamsRef.current = { locale, recentlyWornIds };

      setIsGenerating(true);
      setError(null);
      // Pre-seed the entries array so the screen can render a 7-row
      // skeleton with stable date labels while the loop fills them in.
      setEntries(
        isos.map((date) => ({ date, outfit: null, error: null })),
      );

      try {
        for (const date of isos) {
          if (controller.signal.aborted) return;
          try {
            const entry = await callOneDay({
              date,
              locale,
              recentlyWornIds,
              signal: controller.signal,
            });
            if (controller.signal.aborted) return;
            setEntries((prev) => prev.map((e) => (e.date === date ? entry : e)));
          } catch (err) {
            if (err instanceof EdgeFunctionSubscriptionLockedError) {
              setError(SUBSCRIPTION_SENTINEL);
              return; // short-circuit the rest of the week
            }
            // `callOneDay` already swallows non-subscription errors per-day.
            // Anything escaping here is unexpected — log + abort the loop.
            Sentry.withScope((s) => {
              s.setTag('mutation', 'useWeekGenerator');
              Sentry.captureException(err);
            });
            setError(err instanceof Error ? err.message : 'Week generation failed');
            return;
          }
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsGenerating(false);
        }
      }
    },
    [session?.access_token, flatGarmentsQ.data, callOneDay],
  );

  const regenerateDay = useCallback(
    async (date: string) => {
      if (!session?.access_token) return;
      const params = lastParamsRef.current;
      if (!params) return; // no prior batch — caller should call generateWeek first

      // Per-day regeneration uses its own controller so it doesn't fight a
      // backgrounded full-week run for the abort signal.
      const controller = new AbortController();

      // Mark this row as in-flight by clearing the existing error so the
      // screen can render a skeleton/spinner. We don't flip the top-level
      // `isGenerating` because that would dim the rest of the week.
      setEntries((prev) =>
        prev.map((e) => (e.date === date ? { date, outfit: null, error: null } : e)),
      );

      try {
        const entry = await callOneDay({
          date,
          locale: params.locale,
          recentlyWornIds: params.recentlyWornIds,
          signal: controller.signal,
        });
        setEntries((prev) => prev.map((e) => (e.date === date ? entry : e)));
      } catch (err) {
        if (err instanceof EdgeFunctionSubscriptionLockedError) {
          setError(SUBSCRIPTION_SENTINEL);
          return;
        }
        const message = err instanceof Error ? err.message : 'Generation failed';
        setEntries((prev) =>
          prev.map((e) => (e.date === date ? { date, outfit: null, error: message } : e)),
        );
      }
    },
    [session?.access_token, callOneDay],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    lastParamsRef.current = null;
    setEntries([]);
    setError(null);
    setIsGenerating(false);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const completed = entries.filter((e) => e.outfit !== null).length;

  return { entries, isGenerating, completed, error, generateWeek, regenerateDay, reset };
}
