// Open-Meteo WMO weather-code helpers (N14/F2).
//
// Extracted from `mobile/src/hooks/useWeather.ts` + `mobile/src/hooks/useForecast.ts`
// — the two M35 hooks were carrying byte-identical copies of `getConditionFromCode`
// (and `useWeather` additionally carried `getPrecipitationFromCode` /
// `getWindCategory`). Centralised here so future precipitation-bucket or
// wind-tier tweaks land in one place.
//
// Pure functions — no React, no I/O, safe to import from any consumer.

/** Map an Open-Meteo WMO weather code to a `weather.condition.*` i18n key.
 *  Ranges mirror Open-Meteo docs (https://open-meteo.com/en/docs):
 *  0 = clear; 1-3 = cloudy; 45/48 = fog; 51-57 = drizzle; 61-67 = rain;
 *  71-77 = snow; 80-82 = rain showers; 85-86 = snow showers; 95-99 = thunder.
 *  Anything outside those ranges falls through to `weather.condition.unknown`. */
export function getConditionFromCode(code: number): string {
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

/** Bucket precipitation type for `dayIntelligence.normalizeText` matching.
 *  Snow ranges include 71-77 + 85-86 (showers). Rain covers drizzle (51-57),
 *  rain (61-67), rain showers (80-82), and thunder (95-99 — Open-Meteo treats
 *  thunder as a precipitation event). Everything else returns `'none'`. */
export function getPrecipitationFromCode(code: number): 'none' | 'rain' | 'snow' {
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 80 && code <= 82) return 'rain';
  if (code >= 95 && code <= 99) return 'rain';
  return 'none';
}

/** Wind-speed tier in km/h: `<15` low, `<30` medium, otherwise high. */
export function getWindCategory(windSpeed: number): 'low' | 'medium' | 'high' {
  if (windSpeed < 15) return 'low';
  if (windSpeed < 30) return 'medium';
  return 'high';
}
