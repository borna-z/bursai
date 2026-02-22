

# Fix: "Forecast unavailable" on Plan page

## Root Cause

The `useForecast` query is failing silently. When the query errors:
- `isLoading` becomes `false`
- `forecast` defaults to `[]` (empty array)
- `getForecastForDate()` returns `null`
- `WeatherForecastBadge` shows "Forecast unavailable"

Network logs confirm: current weather calls (`useWeather`) succeed, but no forecast API calls (`daily=...&forecast_days=16`) appear -- meaning the query either errored and stopped retrying, or never completed.

## Changes

### 1. `src/hooks/useForecast.ts` -- Add resilience and error logging

- Add `retry: 3` explicitly to the query options
- Add `retryDelay` with exponential backoff
- Wrap `getCoordinatesFromCity` in a try/catch with console warning
- If city geocoding fails, fall through to geolocation/Stockholm (currently this already happens but silently)
- Add console.error in queryFn catch to surface why the forecast fails

### 2. `src/components/outfit/WeatherForecastBadge.tsx` -- Show retry option on error

- Accept `error` from `useForecast` in addition to `isLoading`
- When there is an error (not just missing data), show a slightly different UI that hints the user can retry, or at minimum logs the issue

### 3. `src/hooks/useForecast.ts` -- Ensure query does not stay disabled

- The `enabled` option should also check that the hook is ready (not waiting on a null city that will change). Add `enabled: options.enabled !== false` explicitly (already present, but verify no race condition).
- Consider adding `refetchOnMount: true` so navigating to the Plan page always attempts a fresh fetch if data is stale.

## Technical Detail

```typescript
// useForecast.ts queryFn update
queryFn: async () => {
  try {
    const coords = await getCoordinates(city);
    return fetchForecast(coords.lat, coords.lon);
  } catch (err) {
    console.error('[useForecast] Failed to fetch forecast:', err);
    throw err; // Re-throw so React Query tracks the error
  }
},
retry: 3,
retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
refetchOnMount: 'always',
```

This ensures:
- Transient failures (Nominatim rate limits, network hiccups) are retried up to 3 times
- Every time the Plan page mounts, it checks for fresh data
- Errors are logged to console for debugging

