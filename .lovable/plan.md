

## Supercharge the Live Scanner

### Problem
The current scanner feels sluggish: 600ms stability wait + slow scan-line animation + no real-time guidance for the user. The AI analysis also takes longer than needed because the edge function uses a heavier model. Users don't get feedback about framing (too close, too far, etc.).

### What Changes

**1. Faster auto-detect (600ms -> 400ms stability, 800ms -> 500ms cooldown)**
- `useAutoDetect.ts`: Reduce `STABLE_DURATION` from 600 to 400ms and `COOLDOWN` from 800 to 500ms
- Lower `SAMPLE_INTERVAL` from 150 to 100ms for more responsive detection
- Result: scan triggers ~40% faster

**2. Real-time framing guidance**
- Add a new component `ScanGuidance` in `LiveScan.tsx` that analyzes the video frame brightness/contrast to detect:
  - **Too dark**: "Move to better light"
  - **Too close / too far**: Simple edge-density heuristic -- many edges near borders = too close, very few features = too far
  - **Good framing**: "Hold still to scan"
- Show as a floating pill overlay replacing the current static "Hold still" / "Point at garment" text
- Update with smooth transitions (no flickering)

**3. Much snappier scan animations**
- Replace the slow vertical scan-line (1.5s cycle) with a faster, more dynamic animation:
  - Horizontal laser sweep: 0.8s cycle instead of 1.5s
  - Corner brackets pulse faster (1.2s instead of 2s)
  - Add a subtle radial pulse from center on capture
  - Green glow effect on the border when stability is building
- Smoother accepted overlay: faster ring draw (0.35s instead of 0.5s)
- Badge pop animation tightened to 0.3s

**4. Faster AI analysis (switch to lighter model)**
- `analyze_garment/index.ts`: Switch from `google/gemini-3-flash-preview` to `google/gemini-2.5-flash-lite` for live scan mode (when `base64Image` is provided)
- Keep `gemini-3-flash-preview` for the standard upload flow (when `storagePath` is provided) since quality matters more there
- Reduce `max_tokens` from 500 to 300 for live scan (the JSON response is small)
- Reduce timeout from 30s to 15s for live scan
- This should bring analysis from ~4-5s down to ~2-3s

**5. New i18n keys for guidance**
- Add translation keys for the framing hints: `scan.move_closer`, `scan.move_back`, `scan.more_light`, `scan.ready`

### Files Modified

| File | Change |
|------|--------|
| `src/hooks/useAutoDetect.ts` | Faster constants, add brightness/edge analysis export |
| `src/pages/LiveScan.tsx` | New `ScanGuidance` component, faster animations, better UX flow |
| `src/index.css` | Updated keyframes: faster scan-line, new pulse/glow animations |
| `supabase/functions/analyze_garment/index.ts` | Conditional model selection (lite for live scan), lower max_tokens/timeout |
| `src/i18n/translations.ts` | Add guidance translation keys (sv, en + other locales) |

### Technical Details

**Framing heuristic (lightweight, runs on existing sampled canvas)**:
```text
1. Sample center region brightness -> if avg < 60 -> "more light"
2. Run simple Sobel edge count on 64x64 canvas:
   - edge_ratio > 0.6 near borders -> "too close"
   - edge_ratio < 0.05 overall -> "too far / no garment"
   - otherwise -> "ready, hold still"
3. Debounce guidance changes by 300ms to prevent flickering
```

**Animation timing summary**:
```text
Before -> After
scan-line cycle:     1.5s -> 0.8s
bracket pulse:       2.0s -> 1.2s
accepted ring draw:  0.5s -> 0.35s
badge pop:           0.4s -> 0.3s
stability duration:  600ms -> 400ms
cooldown:            800ms -> 500ms
```

