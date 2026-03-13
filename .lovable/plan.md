

# Smart Dynamic Token Limits Across All Edge Functions

## Approach

Instead of hardcoded `max_tokens` in every edge function, add a **smart token estimation** utility to `burs-ai.ts` that calculates tokens based on the actual prompt size and expected output. Each function will pass context hints (like item count, wardrobe size) and the shared layer auto-scales.

## Changes

### 1. Add `estimateMaxTokens()` helper to `supabase/functions/_shared/burs-ai.ts`

Add a new exported function and update `resolveMaxTokens`:

```typescript
export function estimateMaxTokens(opts: {
  inputItems?: number;    // e.g. garment count, event count
  outputItems?: number;   // e.g. expected outfit/item count
  perItemTokens?: number; // tokens per output item (default 60)
  baseTokens?: number;    // base overhead (default 150)
  cap?: number;           // max cap (default 4096)
}): number {
  const base = opts.baseTokens ?? 150;
  const perItem = opts.perItemTokens ?? 60;
  const items = opts.outputItems ?? Math.ceil((opts.inputItems ?? 5) * 0.6);
  return Math.min(base + items * perItem, opts.cap ?? 4096);
}
```

Also update `resolveMaxTokens` to bump the defaults:
- `trivial: 300` → keep
- `standard: 600` → keep  
- `complex: 1200` → keep

These are fine as fallbacks; the smart estimation replaces hardcoded overrides.

### 2. Update edge functions to use dynamic tokens

Replace static `max_tokens` with `estimateMaxTokens()` calls:

| Function | Current | New Logic |
|---|---|---|
| `generate_outfit` | 300 | `estimateMaxTokens({ outputItems: validItems expected ~5, perItemTokens: 40, baseTokens: 120 })` ≈ 320 |
| `burs_style_engine` | 200/500 | Scale by mode: generate=200, suggest=`est({outputItems: candidateCount})` |
| `suggest_outfit_combinations` | 500 | `est({outputItems: 3, perItemTokens: 100})` ≈ 450 |
| `clone_outfit_dna` | 500 | `est({outputItems: 3, perItemTokens: 120})` ≈ 510 |
| `mood_outfit` | 300 | `est({outputItems: 5, perItemTokens: 40})` ≈ 350 |
| `wardrobe_gap_analysis` | 600 | `est({inputItems: garments.length, outputItems: Math.ceil(garments.length/10)})` |
| `smart_shopping_list` | 600 | `est({outputItems: 6, perItemTokens: 80})` ≈ 630 |
| `wardrobe_aging` | 500 | `est({inputItems: garments.length, perItemTokens: 50})` |
| `suggest_accessories` | 300 | `est({outputItems: 3, perItemTokens: 60})` ≈ 330 |
| `prefetch_suggestions` | 400 | `est({outputItems: 3, perItemTokens: 80})` ≈ 390 |
| `summarize_day` | 500 | `est({inputItems: events.length, perItemTokens: 80, baseTokens: 200})` |
| `visual_search` | 600 | `est({inputItems: garments.length, outputItems: 5, perItemTokens: 80})` |
| `travel_capsule` | already dynamic | keep existing logic, refactor to use `estimateMaxTokens` |
| `style_twin` | 400 | keep (simple, fixed output) |
| `detect_duplicate` | 200 | keep (trivial yes/no) |
| `assess_condition` | 200 | keep (trivial) |
| `outfit_photo_feedback` | 300 | keep (fixed structure) |
| `style_chat` / `shopping_chat` | 1000 | keep (streaming, needs headroom) |

### Files to edit
- `supabase/functions/_shared/burs-ai.ts` — add `estimateMaxTokens` export
- `supabase/functions/burs_style_engine/index.ts` — dynamic tokens for suggest/swap modes
- `supabase/functions/generate_outfit/index.ts` — scale by garment count
- `supabase/functions/suggest_outfit_combinations/index.ts` — scale by output
- `supabase/functions/wardrobe_gap_analysis/index.ts` — scale by wardrobe size
- `supabase/functions/smart_shopping_list/index.ts` — scale by wardrobe size
- `supabase/functions/wardrobe_aging/index.ts` — scale by garment count
- `supabase/functions/mood_outfit/index.ts` — scale by garment count
- `supabase/functions/clone_outfit_dna/index.ts` — scale by variation count
- `supabase/functions/suggest_accessories/index.ts` — scale by accessory count
- `supabase/functions/summarize_day/index.ts` — scale by event count
- `supabase/functions/visual_search/index.ts` — scale by garment count
- `supabase/functions/prefetch_suggestions/index.ts` — scale by garment count
- `supabase/functions/travel_capsule/index.ts` — refactor to use shared helper

