// Mobile current-weather hook (M35 + G5). Wraps the Open-Meteo `forecast`
// endpoint (https://open-meteo.com/en/docs) — free tier, no API key, no
// rate-limit concerns at our launch volume. Same provider the web uses
// (`src/hooks/useWeather.ts`) so the temperature / precipitation
// classification stays byte-for-byte consistent across surfaces.
//
// Location resolution (G5 — auto-weather via `expo-location`):
//   - When a city name is passed, we resolve it via Nominatim (OpenStreetMap)
//     to lat/lon before hitting Open-Meteo. Cached for 30 min per `staleTime`.
//   - When no city is passed, we ask `expo-location` for foreground
//     permission. On grant, `getCurrentPositionAsync` returns the device
//     coordinates; we use those directly (no reverse-geocode required for
//     the engine payload — temperature + condition are what matter). On
//     deny / error / iOS Simulator with no fallback fix, we fall back to
//     the existing Stockholm coordinates so the engine still gets a sane
//     `weather` payload.
//   - Manual override (G5 adjust UI): `useWeather().setManual({ tempC,
//     precipitation, ... })` writes a synthetic WeatherData row directly
//     into the React Query cache so `awaitFreshWeather` and every other
//     subscriber pick it up without a network roundtrip. The override
//     stays sticky for the screen's lifetime — `setManual(null)` clears it.
//
// Cache: `staleTime` is 30 minutes per the M35 wave plan. The hook is shared
// across HomeScreen, the day-intelligence engine override, and PlanScreen so
// React Query's de-dupe keeps us at one fetch per 30-min window per active
// city.

import { useCallback } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';

export interface WeatherData {
  /** Whole-degree Celsius reading rounded from Open-Meteo's hourly value. */
  temperature: number;
  /** Free-form bucket consumed by `dayIntelligence.normalizeText` matching. */
  precipitation: 'none' | 'rain' | 'snow';
  /** Wind tier — `low` < 15 km/h, `medium` < 30 km/h, `high` otherwise. */
  wind: 'low' | 'medium' | 'high';
  /** i18n key for the human-readable condition (e.g. `weather.condition.rain`). */
  condition: string;
  /** Raw Open-Meteo WMO weather code, exposed for icon mapping in components. */
  weather_code: number;
  /** True when Open-Meteo reports daylight at the observation timestamp. */
  is_day: boolean;
}

export interface UseWeatherOptions {
  /** Optional city name override. When omitted, defaults to Stockholm. */
  city?: string | null;
  /** Disable the query (useful when the consumer hasn't decided on a city yet). */
  enabled?: boolean;
}

const DEFAULT_COORDS = { lat: 59.3293, lon: 18.0686 } as const;
const STALE_MS = 30 * 60 * 1000;
export const WEATHER_QUERY_STALE_MS = STALE_MS;

/** Stable query key for the weather fetch. Exported so generator hooks can
 *  call `queryClient.ensureQueryData(...)` against the SAME cache entry the
 *  `useWeather` hook subscribes to — guaranteeing a single in-flight fetch
 *  when the hook is mounted in a sibling screen and the generator is kicked
 *  before that fetch resolves. (Codex P2 round 1 on PR #775.) */
export function weatherQueryKey(city: string | null | undefined) {
  return ['weather', city ?? null] as const;
}

/** Maximum time `awaitFreshWeather` will wait for a cold-cache fetch before
 *  resolving to `null` so the caller can fall back to a placeholder. Open-
 *  Meteo typically responds in 200–500 ms; 1500 ms gives flaky / captive
 *  networks two retry windows before we surrender. Weather is contextual
 *  for outfit generation — blocking the engine call indefinitely on a
 *  slow weather request would leave the user staring at a spinner.
 *  (Codex P2 round 2 on PR #775.) */
export const WEATHER_AWAIT_TIMEOUT_MS = 1500;

/** Resolve weather for a generator that's about to fire. Returns the
 *  cached value when warm, otherwise races the in-flight fetch (kicking
 *  one when nothing's running) against `timeoutMs`. Resolves to `null` on
 *  timeout or fetch error so the caller can fall back to a placeholder
 *  weather payload — never throws. The fetch itself keeps running on
 *  timeout (it'll populate the cache for a follow-up generate), so this
 *  is a soft deadline, not a cancellation. */
