

# Quality Pass — 5 Parts

This is a large but well-scoped refactor across ~15 files. No UI, routing, or feature logic changes.

## Part 1 — Migrate raw `supabase.functions.invoke()` to `invokeEdgeFunction`

Each file below has one or more `supabase.functions.invoke(...)` calls that need replacing with `invokeEdgeFunction(...)` from `@/lib/edgeFunctionClient`. The key difference: `invokeEdgeFunction` returns `{ data, error }` with built-in timeout/retry, and accepts `body` as an object (not stringified).

| File | Function(s) to migrate | Notes |
|---|---|---|
| `src/hooks/useLiveScan.ts` (line 74) | `analyze_garment` | Default timeout fine |
| `src/hooks/useDuplicateDetection.ts` (line 33) | `detect_duplicate_garment` | Default timeout fine |
| `src/hooks/useSwapGarment.ts` (line 41) | `burs_style_engine` | Default timeout fine |
| `src/hooks/useCalendarSync.ts` (lines 67, 87, 179, 194) | `calendar`, `google_calendar_auth` | The Google sync mutation (line 87) has complex error body parsing for reconnect — preserve that logic but adapt to `invokeEdgeFunction` response shape |
| `src/hooks/usePushNotifications.ts` (line 82) | `get_vapid_public_key` | Simple call |
| `src/hooks/usePhotoFeedback.ts` (line 62) | `outfit_photo_feedback` | Default timeout fine |
| `src/pages/MoodOutfit.tsx` (line 45) | `mood_outfit` | Use `timeout: 45000` |
| `src/pages/UnusedOutfits.tsx` (line 61) | `burs_style_engine` | Default timeout fine (called in a loop, retries per-call) |
| `src/components/onboarding/QuickUploadStep.tsx` (line 90) | `analyze_garment` | Non-blocking, wrapped in try/catch already |

**Pattern change:**
```ts
// Before
const { data, error } = await supabase.functions.invoke('fn_name', { body: { ... } });

// After
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
const { data, error } = await invokeEdgeFunction('fn_name', { body: { ... } });
```

Special case for `useCalendarSync.ts`: The Google sync mutation reads `error.context.body` for reconnect signals. With `invokeEdgeFunction`, errors are normalized — we need to handle the reconnect detection differently (check if the error message contains "reconnect" or check the data payload).

## Part 2 — Wire StaleIndicator to AI-generated content

### `src/components/insights/AISuggestions.tsx`
- Import `StaleIndicator` from `@/components/ui/StaleIndicator`
- The `useAISuggestions` hook uses `useQuery` — access `dataUpdatedAt` from the query result (it's a timestamp in ms, convert to ISO string)
- Place `<StaleIndicator>` inline next to the header title (inside the flex row with the sparkles icon)
- `onRefresh` calls `refetch()`

### `src/components/discover/WardrobeGapSection.tsx`
- The gap analysis is a mutation, not a query — track the timestamp via local state (`useState<string | null>`) set when results arrive
- Place `<StaleIndicator>` next to the section title in the results view

### `src/components/home/InsightsBanner.tsx`
- `useInsights` returns a `useQuery` result — access `dataUpdatedAt`
- Place `<StaleIndicator>` inline next to the "Wardrobe Usage" text

## Part 3 — Type safety: eliminate `as any` casts

### `src/hooks/useOutfits.ts`
- The `data as unknown as OutfitWithItems[]` cast is needed because Supabase's typed response for joined queries doesn't match our interface. Define nothing new — the cast is acceptable here since the shape is correct. **However**, add `feedback` and `weather` as optional typed fields on `OutfitWithItems`:
```ts
export interface OutfitWithItems extends Outfit {
  outfit_items: (OutfitItem & { garment: Tables<'garments'> })[];
  feedback?: string[];
  weather?: { temp?: number; condition?: string; precipitation?: string; wind?: string } | null;
}
```

### `src/pages/OutfitDetail.tsx`
- Replace `(outfit as any)?.feedback` with `outfit?.feedback` and `(outfit as any).weather` with `outfit.weather` — possible once the interface is updated above
- Line 193: `{ feedback: newFeedback } as any` — cast to `TablesUpdate<'outfits'>` (feedback is already a column)

### `src/hooks/useSubscription.ts`
- `data as unknown as Subscription` — the `Subscription` interface already matches the DB shape. Keep the cast but change to a cleaner form: map fields explicitly or just keep `as unknown as Subscription` (it's already typed, the cast is due to Supabase generic mismatch). **Leave as-is** since the type already matches — the instruction says "map explicitly" but there's no actual type mismatch, just a generic boundary.

### `src/pages/PublicProfile.tsx`
- `.from('public_profiles' as any)` — `public_profiles` is a view that's already in `types.ts` (the schema shows it). Check if it's typed. Looking at the types summary, `public_profiles` is listed as a View. So remove `as any` and use `.from('public_profiles')` directly.

### `src/hooks/usePhotoFeedback.ts`
- `(supabase as any).from('outfit_feedback')` — `outfit_feedback` is a table in the schema. Check if it's in the types. Yes, it is. Remove `as any` and use `supabase.from('outfit_feedback')` directly.

## Part 4 — Progressive loading messages

### `src/pages/MoodOutfit.tsx`
- Add local state `loadingPhase` and a `useEffect` with two `setTimeout`s (5s → "Still thinking...", 15s → "Almost there...")
- Clear timeouts on `isGenerating` becoming false or unmount
- Show as `<p className="text-muted-foreground text-[12px]">` below the generating badge

### `src/pages/TravelCapsule.tsx`
- Same pattern — find the loading/generating spinner area and add a timed message below it
- Already uses `invokeEdgeFunction` with 45s timeout, so the progressive message is relevant

## Part 5 — ESLint no-console rule

### `eslint.config.js`
- Add `'no-console': ['warn', { allow: ['warn', 'error'] }]` to the rules object

---

## Execution order

1. **Parts 3 + 5** (type fixes + ESLint) — no dependencies
2. **Part 1** (migrate edge function calls) — independent
3. **Part 2** (StaleIndicator wiring) — after Part 1 for consistency
4. **Part 4** (progressive loading) — after Part 1 since MoodOutfit gets migrated

**Files touched (17 total):**
- `src/hooks/useLiveScan.ts`
- `src/hooks/useDuplicateDetection.ts`
- `src/hooks/useSwapGarment.ts`
- `src/hooks/useCalendarSync.ts`
- `src/hooks/usePushNotifications.ts`
- `src/hooks/usePhotoFeedback.ts`
- `src/hooks/useOutfits.ts`
- `src/hooks/useSubscription.ts`
- `src/pages/MoodOutfit.tsx`
- `src/pages/UnusedOutfits.tsx`
- `src/pages/TravelCapsule.tsx`
- `src/pages/OutfitDetail.tsx`
- `src/pages/PublicProfile.tsx`
- `src/components/insights/AISuggestions.tsx`
- `src/components/discover/WardrobeGapSection.tsx`
- `src/components/home/InsightsBanner.tsx`
- `src/components/onboarding/QuickUploadStep.tsx`
- `eslint.config.js`

