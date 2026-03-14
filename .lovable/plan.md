

# Redesign AI Suggestions on Home Page

## Issues Found

1. **Broken translation**: `StaleIndicator` uses `t('common.ago')` and `t('common.just_now')` — these keys don't exist. The `t()` function returns the key itself as fallback, so users see "2m common.ago" literally. The correct existing keys are `insights.ago` / need to add `common.just_now`.

2. **Garment circles too small**: Currently `w-14 h-14` (56px) — feels tiny on mobile. Need to bump to ~72–80px.

3. **Layout feels disconnected**: Occasion label, title, explanation, circles, and buttons are stacked with minimal visual hierarchy. The design needs tighter grouping and clearer flow.

## Plan

### Fix 1 — StaleIndicator broken translations
In `src/components/ui/StaleIndicator.tsx`, change `t('common.ago')` → `t('insights.ago')` and `t('common.just_now')` → a hardcoded "just now" or add the missing key. Simplest: add `common.just_now` and `common.ago` to translations. But since `insights.ago` already exists everywhere, just use that.

### Fix 2 — Redesign AISuggestions component
Rework `src/components/insights/AISuggestions.tsx`:

- **Garment circles**: Increase from `w-14 h-14` to `w-[72px] h-[72px]` with slightly less overlap (`-space-x-4`)
- **Layout restructure**: Put occasion + title at top, then garment circles prominently in the center, then explanation below the circles as context, then CTAs at the bottom
- **Visual polish**: Add subtle card-like backdrop behind the garment stack area, better spacing between sections
- **Remove StaleIndicator from view** — it's confusing UX clutter; the refresh button already serves this purpose. Or fix and keep it very subtle.

### Fix 3 — Premium gate placeholder circles
Update the blurred premium gate to match the new larger circle sizes.

### Files to edit
1. `src/components/insights/AISuggestions.tsx` — redesign layout, bigger circles
2. `src/components/ui/StaleIndicator.tsx` — fix translation keys
3. `src/i18n/translations.ts` — add `common.just_now` key or switch to `insights.ago`

