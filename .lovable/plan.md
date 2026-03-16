

## Diagnosis

### Issue 1: Enrichment ("deep analysis") failing — `SyntaxError: Unterminated fractional number`

The edge function logs show repeated JSON parse failures at position 892. The enrich mode prompt asks for 20+ fields but `max_tokens` is only `300` — the AI response gets truncated mid-number, producing invalid JSON like `"confidence": 0.`. The `cleanJsonResponse` helper strips markdown fences and trailing commas but cannot repair a number cut off at the decimal point. Both retry attempts fail identically because the token limit is structural.

**Fix**: Increase `max_tokens` for enrich mode from `300` to `800`, and add a truncated-number repair step to `cleanJsonResponse` (strip trailing dots/incomplete decimals before `}` or `,`).

### Issue 2: Live Scan — "Could not capture image"

`compressCenterCrop()` reads `video.videoWidth` and `video.videoHeight`. If the video stream hasn't fully initialized (dimensions = 0), the computed canvas dimensions become 0×0. A zero-dimension canvas causes `toBlob()` to return `null`, which rejects with `"Failed to capture frame"`, caught by `useLiveScan` as `"Could not capture image"`.

This can happen when auto-detect fires `onStable` before the video element reports dimensions, or on manual capture immediately after camera start.

**Fix**: Add a guard in `compressCenterCrop` (and `compressFrame`) to reject with a clear error if video dimensions are 0. Add a guard in `useLiveScan.capture()` to check `videoEl.videoWidth > 0` before proceeding.

---

## Changes

### 1. `supabase/functions/analyze_garment/index.ts`
- Change enrich mode `max_tokens` from `300` to `800`
- Update `cleanJsonResponse` to repair truncated numbers: regex to replace patterns like `0.}` or `0.,` with `0}` / `0,`

### 2. `src/lib/compressFrame.ts`
- Add dimension guard at top of both `compressFrame` and `compressCenterCrop`: if `video.videoWidth === 0 || video.videoHeight === 0`, reject with `"Video not ready"`

### 3. `src/hooks/useLiveScan.ts`
- In `capture()`, check `videoEl.videoWidth > 0 && videoEl.videoHeight > 0` before calling `compressCenterCrop`. If not ready, set error to a user-friendly message like "Camera not ready, try again" instead of the generic "Could not capture image"

