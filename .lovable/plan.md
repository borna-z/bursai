
## Remove All Remaining Hardcoded Language Strings

A deep audit found hardcoded Swedish strings in **13 more files** beyond what was previously addressed. Here is every file and what needs to change.

---

### Files with hardcoded strings to fix

#### 1. `src/components/outfit/StylistSummary.tsx`
- **Line 43-50**: `occasionLabels` map with Swedish labels (`'Jobb'`, `'Vardag'`, `'Fest'`, `'Resa'`, `'Traning'`, `'Dejt'`)
- **Line 60-89**: `generateSummary()` function with fully hardcoded Swedish sentences like `'Perfekt valt!'`, `'En proffsig look som funkar hela dagen.'`, `'Kl\u00e4tt f\u00f6r kylan!'` etc.
- **Line 150**: `'Stylistens sammanfattning'` hardcoded title
- **Line 174**: `'Passar v\u00e4dret'` badge text
- Needs `useLanguage` hook import

#### 2. `src/components/outfit/WeatherWarnings.tsx`
- **Line 32-33**: `WARM_SEASONS = ['Vinter', 'H\u00f6st']` and `COLD_SEASONS = ['Sommar']` -- season matching strings in Swedish
- **Lines 91-98**: `'Det \u00e4r ${n}\u00b0 varmare/kallare \u00e4n n\u00e4r outfiten skapades'`
- **Lines 108-116**: `'Kyla! \u00d6verv\u00e4g att l\u00e4gga till ytterpl\u00e4gg'`, `'Outfiten saknar vinterplagg'`
- **Line 126**: `'Kan vara kyligt -- ta med en jacka'`
- **Lines 137-145**: `'Varmt v\u00e4der! Ytterpl\u00e4gg kan bli f\u00f6r varmt'`, `'\u00d6verv\u00e4g l\u00e4ttare plagg f\u00f6r v\u00e4rmen'`
- **Lines 155-161**: Rain warnings in Swedish
- **Line 172**: `'Sn\u00f6! Kl\u00e4 dig varmt och vattent\u00e4tt'`
- **Line 182**: `'Bl\u00e5sigt -- v\u00e4lj vindt\u00e4ta kl\u00e4der'`
- **Line 239**: `'varning' / 'varningar'` in badge text
- Cannot use hooks directly (exported pure function `analyzeOutfitWeather`). Solution: Pass `t` function as parameter, or move warnings generation into a hook/component.

#### 3. `src/components/plan/SmartDayBanner.tsx`
- **Line 13-18**: `occasionConfig` with Swedish labels (`'Jobb'`, `'Tr\u00e4ning'`, `'Fest'`, `'Dejt'`)

#### 4. `src/components/plan/DaySummaryCard.tsx`
- **Line 15-21**: `occasionConfig` with Swedish labels (`'Jobb'`, `'Tr\u00e4ning'`, `'Fest'`, `'Dejt'`, `'Vardag'`)

#### 5. `src/contexts/ThemeContext.tsx`
- **Lines 14-27**: `ACCENT_COLORS` array with Swedish `name` properties (`'Skog'`, `'Salvia'`, `'Marin'`, `'Skiffer'`, `'Vinr\u00f6d'`, `'Ros'`, `'Terrakotta'`, `'B\u00e4rnsten'`, `'Plommon'`, `'Kol'`)
- These are used as display labels in the accent color picker.

#### 6. `src/hooks/useAnalyzeGarment.ts`
- **Line 32**: `'Inte inloggad'`
- **Line 60**: `'AI-analys misslyckades'`
- **Line 72**: `'Ett ov\u00e4ntat fel uppstod vid AI-analysen'`

#### 7. `src/components/onboarding/StylePreferencesStep.tsx`
- **Lines 10-12**: `COLORS` array with Swedish color names (`'svart'`, `'vit'`, `'gr\u00e5'`, etc.) displayed directly without translation
- **Line 110**: `'Loose'`, `'Regular'`, `'Slim'` -- English but not going through `t()`

#### 8. `src/components/insights/UnusedGemCard.tsx`
- **Line 43**: `'{daysUnused} dagar sedan'` -- hardcoded Swedish
- **Line 62**: `'Outfit'` button text (English, but should go through `t()`)

#### 9. `src/components/insights/WeeklySummary.tsx`
- **Line 68**: `'Veckosammanfattning'` title
- **Line 70**: `'Din stil denna vecka'` description
- **Line 79**: `'{streak} dagar'`
- **Line 80**: `'Anv\u00e4ndningsstreak'`
- **Line 101**: `'Mest anv\u00e4nd denna vecka'`

