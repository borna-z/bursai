

# Faster Scanner + Polished Loading Animation

## Problem
1. The auto-detect stability timer (`STABLE_DURATION = 1200ms`) and cooldown (`COOLDOWN = 2000ms`) are too slow for rapid scanning.
2. The image is compressed at `maxDim = 1024` and `quality = 0.85`, creating unnecessarily large base64 payloads that slow the AI call.
3. The loading state during AI analysis is a plain spinner -- no visual flair.
4. The accepted overlay lingers for 1200ms, slowing the flow.

## Changes

### 1. Speed up auto-detect (`src/hooks/useAutoDetect.ts`)
- Reduce `STABLE_DURATION` from 1200ms to 600ms (fires twice as fast)
- Reduce `COOLDOWN` from 2000ms to 800ms (re-arms much sooner)
- Reduce `SAMPLE_INTERVAL` from 200ms to 150ms (more responsive detection)

### 2. Speed up image capture (`src/hooks/useLiveScan.ts`)
- Reduce `maxDim` from 1024 to 640 (much smaller base64, faster upload to AI)
- Reduce JPEG quality from 0.85 to 0.7 (smaller payload, still good enough for classification)

### 3. Faster accepted overlay (`src/pages/LiveScan.tsx`)
- Reduce `AcceptedOverlay` timeout from 1200ms to 700ms

### 4. New scanning loading animation (`src/pages/LiveScan.tsx`)
Replace the plain `Loader2` spinner with a custom pulsing scan animation:
- A translucent scan line that sweeps vertically over the camera feed
- Pulsing corner brackets that frame the garment area
- A subtle text label ("Analyzing...") with a dot animation
- All CSS-driven (keyframes in `src/index.css`), no extra libraries

### 5. Add keyframes to `src/index.css`
- `@keyframes scan-line` -- a horizontal line that slides top-to-bottom repeatedly
- `@keyframes pulse-bracket` -- subtle scale pulse on corner markers

## Summary of speed gains
- Auto-detect trigger: ~1.2s to ~0.6s (2x faster)
- Cooldown between scans: 2s to 0.8s (2.5x faster)
- Image payload: ~60% smaller (640px + 0.7 quality vs 1024px + 0.85)
- Accept overlay: 1.2s to 0.7s
- Combined: scanning flow should feel roughly 3x snappier

