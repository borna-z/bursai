# M15 — Day intelligence depth

| Field | Value |
|---|---|
| Goal | Port `dayIntelligence` + `buildTodaySuggestions` + `useSmartDayRecommendation` so HomeScreen surfaces a "today's outfit" recommendation tied to weather, calendar occasion, and recent wear history. |
| Status | TODO |
| Branch | `mobile-m15-day-intelligence` |
| PR count | 1 |
| Depends on | V0, M9 |
| Complexity | L |

## Background

Web home page leads with a SmartDayBanner: "Tuesday — meeting + 12°C drizzle. Try this." The recommendation engine is `dayIntelligence.ts` (occasion classifier from calendar + weather inputs) + `buildTodaySuggestions.ts` (consumes the classified context to score outfits). Mobile HomeScreen has none of this.

## Files touched

### New
- `mobile/src/lib/dayIntelligence.ts` — port; `classifyDay({ events, weather, lastWornAt }) → DayContext`
- `mobile/src/lib/buildTodaySuggestions.ts` — port; `buildSuggestions(context, outfits, garments) → ScoredOutfit[]`
- `mobile/src/hooks/useSmartDayRecommendation.ts` — composes the lib functions; returns top 3 ranked outfits
- `mobile/src/hooks/useDaySummary.ts` — calls `summarize_day` edge function for the natural-language summary line

### Modified
- `mobile/src/screens/HomeScreen.tsx` — add SmartDayBanner above the existing surfaces; show summary line + top recommendation; tap → OutfitDetail
- `mobile/src/components/SmartDayBanner.tsx` — new component, but using existing primitives (Eyebrow + PageTitle + Caption + OutfitCard)

## Pattern reference

Web `dayIntelligence.ts` + `buildTodaySuggestions.ts` are pure — port directly. Inputs come from M35 Home depth's weather hook (deferred there) + react-native-calendar-events (or just last-worn data if calendar sync M36 hasn't shipped yet — graceful fallback).

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: open Home; confirm SmartDayBanner shows weather context + outfit suggestion; force-cycle weather (mock provider in dev) and confirm suggestion changes
- Code-reviewer: approved

## Deploy

None — `summarize_day` already deployed.

## PR template

Title: `feat(mobile): M15 — day intelligence depth`
