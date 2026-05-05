# M16 — Outfit pool + week generator

| Field | Value |
|---|---|
| Goal | Wire pool generation (5–10 outfits per session) and week generation (7-day plan) into PlanScreen and a new "Generate pool" entry. |
| Status | TODO |
| Branch | `mobile-m16-pool-week-generators` |
| PR count | 1 |
| Depends on | V0, M13, M15 |
| Complexity | L |

## Background

Edge functions: `generate_outfit` already deployed; week / pool generation is implemented as multi-shot calls to `generate_outfit` with `count: N` + `dailyContext` per day. Web `useWeekGenerator` orchestrates the loop.

## Files touched

### New
- `mobile/src/hooks/useOutfitPool.ts` — `generatePool({ count, anchor?, occasion? })` returns `count` outfits.
- `mobile/src/hooks/useWeekGenerator.ts` — `generateWeek({ startDate })` returns 7 outfits, one per day, each fed M15's day context.
- `mobile/src/screens/OutfitPoolScreen.tsx` (or modal) — grid view of generated outfits, save-all / save-selected actions.
- `mobile/src/components/WeekPlanPreview.tsx` — under PlanScreen's WeekStrip; shows the 7-day generated plan with per-day quick-swap.

### Modified
- `mobile/src/screens/OutfitGenerateScreen.tsx` — add "Generate pool" button alongside the existing single-outfit CTA.
- `mobile/src/screens/PlanScreen.tsx` — add "Generate week" entry in the WeekStrip header.
- `mobile/src/navigation/RootNavigator.tsx` — register OutfitPool route.

## Pattern reference

Both hooks fan out via the M9 client wrapper. Per-call failures isolated; partial pool is acceptable.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: tap "Generate pool" → 5 outfits arrive over ~10–20s; save 3 → confirm in OutfitsScreen. Tap "Generate week" → 7 plan entries appear; tap a day to swap.
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M16 — outfit pool + week generator`
