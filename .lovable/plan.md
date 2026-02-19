

# Live Scan -- Rapid Wardrobe Scanner

## The Vision

A dedicated "Live Scan" mode where users open their phone camera and rapidly scan garments one after another. Each garment is detected, analyzed by AI, and added to the wardrobe automatically. The goal: **50 garments in 30 seconds**.

## How It Works

```text
User taps "Live Scan" button
  -> Full-screen camera opens
  -> User holds up a garment
  -> AI detects + analyzes in real-time
  -> A result card slides up: garment name, category, color
  -> User taps "Accept" or "Retake"
  -> On accept: saved to wardrobe instantly
  -> Camera stays open, ready for the next garment
  -> Counter shows "12 garments scanned"
  -> User taps "Done" when finished
```

## User Experience

1. From the Wardrobe page (or a new bottom nav entry), user taps a prominent "Live Scan" button
2. Full-screen camera view opens with a clean, minimal overlay
3. A "Capture" button at the bottom -- user frames a garment and taps to capture (or holds garment in front of camera)
4. The captured frame is sent to AI for analysis (takes 2-3 seconds)
5. A small result card slides up from the bottom showing: thumbnail, title, category, primary color
6. Two buttons: "Accept" (green checkmark) and "Retake" (retry icon)
7. On accept: the garment is uploaded to storage, saved to DB, and the card animates away
8. A running counter at the top shows "7 garments added"
9. Camera immediately ready for the next scan
10. "Done" button closes the scanner and returns to wardrobe

## Technical Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/pages/LiveScan.tsx` | Full-screen camera scanner page |
| `src/hooks/useLiveScan.ts` | Orchestrates capture, upload, analyze, save pipeline |

### Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Add route `/wardrobe/scan` |
| `src/pages/Wardrobe.tsx` | Add "Live Scan" button next to the existing "+" FAB |
| `supabase/functions/analyze_garment/index.ts` | Add support for base64 image input (skip storage path requirement for speed) |

### Camera Implementation

Using the browser `getUserMedia` API with `<video>` element for the live camera feed. When user taps capture:

1. Draw current video frame to an off-screen `<canvas>`
2. Export as JPEG blob (`canvas.toBlob('image/jpeg', 0.85)`)
3. Show the captured frame as a preview thumbnail
4. Upload to storage in the background while AI analyzes

### Scan Pipeline (useLiveScan hook)

The hook manages a queue-based pipeline:

```text
[Capture frame] -> [Upload to storage] -> [Call analyze_garment] -> [Show result card]
                                                                         |
                                                              [Accept] -> [Save to DB]
                                                              [Retake] -> [Discard]
```

Key state:
- `scanCount`: number of garments successfully added
- `currentScan`: the garment currently being analyzed (thumbnail + loading state)
- `lastResult`: the AI analysis result waiting for user confirmation
- `isProcessing`: whether the pipeline is busy

### Edge Function Update

The existing `analyze_garment` function currently requires a `storagePath`. For Live Scan speed, we add an alternative input: the function can also accept a `base64Image` string directly (the captured frame). This avoids a round-trip to storage before analysis.

Flow:
1. If `base64Image` is provided: use it directly as a data URL for the AI vision call
2. If `storagePath` is provided: use existing signed URL flow (backwards compatible)

After the user accepts, the frontend uploads the image to storage and saves the garment record -- this happens after AI analysis, not before, so the user sees results faster.

### LiveScan.tsx Page Structure

```text
+------------------------------------------+
|  [X Close]           [7 scanned]         |
+------------------------------------------+
|                                          |
|                                          |
|          Live Camera Feed                |
|          (full screen video)             |
|                                          |
|                                          |
+------------------------------------------+
|  +------------------------------------+ |
|  |  [thumb] Navy T-shirt   Overdel    | |  <-- Result card (slides up)
|  |          Marinbla | Bomull         | |
|  |   [Retake]           [Accept]      | |
|  +------------------------------------+ |
+------------------------------------------+
|         [ Capture Button ]               |
+------------------------------------------+
```

### Speed Optimizations

- **Base64 direct analysis**: Send captured frame directly to AI without uploading to storage first
- **Background upload**: Upload image to storage only after user accepts, in parallel with showing the next capture view
- **Queue system**: While upload + save runs in background, camera is already ready for next scan
- **Compressed captures**: JPEG at 85% quality, resized to max 1024px on the longest side before sending to AI
- **Batch invalidation**: Only invalidate the garments query cache once when user taps "Done", not after each save

### Image Compression

Before sending to AI, the captured frame is resized on a canvas:
- Max dimension: 1024px (preserving aspect ratio)
- Format: JPEG at 85% quality
- This keeps the payload small (~100-200KB) for fast AI analysis

### Subscription Check

Before starting Live Scan, check the user's remaining garment slots. Show the counter during scanning. If limit is reached mid-scan, show the paywall modal and stop scanning.

### Accessibility

- Camera permission prompt handled gracefully with a fallback message
- Works on devices without LiDAR (standard camera only -- LiDAR is not accessible via web APIs)
- Portrait orientation optimized
- Haptic feedback on successful scan (using `navigator.vibrate` where supported)

## Summary of Changes

1. **New page** `LiveScan.tsx` -- Full-screen camera with capture, AI analysis, accept/retake flow, running counter
2. **New hook** `useLiveScan.ts` -- Pipeline orchestration: capture -> compress -> analyze -> upload -> save
3. **Updated edge function** `analyze_garment` -- Accept base64 images alongside storage paths for faster analysis
4. **Updated routing** in `App.tsx` -- Add `/wardrobe/scan` route
5. **Updated Wardrobe page** -- Add "Live Scan" entry point button
6. No database changes needed -- uses existing `garments` table and `garments` storage bucket

