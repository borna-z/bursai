
# DRAPE Deep Audit — Step 4/4: Bugs, Performance & Data Efficiency

## Critical Bugs Found

| # | Area | Issue | Severity |
|---|------|-------|----------|
| 1 | **Weather polling** | `useWeather` uses `refetchInterval: 3000` (every 3 seconds!) and `staleTime: 2000`. This fires a network request to Open-Meteo API every 3s on every screen that uses weather. Massive waste, potential rate-limiting. | **Critical** |
| 2 | **N+1 in useMarkOutfitWorn** | Loops over `garmentIds` sequentially, making 3 DB calls per garment (SELECT + UPDATE garment + UPSERT wear_log). For 5 garments = 15 sequential queries. | **High** |
| 3 | **GarmentDetail.tsx** | Still has `active:animate-press` on 2 buttons (missed in Steps 2-3) | **Low** |
| 4 | **Wardrobe search** | No debounce on search input — each keystroke triggers a full re-render + query recomputation with client-side filter | **Medium** |
| 5 | **useGarments** | No `staleTime` configured — refetches on every mount/focus. With 300+ garments this is heavy | **Medium** |
| 6 | **useInsights** | Fetches ALL garments (`select *`) + ALL wear logs without pagination. For large wardrobes (300+) this is inefficient | **Medium** |
| 7 | **useOutfits** | Fetches ALL outfits with nested joins (outfit_items + garments) without limit. Could be 100+ outfits with 500+ items | **Medium** |
| 8 | **OutfitGenerate** | Weather condition strings in `useWeather.ts` are hardcoded Swedish ("Klart", "Molnigt", "Regn", etc.) and never i18n'd | **Low** |

## Performance Optimizations

### 1. Fix weather polling (Critical)

**File: `src/hooks/useWeather.ts`**

Change from:
```
refetchInterval: 3000,    // every 3 seconds!
staleTime: 2000,
```
To:
```
refetchInterval: 5 * 60 * 1000,   // every 5 minutes
staleTime: 3 * 60 * 1000,         // 3 minutes
```

Weather doesn't change every 3 seconds. 5-minute polling is more than sufficient and reduces API calls by 100x.

### 2. Fix N+1 in useMarkOutfitWorn

**File: `src/hooks/useOutfits.ts`**

Replace the sequential `for` loop (lines 196-239) with batch operations:
- Single SELECT to get all garment wear_counts at once
- Single batch UPDATE for all garments using individual updates in Promise.all
- Single batch INSERT for all wear_logs

This reduces ~15 sequential queries to ~3 parallel ones.

### 3. Add debounce to Wardrobe search

**File: `src/pages/Wardrobe.tsx`**

Add a debounced search value using a simple `useEffect` with `setTimeout`:
- `search` state for immediate input display
- `debouncedSearch` state (300ms delay) passed to `useGarments` as the actual filter
- This prevents the garment list from recomputing on every keystroke

### 4. Add staleTime to heavy queries

**File: `src/hooks/useGarments.ts`**
- Add `staleTime: 2 * 60 * 1000` (2 minutes) to `useGarments` query
- Add `staleTime: 5 * 60 * 1000` (5 minutes) to `useGarmentCount` query

**File: `src/hooks/useOutfits.ts`**
- Add `staleTime: 2 * 60 * 1000` to `useOutfits` query
- Add `staleTime: 60 * 1000` to `useOutfit` query

**File: `src/hooks/useInsights.ts`**
- Add `staleTime: 5 * 60 * 1000` to insights query (data is aggregated, doesn't need to be live)

**File: `src/hooks/useProfile.ts`**
- Add `staleTime: 10 * 60 * 1000` (profile rarely changes)

### 5. Remove remaining `active:animate-press`

**File: `src/pages/GarmentDetail.tsx`**
- Line 84: Remove from edit button
- Line 173: Remove from mark worn button

### 6. Add pagination to useOutfits

**File: `src/hooks/useOutfits.ts`**
- Add `.limit(50)` to the outfits query to prevent loading hundreds of outfits with full nested joins
- The Outfits page already only shows 10 recent ones, so 50 is a safe ceiling

### 7. Weather condition i18n

**File: `src/hooks/useWeather.ts`**
- Keep the hardcoded Swedish condition names as-is (they're used internally, not displayed directly in most places)
- The `WeatherWidget` already handles display logic
- This is low priority and can be deferred

## Security Sanity Check (all pass)

| Check | Status |
|-------|--------|
| RLS on all user tables (garments, outfits, profiles, etc.) | All have `auth.uid() = user_id` policies |
| Storage bucket `garments` is private | Yes, signed URLs only |
| Edge functions verify auth header | Yes, all check `authorization` header |
| `stripe_events` table locked down | Yes, deny-all policy |
| `subscriptions` table read-only for clients | Yes, deny insert/update/delete |
| Marketing tables (leads, events) allow public INSERT only | Intentional, acceptable |
| No raw SQL execution in edge functions | Confirmed |

## Implementation Summary

| Change | File(s) | Impact |
|--------|---------|--------|
| Weather polling: 3s to 5min | `useWeather.ts` | 100x fewer API calls |
| Batch mark-worn queries | `useOutfits.ts` | 15 queries to ~3 |
| Debounced search | `Wardrobe.tsx` | Fewer re-renders on type |
| Add staleTime to 5 hooks | 5 hook files | Fewer unnecessary refetches |
| Remove animate-press | `GarmentDetail.tsx` | Consistent motion |
| Limit outfits query | `useOutfits.ts` | Prevent large payload |

## Technical Details

### Weather fix (useWeather.ts, lines 119-121)
```typescript
refetchInterval: 5 * 60 * 1000,  // 5 minutes
staleTime: 3 * 60 * 1000,        // 3 minutes
gcTime: 10 * 60 * 1000,          // 10 minutes
```

### Debounced search (Wardrobe.tsx)
```typescript
const [search, setSearch] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(search), 300);
  return () => clearTimeout(timer);
}, [search]);

// Pass debouncedSearch to useGarments instead of search
```

### Batch mark-worn (useOutfits.ts)
Replace sequential for-loop with:
1. `Promise.all` for garment SELECT queries
2. `Promise.all` for garment UPDATE queries  
3. Single batch INSERT for wear_logs

### staleTime additions
```typescript
// useGarments: staleTime: 2 * 60 * 1000
// useGarmentCount: staleTime: 5 * 60 * 1000
// useOutfits: staleTime: 2 * 60 * 1000
// useOutfit: staleTime: 60 * 1000
// useInsights: staleTime: 5 * 60 * 1000
// useProfile: staleTime: 10 * 60 * 1000
```

### Outfits query limit
```typescript
// Add .limit(50) to useOutfits query
```

Total: ~8 files modified, 0 new dependencies, 0 schema changes.
