
# Add Arabic and Farsi (Persian) Languages

## Overview
Add Arabic (ar) and Farsi/Persian (fa) as new language options. Both are **right-to-left (RTL)** languages, which requires layout handling beyond just adding translations.

## Changes

### 1. Update Locale type and supported locales (`src/i18n/translations.ts`)
- Extend the `Locale` type to include `'ar' | 'fa'`
- Add entries to `SUPPORTED_LOCALES`:
  - `{ code: 'ar', name: 'العربية', flag: '🇸🇦' }`
  - `{ code: 'fa', name: 'فارسی', flag: '🇮🇷' }`
- Add full translation blocks for both languages with all keys (matching the same keys as `sv` and `en`)

### 2. Add RTL support (`src/contexts/LanguageContext.tsx`)
- Define an `RTL_LOCALES` set containing `'ar'` and `'fa'`
- When locale changes, set `document.documentElement.dir` to `'rtl'` or `'ltr'`
- Set `document.documentElement.lang` to the current locale code

### 3. Add base RTL CSS (`src/index.css`)
- Add a small block of RTL-aware utility overrides:
  ```css
  [dir="rtl"] { text-align: right; }
  ```
- This ensures text alignment flips automatically. Tailwind's flexbox/grid layouts mostly adapt, but a few spots may need `rtl:` variants.

### 4. Minor layout adjustments
- Review `BottomNav`, `PageHeader`, and `SettingsRow` for any hardcoded `left`/`right` styles that need mirroring in RTL mode. Tailwind's logical properties (`ms-`, `me-`, `ps-`, `pe-`) handle most cases, but icons with explicit `mr-` may need `rtl:ml-` counterparts.

## Technical Details

| File | Change |
|------|--------|
| `src/i18n/translations.ts` | Add `'ar'` and `'fa'` to `Locale` type, `SUPPORTED_LOCALES`, and `translations` object |
| `src/contexts/LanguageContext.tsx` | Set `dir` and `lang` on `<html>` when locale changes |
| `src/index.css` | Add `[dir="rtl"]` base rule |

## Translation scope
Both `ar` and `fa` will include all ~120 translation keys covering navigation, onboarding, settings, wardrobe, outfits, plan, insights, and general UI strings.
