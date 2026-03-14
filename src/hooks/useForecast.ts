import { useQuery } from '@tanstack/react-query';

export interface ForecastDay {
  date: string; // YYYY-MM-DD
  temperature_max: number;
  temperature_min: number;
  temperature_avg: number;
  weather_code: number;
  condition: string;
  precipitation_probability: number;
  /** true when data comes from historical averages, not a live forecast */
  isHistorical?: boolean;
}

interface UseForecastResult {
  forecast: ForecastDay[];
  isLoading: boolean;
  error: string | null;
  getForecastForDate: (date: string) => ForecastDay | null;
}

interface UseForecastOptions {
  /** Manual city override (highest priority) */
  city?: string | null;
  enabled?: boolean;
  /** Optional date range — triggers historical fetch for dates beyond 16 days */
  startDate?: string;
  endDate?: string;
}

// Map Open-Meteo weather codes to translation keys
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

// Country code → flag emoji
function countryCodeToFlag(code: string): string {
  const upper = code.toUpperCase();
  return String.fromCodePoint(...[...upper].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

export interface CitySuggestion {
  display_name: string;
  short_name: string;
  lat: number;
  lon: number;
  country_code: string;
  flag: string;
}

/** Search for cities via Nominatim — returns up to `limit` results. Throws on network/CSP errors. */
export async function searchCities(query: string, limit = 5): Promise<CitySuggestion[]> {
  if (!query || query.length < 2) return [];
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}&addressdetails=1`
  );
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const data = await response.json();
  interface NominatimResult {
    display_name: string;
    lat: string;
    lon: string;
    name?: string;
    address?: {
      city?: string;
      town?: string;
      village?: string;
      country?: string;
      country_code?: string;
    };
  }
  return data.map((item: NominatimResult) => {
    const city = item.address?.city || item.address?.town || item.address?.village || item.name || query;
    const country = item.address?.country || '';
    const cc = (item.address?.country_code || '').toLowerCase();
    return {
      display_name: item.display_name,
      short_name: country ? `${city}, ${country}` : city,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      country_code: cc,
      flag: cc ? countryCodeToFlag(cc) : '🌍',
    };
  });
}

// Get coordinates from city name using OpenStreetMap Nominatim
export async function getCoordinatesFromCity(city: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data[0]) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

// Fetch 16-day forecast from Open-Meteo
export async function fetchForecast(lat: number, lon: number): Promise<ForecastDay[]> {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=auto&forecast_days=16`
  );

  if (!response.ok) {
    throw new Error('Could not fetch weather forecast');
  }

  const data = await response.json();
  const daily = data.daily;

  const forecast: ForecastDay[] = daily.time.map((date: string, i: number) => ({
    date,
    temperature_max: Math.round(daily.temperature_2m_max[i]),
    temperature_min: Math.round(daily.temperature_2m_min[i]),
    temperature_avg: Math.round((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2),
    weather_code: daily.weather_code[i],
    condition: getConditionFromCode(daily.weather_code[i]),
    precipitation_probability: daily.precipitation_probability_max[i],
    isHistorical: false,
  }));

  return forecast;
}

/**
 * Fetch historical weather for a date range using Open-Meteo Archive API.
 * Uses the same dates from the previous year as a climate proxy.
 * Maps the results back to the requested future dates.
 */
export async function fetchHistoricalWeather(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<ForecastDay[]> {
  // Shift dates to previous year
  const start = new Date(startDate);
  const end = new Date(endDate);
  const histStart = new Date(start);
  histStart.setFullYear(histStart.getFullYear() - 1);
  const histEnd = new Date(end);
  histEnd.setFullYear(histEnd.getFullYear() - 1);

  const histStartStr = histStart.toISOString().split('T')[0];
  const histEndStr = histEnd.toISOString().split('T')[0];

  const response = await fetch(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${histStartStr}&end_date=${histEndStr}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum&timezone=auto`
  );

  if (!response.ok) {
    throw new Error('Could not fetch historical weather');
  }

  const data = await response.json();
  const daily = data.daily;
  if (!daily?.time) return [];

  // Map historical dates back to the requested future dates
  const dayCount = daily.time.length;
  const forecast: ForecastDay[] = [];

  for (let i = 0; i < dayCount; i++) {
    // Calculate the corresponding future date
    const futureDate = new Date(start);
    futureDate.setDate(futureDate.getDate() + i);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const tMax = daily.temperature_2m_max[i];
    const tMin = daily.temperature_2m_min[i];
    const wCode = daily.weather_code[i] ?? 0;
    const precip = daily.precipitation_sum?.[i] ?? 0;

    forecast.push({
      date: futureDateStr,
      temperature_max: Math.round(tMax ?? 0),
      temperature_min: Math.round(tMin ?? 0),
      temperature_avg: Math.round(((tMax ?? 0) + (tMin ?? 0)) / 2),
      weather_code: wCode,
      condition: getConditionFromCode(wCode),
      // Estimate probability from actual precipitation last year
      precipitation_probability: precip > 0 ? Math.min(90, Math.round(precip * 10 + 30)) : 10,
      isHistorical: true,
    });
  }

  return forecast;
}

// Get coordinates — from city, geolocation, or Stockholm fallback
async function getCoordinates(city?: string | null): Promise<{ lat: number; lon: number }> {
  // 1. Manual city — no fallback
  if (city) {
    const coords = await getCoordinatesFromCity(city);
    if (coords) return coords;
  }

  // 2. Auto mode: try browser geolocation
  if (!city && typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        });
      });
      return { lat: position.coords.latitude, lon: position.coords.longitude };
    } catch {
      // Fall through to Stockholm
    }
  }

  // 3. Fallback to Stockholm
  return { lat: 59.3293, lon: 18.0686 };
}

export function useForecast(options: UseForecastOptions = {}): UseForecastResult {
  const city = options.city ?? null;
  const enabled = options.enabled !== false;
  const { startDate, endDate } = options;

  const { data: forecast = [], isLoading, error } = useQuery({
    queryKey: ['forecast', city, startDate, endDate],
    queryFn: async () => {
      try {
        const coords = await getCoordinates(city);
        const liveForecast = await fetchForecast(coords.lat, coords.lon);

        // If no date range requested, return just the 16-day forecast
        if (!startDate || !endDate) return liveForecast;

        // Check if any requested dates fall beyond the 16-day forecast window
        const lastForecastDate = liveForecast[liveForecast.length - 1]?.date;
        if (!lastForecastDate || endDate <= lastForecastDate) {
          return liveForecast;
        }

        // Determine which dates need historical data
        const histStart = startDate > lastForecastDate ? startDate : (() => {
          const d = new Date(lastForecastDate);
          d.setDate(d.getDate() + 1);
          return d.toISOString().split('T')[0];
        })();

        const historicalDays = await fetchHistoricalWeather(
          coords.lat,
          coords.lon,
          histStart,
          endDate
        );

        // Merge: live forecast first, then historical for remaining dates
        const forecastDates = new Set(liveForecast.map(f => f.date));
        const merged = [
          ...liveForecast,
          ...historicalDays.filter(h => !forecastDates.has(h.date)),
        ];

        return merged;
      } catch (err) {
        console.error('[useForecast] Failed to fetch forecast:', err);
        throw err;
      }
    },
    enabled,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    refetchOnMount: 'always',
  });

  const getForecastForDate = (date: string): ForecastDay | null => {
    return forecast.find((day) => day.date === date) || null;
  };

  return {
    forecast,
    isLoading,
    error: error ? (error as Error).message : null,
    getForecastForDate,
  };
}
