

# Remove All Scroll Lists

## What Changes

Replace every scrolling list container across all pages with simple, flat layouts that show content directly without scroll containers.

### 1. LinkImportForm -- Remove ScrollArea

Replace the `ScrollArea` (fixed 200px height) with a simple `div` that shows all items inline. Remove the `h-[200px]` constraint so items just stack naturally.

### 2. OutfitDetail -- SwapSheet candidates

Replace the `ScrollArea` inside the swap sheet with a plain `div space-y-2` layout. The sheet itself already scrolls via its built-in behavior, so the nested ScrollArea is redundant.

### 3. PlanningSheet -- Outfit selection

Replace `overflow-y-auto` on the outfit list container with a plain stacking layout. The sheet content handles its own scroll.

### 4. Insights page -- Garment lists

The "Top 5 worn" and "Unused garments" sections already show limited items (max 5), so they are just vertical stacks -- no scroll container. These are fine as-is, no changes needed.

### 5. Outfits page -- Outfit cards

Already uses `space-y-3` stacking with no scroll container. Fine as-is.

### 6. WeekStrip -- Keep as-is

The horizontal day strip is navigation, not a list. Keeping `overflow-x-auto` for the 7-day strip is standard mobile UX and not a "scroll list".

## Technical Details

| File | Change |
|------|--------|
| `src/components/LinkImportForm.tsx` | Replace `ScrollArea` with plain `div`, remove fixed height |
| `src/pages/OutfitDetail.tsx` | Replace `ScrollArea` with plain `div` in SwapSheet |
| `src/components/plan/PlanningSheet.tsx` | Remove `overflow-y-auto` from outfit list container |

Three small edits. No new files. No logic changes.
