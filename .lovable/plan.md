

# Live Scan Two-Stage Pipeline & Precision Upgrade

## Current State

- **Auto-detect** uses frame-differencing at 64x64 to detect stability, fires `onStable` after 300ms of stillness
- **Capture** compresses full frame to 480px JPEG, sends base64 to `analyze_garment` edge function
- **Edge function** uses `complexity: "standard"` with 300 max tokens, 15s timeout for live scan
- **Result** shows full-frame thumbnail + title/category/color, user accepts or retakes
- **Save** runs in background after accept (upload + insert)
- No center-crop, no confidence score, no Stage 2 enrichment, no duplicate awareness
- ScanOverlay uses bouncing dots + ping rings (generic)
- Garments table has no enrichment columns (neckline, sleeve_length, etc.) — enrichment will go into `ai_raw` JSON

## Plan

### 1. Center-crop before analysis (`src/lib/compressFrame.ts`)
- Add optional crop region parameter to `compressFrame`
- New export `compressCenterCrop(canvas, video, maxDim, quality)` that crops the center 70% of the frame before compressing — removes background clutter, focuses on the garment the reticle is pointing at
- Used by live scan capture path; file capture stays full-frame

### 2. Edge function fast path (`supabase/functions/analyze_garment/index.ts`)
- Add `mode: 'fast' | 'full'` to request body (default `'full'`)
- When `mode === 'fast'`:
  - Use `complexity: "trivial"` (gemini-2.5-flash-lite → gemini-2.5-flash) for speed
  - `max_tokens: 200`, `timeout: 10000`
  - Tighter prompt: no verbose instructions, request JSON only with a `confidence` field (0-1)
  - Temperature 0 for deterministic output
- When `mode === 'full'`: existing behavior unchanged
- Add `confidence` to response type
- Prompt for fast mode: single-sentence system prompt + schema, no examples

### 3. Stage 2 enrichment edge function call (`supabase/functions/analyze_garment/index.ts`)
- Add `mode: 'enrich'` option
- Uses `complexity: "standard"`, requests additional fields: neckline, sleeve_length, closure, fabric_weight, style_tags, occasion_tags, layering_role, refined_title
- Returns enrichment data stored into `ai_raw` column via background update

### 4. `useLiveScan` hook upgrades (`src/hooks/useLiveScan.ts`)
- `capture()` uses new `compressCenterCrop` for center-cropped frame
- Pass `mode: 'fast'` to `invokeEdgeFunction` for Stage 1
- Add `confidence` to `ScanResult` interface
- New `ScanResult.confidence` field from AI response
- After `accept()`, fire Stage 2 enrichment in background:
  - Upload image first (existing)
  - Insert garment record (existing)
  - Then invoke `analyze_garment` with `mode: 'enrich'` and `storagePath`
  - Update garment's `ai_raw` with enrichment data
  - Run duplicate detection (existing `detect_duplicate_garment`) with metadata
- Background enrichment never blocks scan loop

### 5. `backgroundGarmentSave.ts` — add enrichment step
- After successful insert, fire enrichment edge function
- After enrichment response, update garment record's `ai_raw` with merged data
- After enrichment, run duplicate detection and log result (no UI blocking)
- All errors caught silently — enrichment is best-effort

### 6. Auto-detect confidence-aware reticle (`src/hooks/useAutoDetect.ts`)
- Add `'multiple_objects'` to `FramingHint` type for when edge density is high everywhere (suggests clutter)
- Tighten `STABLE_DURATION` to 250ms for snappier lock feel
- Export `lockConfidence` (0-1) based on edge density quality: high center edges + low border edges = high confidence

### 7. LiveScan.tsx UI upgrades
- **Reticle**: Replace circle with a rounded-rect "focus frame" (4 corner brackets) that transitions from `border-foreground/20` to `border-accent` on lock
- **ScanOverlay**: Replace bouncing dots + ping rings with the premium `GarmentAnalysisState` treatment (shimmer line + phase text crossfade). Phases: "Locking on" → "Reading garment" → "Extracting details"
- **Result overlay**: Add confidence badge (high/medium/low) with appropriate copy. Show a subtle "Enriching details..." note after accept
- **Guidance**: Add `'multiple_objects'` hint: "Focus on one garment"
- Add new scan phase i18n keys

### 8. i18n translations (`src/i18n/translations.ts`)
Add for `en` and `sv`:
- `scan.locking_on` / `scan.reading_garment` / `scan.extracting`
- `scan.confidence_high` / `scan.confidence_medium` / `scan.confidence_low`
- `scan.multiple_objects` / `scan.enriching`

### 9. Tests
- Update `useLiveScan.test.tsx`: verify `mode: 'fast'` is passed in capture body
- Update `backgroundGarmentSave.test.ts`: verify enrichment call after insert
- Add test: confidence field flows through to ScanResult

## Files Modified

| File | Change |
|------|--------|
| `src/lib/compressFrame.ts` | Add `compressCenterCrop` export |
| `supabase/functions/analyze_garment/index.ts` | Add `mode` param, fast/enrich paths |
| `src/hooks/useLiveScan.ts` | Center-crop, fast mode, confidence |
| `src/lib/backgroundGarmentSave.ts` | Stage 2 enrichment + duplicate detection |
| `src/hooks/useAutoDetect.ts` | lockConfidence, multiple_objects hint |
| `src/pages/LiveScan.tsx` | Focus frame reticle, premium scan overlay, confidence badge |
| `src/i18n/translations.ts` | New scan phase keys |
| `src/hooks/__tests__/useLiveScan.test.tsx` | Fast mode assertion |
| `src/lib/__tests__/backgroundGarmentSave.test.ts` | Enrichment test |

## Speed Budget

- Center crop + compress: <50ms (canvas draw)
- Stage 1 AI (trivial complexity, 200 tokens, flash-lite): target p50 <2s, p90 <3s
- Accept → scan loop ready: <100ms (background fire-and-forget)
- Stage 2 enrichment: 5-15s in background, invisible to user

