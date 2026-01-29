import { useState, useEffect, useCallback } from 'react';

interface WeatherData {
  temperature: number;
  precipitation: 'none' | 'rain' | 'snow';
  wind: 'low' | 'medium' | 'high';
  condition: string;
  location: string;
}

interface UseWeatherResult {
  weather: WeatherData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
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

// Map weather code to precipitation type
function getPrecipitationFromCode(code: number): 'none' | 'rain' | 'snow' {
  if (code <= 49) return 'none';
  if (code <= 69) return 'rain';
  if (code <= 79) return 'snow';
  if (code >= 80) return 'rain'; // Showers/thunderstorms
  return 'none';
}

// Map wind speed to category
function getWindCategory(windSpeed: number): 'low' | 'medium' | 'high' {
  if (windSpeed < 15) return 'low';
  if (windSpeed < 30) return 'medium';
  return 'high';
}

// Reverse geocode coordinates to city name
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

export function useWeather(): UseWeatherResult {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    try {
      // Fetch weather from Open-Meteo (free, no API key required)
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`
      );
      
      if (!response.ok) {
        throw new Error('Kunde inte hämta väderdata');
      }
      
      const data = await response.json();
      const current = data.current;
      
      // Get city name
      const location = await getCityName(lat, lon);
      
      const weatherData: WeatherData = {
        temperature: Math.round(current.temperature_2m),
        precipitation: getPrecipitationFromCode(current.weather_code),
        wind: getWindCategory(current.wind_speed_10m),
        condition: getConditionFromCode(current.weather_code),
        location,
      };
      
      setWeather(weatherData);
      setError(null);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError(err instanceof Error ? err.message : 'Kunde inte hämta väder');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getLocation = useCallback(() => {
    setIsLoading(true);
    setError(null);
    
    if (!navigator.geolocation) {
      setError('Geolokalisering stöds inte');
      setIsLoading(false);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchWeather(position.coords.latitude, position.coords.longitude);
      },
      (err) => {
        console.error('Geolocation error:', err);
        // Fallback to Stockholm if geolocation fails
        if (err.code === err.PERMISSION_DENIED) {
          setError('Platsåtkomst nekad. Använder Stockholm.');
          fetchWeather(59.3293, 18.0686);
        } else {
          setError('Kunde inte hämta plats');
          setIsLoading(false);
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // Cache location for 5 minutes
      }
    );
  }, [fetchWeather]);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  return { weather, isLoading, error, refetch: getLocation };
}