export async function awaitFreshWeather(
  queryClient: QueryClient,
  city: string | null = null,
  timeoutMs: number = WEATHER_AWAIT_TIMEOUT_MS,
): Promise<WeatherData | null> {
  // Honor staleTime — React Query keeps stale entries in the cache until an
  // unrelated refetch trigger fires, so a screen left open >30 min would
  // otherwise feed outdated rain/temperature into Generate / Pool. When the
  // cached entry is fresh (`dataUpdatedAt` within `STALE_MS`), return it
  // immediately. When stale, force a real refetch via `fetchQuery` —
  // `ensureQueryData` would short-circuit and return the stale cached value
  // because the entry exists, defeating the staleness check.
  // (Codex P2 round 3 on PR #775.)
  const queryKey = weatherQueryKey(city);
  const cached = queryClient.getQueryData<WeatherData>(queryKey);
  if (cached) {
    const state = queryClient.getQueryState<WeatherData>(queryKey);
    const dataUpdatedAt = state?.dataUpdatedAt ?? 0;
    if (dataUpdatedAt > 0 && Date.now() - dataUpdatedAt < STALE_MS) {
      return cached;
    }
  }
  // `fetchQuery` invokes `queryFn` whenever the entry is stale relative to
  // its `staleTime` arg. We pass `staleTime: 0` because we've already gated
  // on freshness above — at this point the cache is either absent or stale,
  // and we explicitly want a network refetch in both cases. The result is
  // written back into the same cache entry `useWeather` subscribes to, so a
  // slow refresh still propagates to active subscribers when it lands.
  const fetchPromise = queryClient
    .fetchQuery({
      queryKey,
      queryFn: () => fetchWeather(city),
      staleTime: 0,
    })
    .catch((): WeatherData | null => null);
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutHandle = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race<WeatherData | null>([fetchPromise, timeoutPromise]);
  } finally {
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
  }
}

function getConditionFromCode(code: number): string {
  if (code === 0) return 'weather.condition.clear';
  if (code <= 3) return 'weather.condition.cloudy';
  if (code === 45 || code === 48) return 'weather.condition.fog';
  if (code >= 51 && code <= 57) return 'weather.condition.drizzle';
  if (code >= 61 && code <= 67) return 'weather.condition.rain';
  if (code >= 71 && code <= 77) return 'weather.condition.snow';
  if (code >= 80 && code <= 82) return 'weather.condition.rain_showers';
  if (code >= 85 && code <= 86) return 'weather.condition.snow_showers';
  if (code >= 95 && code <= 99) return 'weather.condition.thunder';
  return 'weather.condition.unknown';
}

function getPrecipitationFromCode(code: number): 'none' | 'rain' | 'snow' {
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 80 && code <= 82) return 'rain';
  if (code >= 95 && code <= 99) return 'rain';
  return 'none';
}

function getWindCategory(windSpeed: number): 'low' | 'medium' | 'high' {
  if (windSpeed < 15) return 'low';
  if (windSpeed < 30) return 'medium';
  return 'high';
}

/** Resolve `city` → lat/lon via Nominatim. Returns null when the lookup fails
 *  so the caller can fall back to the default coords without a thrown error. */
export async function getCoordinatesFromCity(
  city: string,
): Promise<{ lat: number; lon: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { lat: string; lon: string }[];
    const first = data[0];
    if (!first) return null;
    const lat = parseFloat(first.lat);
    const lon = parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

/** Resolve the device's current position via `expo-location`. Returns null
 *  on permission denial, missing services, or any platform error so the
 *  caller can fall back to the existing Stockholm default. The fallback
 *  happens INSIDE `fetchWeather` so the React Query cache key (which is
 *  scoped on the optional `city` arg) stays stable — a denied permission
 *  shouldn't churn the cache identity. (G5.) */
async function getCurrentDeviceCoords(): Promise<{ lat: number; lon: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const position = await Location.getCurrentPositionAsync({
      // Same accuracy bucket the web uses (`enableHighAccuracy: false`) —
      // city-level resolution is enough for outfit weather, and the lower
      // accuracy mode ships a fix faster on a cold GPS.
      accuracy: Location.Accuracy.Lowest,
    });
    const { latitude, longitude } = position.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { lat: latitude, lon: longitude };
  } catch {
    return null;
  }
}

