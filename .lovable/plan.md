

## Plan: Replace `buildCombos()` and `scoreCombo()` in burs_style_engine

**File**: `supabase/functions/burs_style_engine/index.ts`

### What changes

**1. Remove lines 1609-1789** — this covers `toComboItem()`, `deduplicateCombos()`, the old `buildCombos()`, and the old `scoreCombo()`.

**2. Insert the user's new `buildCombos()` and `scoreCombo()`** in their place. Key differences from the old code:

- `buildCombos` signature reordered: `(slotCandidates, recentOutfitSets, occasion, style, weather, prefs, maxCombos, body)` — occasion/style/weather/prefs move before maxCombos/body
- Combo item creation is now inline (no more `toComboItem` helper)
- Outerwear/accessory selection uses weather-aware logic (`isWetWeather`, temperature thresholds) and occasion-aware accessory inclusion
- Iterates over multiple outerwear and accessory options per combo instead of appending a single best one
- Deduplication uses inline `Map` keyed by sorted slot:id pairs
- `scoreCombo` signature reordered: `(items, recentSets, occasion, weather, style, prefs, body)` — no more defaults, occasion/weather before style/prefs
- Weights changed: `avgBaseScore` goes from 0.22 → 0.34, `matScore` from 0.10 → 0.08, `fitScore` from 0.08 → 0.10
- Breakdown now includes both `color`/`material` shorthand keys AND the `color_harmony`/`material_compatibility` UI keys

**3. Update call site at line 2190** to match the new parameter order:
```
buildCombos(slotCandidates, recentOutfitSets, occasion, style, weather, preferences, 10, bodyProfile)
```

### What can be removed
- `toComboItem()` (lines 1609-1611) — no longer used; new code creates items inline
- `deduplicateCombos()` (lines 1613-1623) — replaced by inline `Map`-based dedup in `buildCombos`

### What stays the same
- All functions before the combo builder section (scoring helpers, slot categorization, etc.)
- All functions after `scoreCombo` (locale, AI refinement, swap mode, main server)
- The section header comment "COMBO BUILDER" is preserved

