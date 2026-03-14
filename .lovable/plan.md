
## Rephrased issue
The destination field on Travel Capsule behaves like a plain text input: typing does not produce autocomplete suggestions, so users get no feedback.

## What I checked
- `src/components/ui/LocationAutocomplete.tsx`
- `src/hooks/useLocationSuggestions.ts`
- `src/hooks/useForecast.ts`
- `src/pages/TravelCapsule.tsx`
- `src/components/plan/QuickGenerateSheet.tsx`
- `index.html` (CSP)

## Root cause
Do I know what the issue is? **Yes.**

1. **CSP blocks the autocomplete/weather APIs**
   - `index.html` has a strict `Content-Security-Policy` with `connect-src` that allows only backend/sentry/openweathermap.
   - Current code uses:
     - `https://nominatim.openstreetmap.org` (city search/geocoding)
     - `https://api.open-meteo.com` and `https://archive-api.open-meteo.com` (weather)
   - These are not whitelisted, so requests are blocked by browser policy.

2. **Silent failure makes it look “dead”**
   - `searchCities()` catches errors and returns `[]`.
   - `useLocationSuggestions` and `LocationAutocomplete` treat empty results as normal, so no visible error appears (just a plain input feel).

## Implementation plan
1. **Fix CSP allowlist**
   - Update `index.html` `connect-src` to include:
     - `https://nominatim.openstreetmap.org`
     - `https://api.open-meteo.com`
     - `https://archive-api.open-meteo.com`
   - Keep existing allowed domains intact.

2. **Expose autocomplete failures instead of swallowing them**
   - In `src/hooks/useForecast.ts`, make `searchCities` report failure state (do not silently mask all errors as empty results).

3. **Propagate status through suggestion hook**
   - In `src/hooks/useLocationSuggestions.ts`, return richer state:
     - `suggestions`
     - `isLoading`
     - `error` (blocked/rate-limited/network)
     - `hasSearched`
   - Keep debounce + cache behavior.

4. **Improve autocomplete UI feedback**
   - In `src/components/ui/LocationAutocomplete.tsx`:
     - Show “searching…” row while loading.
     - Show “no results” row when query length ≥ 2 and no matches.
     - Show explicit error row when lookup fails.
   - Keep current keyboard and click behavior.

5. **Wire feedback where used**
   - `src/pages/TravelCapsule.tsx` and `src/components/plan/QuickGenerateSheet.tsx`:
     - Surface the new autocomplete error text below the field.
     - Keep manual typing possible, but with clear message when suggestions are unavailable.

## Technical notes
- This is primarily a **frontend security-policy mismatch** after switching weather/geocode providers.
- Fixing only hook/component logic without CSP change will still fail in browser.
- The same fix path will stabilize both Travel Capsule and Quick Generate travel destination input.
