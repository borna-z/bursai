# Travel Capsule — Six-Fix Design

**Date:** 2026-04-15
**Scope:** Six targeted fixes to the BURS Travel Capsule feature
**Status:** Design approved, ready for implementation plan
**PR strategy:** One atomic PR covering all six fixes

## Problem statement

The user reports six interlocked issues with the Travel Capsule feature:

1. Wizard cards are visually invisible — they blend into the page background
2. Generator appears to read only ~30 garments instead of the full wardrobe
3. Some input combinations produce a "could not build" error instead of a partial result
4. On the results screen, "Add to plan" and "Start over" buttons float mid-screen instead of being pinned to the bottom
5. Each generated outfit has a "Try this" button that does nothing
6. Saved trips only restore the destination, not the full capsule result, so reopening a trip forces regeneration

This spec addresses all six in a single PR because issues 2, 3, and 6 share an edge-function and a DB schema change — splitting them would create intermediate states with regressed functionality.

## Non-goals

- Redesigning the travel capsule flow (a separate spec from 2026-04-14 covers that, unrelated to these bugs)
- Changing the AI model or prompt for capsule generation beyond the minimum needed for category coverage
- Adding new features (history search, sharing, export, etc.)
- Touching the shared `Card` component or any global styling that affects non-travel pages

## Current behaviour (root causes)

### Issue 1: Card invisibility
`src/components/travel/TravelStep1.tsx` and `TravelStep2.tsx` wrap their sections in the default `<Card>` variant, which applies `border-border/70 bg-card shadow-[0_12px_30px_rgba(28,25,23,0.05)]`. Card background is Editorial Cream at 98% lightness, page background at 95% — a 3-point delta. At `/70` border opacity and 5%-opacity shadow, the card outline is effectively invisible once the page contents are in flow.

### Issue 2: Garment limit
`supabase/functions/travel_capsule/index.ts:242-249` hard-caps AI input at 40 garments:
```
const maxAiInput = Math.min(40, Math.max(20, garmentBudget * 2));
```
Selection is sorted purely by pack-worthiness score with no category guarantees, so a user with 80 tops and 5 pairs of shoes may have all 40 slots consumed by tops, leaving the generator with zero shoes to pair.

`src/components/travel/useTravelCapsule.ts:132` shows "Scanning your {N} garments" where N is the full wardrobe count, falsely implying all garments are considered.

### Issue 3: "Could not build" errors
The edge function has a 5-level fallback and returns `coverage_gaps`, but the frontend treats `scheduledOutfits.length < requiredOutfits` as a hard failure. Combined with Issue 2's category blindness, wardrobes that lack diversity in the top-40 selection produce partial results that render as errors.

### Issue 4: Button layout
`src/components/travel/TravelResultsView.tsx:247`:
```
<div className="bottom-safe-nav fixed inset-x-4 z-20">
```
The `bottom-safe-nav` class provides safe-area padding but does not include `bottom: 0`. Without an explicit bottom anchor, `fixed` positions the element wherever it sits in document flow.

### Issue 5: Dead "Try this" button
`src/components/travel/CapsuleOutfitCard.tsx:37` passes a no-op:
```
onTryOutfit={() => {/* no-op in capsule context */}}
```
The button renders but does nothing when tapped.

### Issue 6: Incomplete persistence
Two writers to the `travel_capsules` table with mismatched schemas:
- `src/hooks/useTravelCapsules.ts` inserts `result: CapsuleResult` (JSON blob)
- `supabase/functions/travel_capsule/index.ts:1091-1107` inserts disaggregated fields (`capsule_items`, `outfits`, `packing_list`, `packing_tips`, `total_combinations`, `reasoning`)

The DB schema likely lacks a `result JSONB` column, so the frontend's insert silently drops that field. On reload, `trip.result` is undefined and only the destination and dates survive. The restore code in `TravelCapsule.tsx:73-102` is already correct — it just has nothing to restore.

## Proposed solution

