// useWeatherAndContext — weather fetch + recently-worn query + day-context
// builder, extracted from useWeekGenerator. Reusable across other
// day-aware features (per Phase 2 design).

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { DayWeatherInput } from '../lib/dayIntelligence';
import { awaitFreshWeather, useWeather, type WeatherData } from './useWeather';
import { CACHE_KEYS } from './cacheKeys';

const RECENTLY_WORN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Fallback weather used while `useWeather` is loading or has errored.
// Matches `useGenerateOutfit` and `useOutfitPool` so the engine's
// `normalizeWeather` reads the same baseline shape across every mobile
// entry-point. `precipitation: 'unknown'` would otherwise trip the
// engine's wet-weather branch (treats unknown as "potentially raining"
// → biases toward waterproof outerwear and away from suede), silently
// skewing the whole week.
export const FALLBACK_WEATHER: DayWeatherInput = {
  temperature: 18,
  precipitation: 'none',
  wind: 'none',
};

function toDayWeather(weather: WeatherData | null): DayWeatherInput {
  if (!weather) return FALLBACK_WEATHER;
  return {
    temperature: weather.temperature,
    precipitation: weather.precipitation,
    wind: weather.wind,
  };
}

export function useWeatherAndContext(): {
  recentlyWornIds: string[];
  resolveWeather: () => Promise<DayWeatherInput>;
} {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useWeather();

  const recentlyWornCutoffIso = new Date(Date.now() - RECENTLY_WORN_WINDOW_MS).toISOString();
  const recentlyWornQ = useQuery({
    queryKey: CACHE_KEYS.recentlyWornGarmentIds(user?.id, recentlyWornCutoffIso.slice(0, 10)),
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

  // Memoize the array so a referential-equality consumer (or a stable
  // ref capture in the orchestrator) doesn't see a fresh array reference
  // every render — `recentlyWornQ.data` is a Set, so Array.from would
  // otherwise allocate per render.
  const recentlyWornIds = useMemo(
    () => Array.from(recentlyWornQ.data ?? []),
    [recentlyWornQ.data],
  );

  const resolveWeather = useCallback(async (): Promise<DayWeatherInput> => {
    const fresh = await awaitFreshWeather(queryClient);
    return toDayWeather(fresh);
  }, [queryClient]);

  return useMemo(
    () => ({ recentlyWornIds, resolveWeather }),
    [recentlyWornIds, resolveWeather],
  );
}
