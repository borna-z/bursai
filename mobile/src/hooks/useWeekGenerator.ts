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
// `buildDayIntelligence(events, weather)`. M35 wired `useWeather` and M36
// wired `useCalendarSync`; this hook now consumes `useWeather` directly so
// the engine sees real rain/snow/heat/cold context across the whole week
// instead of the mild-day placeholder it shipped with. Calendar events
// remain empty per-day because `useCalendarEvents` is single-date and a
// 7-day fan-out would issue 7 extra queries per generate; wiring a range
// query is deferred to keep this PR focused on the worst regression
// (weather affecting every recommendation). Recently-worn garment IDs
// come from a dedicated id-only Supabase query (id + last_worn_at
// indexed) and are passed to the engine as `exclude_garment_ids` to bias
// against repetition across the week. The query is independent of the
// paginated `useFlatGarments` cache so we never under-count repeats just
// because a wardrobe page hasn't loaded.
//
// Subscription gating: a 402 / `subscription_required` from any single
// day short-circuits the loop and surfaces the same sentinel error
// `useGenerateOutfit` raises so the screen can route to the paywall.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
  SUBSCRIPTION_SENTINEL,
} from '../lib/edgeFunctionClient';
import { supabase } from '../lib/supabase';
import {
  buildDayIntelligence,
  type DayEventInput,
  type DayWeatherInput,
} from '../lib/dayIntelligence';
import { localISODate } from '../lib/outfitDisplay';
import { Sentry } from '../lib/sentry';
import { validateOutfitItems } from '../lib/outfitRules';
import type { ScoredOutfitDraft } from './useOutfitPool';
import { awaitFreshWeather, useWeather, type WeatherData } from './useWeather';

