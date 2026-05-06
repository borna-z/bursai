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

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionRateLimitError,
  EdgeFunctionSubscriptionLockedError,
} from '../lib/edgeFunctionClient';
import { localISODate } from '../lib/outfitDisplay';
import type { DayEventInput, DayWeatherInput } from '../lib/dayIntelligence';

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
  const events = args?.events ?? [];
  const weather = args?.weather ?? null;

  // Day-key cache: re-keying on `localISODate(new Date())` means the query
  // re-runs the moment the local calendar date rolls over. The events +
  // weather hash is folded in so a manual override (e.g. M35 weather change)
  // produces a fresh summary instead of serving yesterday's text.
  const dayKey = localISODate(new Date());
  const eventsHash = events.length === 0 ? 'noevents' : events.map((e) => e.title).sort().join('|').slice(0, 64);
  const weatherHash = weather
    ? `${weather.temperature ?? '?'}-${weather.precipitation ?? '?'}`
    : 'noweather';

  const query = useQuery<SummarizeDayResponse, Error>({
    queryKey: ['daySummary', user?.id, dayKey, eventsHash, weatherHash],
    queryFn: async () => {
      const result = await callEdgeFunction<SummarizeDayResponse>('summarize_day', {
        body: { events, weather },
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
    // 402 (paywall) and 429 (rate limit) are advisory for this surface —
    // the banner hides itself on null summary, so swallow them via retry-0
    // semantics inside the wrapper. We still surface other errors so the
    // consumer can decide whether to log.
    retry: (_failureCount, error) => {
      if (error instanceof EdgeFunctionRateLimitError) return false;
      if (error instanceof EdgeFunctionSubscriptionLockedError) return false;
      return false;
    },
  });

  return {
    summaryText: query.data?.summary ?? null,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}