### Fix 1 — Wizard card visibility
Inline explicit classes on the step sections (do NOT touch the shared `Card` component):
```
rounded-[1.25rem] border border-border bg-card p-5
```
Full-opacity border, no shadow, matches the pattern `GapStateViews` uses after Prompt 36. Apply in `TravelStep1.tsx` and `TravelStep2.tsx` for each section block.

### Fix 2 — Category-balanced garment selection + honest loading copy
**Edge function (`supabase/functions/travel_capsule/index.ts`)**: Rewrite `selectGarmentsForAI` to guarantee minimum category coverage before the score cap. Reserve slots per category:
- 10 tops
- 10 bottoms
- 6 shoes
- 6 outerwear
- 4 accessories
- Remaining 24 slots filled by highest-scored regardless of category

Raise ceiling from 40 to 60. Numbers are tunable; the invariant is "no essential category gets starved." If a user has fewer items in a category than the reservation, just take all of them and redistribute the unused slots to the remaining pool.

**Frontend (`useTravelCapsule.ts`)**: Update loading text to accurately describe the selection:
> "Picking the best {count} pieces from your {total} garments"
where `count` is the actual number sent to the AI. Requires the edge function to return this count (or the frontend calculates it from the 60 cap).

### Fix 3 — Graceful partial results
**Frontend (`TravelResultsView` or its parent)**: Render whatever was built, never hard-error if `scheduledOutfits.length ≥ 1`. Show a compact banner above the results when `scheduledOutfits.length < requiredOutfits`:
> "We built {X} of {Y} days from your current wardrobe. Add more {category} to unlock the rest."

Pull the gap categories from the `coverage_gaps` field already returned by the edge function.

**Edge function**: Guarantee `scheduledOutfits` contains at least one outfit whenever the wardrobe has ≥1 top + ≥1 bottom + ≥1 shoes. If the AI returns zero valid outfits, generate a single deterministic fallback using the highest-scored garment in each essential category. Combined with Fix 2's category balance, hard failures should become vanishingly rare.

### Fix 4 — Action bar pinned to viewport bottom
Replace the `bottom-safe-nav fixed inset-x-4 z-20` wrapper with:
```
fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-20
```
Verify the results content has sufficient `paddingBottom` (at least `inputDockHeight + 1rem`) so no outfit card is obscured behind the action bar.

### Fix 5 — Remove Try-this in capsule context
Add optional `hideTryButton?: boolean` prop to `OutfitSuggestionCard` (defaults to `false` to preserve chat behaviour). Pass `hideTryButton` from `CapsuleOutfitCard`. When `true`, the Try-this button is not rendered at all; the save/variant buttons stay.

### Fix 6 — Full capsule persistence
1. **DB migration** (pre-approved by user): Add `result JSONB` column to `travel_capsules` if missing. Verify with Supabase MCP before running. Migration name: `add_result_jsonb_to_travel_capsules`.
2. **Edge function**: Remove the DB insert at lines 1091-1107. The edge function now just RETURNS the capsule; it does not write.
3. **Frontend hook (`useTravelCapsules.ts`)**: Becomes the single writer. Insert full row with `result` as JSONB blob plus the scalar fields already being sent.
4. **Restore path** (`TravelCapsule.tsx:handleSelectTrip`): Already correct. Just needs a functional DB column to pull from.

## Data model changes

**`travel_capsules` table migration:**
```sql
ALTER TABLE travel_capsules
  ADD COLUMN IF NOT EXISTS result JSONB;
```

No column drops, no constraints added, no existing data touched. Existing saved trips will have `result = NULL` and render only destination/date (current broken behaviour) — acceptable, since the user has accepted that pre-fix saves are effectively lost. Future saves will populate `result` and restore fully.

## Deploy plan

1. Run migration against production database
2. Deploy `travel_capsule` edge function (required for Fixes 2, 3, 6)
3. Merge and deploy frontend

Order matters: migration must land before edge function redeploy (because the edge function will start returning data the frontend expects the schema to accept). Frontend can land at any point but benefits from having the edge function already live.

