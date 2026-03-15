

## Plan: Replace swap helpers and `scoreSwapCandidates()` with new implementations

**File**: `supabase/functions/burs_style_engine/index.ts`

### Current state (lines 1996–2168)
- Swap section has: `fitFamily`, `visualWeight`, `dnaPreservationScore`, `formalityAlignmentScore`, `fitConsistencyScore`, `swapPracticalityScore`, `scoreSwapCandidates`
- `clampScore` already exists at line 679 and `garmentText` at line 757 — both are shared helpers used by generate/suggest mode too

### Changes

**Replace lines 1996–2168** (the entire swap section) with the user's provided code, but **omit the `clampScore()` and `garmentText()` redefinitions** since they already exist earlier in the file. The existing versions are compatible:
- `clampScore` is identical
- `garmentText` at line 757 takes `GarmentRow` (not nullable) — fine because the new code's only nullable usage is inside `dnaPreservationScore` where it guards with `if (!currentGarment) return 7` before calling `garmentText`

The user's new `visualWeight` accepts `GarmentRow | null | undefined` (vs current `GarmentRow`), and `fitFamily` accepts `string | null | undefined` (vs `string | null`). These are signature expansions that are safe.

**New helper signatures** (all different from current):
- `fitFamily(fit: string | null | undefined)` — adds `undefined`, uses 'relaxed'/'fitted'/'regular' families instead of 'slim'/'loose'/'regular'
- `visualWeight(garment: GarmentRow | null | undefined)` — text-based scoring instead of color+material
- `dnaPreservationScore(garment, currentGarment, others)` — 3 params vs 2, starts at 7 not 10, additive scoring
- `formalityAlignmentScore(garment, others[], currentGarment)` — takes raw `GarmentRow[]` instead of `{garment}[]`
- `fitConsistencyScore(garment, others[], currentGarment)` — different logic with current-garment anchor
- `swapPracticalityScore(garment, slot, weather)` — slot-aware instead of delegating to `weatherSuitability`
- `scoreSwapCandidates` — same signature, new weights (0.34/0.22/0.12/0.08/0.10/0.08/0.06)

### No other changes needed
- The call site at line 2340 already passes the correct arguments
- Generate/suggest modes are untouched
- No schema or dependency changes