#### 10. `src/pages/Insights.tsx`
- **Line 38**: `'ok\u00e4nd'` in colorCounts fallback
- **Line 39**: `colorMap` keys are Swedish color names -- this is data matching, not display, but should align with whatever is stored in the database

#### 11. `src/pages/OutfitDetail.tsx`
- **Line 25**: `import { sv } from 'date-fns/locale'` -- unused import, should be removed

#### 12. `src/pages/marketing/Admin.tsx`
- **Lines 147-171**: `'Sidvisningar'`, `'Leads'`, `'App-klick'`
- **Line 183**: `'H\u00e4ndelser'`
- **Lines 206, 225-227, 239, 248**: Various Swedish labels and hardcoded `'sv-SE'` locale

#### 13. `src/pages/AddGarment.tsx`
- Subcategory arrays (lines 68-74) use Swedish values as both IDs and display -- the values serve as database keys AND display labels. The `SUBCATEGORY_I18N` map exists but the rendering likely still shows the raw Swedish value in some places.

---

### Implementation approach

1. **Add ~60 new translation keys** to `src/i18n/translations.ts`:
   - `occasion.*` keys for all occasion labels (jobb, vardag, fest, etc.)
   - `weather.warning.*` keys for all weather warning messages
   - `stylist.*` keys for the stylist summary component
   - `weekly.*` keys for weekly summary
   - `gem.*` keys for unused gem card
   - `accent.*` keys for accent color names
   - `analyze.*` keys for garment analysis errors
   - `admin.*` keys for the admin page

2. **Refactor `analyzeOutfitWeather` in WeatherWarnings.tsx**: Change the function signature to accept a `t` function parameter. All callers (`StylistSummary`, `WeatherWarnings`, `WeatherWarningBadge`) will pass `t` from `useLanguage()`.

3. **Refactor occasion configs**: Create a shared `OCCASION_I18N` mapping (similar to `CATEGORY_I18N`) and use `t()` for display labels in `SmartDayBanner`, `DaySummaryCard`, `StylistSummary`.

4. **Accent color names**: Add translation keys like `accent.forest`, `accent.sage`, etc. and use `t()` when displaying color names in the picker.

5. **StylePreferencesStep colors**: Use the existing `COLOR_I18N` map and `t()` to translate the color chip labels.

6. **useAnalyzeGarment**: Import `useLanguage` and use `t()` for error strings.

7. **Remove `import { sv } from 'date-fns/locale'`** from `OutfitDetail.tsx`.

8. **Admin.tsx**: Add translation keys and remove hardcoded `'sv-SE'`.

### Files to modify (in order)
1. `src/i18n/translations.ts` -- add ~60 keys
2. `src/components/outfit/WeatherWarnings.tsx` -- pass `t` to `analyzeOutfitWeather`
3. `src/components/outfit/StylistSummary.tsx` -- use `t()` for occasion labels, summary, badge
4. `src/components/plan/SmartDayBanner.tsx` -- use `t()` for occasion labels
5. `src/components/plan/DaySummaryCard.tsx` -- use `t()` for occasion labels
6. `src/contexts/ThemeContext.tsx` -- add i18n keys to accent color names
7. `src/hooks/useAnalyzeGarment.ts` -- use `t()` for error messages
8. `src/components/onboarding/StylePreferencesStep.tsx` -- use `COLOR_I18N` + `t()`
9. `src/components/insights/UnusedGemCard.tsx` -- use `t()`
10. `src/components/insights/WeeklySummary.tsx` -- use `t()`
11. `src/pages/OutfitDetail.tsx` -- remove unused `sv` import
12. `src/pages/marketing/Admin.tsx` -- use `t()`
13. `src/pages/Insights.tsx` -- fix fallback color key
14. `src/components/settings/AccentColorPicker.tsx` -- use translated accent names

### Notes
- Season matching in `WeatherWarnings.tsx` (`WARM_SEASONS`, `COLD_SEASONS`) compares against data stored in the database. These must match the database values, which are in Swedish. So the arrays stay as-is for matching, but the *display* strings get translated.
- `colorMap` keys in `Insights.tsx` match against database values (Swedish color names stored in `color_primary`). These stay as-is for data matching purposes.
- The Landing page remains English-only by design and is not changed.
