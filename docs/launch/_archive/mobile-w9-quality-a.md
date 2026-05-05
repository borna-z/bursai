# Mobile Launch — M9 — Quality A: GarmentDetail Outfits + Similar tabs, StyleChat memory edit

**Goal:** Wire two GarmentDetail tabs (Outfits / Similar) using existing web hooks, port StyleChat's real memory facts (replace MEMORY_FACTS hardcode), and ship inline memory editing via `memory_ingest`.

**Status:** 🔜 TODO
**Branch:** `mobile-w9-quality-a`
**PR count:** 1
**Depends on:** M0
**Complexity:** M

---

## Files touched

**New:**
- `mobile/src/hooks/useGarmentOutfitHistory.ts` (port from `src/hooks/useGarmentOutfitHistory.ts`)
- `mobile/src/hooks/useSimilarGarments.ts` (port from `src/hooks/useSimilarGarments.ts`)
- `mobile/src/hooks/useStyleMemoryFacts.ts` (new — read `user_style_summaries` for the user)
- `mobile/src/hooks/useRecordMemoryEvent.ts` (port from web — write via `memory_ingest`)

**Modified:**
- `mobile/src/screens/GarmentDetailScreen.tsx` — Outfits and Similar tabs render hooks output instead of empty placeholders
- `mobile/src/screens/StyleChatScreen.tsx` — L58-62 (replace MEMORY_FACTS hardcode with `useStyleMemoryFacts` data) + L205 (replace Coming-soon Alert with inline edit modal calling `useRecordMemoryEvent`)

**Tracker (same PR):** standard.

---

## Code skeletons

**Full verbatim — port directly from web:**
- `src/hooks/useGarmentOutfitHistory.ts` (joins `outfit_items` + `outfits`, query key `['garment-outfit-history', garmentId]`)
- `src/hooks/useSimilarGarments.ts` (filters `garments` by category + color, query key `['similar-garments', garmentId]`)
- web's `memory_ingest` caller pattern (mutation-only hook, no cache key)

For `useStyleMemoryFacts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function useStyleMemoryFacts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['style-memory-facts', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_style_summaries')
        .select('summary, facts, updated_at')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}
```

For inline memory edit in StyleChat L205: open a small modal sheet, present the user's current `facts` array, allow add/remove/edit, on save call `useRecordMemoryEvent` with the diff. Invalidate `['style-memory-facts']` on success.

---

## Acceptance gates

```bash
cd mobile && npx tsc --noEmit
```
0 errors.

**Manual smoke test:**
1. GarmentDetail → Outfits tab: shows real outfits the garment is in (or empty state if none).
2. Similar tab: shows up to 8 similar garments by category + color.
3. StyleChat: open chat, see real memory facts (not "You wear black often. ..." hardcode).
4. Tap edit icon next to a fact → modal → edit → save → fact updated. Verify in `user_style_summaries`.

**Code-reviewer subagent:** mandatory.

---

## PR template

**Title:** `feat(mobile): M9 — GarmentDetail tabs + StyleChat real memory + inline edit`

**Body:** Problem (two tabs empty, memory hardcoded, edit Coming-soon). Fix (4 ports from web + screen wiring). Verification above. Out of scope: memory recall analytics, weighted facts (post-launch).

---

## Tracker updates: M9 → DONE, pointer → M10.
