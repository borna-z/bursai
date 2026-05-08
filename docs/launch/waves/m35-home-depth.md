# M35 — Home depth (smart day banner + weather)

| Field | Value |
|---|---|
| Goal | Bring HomeScreen up to web parity: real weather strip, occasion picker, smart day recommendation card, recent outfits row. |
| Status | DONE (PR #PR_NUM) |
| Branch | `mobile-m35-home-depth` |
| PR count | 1 |
| Depends on | V0, M15 |
| Complexity | M |

## Background

M15 ports `dayIntelligence` + `useSmartDayRecommendation`. This wave wires the Home presentation: weather card (M15 dep), occasion picker pill (M15 dep), suggested outfit, and a "recent outfits" carousel.

## Files touched

### New
- `mobile/src/hooks/useWeather.ts` — wraps a free weather API (OpenWeatherMap or Met.no — confirm free-tier viability before picking). Cache 30 min.
- `mobile/src/hooks/useForecast.ts` — 5-day forecast for PlanScreen and TravelCapsule.
- `mobile/src/components/WeatherStrip.tsx` — current temp + condition icon + 1-line forecast.
- `mobile/src/components/OccasionPicker.tsx` — horizontal pill row (Work / Casual / Party / Workout / etc.) feeding M15's `useSmartDayRecommendation`.

### Modified
- `mobile/src/screens/HomeScreen.tsx` — sections: Eyebrow → Weather → SmartDayBanner (M15) → OccasionPicker → SuggestedOutfit → RecentOutfits row.

## Pattern reference

Web `Home.tsx` is the layout reference. Weather provider choice deferred — many free-tier options. Pick the one that doesn't require a paid key for our launch volume.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: open Home → weather + occasion picker + suggestion + recent outfits all render; switch occasion → suggestion changes
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M35 — Home depth`