Per CLAUDE.md: deploy ONE function at a time, use the full command:
```
npx supabase functions deploy travel_capsule --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

## Files to change

**Frontend:**
- `src/components/travel/TravelStep1.tsx` — card classes (Fix 1)
- `src/components/travel/TravelStep2.tsx` — card classes (Fix 1)
- `src/components/travel/TravelResultsView.tsx` — action bar position (Fix 4), partial-result banner (Fix 3)
- `src/components/travel/CapsuleOutfitCard.tsx` — pass `hideTryButton={true}` (Fix 5)
- `src/components/chat/OutfitSuggestionCard.tsx` — add `hideTryButton` prop (Fix 5)
- `src/components/travel/useTravelCapsule.ts` — honest loading text (Fix 2)
- `src/hooks/useTravelCapsules.ts` — ensure `result` is sent in insert (Fix 6)
- `src/pages/TravelCapsule.tsx` — verify `handleSelectTrip` works with JSONB `result` (Fix 6)
- `src/components/travel/types.ts` — verify `TravelCapsuleRow` shape matches (Fix 6)

**Edge function:**
- `supabase/functions/travel_capsule/index.ts` — `selectGarmentsForAI` rewrite (Fix 2), deterministic fallback (Fix 3), remove DB insert (Fix 6)

**Database:**
- One migration adding `result JSONB` column

**Tests:**
- `src/pages/__tests__/TravelCapsule.test.tsx` — update any assertions coupled to the old card styling, removed Try button, or old restore shape

## Risk & rollback

- **Migration risk:** additive-only column, no downtime, no rollback needed
- **Edge function risk:** removing the DB insert is a behaviour change. If the frontend save path is broken at deploy time, new saves will silently drop. Mitigation: frontend hook change lands in the same PR and is verified via test before merge.
- **Frontend risk:** the `hideTryButton` prop defaults to `false`, so chat outfit cards remain unchanged. Verified by snapshot/unit tests.

## Test plan

**On-device (after merge):**

1. **Fix 1:** Open Travel Capsule, observe wizard step cards have visible borders, match the look of the Gaps state cards
2. **Fix 2:** Large wardrobe (100+ garments), start capsule generation, observe loading text shows accurate count; verify final outfits use items from multiple categories (not just the top-scored type)
3. **Fix 2:** Small wardrobe (10-15 garments), start generation, observe no errors and all categories represented in outfits
4. **Fix 3:** Generate with a deliberately sparse wardrobe (e.g. 5 tops, 2 bottoms, 1 shoe pair), observe partial result banner instead of error
5. **Fix 4:** Results screen on iPhone Safari, confirm action bar anchored to bottom above keyboard/safe area
6. **Fix 5:** Results screen, confirm outfit cards do NOT show Try-this button
7. **Fix 5 regression:** AI chat, confirm outfit cards DO still show Try-this button and it still triggers outfit creation
8. **Fix 6:** Generate capsule, save, close PWA, reopen, select saved trip from history — all outfits, packing list, and content fully restored
9. **Fix 6 regression:** Existing saved trips (pre-migration) open without error, show destination/date only (graceful degradation)

**Automated:**
- `npx vitest run src/pages/__tests__/TravelCapsule.test.tsx`
- `npx tsc --noEmit --skipLibCheck`
- `npx eslint src/ --ext .ts,.tsx --max-warnings 0`
- `npm run build` (must be warning-free)

## Open questions

None — all four design decisions confirmed by the user in the approval round:
1. DB migration approved
2. Try-this button: remove in capsule context
3. Garment cap: smart selection + bump to 60
4. PR strategy: one atomic PR

## Success criteria

- All six issues fixed as described, verifiable on device
- No regression in AI chat outfit card behaviour
- No regression in other pages using PageIntro / the shared Card component
- Production DB migration applied cleanly
- Edge function deployed without errors
- All existing tests pass; new test coverage for the partial-result banner and `hideTryButton` prop
