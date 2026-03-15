

# Outfit Completeness Enforcement

## Problem

The `buildCombos` function in `burs_style_engine` already builds combos with either (top + bottom + shoes) or (dress + shoes), plus optional outerwear/accessories. However:

1. **No post-generation completeness validation** — if garment lookups fail or the AI picks an index where items got filtered out, incomplete outfits can slip through
2. **The client-side check is too weak** — `useOutfitGenerator.ts` only checks `selectedItems.length < 2`, so `pants + shoes + jacket` (3 items, no top) passes
3. **Outerwear is never required** — even when `needsOuterwear=true` in `buildCombos`, the outerwear slot is tried but if no outerwear exists, combos without it still pass
4. **No explicit "vest is not a top" rule** — a vest could be categorized as a top and serve as the only upper-body garment
5. **No weather-required outerwear enforcement** — cold/rainy combos without outerwear get scored lower but are still valid candidates

## Changes

### 1. `supabase/functions/burs_style_engine/index.ts` — Add completeness helpers and enforce them

Add three exported-style helpers near the slot categorization section (~line 1247):

- `isCompleteOutfit(items: ComboItem[], weather: WeatherInput): { complete: boolean; missing: string[] }` — checks that every combo has either (top + bottom + shoes) or (dress + shoes). If weather requires outerwear (`temp < 8` or rain/snow), outerwear becomes required too.
- `requiresOuterwear(weather: WeatherInput): boolean` — returns true if temp < 8°C or precipitation is rain/snow.
- Vest rule: add `"vest"` and `"väst"` to `OUTERWEAR_CATS` (they are already there at line 1233 — verify and keep). Ensure vest is NOT in `TOP_CATS`. Currently vest IS in outerwear cats, so this is already correct.

Apply completeness filter in `buildCombos` (after line 2026 where `pushCombo` is called):
- Before pushing a combo, validate it with `isCompleteOutfit`. Skip invalid combos.
- This ensures only complete outfits enter the scoring/ranking pipeline.

Apply completeness filter after AI refinement (lines 3290-3306):
- After the AI picks a combo index, validate the chosen combo. If incomplete (e.g. garment lookup failed), fall back to the next complete combo.

Update the "Not enough matching garments" error to include `explainMissingRequiredSlots()` — returns human-readable strings like "Missing a top to complete the outfit" or "No shoes available".

### 2. `src/hooks/useOutfitGenerator.ts` — Strengthen client-side validation

Replace the weak `selectedItems.length < 2` check with a proper completeness check:

```typescript
function isCompleteOutfitClient(items: { slot: string }[]): boolean {
  const slots = new Set(items.map(i => i.slot));
  const hasStandard = slots.has('top') && slots.has('bottom') && slots.has('shoes');
  const hasDress = slots.has('dress') && slots.has('shoes');
  return hasStandard || hasDress;
}
```

If the engine returns an incomplete outfit, throw with a descriptive message explaining what's missing.

### 3. `src/lib/__tests__/engineEvalHarness.test.ts` — Add completeness assertions

Add a new `describe('Outfit completeness')` block with tests:
- `pants + shoes + jacket` is rejected (no top)
- `top + bottom + shoes` is accepted
- `dress + shoes` is accepted
- `dress` without shoes is rejected
- Cold weather outfit without outerwear is rejected when outerwear is required
- Vest counts as outerwear, not as top

### 4. `src/hooks/__tests__/useOutfitGenerator.test.tsx` — Add client-side completeness test

Add a test that verifies the generator rejects an engine response with `bottom + shoes + outerwear` (no top/dress).

### 5. Weather-required outerwear logic

In `buildCombos`, change the `needsOuterwear` logic:
- Current: `needsOuterwear = (temp < 15) || wet` — this makes outerwear optional even when "needed" (it just tries outerwear options first)
- New: When `temp < 8 || wet`, mark outerwear as **required** — combos without outerwear are filtered out by `isCompleteOutfit`
- When `8 <= temp < 15`, outerwear stays optional (preferred but not required)

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/burs_style_engine/index.ts` | Add `isCompleteOutfit`, `requiresOuterwear`, `explainMissingRequiredSlots`; filter combos in `buildCombos`; validate after AI pick |
| `src/hooks/useOutfitGenerator.ts` | Replace `length < 2` with `isCompleteOutfitClient`; descriptive error messages |
| `src/lib/__tests__/engineEvalHarness.test.ts` | Add completeness test scenarios |
| `src/hooks/__tests__/useOutfitGenerator.test.tsx` | Add incomplete outfit rejection test |

## What Does NOT Change

- Swap mode is explicitly partial — it only returns candidates for a single slot, so completeness rules don't apply
- Suggest mode uses the same `buildCombos` pipeline, so it automatically benefits from the completeness filter
- No UI changes — the engine simply stops producing incomplete outfits
- No new dependencies
- Existing scoring weights, dedup, and AI refinement logic stay intact

