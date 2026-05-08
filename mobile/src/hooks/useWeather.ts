// Mobile current-weather hook (M35). Wraps the Open-Meteo `forecast` endpoint
// (https://open-meteo.com/en/docs) — free tier, no API key, no rate-limit concerns
// at our launch volume. Same provider the web uses (`src/hooks/useWeather.ts`)
// so the temperature / precipitation classification stays byte-for-byte
// consistent across surfaces.
//
// Location resolution:
//   - When a city name is passed, we resolve it via Nominatim (OpenStreetMap)
//     to lat/lon before hitting Open-Meteo. Cached for 30 min per `staleTime`.
//   - When no city is passed, we default to Stockholm (59.3293, 18.0686). The
//     mobile app does not yet request `expo-location` permission — geolocation
//     is deferred to a later wave; M35's surfaces only need a sane default.
//     Sweden is the launch market so Stockholm is the right baseline.
//
// Cache: `staleTime` is 30 minutes per the M35 wave plan. The hook is shared
// across HomeScreen, the day-intelligence engine override, and PlanScreen so
// React Query's de-dupe keeps us at one fetch per 30-min window per active
// city.

import { useQuery, type QueryClient } from '@tanstack/react-query';

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
  const cached = queryClient.getQueryData<WeatherData>(weatherQueryKey(city));
  if (cached) return cached;
  const fetchPromise = queryClient
    .ensureQueryData({
      queryKey: weatherQueryKey(city),
      queryFn: () => fetchWeather(city),
      staleTime: STALE_MS,
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

export async function fetchWeather(city: string | null | undefined): Promise<WeatherData> {
  let coords: { lat: number; lon: number } = DEFAULT_COORDS;
  if (city) {
    const resolved = await getCoordinatesFromCity(city);
    if (resolved) coords = resolved;
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

export function useWeather(options?: UseWeatherOptions) {
  const city = options?.city ?? null;
  const enabled = options?.enabled !== false;

  const query = useQuery({
    queryKey: weatherQueryKey(city),
    queryFn: () => fetchWeather(city),
    enabled,
    staleTime: STALE_MS,
    gcTime: STALE_MS * 2,
    retry: 2,
  });

  return {
    weather: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  };
}
