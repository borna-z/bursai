import { useQuery } from '@tanstack/react-query';
import { useProfile } from './useProfile';
import { getCoordinatesFromCity } from './useForecast';

export interface WeatherData {
  temperature: number;
  precipitation: 'none' | 'rain' | 'snow';
  wind: 'low' | 'medium' | 'high';
  condition: string;
  weather_code: number;
  is_day: boolean;
  location: string;
}

interface UseWeatherOptions {
  city?: string | null;
}

// Map Open-Meteo weather codes to Swedish conditions
function getConditionFromCode(code: number): string {
  if (code === 0) return 'Klart';
  if (code <= 3) return 'Molnigt';
  if (code === 45 || code === 48) return 'Dimma';
  if (code >= 51 && code <= 57) return 'Duggregn';
  if (code >= 61 && code <= 67) return 'Regn';
  if (code >= 71 && code <= 77) return 'Snö';
  if (code >= 80 && code <= 82) return 'Regn';
  if (code >= 85 && code <= 86) return 'Snö';
  if (code >= 95 && code <= 99) return 'Åska';
  return 'Okänt';
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

async function getCityName(lat: number, lon: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=sv`
    );
    if (!response.ok) return 'Din plats';
    const data = await response.json();
    return data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || 'Din plats';
  } catch {
    return 'Din plats';
  }
}

async function getCoordinates(city?: string | null): Promise<{ lat: number; lon: number }> {
  if (city) {
    const coords = await getCoordinatesFromCity(city);
    if (coords) return coords;
  }

  // Try browser geolocation
  if (navigator.geolocation) {
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

  return { lat: 59.3293, lon: 18.0686 };
}

async function fetchWeather(city?: string | null, homeCity?: string | null): Promise<WeatherData> {
  const coords = await getCoordinates(city || homeCity);

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,weather_code,wind_speed_10m,is_day&timezone=auto`
  );

  if (!response.ok) throw new Error('Kunde inte hämta väderdata');

  const data = await response.json();
  const current = data.current;

  const location = city || (await getCityName(coords.lat, coords.lon));

  return {
    temperature: Math.round(current.temperature_2m),
    precipitation: getPrecipitationFromCode(current.weather_code),
    wind: getWindCategory(current.wind_speed_10m),
    condition: getConditionFromCode(current.weather_code),
    weather_code: current.weather_code,
    is_day: current.is_day === 1,
    location,
  };
}

export function useWeather(options?: UseWeatherOptions) {
  const { data: profile } = useProfile();
  const homeCity = profile?.home_city;
  const city = options?.city;

  const { data: weather, isLoading, error } = useQuery({
    queryKey: ['weather', city, homeCity],
    queryFn: () => fetchWeather(city, homeCity),
    refetchInterval: 3000,
    staleTime: 2000,
    gcTime: 60000,
  });

  return {
    weather: weather ?? null,
    isLoading: !weather && isLoading,
    error: error ? (error as Error).message : null,
  };
}
