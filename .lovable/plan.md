

## Plan: Update Swap Scoring in `burs_style_engine`

### Current State
The edge function already has `SwapMode`, `expressiveLiftScore`, `controlledNoveltyScore`, and `scoreSwapCandidates` (lines 2141–2344). The swap mode parsing (line 2391) and swap call (line 2517–2518) also exist and already pass `swapMode`.

### Changes Required

**1. Replace `expressiveLiftScore` (lines 2143–2187)**
Current signature: `(garment, currentGarment, others)` — uses `others` for formality clash check.
New signature: `(garment, currentGarment)` — uses hue diff, pattern, material keywords, and formality diff directly between candidate and current garment. Drops the `others` parameter entirely.

**2. Replace `controlledNoveltyScore` (lines 2189–2229)**
Current signature: `(garment, currentGarment, others)` — uses `last_worn_at`, text similarity, subcategory, and hue diff.
New signature: `(garment, currentGarment, colorHarmony, formalityAlignment, dnaPreservation)` — simpler approach based on color/material/fit differences with a safety gate using upstream scores. Drops `others` and time-based logic.

**3. Replace `scoreSwapCandidates` (lines 2232–2344)**
Key differences from current:
- Removes the `WEIGHTS` lookup table — uses inline weight calculations per mode instead
- Adds penalty gates: `formalityAlignment < 4.5` → −1.5, `colorHarmony < 4.5` → −1.2, safe mode `dnaPreservation < 4.5` → −2
- Calls updated `expressiveLiftScore(garment, currentGarment)` and `controlledNoveltyScore(garment, currentGarment, colorHarmony, formalityAlignment, dnaPreservation)` with new signatures
- Adds `.slice(0, 10)` at the end
- Different weight values per mode (e.g., safe: base 0.26, dna 0.32; bold: expressive 0.18; fresh: freshness 0.14)

**4. Update swap mode parsing (line 2391)**
Minor change: current uses `['safe','bold','fresh'].includes(...)`, new version uses `body.swap_mode === 'bold' || body.swap_mode === 'fresh'` ternary. Functionally equivalent.

### Implementation
All changes are in a single file: `supabase/functions/burs_style_engine/index.ts`, lines 2141–2344 (replace the entire swap helpers + scoring block) and line 2391 (swap mode parsing). The swap call at line 2517–2518 already matches the requested signature.

