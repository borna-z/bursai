

## Fix Location Service and Manual City "Zoom" Behavior

### Problems identified

1. **Forecast hook ignores browser geolocation**: `useForecast` falls back directly to Stockholm when no `homeCity` is set, while `useWeather` correctly tries `navigator.geolocation` first. This means the forecast strip can show wrong-location data.

2. **Manual city not forwarded to forecast**: When the user picks a manual city in `WeatherPill`, it's passed to `useWeather` but NOT to `useForecast`, so the 3-day forecast still shows the old location.

3. **No visual "zoom in" on manual selection**: When a user manually selects a city, the weather pill stays collapsed. The request is to auto-expand the detail view and keep it expanded until a page refresh.

---

### Changes

#### 1. `src/hooks/useForecast.ts` -- Add geolocation fallback

Update `getCoordinates` to try `navigator.geolocation` before falling back to Stockholm, matching the logic in `useWeather`:

```
async function getCoordinates(homeCity?) {
  if (homeCity) { ... geocode ... }
  // NEW: try browser geolocation
  if (navigator.geolocation) {
    try { getCurrentPosition ... }
    catch { /* fall through */ }
  }
  return Stockholm;
}
```

Also accept an optional `city` parameter in the hook so consumers can pass a manual override.

#### 2. `src/components/weather/WeatherPill.tsx` -- Forward manual city to forecast + auto-expand

- Pass `manualCity` to `useForecast` so the forecast strip updates when the user picks a city.
- When `manualCity` is set (user just chose a location), auto-set `Collapsible` to `open={true}` and keep it open. Reset on page refresh (state is already ephemeral via `useState`).

#### 3. `src/components/weather/WeatherWidget.tsx` -- Same fixes for the widget variant

- Forward `manualCity` to `useForecast`.
- No collapsible here, but ensure forecast uses the correct city.

---

### Technical detail

**`useForecast` signature change:**
```ts
interface UseForecastOptions {
  homeCity?: string | null;
  city?: string | null;     // <-- NEW: manual override
  enabled?: boolean;
}
```

The query key will include `city` so it refetches when the user switches location. The priority order: `city` (manual) > `homeCity` (profile) > browser geolocation > Stockholm.

**WeatherPill auto-expand:**
```tsx
const [isOpen, setIsOpen] = useState(false);
// When manualCity is set, force open
useEffect(() => {
  if (manualCity) setIsOpen(true);
}, [manualCity]);

<Collapsible open={isOpen} onOpenChange={setIsOpen}>
```

This keeps the detail view expanded after manual selection. It resets on page navigation/refresh since it's local state.
