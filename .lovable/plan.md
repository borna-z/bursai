

# Fix: "plan.title" raw key showing on AI Suggestions button

## Problem
The "Plan" button in the AI Suggestions hero card uses `t('plan.title')` but that translation key doesn't exist in any locale. The button displays the raw key string "plan.title" instead of a proper label.

## Solution
Replace `t('plan.title')` with a proper translation key. The English word "Plan" is already used in the app — we can add a dedicated key or simply use an existing one. The simplest fix: add `'plan.title': 'Plan'` to the English translations (and equivalents for other locales), OR just hardcode "Plan" since it's a universal short word. Best approach: add the missing key to all locale blocks.

## Changes

### `src/i18n/translations.ts`
- Add `'plan.title'` key to each locale block:
  - `sv`: `'Planera'`
  - `en`: `'Plan'`
  - `no`: `'Planlegg'`
  - `da`: `'Planlæg'`
  - `fi`: `'Suunnitelma'`
  - `de`: `'Planen'`
  - `fr`: `'Planifier'`
  - (and any other locales present)

No other files need changes — `AISuggestions.tsx` already uses `t('plan.title')` correctly, it just needs the key to exist.

