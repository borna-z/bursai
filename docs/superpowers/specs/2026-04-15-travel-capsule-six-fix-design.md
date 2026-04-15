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
Two writers to the `travel_capsules` table, with mismatched column coverage:
- `supabase/functions/travel_capsule/index.ts:1091-1107` writes the NOT NULL columns (`destination`, `trip_type`, `duration_days`, `capsule_items`, `outfits`, `packing_list`) but leaves `result` NULL
- `src/hooks/useTravelCapsules.ts` writes `{ destination, start_date, end_date, occasions, luggage_type, companions, style_preference, result }` — missing `duration_days` and `capsule_items`

The live `travel_capsules` schema (confirmed via MCP) has `result JSONB nullable` **and** `duration_days int4 NOT NULL`, `capsule_items jsonb NOT NULL default '[]'`, `outfits jsonb NOT NULL default '[]'`, `packing_list jsonb NOT NULL default '[]'`. The frontend hook's insert therefore fails with a NOT NULL violation on `duration_days`, which is swallowed by the try/catch in `handleGenerate`. The edge function's insert succeeds but leaves `result = NULL`, so reload restores only destination/date.

**No DB migration is required** — `result JSONB` already exists. The fix is to collapse the two writers into one and send every required column.

## Proposed solution

### Fix 1 — Remove the card wrapper entirely (card-less section layout)
Cards were never the right container for a form flow. The rest of BURS (AddGarment, Settings, profile edit) uses a card-less "editorial magazine" pattern: eyebrow label + Playfair italic section title + form field, with sections separated by a subtle top border or generous vertical spacing.

Remove every `<Card>` wrapper from `TravelStep1.tsx` and `TravelStep2.tsx`. Replace with this structure per section:

```tsx
<section className="space-y-6">
  {/* First section has no top border */}
  <div>
    <p className="label-editorial mb-3">Destination</p>
    <LocationAutocomplete ... />
  </div>

  {/* Subsequent sections: subtle top divider + vertical rhythm */}
  <div className="border-t border-border/40 pt-6">
    <p className="label-editorial mb-3">Trip dates</p>
    <DatePicker ... />
  </div>

  <div className="border-t border-border/40 pt-6">
    <p className="label-editorial mb-3">Luggage</p>
    <LuggageChips ... />
  </div>
</section>
```

No backgrounds, no shadows, no borders around the form — just the form itself breathing on the page. Matches the rest of the app's editorial tone. The `label-editorial` utility already exists in `index.css` and provides the correct small-caps eyebrow styling.

**Rationale for removal vs. stronger cards:** The user's feedback "no visible card i think it is better more cleaner like the rest of the app" is directly asking for a card-less layout. Strengthening borders would still be card-based. Removing is the honest fix.

### Fix 2 — User-controlled garment selection (no hardcoded category caps)
**Default behaviour:** send ALL garments to the edge function. No per-category minimums, no score-based filtering. Gemini Flash handles 100+ garments in context without meaningful token or latency cost, and the 40-cap was conservative without technical justification.

**Safety ceiling:** hard cap at 150 garments total to protect against runaway costs if a user has a pathological wardrobe (e.g. 500+ items). When the user's wardrobe exceeds 150, the edge function sends the top 150 by pack-worthiness score unless the user has manually adjusted selection (see below).

**Optional user override — "Customize selection" panel:**

A new collapsible panel in `TravelStep2.tsx`, positioned below the existing style controls, collapsed by default. Opening it shows:

```
Customize selection                       [–]
────────────────────────────────────────────
Tops          ●─────────────────○   42 of 42
Bottoms       ●───────────○          18 of 28
Shoes        ●──────────○             8 of 12
Outerwear    ●────────○               6 of 8
Accessories  ●──────○                 4 of 6

Using 78 of 96 garments          [Reset]
```

Each category slider:
- Range: `0` to `<count of that category in the user's wardrobe>`
- Default: the full count (slider maxed right)
- Live display: `{selected} of {total}`
- Only appears if the user has at least one item in that category
- Categories derived from the existing `garment.category` enum (tops, bottoms, shoes, outerwear, accessories, dresses, activewear — whatever taxonomy is already used)

Running total shown at the bottom: "Using X of Y garments". If the sum exceeds 150, show "Maximum 150 — reduce a category to send more" and clamp before sending.

**Reset button** restores each slider to its default (full category count, clamped to 150 total via proportional reduction).

**New state in `useTravelCapsule.ts`:**
```ts
const [garmentSelection, setGarmentSelection] =
  useState<Record<string, number> | null>(null);
```
`null` = use defaults (send all, capped at 150). Any object = user has customized.

