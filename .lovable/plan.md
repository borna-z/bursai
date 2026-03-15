

## Plan: Replace wardrobe validation with subcategory-aware logic

**File**: `src/hooks/useOutfitGenerator.ts`

### Changes

1. **Replace `INSUFFICIENT_GARMENTS_MESSAGE`** (line 36) with the new message text.

2. **Replace `validateWardrobeForGeneration()`** (lines 42-58) with the new implementation that:
   - Fetches `category` and `subcategory` columns (instead of just `category`)
   - Removes the `.in('category', [...])` filter so all garments are fetched
   - Normalizes `category + subcategory` into a single string
   - Checks for tops, bottoms, shoes, and dresses using keyword lists (including Swedish terms)
   - Validates both wardrobe paths: top+bottom+shoes OR dress+shoes

3. **Update tests** in `src/hooks/__tests__/useOutfitGenerator.test.tsx` to match the new query shape — the mock chain no longer uses `.in()` for validation; it just uses `.select().eq()` returning objects with `{ category, subcategory }`.

