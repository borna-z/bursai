// Mobile 5-day forecast hook (M35). Same Open-Meteo provider as `useWeather`
// — daily endpoint with `forecast_days=5`. Used by `WeatherStrip` for the
// 1-line "tomorrow" hint on Home, and reserved for PlanScreen + TravelCapsule
// as those features land. The 5-day window is deliberate: Home only renders
// "tomorrow", PlanScreen only needs the next workweek, and TravelCapsule's
// long-range view will swap to historical climate data (web pattern) when it
// lands — so the 16-day max isn't a constraint we need today.

import { useQuery } from '@tanstack/react-query';

import { getCoordinatesFromCity } from './useWeather';

export interface ForecastDay {
  /** ISO yyyy-mm-dd in the observation's local timezone. */
  date: string;
  temperature_max: number;
  temperature_min: number;
  /** i18n key for the daily condition (mirrors `WeatherData.condition`). */
  condition: string;
  weather_code: number;
  precipitation_probability: number;
}

export interface UseForecastOptions {
  city?: string | null;
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

async function fetchForecast(city: string | null | undefined): Promise<ForecastDay[]> {
  let coords: { lat: number; lon: number } = DEFAULT_COORDS;
  if (city) {
    const resolved = await getCoordinatesFromCity(city);
    if (resolved) coords = resolved;
  }

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=auto&forecast_days=5`,
  );
  if (!response.ok) throw new Error(`Forecast request failed (${response.status})`);

  const data = (await response.json()) as {
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      weather_code?: number[];
      precipitation_probability_max?: number[];
    };
  };
  const daily = data.daily ?? {};
  const times = daily.time ?? [];

  return times.map((date, i) => {
    const code = daily.weather_code?.[i] ?? 0;
    return {
      date,
      temperature_max: Math.round(daily.temperature_2m_max?.[i] ?? 0),
      temperature_min: Math.round(daily.temperature_2m_min?.[i] ?? 0),
      condition: getConditionFromCode(code),
      weather_code: code,
      precipitation_probability: daily.precipitation_probability_max?.[i] ?? 0,
    };
  });
}

export function useForecast(options?: UseForecastOptions) {
  const city = options?.city ?? null;
  const enabled = options?.enabled !== false;

  const query = useQuery({
    queryKey: ['forecast', city],
    queryFn: () => fetchForecast(city),
    enabled,
    staleTime: STALE_MS,
    gcTime: STALE_MS * 2,
    retry: 2,
  });

  return {
    forecast: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  };
}