**Wire-up:**
- `TravelStep2.tsx` renders the panel and exposes `garmentSelection` + `setGarmentSelection` as props from the wizard
- `useTravelCapsule.handleGenerate` includes `garmentSelection` in the edge function request body
- Edge function reads `garmentSelection` and, if present, applies the per-category cap before sending to the AI

**Edge function changes (`supabase/functions/travel_capsule/index.ts`):**
- Remove the hardcoded `maxAiInput = Math.min(40, ...)` ceiling
- If `request.garmentSelection` is provided, for each category take the top N by pack-worthiness where N is the user's specified value
- If not provided, take all garments up to 150 (sorted by pack-worthiness if clamping is needed)
- No hardcoded category minimums anywhere

**Frontend loading text (`useTravelCapsule.ts`)**: Show the actual selected count:
> "Scanning {actualCount} of your {totalCount} garments"
where `actualCount` is the computed size of the selection (whether default or user-customized).

**Rationale for the default-collapsed panel:** most users never want to think about this. The default of "send everything" is the best experience for 95% of users. Power users who want to exclude items (e.g. "I have 80 t-shirts but only want to consider 15") get a clean interface to do so without any in-your-face UI noise by default.

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
No DB migration. The `result JSONB` column already exists on `travel_capsules`. The bug is a failed frontend insert + a second insert from the edge function that leaves `result` NULL.

1. **Edge function**: Remove the DB insert at `supabase/functions/travel_capsule/index.ts:1091-1107`. The edge function now just RETURNS the capsule; it does not write.
2. **Frontend hook (`useTravelCapsules.ts`)**: Becomes the single writer. Its `save` mutation must send **every** NOT NULL column the edge function used to send, plus `result`:
   - `destination`, `trip_type`, `duration_days`, `weather_min`, `weather_max`
   - `occasions`, `luggage_type`, `companions`, `style_preference`
   - `start_date`, `end_date`
   - `capsule_items`, `outfits`, `packing_list`, `packing_tips`, `total_combinations`, `reasoning`
   - `result` (full JSONB blob)
3. **`useTravelCapsule.handleGenerate`**: Pass the derived values (`duration_days`, `trip_type`, `weather_min/max`, packing-list from `result.capsule_items`, etc.) into the hook's `save` call.
4. **Restore path** (`TravelCapsule.tsx:handleSelectTrip`): Already correct; simply reads `trip.result` which will now be populated.

## Deploy plan

1. Deploy `travel_capsule` edge function (required for Fixes 2, 3, 6)
2. Merge and deploy frontend

No migration step. Order matters only weakly: if the frontend ships first, any saves that happen before the edge-function redeploy will still be saved via the hook (one row per capsule) — acceptable. If the edge function ships first, the old frontend will still save the capsule via the hook (but continue to fail for the missing NOT NULL columns until the frontend redeploys). Either ordering works; deploying the edge function first is cleaner because it eliminates the double-write immediately.

