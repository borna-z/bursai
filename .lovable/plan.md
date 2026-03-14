

# Fix: Travel Capsule Destination Autocomplete

## Problem
Two bugs prevent the destination autocomplete from working properly:

1. **Dropdown reopens after selection**: Selecting a city sets `value` to the city name, which re-triggers `useLocationSuggestions` → new search → dropdown reopens. The `clear()` call gets overridden by the debounced effect.

2. **`featuretype=city` too restrictive**: Nominatim's `featuretype=city` filter can return zero results for many valid queries (towns, villages, neighborhoods). Removing it and relying on `addressdetails=1` is more reliable.

## Fix (2 files)

### 1. `src/hooks/useLocationSuggestions.ts`
Add a `skipRef` flag. When `clear()` is called (after selection), set `skipRef = true`. In the `useEffect`, if `skipRef` is true, reset it and skip the search. This prevents the post-selection re-fetch.

### 2. `src/hooks/useForecast.ts`
In `searchCities`, remove `&featuretype=city` from the Nominatim URL so it returns results for all place types (cities, towns, villages, etc.).

