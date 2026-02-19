

# Fix: Show Moon at Night Instead of Sun

## Problem
Weather code `0` (clear sky) always renders the `Sun` icon, even at nighttime. At 22:15 in Sweden it should show a moon.

## Solution
Open-Meteo provides an `is_day` field (1 = day, 0 = night) in its current weather response. We'll fetch it and pass it through so the icon mapper can choose between Sun/Moon.

### File 1: `src/hooks/useWeather.ts`
- Add `is_day` to the API request URL: `&current=temperature_2m,weather_code,wind_speed_10m,is_day`
- Add `is_day: boolean` to the `WeatherData` interface
- Return `is_day: current.is_day === 1` in the response object

### File 2: `src/components/weather/WeatherWidget.tsx`
- Import `Moon` from `lucide-react`
- Update `getWeatherIcon` to accept a second parameter `isDay: boolean`
- When `code === 0`: return `Sun` if day, `Moon` if night
- When `code <= 3` (partly cloudy): could optionally keep `Cloud` for both (clouds look the same day/night)
- Pass `weather.is_day` when calling `getWeatherIcon` for the hero icon

### Files changed

| File | Change |
|------|--------|
| `src/hooks/useWeather.ts` | Fetch `is_day` from API, add to WeatherData |
| `src/components/weather/WeatherWidget.tsx` | Import Moon, use `is_day` to pick Sun vs Moon |
