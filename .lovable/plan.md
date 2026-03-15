

## Plan: Replace `styleAlignmentScore()` in burs_style_engine

**File**: `supabase/functions/burs_style_engine/index.ts`

### What changes

Replace lines 679-757 with the new implementation provided by the user. This includes:

1. **New helper `clampScore()`** — extracts `Math.max(0, Math.min(10, value))` into a reusable function
2. **New helper `getStylePrefs()`** — safely extracts `styleProfile` from prefs with fallback
3. **Rewritten `styleAlignmentScore()`** with:
   - More granular style-word matching (minimal, classic, street, sporty) with subcategory awareness
   - Expanded comfort-vs-style logic using fit and material keywords
   - Palette vibe checks using existing `getHSL`/`isNeutral` helpers
   - Simplified fit preference matching (exact match only, no opposite-fit penalty)
   - Removed the old `STYLE_WORD_SIGNALS` dictionary and `vibeMatch` lambda map

### What stays the same
- All surrounding functions (`feedbackScore`, occasion/formality logic, etc.)
- The function signature and return type remain identical
- No changes to how `styleAlignmentScore` is called downstream

### Lines affected
- **Remove**: lines 679-757 (old `styleAlignmentScore` + its return/clamp)
- **Insert**: the three new functions (`clampScore`, `getStylePrefs`, `styleAlignmentScore`) in their place

