// Mobile-adapted port of `src/hooks/useSmartDayRecommendation.ts` (web).
// Composes `buildDayIntelligence` (occasion + weather classifier) with
// `buildSuggestions` (outfit scorer) and exposes the top-ranked outfits +
// the day context for `SmartDayBanner` on HomeScreen.
//
// Mobile defers two upstream data sources:
//   - Weather hook lands in M35 — until then we fall back to a mild
//     placeholder (`{ temp: 18, condition: 'unknown' }`) so the engine
//     produces a sane output instead of refusing to score. Callers can
//     override via `overrides.weather` once a real source is wired.
//   - Calendar events land in M36 — until then the events array is empty,
//     which `buildDayIntelligence` handles cleanly (`dominant_occasion`
//     defaults to `'casual'`, formality to 3, transition complexity to
//     `'low'`).
//
// Recently-worn garment IDs are derived from the user's flat garment list
// via `last_worn_at` ≥ 7 days ago — this set drives the novelty axis in the
// outfit scorer so the banner doesn't recommend the same look every day.

import { useMemo } from 'react';

import { useFlatGarments } from './useGarments';
import { useOutfits } from './useOutfits';
import { useCalendarEvents } from './useCalendarSync';
import { localISODate } from '../lib/outfitDisplay';
import {
  buildDayIntelligence,
  type DayContext,
  type DayEventInput,
  type DayWeatherInput,
} from '../lib/dayIntelligence';
import { buildSuggestions, type ScoredOutfit } from '../lib/buildTodaySuggestions';

const RECENTLY_WORN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Placeholder weather payload used until M35 wires a real provider. Mild
 *  18°C, no precipitation — `buildDayIntelligence` reads `precipitation` as
 *  free-form text so `'unknown'` simply doesn't match any rain/snow rule. */
const FALLBACK_WEATHER: DayWeatherInput = {
  temperature: 18,
  precipitation: 'unknown',
};

export interface UseSmartDayRecommendationOverrides {
  /** Override the placeholder weather. M35 will pass real data here. */
  weather?: DayWeatherInput | null;
  /** Override the empty event list. M36 will pass calendar events here. */
  events?: DayEventInput[];
}

export interface UseSmartDayRecommendationResult {
  context: DayContext | null;
  /** Highest-scoring outfit (the banner hero pick). `null` when the user has
   *  no saved outfits yet — the consumer must self-hide in that case. */
  top1: ScoredOutfit | null;
  /** Top 3 outfits ranked by `buildSuggestions`. Empty when the user has no
   *  saved outfits yet (banner consumer hides itself in that case). */
  top3: ScoredOutfit[];
  isLoading: boolean;
  error: Error | null;
}

export function useSmartDayRecommendation(
  overrides?: UseSmartDayRecommendationOverrides,
): UseSmartDayRecommendationResult {
  // savedOnly=false so generated-but-unsaved looks are still candidate
  // recommendations — without this the banner would only ever surface
  // already-curated outfits, which defeats the "today's pick" promise.
  const outfitsQ = useOutfits(false);
  const garmentsQ = useFlatGarments();

  const overrideEvents = overrides?.events;
  const overrideWeather = overrides?.weather;

  // M36 — fall back to today's synced calendar events when no override is
  // passed AND when the override is an empty array (the M35 OccasionPicker's
  // "Casual" pill emits `[]` to mean "no synthetic event"). The calendar
  // events query stays harmless when the user hasn't connected — it returns
  // `[]` and the engine falls back to its casual baseline same as before.
  const todayDate = useMemo(() => localISODate(new Date()), []);
  const calendarEventsQ = useCalendarEvents(todayDate);

  const events = useMemo<DayEventInput[]>(() => {
    if (overrideEvents && overrideEvents.length > 0) return overrideEvents;
    return (calendarEventsQ.data ?? []).map((e) => ({
      title: e.title,
      location: e.location,
      start_time: e.start_time,
      end_time: e.end_time,
    }));
  }, [overrideEvents, calendarEventsQ.data]);
  const weather = useMemo<DayWeatherInput | null>(
    () => (overrideWeather === undefined ? FALLBACK_WEATHER : overrideWeather),
    [overrideWeather],
  );

  const intelligence = useMemo(
    () => buildDayIntelligence(events, weather),
    [events, weather],
  );

  const recentlyWornGarmentIds = useMemo(() => {
    const cutoffMs = Date.now() - RECENTLY_WORN_WINDOW_MS;
    const ids = new Set<string>();
    for (const g of garmentsQ.data ?? []) {
      const lastWorn = g.last_worn_at ? new Date(g.last_worn_at).getTime() : NaN;
      if (Number.isFinite(lastWorn) && lastWorn >= cutoffMs) ids.add(g.id);
    }
    return ids;
  }, [garmentsQ.data]);

  const context = useMemo<DayContext | null>(() => {
    if (!intelligence) return null;
    return {
      intelligence,
      weather: weather ?? null,
      recentlyWornGarmentIds,
    };
  }, [intelligence, weather, recentlyWornGarmentIds]);

  const top3 = useMemo<ScoredOutfit[]>(() => {
    if (!context) return [];
    const outfits = outfitsQ.data ?? [];
    if (outfits.length === 0) return [];
    const scored = buildSuggestions(context, outfits);
    return scored.slice(0, 3);
  }, [context, outfitsQ.data]);

  return {
    context,
    top1: top3[0] ?? null,
    top3,
    isLoading: outfitsQ.isLoading || garmentsQ.isLoading,
    error: (outfitsQ.error as Error | null) ?? (garmentsQ.error as Error | null) ?? null,
  };
}
