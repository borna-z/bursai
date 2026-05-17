// Calls the deployed `summarize_day` edge function for the natural-language
// day summary line shown by the SmartDayBanner ("Crisp morning, easy
// evening — go layered."). Cached per calendar-day key so the AI call only
// fires once per day per user.
//
// The edge function expects `{ events, weather }` (per
// `supabase/functions/summarize_day/index.ts`) and returns a payload
// shaped `{ summary, priorities, outfit_hints, transitions, intelligence }`.
// The hook passes events through verbatim so M36 can drop a real calendar
// hook in without touching this file; weather defaults to null when not
// provided. When `events.length === 0` the function returns an empty
// envelope (`summary: null`) — we still call it once so the cache primes.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { callEdgeFunction } from '../lib/edgeFunctionClient';
import { getLocale } from '../lib/i18n';
import { localISODate } from '../lib/outfitDisplay';
import type { DayEventInput, DayWeatherInput } from '../lib/dayIntelligence';
import { CACHE_KEYS } from './cacheKeys';

interface SummarizeDayResponse {
  summary: string | null;
  priorities?: unknown[];
  outfit_hints?: unknown[];
  transitions?: unknown;
  intelligence?: unknown;
}

export interface UseDaySummaryArgs {
  events?: DayEventInput[];
  weather?: DayWeatherInput | null;
}

export interface UseDaySummaryResult {
  summaryText: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useDaySummary(args?: UseDaySummaryArgs): UseDaySummaryResult {
  const { user } = useAuth();
  const argsEvents = args?.events;
  const argsWeather = args?.weather;

  // Stabilise optional inputs so the queryKey hash is fed stable references,
  // matching the pattern in `useSmartDayRecommendation`. The events/weather
  // hashes already absorb identity churn via stringification, so this is
  // style-consistency rather than a correctness fix — but worth doing.
  const events = useMemo<DayEventInput[]>(() => argsEvents ?? [], [argsEvents]);
  const weather = useMemo<DayWeatherInput | null>(
    () => argsWeather ?? null,
    [argsWeather],
  );

  // Day-key cache: re-keying on `localISODate(new Date())` means the query
  // re-runs the moment the local calendar date rolls over. The events +
  // weather hash is folded in so a manual override (e.g. M35 weather change)
  // produces a fresh summary instead of serving yesterday's text.
  const dayKey = localISODate(new Date());
  // Events hash participates: title + start_time + end_time. Title alone
  // would collide on identical title sets that were rescheduled (same
  // meetings moved an hour later → cache hit on yesterday's summary). We
  // intentionally leave description/location out — they rarely shift the
  // summary and inflate the key. Slice to 128 chars so the wider key still
  // bounds at a sane size.
  const eventsHash = events.length === 0
    ? 'noevents'
    : events
        .map((e) => `${e.title}@${e.start_time ?? ''}-${e.end_time ?? ''}`)
        .sort()
        .join('|')
        .slice(0, 128);
  // Weather hash: temp + precipitation + wind. Matches the shape
  // `DayWeatherInput` exposes; without `wind` a switch from calm to gusty
  // would silently serve the cached summary.
  const weatherHash = weather
    ? `${weather.temperature ?? '?'}-${weather.precipitation ?? '?'}-${weather.wind ?? '?'}`
    : 'noweather';

  // N16-2: thread device locale through so the edge function returns the
  // summary in the user's language. Folded into the queryKey so flipping
  // device locale invalidates the cached English summary instead of serving
  // stale text.
  const locale = getLocale();

  const query = useQuery<SummarizeDayResponse, Error>({
    queryKey: CACHE_KEYS.daySummary(user?.id, dayKey, locale, eventsHash, weatherHash),
    queryFn: async () => {
      const result = await callEdgeFunction<SummarizeDayResponse>('summarize_day', {
        body: { events, weather, locale },
        // summarize_day is light AI but server-cached for 1h — a single
        // shot per day per user is plenty; retry once for transient
        // network blips, keep the timeout short so the banner isn't
        // blocked on a slow AI tail.
        retries: 1,
        timeoutMs: 30_000,
      });
      return result ?? { summary: null };
    },
    enabled: !!user,
    // Day-level staleness: until the date rolls over we trust the response.
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    // No retries on any error: the banner is advisory and self-hides on a
    // null summary, so rate-limit / paywall / network all collapse to the
    // same advisory-self-hide UX. Typed-error guards would be dead code
    // here.
    retry: false,
  });

  return {
    summaryText: query.data?.summary ?? null,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}
