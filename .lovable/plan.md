

## Remove All Remaining Hardcoded Language Strings (Round 2)

The previous round fixed ~10 files. This round addresses the remaining **13 files** that still contain hardcoded Swedish (or English) strings not going through `t()`.

---

### Changes Overview

#### 1. Add ~60 new translation keys to `src/i18n/translations.ts`

New key groups for sv, en, and no:

- **Occasion labels**: `occasion.jobb`, `occasion.vardag`, `occasion.fest`, `occasion.dejt`, `occasion.resa`, `occasion.traning`
- **Stylist summary**: `stylist.title`, `stylist.fits_weather`, `stylist.greeting_1` through `stylist.greeting_4`, `stylist.jobb`, `stylist.vardag`, `stylist.fest`, `stylist.dejt`, `stylist.resa`, `stylist.traning`, `stylist.default`, `stylist.cold`, `stylist.hot`
- **Weather warnings**: `weather.warning.warmer`, `weather.warning.colder`, `weather.warning.cold_no_outer`, `weather.warning.no_winter`, `weather.warning.chilly`, `weather.warning.hot_outer`, `weather.warning.hot_warm`, `weather.warning.rain_no_outer`, `weather.warning.rain_check`, `weather.warning.snow`, `weather.warning.wind`, `weather.warning.count` (singular), `weather.warning.count_plural`
- **Weekly summary**: `weekly.title`, `weekly.subtitle`, `weekly.days`, `weekly.streak`, `weekly.most_worn`
- **Unused gem**: `gem.days_ago`, `gem.outfit`
- **Accent colors**: `accent.indigo`, `accent.petrol`, `accent.forest`, `accent.sage`, `accent.navy`, `accent.slate`, `accent.burgundy`, `accent.rose`, `accent.terracotta`, `accent.amber`, `accent.plum`, `accent.charcoal`
- **Analyze errors**: `analyze.not_logged_in`, `analyze.failed`, `analyze.unexpected`
- **Insights fallback**: `insights.unknown_color`

#### 2. Modify `src/components/outfit/WeatherWarnings.tsx`

- Change `analyzeOutfitWeather` signature to accept a `t` function: `analyzeOutfitWeather(items, currentWeather, outfitWeather, t)`
- Replace all hardcoded Swedish warning strings with `t()` calls
- In `WeatherWarnings` component: add `useLanguage` and pass `t` to `analyzeOutfitWeather`
- In `WeatherWarningBadge`: add `useLanguage`, pass `t`, replace `'varning'/'varningar'` with `t()` keys
- Keep `WARM_SEASONS` and `COLD_SEASONS` arrays as-is (they match database values)

#### 3. Modify `src/components/outfit/StylistSummary.tsx`

- Import `useLanguage`
- Replace `occasionLabels` map with `t('occasion.{key}')` calls
- Replace `generateSummary()` hardcoded Swedish sentences with `t()` keys
- Replace `'Stylistens sammanfattning'` with `t('stylist.title')`
- Replace `'Passar vadret'` with `t('stylist.fits_weather')`
- Pass `t` to `analyzeOutfitWeather`

#### 4. Modify `src/components/plan/SmartDayBanner.tsx`

- Replace `occasionConfig` labels (`'Jobb'`, `'Traning'`, `'Fest'`, `'Dejt'`) with `t('occasion.*')` calls
- Dynamic label rendering using `t()`

#### 5. Modify `src/components/plan/DaySummaryCard.tsx`

- Replace `occasionConfig` labels with `t('occasion.*')` calls

#### 6. Modify `src/contexts/ThemeContext.tsx`

- Change `ACCENT_COLORS` `name` field from Swedish display names to translation key IDs (e.g., `'accent.indigo'`)
- The `AccentColorPicker` and `AccentColorStep` components will use `t(color.name)` to display translated names

#### 7. Modify `src/components/settings/AccentColorPicker.tsx`

- Import `useLanguage` and use `t(color.name)` for display label

#### 8. Modify `src/hooks/useAnalyzeGarment.ts`

- Import `useLanguage`
- Replace `'Inte inloggad'`, `'AI-analys misslyckades'`, `'Ett ovantat fel...'` with `t()` keys

#### 9. Modify `src/components/onboarding/StylePreferencesStep.tsx`

- Use `t('color.*')` for the COLORS chip labels instead of displaying raw Swedish strings

#### 10. Modify `src/components/insights/UnusedGemCard.tsx`

- Import `useLanguage`
- Replace `'{daysUnused} dagar sedan'` with `t('gem.days_ago')` interpolated
- Replace `'Outfit'` button text with `t('gem.outfit')`

#### 11. Modify `src/components/insights/WeeklySummary.tsx`

- Import `useLanguage`
- Replace `'Veckosammanfattning'`, `'Din stil denna vecka'`, `'{streak} dagar'`, `'Anvandningsstreak'`, `'Mest anvand denna vecka'` with `t()` keys

#### 12. Modify `src/pages/OutfitDetail.tsx`

- Remove unused `import { sv } from 'date-fns/locale'` on line 25

#### 13. Modify `src/pages/marketing/Admin.tsx`

- Import `useLanguage`
- Replace all hardcoded Swedish labels with `t()` keys (using existing admin.* keys)
- Replace `toLocaleDateString('sv-SE')` with `toLocaleDateString(undefined)`

#### 14. Modify `src/pages/Insights.tsx`

- Replace `'okand'` fallback with `t('insights.unknown_color')`

---

### Technical Notes

- **`analyzeOutfitWeather` is a pure function** called from 3 places: `WeatherWarnings`, `WeatherWarningBadge`, and `StylistSummary`. All callers are React components that can access `useLanguage()`, so they will pass `t` as a parameter.
- **Season matching arrays** (`WARM_SEASONS = ['Vinter', 'Host']`) compare against database-stored values, so they stay in Swedish for data matching. Only display strings change.
- **Color data keys** in `Insights.tsx` colorMap match against database values (Swedish color names in `color_primary`). These stay as-is.
- **Accent color names** change from hardcoded Swedish (`'Skog'`) to translation keys (`'accent.forest'`), requiring corresponding updates in `AccentColorPicker` and `AccentColorStep` to call `t()`.
- The Landing page remains English-only by design.

### Files modified (14 total)
1. `src/i18n/translations.ts`
2. `src/components/outfit/WeatherWarnings.tsx`
3. `src/components/outfit/StylistSummary.tsx`
4. `src/components/plan/SmartDayBanner.tsx`
5. `src/components/plan/DaySummaryCard.tsx`
6. `src/contexts/ThemeContext.tsx`
7. `src/components/settings/AccentColorPicker.tsx`
8. `src/hooks/useAnalyzeGarment.ts`
9. `src/components/onboarding/StylePreferencesStep.tsx`
10. `src/components/insights/UnusedGemCard.tsx`
11. `src/components/insights/WeeklySummary.tsx`
12. `src/pages/OutfitDetail.tsx`
13. `src/pages/marketing/Admin.tsx`
14. `src/pages/Insights.tsx`

