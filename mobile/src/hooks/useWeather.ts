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

import { useQuery } from '@tanstack/react-query';

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

async function fetchWeather(city: string | null | undefined): Promise<WeatherData> {
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
    queryKey: ['weather', city],
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
