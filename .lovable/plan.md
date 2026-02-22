

# Add "Is this your city?" confirmation toast on auto-detected location

## What this does

When the app auto-detects your location for the first time (no city saved in your profile), a toast notification will appear showing the detected city name with two buttons: **Yes** (confirms and saves it) and **Change** (opens the weather pill's city editor). Once confirmed or changed, the toast never appears again.

## How it works

1. The weather pill on the Home page already detects your city via geolocation
2. A new effect watches for the first time a city is auto-detected (no `home_city` in profile)
3. A toast appears: "Located in **Berlin** -- Is this your city?" with Yes / Change buttons
4. **Yes**: saves the detected city as `home_city` via `setManualCity`
5. **Change**: opens the location editor in the weather pill

## Technical changes

### 1. `src/components/weather/WeatherPill.tsx`

- Add a `useRef` flag (`hasShownLocationToast`) to track if the toast has been shown this session
- Add a `useEffect` that triggers when:
  - `locationSource === 'auto'` (no manual city set)
  - `weather?.location` is available (city name resolved)
  - `profile` is loaded and `home_city` is null
  - Toast hasn't been shown yet this session
- Show a `sonner` toast with:
  - Message: "Located in {city}" with a subtitle "Is this your city?"
  - **Yes** action button: calls `setManualCity(weather.location)` and dismisses
  - **Change** button: sets `editingLocation(true)` and opens the collapsible, dismisses toast
- Mark `hasShownLocationToast.current = true` after showing

### 2. `src/i18n/translations.ts`

- Add translation keys:
  - `weather.located_in`: "Located in {city}"
  - `weather.is_this_your_city`: "Is this your city?"
  - `weather.yes`: "Yes"
  - `weather.change`: "Change"

### 3. No database changes needed

The existing `profiles.home_city` column handles persistence. Once the user taps "Yes", it saves and the toast condition (`home_city` is null) is never true again.

