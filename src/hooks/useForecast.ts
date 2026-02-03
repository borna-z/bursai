import { useQuery } from '@tanstack/react-query';
import { useProfile } from './useProfile';

export interface ForecastDay {
  date: string; // YYYY-MM-DD
  temperature_max: number;
  temperature_min: number;
  temperature_avg: number;
  weather_code: number;
  condition: string;
  precipitation_probability: number;
}

interface UseForecastResult {
  forecast: ForecastDay[];
  isLoading: boolean;
  error: string | null;
  getForecastForDate: (date: string) => ForecastDay | null;
}

interface UseForecastOptions {
  homeCity?: string | null;
  enabled?: boolean;
}

// Map Open-Meteo weather codes to Swedish conditions
function getConditionFromCode(code: number): string {
  if (code === 0) return 'Klart';
  if (code <= 3) return 'Molnigt';
  if (code <= 49) return 'Dimma';
  if (code <= 59) return 'Duggregn';
  if (code <= 69) return 'Regn';
  if (code <= 79) return 'Snö';
  if (code <= 99) return 'Åska';
  return 'Okänt';
}

// Get coordinates from city name using OpenStreetMap Nominatim
async function getCoordinatesFromCity(city: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1&countrycodes=se`
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
async function fetchForecast(lat: number, lon: number): Promise<ForecastDay[]> {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=auto&forecast_days=16`
  );

  if (!response.ok) {
    throw new Error('Kunde inte hämta väderprognos');
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
  }));

  return forecast;
}

// Get coordinates - from city or geolocation
async function getCoordinates(homeCity?: string | null): Promise<{ lat: number; lon: number }> {
  // Try home city first
  if (homeCity) {
    const coords = await getCoordinatesFromCity(homeCity);
    if (coords) return coords;
  }

  // Fallback to Stockholm
  return { lat: 59.3293, lon: 18.0686 };
}

export function useForecast(options: UseForecastOptions = {}): UseForecastResult {
  const { data: profile } = useProfile();
  const homeCity = options.homeCity ?? profile?.home_city;
  const enabled = options.enabled !== false;

  const { data: forecast = [], isLoading, error } = useQuery({
    queryKey: ['forecast', homeCity],
    queryFn: async () => {
      const coords = await getCoordinates(homeCity);
      return fetchForecast(coords.lat, coords.lon);
    },
    enabled,
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
    gcTime: 2 * 60 * 60 * 1000, // Keep in cache for 2 hours
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
