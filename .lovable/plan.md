

## Fix Garment Swapping -- RLS Policy + Bug Fixes

### Root Cause
The `outfit_items` table is missing an **UPDATE** RLS policy. When the swap button is pressed, the code calls `supabase.from('outfit_items').update(...)` which silently fails because there's no policy allowing updates. The toast still fires "Garment swapped!" because the Supabase client doesn't throw an error for zero-row updates -- it just updates nothing.

### What changes

#### 1. Add UPDATE RLS policy on `outfit_items`
Create a migration that adds an UPDATE policy so users can update their own outfit items (same pattern as the existing DELETE/INSERT policies -- check that the parent outfit belongs to the user).

```sql
CREATE POLICY "Users can update own outfit items"
  ON public.outfit_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM outfits
    WHERE outfits.id = outfit_items.outfit_id
    AND outfits.user_id = auth.uid()
  ));
```

#### 2. Fix swap mutation error handling
Update `useSwapGarment.ts` so the mutation checks if the update actually affected a row. If not, throw an error so the toast shows the correct message.

#### 3. Fix `fetchCandidates` to not return empty silently
When `SLOT_CATEGORIES[slot]` returns undefined (e.g. if a future slot like "dress" is used), fall back to using the slot name as the category directly instead of returning an empty array.

#### 4. Fix console warnings in `OutfitSuggestionCard`
The `LazyImageSimple` and `Popover` components are getting ref warnings. Wrap with `forwardRef` or remove unnecessary ref passing.

### Technical details

**Database migration:**
- Add UPDATE policy on `outfit_items` matching the existing ownership pattern (join to `outfits` table to verify `user_id = auth.uid()`)

**Modified: `src/hooks/useSwapGarment.ts`**
- Add fallback in `fetchCandidates`: if `SLOT_CATEGORIES[slot]` is undefined, use `[slot]` as the category array
- In the swap mutation, check `data` count or use `.select()` to verify the update went through

**Modified: `src/components/chat/OutfitSuggestionCard.tsx`**
- Fix `LazyImageSimple` ref warning by not passing ref-dependent props through Popover

### Files summary
1. **Database migration** -- add UPDATE RLS policy on `outfit_items`
2. `src/hooks/useSwapGarment.ts` -- fix fallback for unknown slots, better error handling
3. `src/components/chat/OutfitSuggestionCard.tsx` -- fix console ref warnings
