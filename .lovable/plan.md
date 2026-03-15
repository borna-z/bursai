

## Plan: Patch `handleOpenSwap()` in OutfitDetail.tsx

**File**: `src/pages/OutfitDetail.tsx`

### Change

Replace lines 160–175 (the current `handleOpenSwap` function) with the user's provided version. Key differences from current code:

1. **`otherItems`** — drops the `&& item.garment` filter (includes all other items regardless of whether garment relation loaded)
2. **`normalizedWeather`** — always produces an object (never `undefined`), falls back to `currentWeather` from `useWeather()` hook when outfit weather fields are missing, defaults precipitation to `'none'` and wind to `'low'`
3. **`occasion`** — defaults to `'vardag'` instead of passing `undefined`
4. **`fetchCandidates` call** — unchanged shape, just better data

No other changes needed. The `OutfitWeather` type, `currentWeather`, and `useWeather` import are all already present.

