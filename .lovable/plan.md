

## Plan: Replace Today's Outfit with AI Suggestions on Home Page

### What changes
Replace the `TodayOutfitCard` on the Home page with the `AISuggestions` carousel component (currently used on the Insights page). This gives users curated AI outfit suggestions as their primary home experience instead of a single auto-generated outfit.

### Implementation

**`src/pages/Home.tsx`**
1. Remove `TodayOutfitCard` import and its usage (lines 116-127)
2. Import `AISuggestions` from `@/components/insights/AISuggestions`
3. Import `useSubscription` to pass `isPremium` prop
4. Replace the `TodayOutfitCard` block with `<AISuggestions isPremium={isPremium} />`
5. Remove now-unused state (`outfitKey`, `occasion`, `style`, `handleUpdateOutfit`, `handleOccasionChange`, `handleStyleChange`) and the `AdjustDaySection` component that depended on them
6. Keep `handleUseUnused` for `SmartInsightCard` or simplify it

**Cleanup**
- Remove `AdjustDaySection` from the lazy imports since occasion/style controls are no longer needed
- The `weatherData` variable can also be removed since it was only used by `TodayOutfitCard`

No backend or database changes required. The `AISuggestions` component already handles its own data fetching via `useAISuggestions` hook.

