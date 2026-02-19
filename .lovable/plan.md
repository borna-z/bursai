

# Weather Widget: Silent Auto-Refresh + Location Picker

## Changes

### 1. `src/hooks/useWeather.ts` -- Silent 3-second polling

Rewrite to use `useQuery` with `refetchInterval: 3000` instead of manual `useState`/`useEffect`. This gives silent background updates with no loading indicator after the first fetch.

- Return `weather_code` directly alongside condition text so the widget doesn't need reverse-mapping
- Add support for an optional `city` parameter: when provided, geocode the city instead of using browser geolocation
- On first load: show skeleton. After that: `refetchInterval: 3000` silently updates data in place (no `isLoading` flash)

### 2. `src/components/weather/WeatherWidget.tsx` -- Replace "Anpassa" with location picker

Remove the entire "Anpassa" section (temperature/precipitation manual override, lines 186-232) and replace with a simple location feature:

- Tapping the location name (e.g. "Stockholm") opens a small inline input field
- User can type a city name and press Enter to switch location
- A small "Auto" button resets to automatic geolocation
- No more temperature/precipitation/wind manual inputs

Also:
- Remove the reverse weather-code mapping hack (lines 77-90) since `useWeather` will now return the code directly
- Remove the `RefreshCw` button since data refreshes automatically every 3 seconds

### 3. `src/pages/Home.tsx` -- Simplify props

Remove all the manual weather override state (`temperature`, `precipitation`, `wind`, `useAutoWeather`, and their setters) since the widget is now self-contained. The `WeatherWidget` no longer needs those props -- it manages everything internally. The outfit generator will read weather directly from the hook instead.

### 4. Weather icon mapping fix

The current mapping has a gap: codes 4-48 are not actually fog in Open-Meteo. Correct mapping:
- 0: Sun (clear sky)
- 1-3: Cloud (partly cloudy / overcast)
- 45, 48: CloudFog (fog)
- 51-57: CloudDrizzle (drizzle)
- 61-67: CloudRain (rain)
- 71-77: CloudSnow (snow)
- 80-82: CloudRain (rain showers)
- 85-86: CloudSnow (snow showers)
- 95-99: CloudLightning (thunderstorm)

## Technical Details

### useWeather refactor

```typescript
// New signature
interface UseWeatherOptions {
  city?: string | null; // manual city override
}

export function useWeather(options?: UseWeatherOptions) {
  // Uses useQuery with refetchInterval: 3000
  // First fetch: isLoading=true (skeleton shown)
  // Subsequent: silent background refresh, no loading state
  // Returns weather_code in the data object
}
```

Key: `useQuery` has `refetchInterval: 3000` and the skeleton only shows when `!data` (first load). After that, stale data stays visible while fresh data loads in background.

### WeatherWidget new props

```typescript
// Simplified -- no more manual override props
interface WeatherWidgetProps {
  // Only needs to expose weather data upward for outfit generation
  onWeatherChange?: (weather: { temperature: number; precipitation: string; wind: string }) => void;
}
```

### Location picker UX

Tapping MapPin + city name toggles an inline text input. Type a city, press Enter. The widget geocodes it and refetches weather for that location. A small "x" button clears the manual city and returns to auto-detect.

### Files changed

| File | Change |
|------|--------|
| `src/hooks/useWeather.ts` | Rewrite with useQuery, 3s refetch, city param, return weather_code |
| `src/components/weather/WeatherWidget.tsx` | Remove "Anpassa" section, add location picker, fix icon mapping, remove RefreshCw |
| `src/pages/Home.tsx` | Remove manual weather state, simplify WeatherWidget usage |