Per CLAUDE.md: deploy ONE function at a time, use the full command:
```
npx supabase functions deploy travel_capsule --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

## Files to change

**Frontend:**
- `src/components/travel/TravelStep1.tsx` — remove all `<Card>` wrappers, switch to section-header + divider layout (Fix 1)
- `src/components/travel/TravelStep2.tsx` — remove all `<Card>` wrappers (Fix 1), add the new collapsible "Customize selection" panel with per-category sliders (Fix 2)
- `src/components/travel/TravelWizard.tsx` — thread `garmentSelection` and `setGarmentSelection` props through to Step 2 (Fix 2)
- `src/components/travel/TravelResultsView.tsx` — action bar position (Fix 4), partial-result banner (Fix 3)
- `src/components/travel/CapsuleOutfitCard.tsx` — pass `hideTryButton={true}` (Fix 5)
- `src/components/chat/OutfitSuggestionCard.tsx` — add `hideTryButton` prop (Fix 5)
- `src/components/travel/useTravelCapsule.ts` — new `garmentSelection` state (Fix 2), include in edge function request body (Fix 2), honest loading text (Fix 2), save full `result` through the hook (Fix 6)
- `src/components/travel/types.ts` — extend request type with optional `garmentSelection` field (Fix 2), verify `TravelCapsuleRow` shape (Fix 6)
- `src/hooks/useTravelCapsules.ts` — ensure `result` is persisted as JSONB (Fix 6)
- `src/pages/TravelCapsule.tsx` — verify `handleSelectTrip` restores from JSONB `result` (Fix 6)

**New component (optional, can inline if short):**
- `src/components/travel/GarmentSelectionPanel.tsx` — the collapsible per-category slider panel from Fix 2. Keep it as its own file to avoid bloating TravelStep2.

**Edge function:**
- `supabase/functions/travel_capsule/index.ts` — remove hardcoded 40-cap and hardcoded category minimums (Fix 2), accept `garmentSelection` field in request body (Fix 2), apply 150-ceiling safety (Fix 2), deterministic fallback when AI returns zero outfits (Fix 3), remove the DB insert block at lines 1091-1107 (Fix 6)

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

1. **Fix 1 (card-less layout):** Open Travel Capsule wizard, observe:
   - No card backgrounds, borders, or shadows around form sections
   - Each section has an eyebrow label + its input
   - Sections separated by subtle `border-t border-border/40` dividers with generous top padding
   - Overall feel matches AddGarment / Settings pages (not a "card sandwich")
2. **Fix 2 — default behaviour:** Large wardrobe (100+ garments), generate a capsule without opening the Customize panel:
   - Loading text shows "Scanning {actual} of your {total} garments"
   - `actual` equals `total` when wardrobe ≤ 150
   - `actual` equals 150 when wardrobe > 150
   - Final outfits use a variety of categories
3. **Fix 2 — customize panel:** Open the Customize selection panel in Step 2:
   - Default expanded state is collapsed
   - Each category slider defaults to its full count
   - Dragging the "Tops" slider down updates the running total instantly
   - Reset button restores all sliders to defaults
   - Sum capped at 150 with the warning message when user tries to exceed
   - Edge function receives the customized counts and respects them (verify in Network tab or by checking final outfit composition)
4. **Fix 2 — empty categories:** User with zero shoes sees no Shoes slider in the panel (graceful handling)
5. **Fix 3:** Generate with a deliberately sparse wardrobe (5 tops, 2 bottoms, 1 shoe pair):
   - No hard error
   - Results screen shows whatever outfits WERE built
   - Banner above results lists the coverage gaps ("We built 3 of 5 days. Add more bottoms to unlock the rest.")
6. **Fix 4:** Results screen on iPhone Safari:
   - Action bar pinned to bottom of viewport, above safe area
   - Does not overlap outfit cards (content has sufficient paddingBottom)
   - Buttons reachable with one thumb on the bottom of the screen
7. **Fix 5:** Capsule results, tap an outfit card:
   - NO "Try this" button visible
   - Save-as-outfit / other existing buttons still render and work
8. **Fix 5 regression:** AI chat, send a style request, get an outfit suggestion:
   - "Try this" button still visible
   - Tapping it still creates the outfit as before
9. **Fix 6:** Generate a capsule, save, fully close PWA, reopen, select the saved trip from history:
   - All outfits, packing list, coverage_gaps, packing_tips, and reasoning restored
   - Customize selection state (if user adjusted it) also restored OR reset to defaults — see open question
10. **Fix 6 regression:** Existing saved trips (pre-migration) open without crashing, show destination/date only (graceful degradation, `result` is null)

**Automated:**
- `npx vitest run src/pages/__tests__/TravelCapsule.test.tsx`
- New tests: customize panel slider interaction, `garmentSelection` threading through `handleGenerate`, `hideTryButton` prop gating, partial-result banner rendering when `scheduledOutfits.length < requiredOutfits`
- `npx tsc --noEmit --skipLibCheck`
- `npx eslint src/ --ext .ts,.tsx --max-warnings 0`
- `npm run build` (must be warning-free)

## Open questions

Resolved by the user:
1. **DB migration** — approved (additive `result JSONB` column)
2. **Try-this button** — removed in capsule context, preserved in chat
3. **Garment cap** — no category caps; default sends ALL garments; 150 safety ceiling; user-controlled per-category sliders (refined in Fix 2)
4. **PR strategy** — one atomic PR covering all six fixes
5. **Wizard cards** — remove entirely, not merely restyle (refined in Fix 1)

Remaining micro-decisions (low-risk, resolvable at implementation time without blocking approval):
- **Slider granularity** — continuous slider vs. stepped (+1/-1 buttons). Recommended: native `<input type="range">` for simplicity and mobile-friendliness; if UX feedback requests, add stepper buttons later.
- **Restoring customize state on trip reopen** — when a saved trip is restored, should the Customize panel reflect the counts used for that capsule, or reset to defaults? Recommended: persist `garmentSelection` in the saved `result` JSONB so the exact generation context is reproducible; show the saved counts if the user edits the trip.
- **Exact Playfair section title size in the card-less layout** — Fix 1 uses `label-editorial` eyebrow but does not add Playfair section titles (form sections are self-explanatory from the eyebrow). Confirm during implementation that this reads cleanly vs. adding a larger Playfair header.

## Success criteria

- All six issues fixed as described, verifiable on device
- No regression in AI chat outfit card behaviour
- No regression in other pages using PageIntro / the shared Card component
- Production DB migration applied cleanly
- Edge function deployed without errors
- All existing tests pass; new test coverage for the partial-result banner and `hideTryButton` prop
