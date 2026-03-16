

# Premium App Feel Pass

## Current State Assessment

The app has solid bones — working flows, semantic surfaces (hero/secondary/inset/interactive), editorial typography tokens, and motion presets. But several high-visibility areas feel unfinished or inconsistent, creating gaps in the "one premium product" feeling.

## What's Already Strong (Preserve)
- BottomNav: frosted glass, animated pill, haptic feedback — premium
- Surface hierarchy: 4-tier system is well-defined
- Motion system: purpose-based presets with reduced-motion support
- Settings page: clean grouped rows with consistent spacing
- Garment Detail: hero image with floating controls — editorial

## Issues & Improvements

### 1. Home Page — Greeting & Hero Polish
**Problem**: Greeting section uses `text-xl` which feels small for a hero moment. Date line opacity (`/50`) is too faint. Settings icon button lacks the glass treatment used elsewhere.
**Fix**: Bump greeting to `text-[1.625rem]` (h1 token). Increase date opacity to `/60`. Add `surface-inset` to settings button for consistency.

### 2. Home Page — Empty & No-Outfit States
**Problem**: Empty states use `rounded-2xl surface-secondary p-8` but icons are too faint (`/25`). The CTA buttons use `bg-accent` inline instead of the Button component's default variant.
**Fix**: Increase icon opacity to `/40`. Use the `surface-hero` class for empty states (they're the primary content when visible). Standardize button approach.

### 3. QuickActionsRow — Touch Target & Visual Weight
**Problem**: Two buttons feel sparse. Text at `0.75rem` is hard to read. The `surface-inset` class makes them recede too much for action buttons.
**Fix**: Bump text to `0.8125rem` (13px). Switch from `surface-inset` to `surface-interactive` for better affordance. Add subtle icon color bump.

### 4. AISuggestions — Card Polish
**Problem**: Garment circles use hardcoded `border-2 border-border/20` and `shadow-sm`. The occasion label uses inline `text-[9px]` which is inconsistently small. CTA buttons lack visual hierarchy — "Try it" and "Plan" look similar.
**Fix**: Use consistent `border border-border/30` on garment circles. Bump occasion to `text-[10px]`. Make "Try it" button use accent color for clear primary action.

### 5. OutfitDetail — Section Labels Inconsistency  
**Problem**: Multiple section labels use inline `text-[11px] text-muted-foreground/60 uppercase tracking-wide font-medium` instead of the `label-editorial` class. This appears on lines for "Why it works", "Style Score", "Photo Feedback", "Rating", "Feedback".
**Fix**: Replace all inline section label patterns with `label-editorial` class.

### 6. OutfitDetail — Sticky Bottom Bar
**Problem**: The action bar uses `bg-background/60 backdrop-blur-2xl` which matches BottomNav but the `border-border/15` is inconsistent. The "Mark Worn" button uses default variant, not accent.
**Fix**: Align border opacity with BottomNav. Use accent color for primary action.

### 7. GarmentDetail — Content Spacing
**Problem**: Uses `px-6 pt-8 space-y-8` which doesn't match the `page-container` pattern. Stats section uses `text-3xl font-light` which feels web-template-like, not editorial.
**Fix**: Align padding with page-container. Refine stat typography to `text-2xl font-semibold` for editorial weight.

### 8. GarmentDetail — Bottom CTAs
**Problem**: Two full-width stacked buttons with `rounded-2xl h-12` feel heavy. "Use in outfit" has `bg-accent` inline, "Mark worn" is outline — good hierarchy but both could use a sticky bottom bar like OutfitDetail for consistency.
**Fix**: Wrap in sticky bottom bar matching OutfitDetail's pattern for consistency across detail pages.

### 9. PageHeader — Border & Blur
**Problem**: Uses `border-b border-border` (full opacity) while BottomNav uses `border-border/15`. This creates a heavy top bar vs. light bottom bar inconsistency.
**Fix**: Match border to `border-border/15` for unified feel. Increase blur from `backdrop-blur-lg` to `backdrop-blur-2xl`.

### 10. OutfitGenerate — Fixed Button Gradient
**Problem**: The fixed generate button uses `bg-gradient-to-t from-background via-background to-transparent` which can feel harsh.
**Fix**: Use `from-background via-background/95` for softer fade.

### 11. Swap Sheet Mode Buttons — Not i18n'd
**Problem**: "Safe", "Bold", "Fresh" labels in the swap sheet are hardcoded English.
**Fix**: Use `t()` keys.

## Files to Change

1. **`src/pages/Home.tsx`** — Greeting typography, empty state icon opacity, surface class upgrades
2. **`src/components/home/QuickActionsRow.tsx`** — Text size, surface class, icon opacity
3. **`src/components/insights/AISuggestions.tsx`** — Garment circle borders, occasion label size, CTA button accent
4. **`src/pages/OutfitDetail.tsx`** — Replace inline section labels with `label-editorial`, fix sticky bar styling, i18n swap mode labels
5. **`src/pages/GarmentDetail.tsx`** — Stat typography refinement, sticky bottom CTA bar, padding alignment
6. **`src/components/layout/PageHeader.tsx`** — Border opacity and blur alignment
7. **`src/pages/OutfitGenerate.tsx`** — Softer gradient fade on fixed button
8. **`src/i18n/translations.ts`** — Add swap mode keys (safe/bold/fresh)

## Summary
8 files modified. No new components. No structural changes. Focus on typography weight, surface consistency, border/blur alignment, and label standardization across the 5 highest-visibility screens (Home, OutfitDetail, GarmentDetail, OutfitGenerate, PageHeader).

