

# Fix: Loading Text Not Changing & Duplicate Outfits on Add to Plan

## Bug 1: Loading phase text stuck on "Analysing the weather"

**Root cause**: `travelLoadingPhases` is a plain array created on every render. The `simulatedProgress` state updates ~60fps via `requestAnimationFrame`, causing constant re-renders. Each re-render creates a new `phases` array reference, which triggers `AILoadingOverlay`'s `useEffect` to clear and restart its phase timer — so the timer never fires and the phase never advances.

**Fix in `src/pages/TravelCapsule.tsx` (line 146–152)**:
Wrap `travelLoadingPhases` in `useMemo` with `[t]` dependency:
```typescript
const travelLoadingPhases = useMemo(() => [
  { icon: Cloud, label: t('capsule.phase_weather'), duration: 10000 },
  { icon: Shirt, label: t('capsule.phase_wardrobe'), duration: 10000 },
  { icon: SlidersHorizontal, label: t('capsule.phase_styling'), duration: 20000 },
  { icon: Package, label: t('capsule.phase_packing'), duration: 0 },
], [t]);
```

## Bug 2: "Add to Plan" duplicates the first outfit

**Root cause**: In `handleAddToCalendar` (line 421–477), the code filters outfit items via `garmentMap.has(id)`. But `garmentMap` is built from `useGarmentsByIds(result?.capsule_items)` — a React Query hook that fetches asynchronously. If the garment data hasn't fully loaded or the IDs from the AI don't match exactly, only some items resolve, and the fallback logic may cause repeated identical outfit records.

Additionally, the code doesn't deduplicate outfits for the same day — if the AI returns multiple outfits for day 1, they all get inserted, which is correct. But if the `capsule_items` list from the AI contains duplicate IDs or the outfit items overlap heavily, it looks like duplication.

**Fix in `src/pages/TravelCapsule.tsx` — `handleAddToCalendar`**:

1. **Fetch garments directly** instead of relying on `garmentMap` (which may not be populated):
```typescript
const handleAddToCalendar = async () => {
  if (!result || !dateRange?.from) return;
  setIsAddingToCalendar(true);
  try {
    const userId = (await supabase.auth.getUser()).data.user!.id;

    // Fetch all capsule garments directly to avoid stale garmentMap
    const { data: freshGarments } = await supabase
      .from('garments')
      .select('id, category')
      .in('id', result.capsule_items)
      .eq('user_id', userId);
    
    const freshMap = new Map((freshGarments || []).map(g => [g.id, g]));
    
    // Track created outfit IDs to avoid duplicates
    const createdOutfitKeys = new Set<string>();

    for (const capsuleOutfit of result.outfits) {
      // Deduplicate by day+items fingerprint
      const key = `${capsuleOutfit.day}-${capsuleOutfit.items.sort().join(',')}`;
      if (createdOutfitKeys.has(key)) continue;
      createdOutfitKeys.add(key);

      const outfitDate = format(addDays(dateRange.from!, capsuleOutfit.day - 1), 'yyyy-MM-dd');
      const validItems = capsuleOutfit.items.filter(id => freshMap.has(id));
      if (validItems.length === 0) continue;

      // ... rest of outfit creation logic stays the same but uses freshMap
    }
    // ... rest unchanged
  }
};
```

2. **Use `freshMap`** instead of `garmentMap` for slot resolution inside the loop.

## Files Changed
- `src/pages/TravelCapsule.tsx` — two changes: memoize phases array, fix handleAddToCalendar to use fresh garment data and deduplicate

