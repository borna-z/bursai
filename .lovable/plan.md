

# Fix: One-time unlock celebration

## Problem

`useUnlockCelebration` uses a ref (`prevCountRef`) to track the previous garment count. On every app load:
1. First render: `garmentCount` is `undefined` → `currentCount = 0`, ref set to `0`
2. Query resolves: `currentCount = 6` → ref was `0`, so milestone 5 appears "newly crossed"

This means every page load re-triggers the celebration toast for already-seen milestones.

## Fix

Persist celebrated milestones in `localStorage`. Instead of comparing prev vs current count, check if the milestone has already been celebrated.

### Changes to `src/hooks/useWardrobeUnlocks.ts`

In `useUnlockCelebration()`:
1. Read a `burs_celebrated_milestones` key from localStorage (stores an array of numbers, e.g. `[5, 10]`)
2. When garment count resolves, find milestones where `currentCount >= m` but `m` is NOT in the celebrated set
3. If any new milestones found, show the toast, then write the updated set back to localStorage
4. Keep the ref-based guard to avoid firing on the very first render (when count is still 0), but remove the "prev < m" logic entirely — localStorage is the source of truth

```ts
const CELEBRATED_KEY = 'burs_celebrated_milestones';

function getCelebrated(): number[] {
  try { return JSON.parse(localStorage.getItem(CELEBRATED_KEY) || '[]'); }
  catch { return []; }
}

function setCelebrated(milestones: number[]) {
  localStorage.setItem(CELEBRATED_KEY, JSON.stringify(milestones));
}
```

In the effect:
- Skip if `garmentCount` is still `undefined` (query loading)
- Compare `MILESTONES` against `getCelebrated()`
- Fire toast only for uncelebrated milestones where `currentCount >= m`
- Persist immediately after showing

**1 file changed.** No UI, routing, or feature logic changes.

