# M28 — Travel capsule end-to-end

| Field | Value |
|---|---|
| Goal | Wire the 3-screen travel wizard (TravelCapsule → TravelMustHaves → TravelPackingList) to the deployed `travel_capsule` edge function. |
| Status | DONE (PR #TBD) |
| Branch | `mobile-m28-travel-capsule` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | M |

## Background

Edge function `travel_capsule` (~1235 lines, Gemini tool-use) is deployed. Mobile has 3 screens with FIXTURES + GARMENT_FIXTURES placeholder data — the wizard runs end-to-end visually but doesn't generate anything real.

## Files touched

### New
- `mobile/src/hooks/useTravelCapsules.ts` — list saved capsules.
- `mobile/src/hooks/useGenerateTravelCapsule.ts` — POST `{ destination, dates, occasions, weather }` → returns `{ capsule_garments, packing_list, must_haves }`.

### Modified
- `mobile/src/screens/TravelCapsuleScreen.tsx` — replace SECTIONS fixtures with route param threading + real `useTravelCapsules`.
- `mobile/src/screens/TravelMustHavesScreen.tsx` — receive capsule_id via route params → render real must-haves with edit support.
- `mobile/src/screens/TravelPackingListScreen.tsx` — render real packing_list with checkbox state persisted per capsule.
- Optional: new table `travel_capsules` if not yet present — confirm against schema before adding.

## Pattern reference

Web `TravelCapsule.tsx` is the wizard reference; backend behavior identical.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: start a 5-day Stockholm trip with mixed weather → confirm capsule garments + must-haves + packing list materialize within ~30s; reopen the saved capsule from the list
- Code-reviewer: approved

## Deploy

None unless schema add — then `db push`.

## PR template

Title: `feat(mobile): M28 — travel capsule end-to-end`
