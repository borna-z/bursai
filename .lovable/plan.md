

# Consistent Garment Intelligence Pipeline

## Current Divergence Analysis

All three input flows (live scan, gallery/add-garment, batch upload) now trigger the same two-stage pipeline:
- **Stage 1**: `analyze_garment` with `mode: 'fast'` or `mode: 'full'` — produces basic metadata
- **Stage 2**: `analyze_garment` with `mode: 'enrich'` — produces deep intelligence (silhouette, texture, stylist note, etc.)

The flows are already wired correctly in code. **The real problems are:**

1. **Silent enrichment failures**: Edge function logs show `SyntaxError` when parsing enrichment JSON responses. When enrichment fails, it silently returns — no retry, no status tracking, no UI indication. The garment just permanently lacks deep intelligence.

2. **No enrichment status model**: There's no `enrichment_status` field on garments. The detail page simply checks if `ai_raw.enrichment` exists — if not, all deep intelligence sections silently vanish. Users see inconsistent detail pages with no explanation.

3. **No retry mechanism**: If Stage 2 enrichment fails (bad JSON, timeout, AI error), there's no way to retry — the garment is stuck with basic metadata forever.

4. **Detail page doesn't refresh after enrichment**: Enrichment runs in the background after save. If the user navigates to garment detail before it completes, they see basic-only data with no indication that more is coming.

5. **JSON parsing brittleness**: The enrichment prompt asks for many fields, increasing the chance of malformed JSON from the AI. There's no fallback parsing or cleanup.

## Implementation Plan

### 1. Database: Add `enrichment_status` column to garments

Migration SQL:
```sql
ALTER TABLE public.garments 
ADD COLUMN enrichment_status text NOT NULL DEFAULT 'pending';

-- Backfill existing garments
UPDATE public.garments 
SET enrichment_status = CASE 
  WHEN ai_raw::text LIKE '%enrichment%' THEN 'complete'
  WHEN ai_analyzed_at IS NOT NULL THEN 'pending'
  ELSE 'none'
END;
```

Values: `'none'` | `'pending'` | `'in_progress'` | `'complete'` | `'failed'`

### 2. Edge Function: Harden enrichment JSON parsing

**File**: `supabase/functions/analyze_garment/index.ts`

In the `mode === 'enrich'` block:
- Add a `cleanJsonResponse()` utility that strips trailing commas, fixes common AI JSON errors before `JSON.parse`
- Wrap in try/catch with a retry (1 retry with slightly modified prompt asking for simpler JSON)
- On final failure, return `{ enrichment: null, error: 'parse_failed' }` instead of crashing

### 3. Background save: Track enrichment status

**Files**: `src/lib/backgroundGarmentSave.ts`, `src/pages/AddGarment.tsx`, `src/components/wardrobe/BatchUploadProgress.tsx`

- After garment insert, set `enrichment_status: 'pending'`
- Before calling enrichment, update to `'in_progress'`
- On success, update to `'complete'`
- On failure, update to `'failed'`
- All three enrichment functions (backgroundGarmentSave, AddGarment, BatchUploadProgress) get this same status tracking

### 4. Garment Detail: Show enrichment status UI

**File**: `src/pages/GarmentDetail.tsx`

- Read `garment.enrichment_status` from the query
- If `'pending'` or `'in_progress'`: show a calm, premium "Deep analysis in progress" card with a subtle shimmer animation, positioned where the intelligence sections would appear
- If `'failed'`: show a minimal "Analysis incomplete" card with a "Retry" button
- If `'complete'`: show enrichment sections as today
- Retry button calls `analyze_garment` with `mode: 'enrich'`, updates status, and refetches the garment

### 5. Auto-refresh after enrichment completes

**File**: `src/pages/GarmentDetail.tsx`

- When `enrichment_status` is `'pending'` or `'in_progress'`, set up a polling interval (every 5s, max 60s) that refetches the garment query
- Once status changes to `'complete'`, stop polling and the enrichment sections animate in naturally
- Use `refetchInterval` from React Query for clean implementation

### 6. Automatic retry for failed enrichments

**File**: `src/lib/backgroundGarmentSave.ts` (and the AddGarment/Batch variants)

- On enrichment failure, wait 3s and retry once automatically
- Only set `'failed'` after the retry also fails
- This handles transient AI errors without user intervention

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/analyze_garment/index.ts` | Add `cleanJsonResponse()`, retry logic for malformed JSON |
| `src/lib/backgroundGarmentSave.ts` | Track `enrichment_status` through lifecycle, auto-retry |
| `src/pages/AddGarment.tsx` | Track `enrichment_status` in enrichment function |
| `src/components/wardrobe/BatchUploadProgress.tsx` | Track `enrichment_status` in enrichment function |
| `src/pages/GarmentDetail.tsx` | Show enrichment status UI, retry button, auto-refresh polling |
| Migration | Add `enrichment_status` column with backfill |

No changes to auth, routing, storage, subscriptions, or existing save behavior. All changes are additive.

