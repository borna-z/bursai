

## Background Removal Pipeline — Implementation Plan

### Overview

Add client-side AI background removal (`@imgly/background-removal`) to both garment input flows (Live Scan and Add Garment), so only the isolated garment is saved and displayed.

### Files to Create/Modify

| File | Action |
|---|---|
| `package.json` | Add `@imgly/background-removal` dependency |
| `src/lib/removeBackground.ts` | **Create** — shared utility with lazy-loaded WASM |
| `src/hooks/useLiveScan.ts` | Integrate removal into `capture()` and `captureFromFile()`, add `isRemovingBackground` state |
| `src/pages/LiveScan.tsx` | Editorial cream background on result preview, show removing-bg state in `ScanOverlay` |
| `src/pages/AddGarment.tsx` | Integrate removal into `handleImageSelect()` and `processNativeCapture()`, add "Removing background…" progress indicator, cream preview background |

### 1. `src/lib/removeBackground.ts` (new)

Two exported functions:

- **`removeBackground(input: Blob): Promise<Blob>`** — lazy-imports `@imgly/background-removal`, calls it with `{ model: 'small', output: { format: 'image/png', quality: 0.9 } }`. On any failure, logs warning and returns the original blob unchanged.
- **`removeBackgroundFromDataUrl(base64: string): Promise<{ blob: Blob; base64: string }>`** — converts data URL to blob, calls `removeBackground`, converts result back to data URL. Used by the Live Scan video-frame path.

The `@imgly/background-removal` import uses dynamic `import()` so the ~5MB WASM bundle only loads on first use.

### 2. `src/hooks/useLiveScan.ts`

- Add `isRemovingBackground` state (boolean), exposed in return value.
- **`capture()`**: After `compressCenterCrop()` returns `{ blob, base64 }`:
  1. Set `isRemovingBackground = true`
  2. Call `removeBackgroundFromDataUrl(base64)`
  3. Set `isRemovingBackground = false`
  4. Use processed blob/base64 for the `analyze_garment` call and `thumbnailUrl`
- **`captureFromFile()`**: After `compressImage()`:
  1. Set `isRemovingBackground = true`
  2. Call `removeBackground(blob)`
  3. Set `isRemovingBackground = false`
  4. Revoke old preview URL, create new one from processed blob
  5. Use processed blob for analysis and result

The `isProcessing` flag already gates the UI — `isRemovingBackground` is an additional signal for more specific UI feedback.

### 3. `src/pages/LiveScan.tsx`

- Import `isRemovingBackground` from `useLiveScan`.
- In `ScanOverlay` (or alongside it), when `isRemovingBackground` is true, show a subtle "Isolating garment…" label.
- In the result overlay (line ~508), change the image container background from transparent to `bg-[#F5F0E8]` (editorial cream) so the transparent PNG garment displays on a clean product-shot background.

### 4. `src/pages/AddGarment.tsx`

- In `handleImageSelect()` (line ~362-403): After `compressImage()` returns `{ file, previewUrl }`, call `removeBackground(file as Blob)`. Replace `file` with the processed blob for upload. Update preview. Track a new `isRemovingBg` local state for UI.
- In `processNativeCapture()` (line ~210-231): Same pattern — after receiving the file, remove background before upload.
- Update the upload `contentType` to `'image/png'` when the processed blob is PNG (check `blob.type`).
- Show a brief "Removing background…" indicator using the existing `Progress` component (indeterminate mode) between the image selection and the "analyzing" step.
- Set preview container background to `bg-[#F5F0E8]` in the form step image display.

### 5. Storage Impact

- `backgroundGarmentSave.ts` already uploads `result.blob` with `contentType: 'image/jpeg'` — since useLiveScan now provides a PNG blob, update the contentType detection in `backgroundGarmentSave.ts` to read from `blob.type` instead of hardcoding JPEG. **This is a one-line change** — checking `result.blob.type || 'image/jpeg'` and using `.png` extension when appropriate.

Wait — the instructions say "Do NOT modify backgroundGarmentSave.ts." The current code there uses:
```ts
contentType: 'image/jpeg'
```
and the file extension is hardcoded to `.jpg`. If we send a PNG blob but label it JPEG, Supabase will store it fine (it's just metadata). The image will still render correctly. So we can skip this change and comply with the constraint. The blob data is what matters, not the content-type header.

### 6. Error Handling

Every call to `removeBackground` / `removeBackgroundFromDataUrl` is wrapped in try/catch. On failure:
- `console.warn('Background removal unavailable, using original image')`
- Return original input unchanged
- No user-facing error — the pipeline continues seamlessly

### What Does NOT Change

- `backgroundGarmentSave.ts`
- `useAnalyzeGarment.ts`
- Any edge functions
- Batch upload flow (`BatchUploadProgress`)
- Accept/retake/finish flow in useLiveScan
- Routing, auth, subscriptions, paywall logic

