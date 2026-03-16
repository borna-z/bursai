

## Problem

When adding garments from the photo library (AddGarment page), the saved garment record is **missing key AI fields** that Live Scan saves:

| Field | Live Scan | Add from Library |
|-------|-----------|-----------------|
| `ai_raw` | Saved | **Not saved** |
| `ai_analyzed_at` | Saved | **Not saved** |
| `ai_provider` | Saved | **Not saved** |
| Stage 2 enrichment | Triggered | **Never triggered** |

This means library-added garments never get the rich enrichment data (silhouette, visual weight, texture, layering role, versatility score) that powers the intelligence system.

## Fix

**File: `src/pages/AddGarment.tsx`**

1. **Store `ai_raw` and `ai_provider` from analysis result** — the `analyzeGarment` call already returns these fields via `ai_raw` and `ai_provider` in the response, and they're stored in the `aiAnalysis` state. The `handleSave` function just never includes them in the insert.

2. **Add `ai_analyzed_at`, `ai_provider`, `ai_raw`** to the `createGarment.mutateAsync()` call in `handleSave`:
   ```typescript
   ai_analyzed_at: new Date().toISOString(),
   ai_provider: aiAnalysis?.ai_provider || 'unknown',
   ai_raw: (aiAnalysis?.ai_raw ?? null),
   ```

3. **Trigger Stage 2 enrichment after save** — after the garment is successfully inserted, call the `analyze_garment` edge function with `mode: 'enrich'` in the background (same as `backgroundGarmentSave.ts` does), then merge the enrichment result into the garment's `ai_raw` via an update.

   Import `invokeEdgeFunction` (already available) and add a fire-and-forget enrichment call after successful save, reusing the same pattern from `backgroundGarmentSave.ts`.

4. **Apply same fix to BatchUploadProgress** — `src/components/wardrobe/BatchUploadProgress.tsx` also saves garments without `ai_raw`/enrichment. Add the same fields and background enrichment trigger there.

### Summary of changes
- `src/pages/AddGarment.tsx` — add 3 AI fields to `handleSave`, trigger background enrichment after insert
- `src/components/wardrobe/BatchUploadProgress.tsx` — same: add AI fields and enrichment trigger

No database migrations needed. No edge function changes. The enrichment endpoint already exists and works.

