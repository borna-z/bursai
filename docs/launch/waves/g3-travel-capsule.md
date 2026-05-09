# G3 — Travel Capsule: tappable picker + multi-select occasions + saved-list always visible + per-day outfits screen + keep-alive

| Field | Value |
|---|---|
| Goal | Fix the 6 audit-confirmed Travel Capsule defects: untappable picker, single-select trip type, hidden saved-capsules list during form, generate timeout, must-haves with no thumbnails, missing per-day outfits view. |
| Status | TODO |
| Branch | `fix/mobile-g3-travel-capsule` |
| PR count | 1 |
| Depends on | G6 (per-day outfit cards use upgraded `OutfitCard`) |
| Complexity | XL |
| Spec | [`docs/launch/g-campaign.md`](../g-campaign.md) |

## Background

Audit findings (file:line refs):
1. **Picker untappable.** `mobile/src/components/TravelGarmentPicker.tsx:150–200` has unbounded ScrollView inside the outer TravelCapsuleScreen ScrollView; tiles scroll out of reach. Web constrains via `max-h-[320px]`.
2. **Single-select trip type vs web's multi-select Occasions.** `mobile/src/screens/TravelCapsuleScreen.tsx:240` `selectTripType = (type) => setTripType(type)` replaces. Web (`src/components/travel/TravelStep2.tsx:107–157`) has BOTH a single-select Trip Type AND a 9-icon multi-select Occasions.
3. **Saved capsules list hidden on form sub-step.** Lines 485–511 are gated behind `subStep === 'picker'`. Web shows always.
4. **Generate hangs.** `mobile/src/hooks/useGenerateTravelCapsule.ts:282–290` sets 60s timeout but no keep-alive; long Gemini runs (25–45s baseline; spikes higher) appear hung.
5. **Must-haves shows no garments.** `mobile/src/screens/TravelMustHavesScreen.tsx` reads `must_haves` but the seed-from-coverage-gaps pipeline doesn't populate them visually.
6. **No per-day outfits view.** `TravelPackingListScreen.tsx:64–88` is category-grouped checklist only. Web (`TravelResultsView.tsx:223–287`) has an Outfits tab that renders `outfits[]` grouped by `.day`.

## Files touched

### Modified
- `mobile/src/components/TravelGarmentPicker.tsx` — wrap the grid in a `View` with `style={{ maxHeight: 320 }}` and an internal `ScrollView` (or convert to `FlatList` with `nestedScrollEnabled`). Mirrors web's max-h gate.
- `mobile/src/screens/TravelCapsuleScreen.tsx` —
  (a) Lift the saved-capsules section (lines 485–511) outside the `subStep === 'picker'` conditional so it renders on both sub-steps.
  (b) Keep `tripType` single-select BUT add a new multi-select `occasions: string[]` state below the trip-type chips, with the 9 web-parity options (work, dinner, beach, hiking, nightlife, wedding, sightseeing, airport, active). Render as toggle chips. Pipe `occasions` into the generate payload (already supported by edge function — see `supabase/functions/travel_capsule/index.ts` payload spec).
- `mobile/src/hooks/useGenerateTravelCapsule.ts` —
  (a) Bump `callEdgeFunction` `timeoutMs` from 60_000 to 120_000 for travel_capsule (long Gemini runs).
  (b) Add a `console.log` (or `Sentry.addBreadcrumb`) at request-start and at first-byte to confirm the timeout starts on response-byte arrival, not request start. If `callEdgeFunction` (M9) doesn't behave that way, file a P1 followup but do NOT block this PR — extending timeout to 120s should cover.
  (c) Verify `seedMustHaves` populates the `must_haves` array from `coverage_gaps` returned by the edge function. If `must_haves` is reaching the screen empty, log the response shape and trace the seed function.
- `mobile/src/screens/TravelMustHavesScreen.tsx` — render must-haves with G6 `OutfitCard` (or `GarmentCard` per row, depending on data shape). Confirm garments hydrate via `useGarmentImage`.
- `mobile/src/screens/TravelPackingListScreen.tsx` — add a tab/CTA in the header that navigates to the new `TravelOutfitsScreen` with `route.params = { capsuleId }`. No other changes here.

### New
- `mobile/src/screens/TravelOutfitsScreen.tsx` — fetches the capsule via `useTravelCapsule(capsuleId)`. Groups `capsule.outfits[]` by `.day`. For each day: a Day Header (Day N + date + weather), then a stack of `<OutfitCard garments={outfit.items} />` (G6) with the `outfit.note` and `outfit.occasion` below. Mirrors web's `CapsuleOutfitCard` from `src/components/travel/TravelResultsView.tsx:223–287`.
- Register `TravelOutfitsScreen` in `mobile/src/navigation/MainStack.tsx` (or wherever travel routes live).
- `mobile/src/i18n/locales/en.ts` + `sv.ts` — append: `travel.occasions.title`, `travel.occasions.{work,dinner,beach,hiking,nightlife,wedding,sightseeing,airport,active}`, `travel.outfits.tab`, `travel.outfits.dayLabel`, `travel.savedCapsules.empty`.

### Verified
- `mobile/src/hooks/useTravelCapsule.ts` — confirm it returns `outfits: { day: number, items: { id, rendered_image_path, original_image_path }[], occasion: string, note: string }[]`. If shape differs, add the type alongside (no schema work).
- `supabase/functions/travel_capsule/index.ts` payload spec — read-only confirmation that `occasions: string[]` is accepted in the request body.

## Pattern reference

- Web `TravelStep2` multi-select chips: `src/components/travel/TravelStep2.tsx:132–157`.
- Web `TravelResultsView` per-day rendering: `src/components/travel/TravelResultsView.tsx:223–287`.
- Mobile `M28 — Travel Capsule` baseline: `docs/launch/waves/m28-travel-capsule.md` (foundation; this is a follow-up).

## Acceptance gates

- `tsc --noEmit` → 0 errors
- `eslint "src/**/*.{ts,tsx}" --max-warnings 0` → clean
- `expo-doctor` → passes
- `expo export -p ios` → bundle delta ≤ +30 KB
- Manual: open Travel Capsule → step 1 picker is fully tappable from any scroll position; tiles never scroll offscreen.
- Manual: select trip type (single) + select 3 occasions (multi) → generate → result reflects multi-occasion mix.
- Manual: open form sub-step → saved-capsules list still visible at top.
- Manual: generate trip → does not hang; completes in ≤ 90s in normal conditions.
- Manual: post-generation, must-haves screen shows garment thumbnails, not gradients.
- Manual: from packing list, tap Outfits tab → per-day breakdown with multiple outfits per day, each composed of real garment thumbs.
- i18n: en/sv updated.
- Code-reviewer: approved.
- Codex: 👍 / "no bugs found" + quiet window.
- Mandatory 2nd self-review: clean.

## Deploy

None — mobile-only.

## PR template

Title: `fix(mobile): G3 — Travel Capsule end-to-end (picker, occasions, saved list, keep-alive, per-day outfits)`

Body:
- TravelGarmentPicker height-constrained → tappable.
- Multi-select Occasions (9 chips) added next to single-select Trip Type.
- Saved capsules list lifted outside sub-step conditional.
- callEdgeFunction timeout 60s → 120s for travel_capsule + breadcrumb logging.
- Must-haves screen renders garment thumbnails (G6 OutfitCard).
- New `TravelOutfitsScreen` for per-day outfit breakdown (mirrors web TravelResultsView Outfits tab).
- Plan: `docs/launch/waves/g3-travel-capsule.md`