export async function fetchWeather(city: string | null | undefined): Promise<WeatherData> {
  let coords: { lat: number; lon: number } = DEFAULT_COORDS;
  if (city) {
    const resolved = await getCoordinatesFromCity(city);
    if (resolved) coords = resolved;
  } else {
    // Auto mode (G5) — try the device's current position. On any failure
    // (permission denied, services off, simulator with no fix) we fall
    // through to `DEFAULT_COORDS` so the engine still receives weather.
    const auto = await getCurrentDeviceCoords();
    if (auto) coords = auto;
  }

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,weather_code,wind_speed_10m,is_day&timezone=auto`,
  );
  if (!response.ok) throw new Error(`Weather request failed (${response.status})`);

  const data = (await response.json()) as {
    current?: {
      temperature_2m?: number;
      weather_code?: number;
      wind_speed_10m?: number;
      is_day?: number;
    };
  };
  const current = data.current ?? {};
  const code = current.weather_code ?? 0;

  return {
    temperature: Math.round(current.temperature_2m ?? 0),
    precipitation: getPrecipitationFromCode(code),
    wind: getWindCategory(current.wind_speed_10m ?? 0),
    condition: getConditionFromCode(code),
    weather_code: code,
    is_day: current.is_day === 1,
  };
}

/** Subset of `WeatherData` accepted by `setManual` — the rest of the row
 *  (`weather_code`, `is_day`, `wind`) is filled with neutral defaults so the
 *  engine doesn't trip on a partial payload. The four manual-adjust UI
 *  conditions map onto Open-Meteo `weather_code` values via {@link
 *  conditionToWeatherCode} so `getPrecipitationFromCode` /
 *  `getConditionFromCode` keep returning consistent values when the
 *  override is in effect. (G5.) */
export type ManualWeatherInput = {
  /** Temperature in degrees Celsius, integer or float. */
  tempC: number;
  /** One of the four condition buckets the StyleMe Adjust sheet exposes. */
  condition: 'clear' | 'cloudy' | 'rain' | 'snow';
};

function conditionToWeatherCode(condition: ManualWeatherInput['condition']): number {
  switch (condition) {
    case 'clear':
      return 0;
    case 'cloudy':
      return 3;
    case 'rain':
      return 63;
    case 'snow':
      return 73;
  }
}

/** Build a synthetic `WeatherData` row from a manual adjust payload. Exposed
 *  for tests + the `setManual` writer below. */
export function manualWeatherToData(input: ManualWeatherInput): WeatherData {
  const code = conditionToWeatherCode(input.condition);
  return {
    temperature: Math.round(input.tempC),
    precipitation: getPrecipitationFromCode(code),
    wind: 'low',
    condition: getConditionFromCode(code),
    weather_code: code,
    is_day: true,
  };
}

export function useWeather(options?: UseWeatherOptions) {
  const city = options?.city ?? null;
  const enabled = options?.enabled !== false;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: weatherQueryKey(city),
    queryFn: () => fetchWeather(city),
    enabled,
    staleTime: STALE_MS,
    gcTime: STALE_MS * 2,
    retry: 2,
  });

  /** Manual override writer (G5 adjust UI). Writes the synthesised row into
   *  the SAME React Query entry the hook subscribes to so every consumer of
   *  `useWeather()` and every `awaitFreshWeather()` reader sees the override
   *  immediately. The override is sticky — `setManual({ tempC, condition })`
   *  replaces whatever's cached and `awaitFreshWeather` will return it
   *  (within `staleTime`) instead of triggering a network refetch. */
  const setManual = useCallback(
    (input: ManualWeatherInput | null) => {
      const key = weatherQueryKey(city);
      if (input === null) {
        // Clear override: invalidate so the next read kicks a real fetch.
        queryClient.invalidateQueries({ queryKey: key });
        return;
      }
      const next = manualWeatherToData(input);
      queryClient.setQueryData<WeatherData>(key, next);
    },
    [queryClient, city],
  );

  return {
    weather: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    setManual,
  };
}