const RECENTLY_WORN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Fallback weather used while `useWeather` is loading or has errored. Matches
// `useGenerateOutfit` and `useOutfitPool` so the engine's `normalizeWeather`
// reads the same baseline shape across every mobile entry-point.
// `precipitation: 'unknown'` would otherwise trip the engine's wet-weather
// branch (treats unknown as "potentially raining" → biases toward waterproof
// outerwear and away from suede), silently skewing the whole week.
const FALLBACK_WEATHER: DayWeatherInput = {
  temperature: 18,
  precipitation: 'none',
  wind: 'none',
};

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
  /** Per-row pending state — populated while `regenerateDay` is in flight
   *  for a specific date. WeekPlanPreview reads this to gate row presses
   *  (so the user can't fire two regenerations in parallel for the same
   *  day) and to render a row-local spinner. */
  regeneratingDates: Set<string>;
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
  occasion?: string | null;
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
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  // Pre-warm the React Query weather cache by mounting the subscription
  // here. The actual weather value is read by `awaitFreshWeather` inside
  // `generateWeek` / `regenerateDay`, not via this hook's return value —
  // mounting `useWeather()` at hook level kicks the Open-Meteo fetch at
  // screen mount instead of waiting for the user to tap Generate. By the
  // time generation runs, the cache is typically warm. We resolve weather
  // ONCE at the top of `generateWeek` and reuse that snapshot across all
  // 7 sequential calls (matches the intent that "this week's" outfits are
  // generated from one moment in time, not a 7-day forecast slice). The
  // closure-frozen `liveWeather` value would otherwise stay null for the
  // whole loop on cold mount because React state updates don't propagate
  // into an in-flight async closure. (Codex P2 round 2 on PR #775.)
  useWeather();

  // Dedicated id-only query for recently-worn garments. Independent of the
  // paginated wardrobe cache so the exclude set is complete even when the
  // wardrobe pager hasn't loaded every page. id-only payload + indexed
  // `last_worn_at` filter keeps this cheap; cached for an hour because a
  // freshly worn garment doesn't need to land in the bias set within the
  // same minute.
  const recentlyWornCutoffIso = new Date(Date.now() - RECENTLY_WORN_WINDOW_MS).toISOString();
  const recentlyWornQ = useQuery({
    queryKey: ['recentlyWornGarmentIds', user?.id, recentlyWornCutoffIso.slice(0, 10)],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return new Set<string>();
      const { data, error: qErr } = await supabase
        .from('garments')
        .select('id')
        .eq('user_id', user.id)
        .gt('last_worn_at', recentlyWornCutoffIso);
      if (qErr) throw qErr;
      return new Set((data ?? []).map((r) => r.id));
    },
    staleTime: 60 * 60 * 1000,
  });

  const [entries, setEntries] = useState<WeekGeneratorEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingDates, setRegeneratingDates] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  // Per-date AbortController map for `regenerateDay` so a day-swap can be
  // cancelled on unmount without nuking concurrent or full-week traffic. We
  // also abort any in-flight controller for the same date before starting a
  // fresh regeneration so a rapid double-tap doesn't leak two requests.
  const regenAbortMapRef = useRef<Map<string, AbortController>>(new Map());
  // Snapshot the last-generation params so `regenerateDay` can re-run a
  // single slot with the same locale the original batch saw. (We DO NOT
  // snapshot recently-worn ids here — those are re-derived from the live
  // React Query result at regeneration time so a freshly worn garment
  // doesn't get re-suggested.)
  const lastParamsRef = useRef<{ locale: string } | null>(null);

  const callOneDay = useCallback(
    async ({
      date,
      locale,
      recentlyWornIds,
      weather,
      signal,
    }: {
      date: string;
      locale: string;
      recentlyWornIds: string[];
      /** Resolved weather snapshot, captured ONCE at the top of the calling
       *  loop so all 7 days share the same context. Null when the upstream
       *  `awaitFreshWeather` resolved to null (cold cache + slow network) —
       *  caller has already substituted `FALLBACK_WEATHER` in that case. */
      weather: DayWeatherInput;
      signal: AbortSignal;
    }): Promise<WeekGeneratorEntry> => {
      // Build per-day context. Calendar events stay empty until a date-range
      // calendar query lands (single-date `useCalendarEvents` × 7 days is
      // not worth the extra queries here); weather is the resolved snapshot
      // passed in from `generateWeek` / `regenerateDay`.
      const events: DayEventInput[] = [];
      const effectiveWeather: DayWeatherInput = weather;
      const intelligence = buildDayIntelligence(events, effectiveWeather);

      try {
        const data = await callEdgeFunction<EngineResponse>('burs_style_engine', {
          body: {
            mode: 'generate',
            generator_mode: 'standard',
            occasion: intelligence.dominant_occasion,
            style: null,
            // Engine reads `body.weather` as a flat WeatherInput sibling
            // of `body.day_context` (see supabase/functions/burs_style_engine
            // index.ts:806 + _shared/outfit-scoring.ts:74-78).
            weather: effectiveWeather,
            locale,
            // Engine destructures `body.day_context` as a flat
            // DayContextInput (`dominant_occasion`, `anchor_event`,
            // `emphasis`, etc. directly on the object — see
            // _shared/outfit-scoring.ts:80-99 + index.ts:797). Pass the
            // `intelligence` object directly, NOT wrapped in `{ date,
            // intelligence, weather }` (which would silently strand
            // every field under an unread key).
            day_context: intelligence,
            // Bias the engine away from already-worn garments to reduce
            // week-over-week repetition. Soft hint, not a hard exclude —
            // mirrors web's web reference.
            exclude_garment_ids: recentlyWornIds,
          },
          signal,
        });

        if (!data) {
          // 2xx with unparseable JSON body — surface as a per-day error
          // rather than silently returning a "no_items" empty outfit
          // (which the screen treats as a successful but empty day).
          return { date, outfit: null, error: 'invalid_response' };
        }
        if (data.error) {
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
            // Prefer the engine's overridden occasion when it returns one
            // (e.g. style-chat normalised the request and the engine landed
            // on a different bucket). Fall back to the day-context dominant
            // occasion the request was kicked with.
            occasion: data?.occasion ?? intelligence.dominant_occasion ?? undefined,
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

      // Recently-worn = last 7 days. Pulled from the dedicated id-only
      // query (above) — independent of the wardrobe pager so we don't
      // miss garments on later pages.
      const recentlyWornIds = Array.from(recentlyWornQ.data ?? []);

      lastParamsRef.current = { locale };

      setIsGenerating(true);
      setError(null);
      // Pre-seed the entries array so the screen can render a 7-row
      // skeleton with stable date labels while the loop fills them in.
      setEntries(
        isos.map((date) => ({ date, outfit: null, error: null })),
      );

      try {
        // Resolve weather ONCE before the loop and reuse the snapshot across
        // all 7 days. Reading `liveWeather` per-day inside the loop closure
        // would freeze at whatever value React state held when `generateWeek`
        // was kicked (closures don't see future state updates), which is null
        // on cold mount → all 7 days would silently fall back to the mild-day
        // placeholder even if `useWeather` resolved mid-loop.
        // `awaitFreshWeather` joins the in-flight fetch when one's running
        // and races a 1.5 s timeout so a slow / captive / offline network
        // can't strand the whole week. (Codex P2 round 2 on PR #775.)
        const weatherForWeek: WeatherData | null = await awaitFreshWeather(queryClient);
        if (controller.signal.aborted) return;
        const effectiveWeather: DayWeatherInput = weatherForWeek
          ? {
              temperature: weatherForWeek.temperature,
              precipitation: weatherForWeek.precipitation,
              wind: weatherForWeek.wind,
            }
          : FALLBACK_WEATHER;

        for (const date of isos) {
          if (controller.signal.aborted) return;
          try {
            const entry = await callOneDay({
              date,
              locale,
              recentlyWornIds,
              weather: effectiveWeather,
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
    [session?.access_token, recentlyWornQ.data, callOneDay, queryClient],
  );

  const regenerateDay = useCallback(
    async (date: string) => {
      if (!session?.access_token) return;
      const params = lastParamsRef.current;
      if (!params) return; // no prior batch — caller should call generateWeek first

      // Per-day regeneration uses its own controller so it doesn't fight a
      // backgrounded full-week run for the abort signal. We track each
      // controller in a per-date map so unmount cleanup can abort all
      // in-flight regenerations and a rapid double-tap on the same row
      // cancels the prior request before kicking the next.
      const existing = regenAbortMapRef.current.get(date);
      if (existing) {
        existing.abort();
      }
      const controller = new AbortController();
      regenAbortMapRef.current.set(date, controller);

      // Snapshot the existing entry so we can restore it if the row falls
      // back to a subscription-locked state (otherwise the row would be
      // stuck blank with no outfit and no error after the redirect).
      let previousEntry: WeekGeneratorEntry | null = null;
      setEntries((prev) => {
        const found = prev.find((e) => e.date === date);
        if (found) previousEntry = found;
        return prev.map((e) => (e.date === date ? { date, outfit: null, error: null } : e));
      });

      // Mark this row as in-flight so WeekPlanPreview can gate the press +
      // render a per-row spinner. Cleared in `finally` regardless of
      // success / abort / failure.
      setRegeneratingDates((prev) => {
        const next = new Set(prev);
        next.add(date);
        return next;
      });

      // Re-derive `recentlyWornIds` at regeneration time so a garment the
      // user just wore lands in the bias set on the next swap (the
      // snapshot from `generateWeek` would otherwise stay frozen for the
      // session).
      const recentlyWornIds = Array.from(recentlyWornQ.data ?? []);

      try {
        // Resolve weather for this single-day regeneration. Same rationale
        // as `generateWeek` — the closure can't see post-mount `useWeather`
        // resolutions, and `awaitFreshWeather` returns the cached value when
        // warm or races the in-flight fetch against a 1.5 s timeout.
        const weatherForCall: WeatherData | null = await awaitFreshWeather(queryClient);
        if (controller.signal.aborted) return;
        const effectiveWeather: DayWeatherInput = weatherForCall
          ? {
              temperature: weatherForCall.temperature,
              precipitation: weatherForCall.precipitation,
              wind: weatherForCall.wind,
            }
          : FALLBACK_WEATHER;

        const entry = await callOneDay({
          date,
          locale: params.locale,
          recentlyWornIds,
          weather: effectiveWeather,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setEntries((prev) => prev.map((e) => (e.date === date ? entry : e)));
      } catch (err) {
        if (err instanceof EdgeFunctionSubscriptionLockedError) {
          setError(SUBSCRIPTION_SENTINEL);
          // Restore the previous entry's outfit (or surface a
          // subscription_required sentinel on the row if there was
          // nothing prior) so the row isn't stuck blank between the
          // redirect-effect and the modal mount.
          setEntries((prev) =>
            prev.map((e) => {
              if (e.date !== date) return e;
              if (previousEntry) return previousEntry;
              return { date, outfit: null, error: SUBSCRIPTION_SENTINEL };
            }),
          );
          return;
        }
        const message = err instanceof Error ? err.message : 'Generation failed';
        setEntries((prev) =>
          prev.map((e) => (e.date === date ? { date, outfit: null, error: message } : e)),
        );
      } finally {
        // Drop the controller from the map only if we still own this slot
        // (a follow-up regeneration may have replaced it).
        if (regenAbortMapRef.current.get(date) === controller) {
          regenAbortMapRef.current.delete(date);
        }
        setRegeneratingDates((prev) => {
          if (!prev.has(date)) return prev;
          const next = new Set(prev);
          next.delete(date);
          return next;
        });
      }
    },
    [session?.access_token, recentlyWornQ.data, callOneDay, queryClient],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    for (const controller of regenAbortMapRef.current.values()) {
      controller.abort();
    }
    regenAbortMapRef.current.clear();
    lastParamsRef.current = null;
    setEntries([]);
    setError(null);
    setIsGenerating(false);
    setRegeneratingDates(new Set());
  }, []);

  useEffect(() => {
    const regenMap = regenAbortMapRef.current;
    return () => {
      abortRef.current?.abort();
      for (const controller of regenMap.values()) {
        controller.abort();
      }
      regenMap.clear();
    };
  }, []);

  const completed = entries.filter((e) => e.outfit !== null).length;

  return {
    entries,
    isGenerating,
    completed,
    error,
    regeneratingDates,
    generateWeek,
    regenerateDay,
    reset,
  };
}
