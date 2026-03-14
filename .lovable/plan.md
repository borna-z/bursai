

# Pass Weather Data to AI Suggestions

## Problem
The `burs_style_engine` edge function already accepts and uses `weather` (temperature, precipitation, wind) for garment scoring, but `useAISuggestions` never sends it -- it defaults to `{ precipitation: "none", wind: "low" }` with no temperature.

## Changes

### 1. `src/hooks/useAISuggestions.ts`
- Import `useWeather` hook
- Call `useWeather()` to get current weather data
- Pass `weather: { temperature, precipitation, wind }` in the edge function body
- Add weather data to the query key so suggestions refresh when weather changes

### 2. No backend changes needed
The edge function (line 1695) already reads `body.weather` and passes it through `scoreGarment()` and `buildCombos()` for season/temperature filtering.

## Technical detail
- Map `useWeather` fields to the `WeatherInput` format expected by the engine: `{ temperature: number, precipitation: 'none'|'rain'|'snow', wind: 'low'|'medium'|'high' }`
- Only pass weather when data is available; fall back to existing defaults otherwise
- The query stays `enabled` even without weather (the engine handles missing weather gracefully)

