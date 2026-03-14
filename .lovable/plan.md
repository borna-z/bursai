

# Travel Capsule — Location Autocomplete & UX Improvements

## Current State
The destination field is a plain text `<Input>` that only triggers a Nominatim geocode lookup `onBlur`. No suggestions appear while typing. The Nominatim API already supports `limit=5` for multiple results.

## Plan (8 Steps)

### Step 1 — Add `searchCities` helper to `useForecast.ts`
Export a new function that queries Nominatim with `limit=5` and `addressdetails=1`, returning `{ display_name, short_name (city+country), lat, lon }[]`. Debounce is handled by the consumer.

### Step 2 — Create `useLocationSuggestions` hook
New hook: `src/hooks/useLocationSuggestions.ts`
- Takes the raw input string, debounces 300ms
- Calls `searchCities` when input ≥ 2 chars
- Returns `{ suggestions, isLoading, clear() }`
- Caches results per query string via React Query with 5-min stale time

### Step 3 — Build `LocationAutocomplete` component
New file: `src/components/ui/LocationAutocomplete.tsx`
- Renders an `<Input>` with a dropdown list of suggestions below it
- Each suggestion shows city name + country flag emoji (derived from country code)
- Keyboard navigation (arrow keys + Enter) for accessibility
- On select: sets value, calls `onSelect(city, coords)`, closes dropdown
- Click-outside closes dropdown
- Shows a subtle `Loader2` spinner in the input while fetching

### Step 4 — Integrate into TravelCapsule form
Replace the plain `<Input>` (lines 448-457) with `<LocationAutocomplete>`. On select, immediately trigger weather lookup with the returned coords (skip the extra geocode call). Remove the `onBlur` handler.

### Step 5 — Auto-fetch weather on date change
Add a `useEffect` that re-fetches weather when `dateRange` changes AND a destination is already selected, so the forecast updates to match the trip window without manual action.

### Step 6 — Show trip summary chip above Generate button
Add a compact summary line before the Generate button: `"Paris, France · Jun 5–10 · 5 nights · ☀️ 18–24°C"` — gives users confidence everything is correct before generating.

### Step 7 — Auto-select occasion chips from weather
When weather loads, auto-suggest relevant occasions: if temp > 28°C auto-select "beach", if rain > 60% keep "vardag". Show as pre-selected but user can toggle off. Only on first weather load, not overriding manual selections.

### Step 8 — Integrate into QuickGenerateSheet travel input
Reuse `<LocationAutocomplete>` in `QuickGenerateSheet.tsx` where the travel destination input exists, replacing that plain input too for consistency.

### Files Changed
- `src/hooks/useForecast.ts` — add `searchCities` export
- `src/hooks/useLocationSuggestions.ts` — new hook
- `src/components/ui/LocationAutocomplete.tsx` — new component
- `src/pages/TravelCapsule.tsx` — integrate autocomplete + auto-weather + summary chip + smart occasions
- `src/components/plan/QuickGenerateSheet.tsx` — reuse autocomplete

