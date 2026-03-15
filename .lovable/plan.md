

## Plan: Replace combo scoring helpers in burs_style_engine

**File**: `supabase/functions/burs_style_engine/index.ts`

### What changes

Replace lines 753-856 (the section header + `styleIntentScore`, `occasionTemplateScore`, `weatherPracticalityScore`) with the user's new code block containing:

1. **New utility helpers**: `garmentText()`, `hasComboSlot()`, `isWetWeather()`
2. **Rewritten `styleIntentScore()`** — now accepts `prefs` param, uses style words from user profile, counts neutral/pattern/relaxed/structured/sporty/romantic items, scores per style target
3. **Rewritten `occasionTemplateScore()`** — now accepts `weather` param, uses formality ranges per occasion type (work, casual, date, party, travel, formal), checks shoe text
4. **Rewritten `weatherPracticalityScore()`** — simplified temperature/precipitation logic using `isWetWeather()`, shoe-aware penalties

### Call-site updates needed

The function signatures changed:
- `styleIntentScore` now takes `(items, requestedStyle, prefs)` instead of `(items, style)`
- `occasionTemplateScore` now takes `(items, occasion, weather)` instead of `(items, occasion)`

Will need to find and update all call sites in the same file to pass the additional arguments.

### Lines affected
- **Remove**: lines 753-856
- **Insert**: section header + all 6 new functions in their place

