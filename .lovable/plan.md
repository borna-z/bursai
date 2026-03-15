

# Premium Home Screen Refinement

## Current State

The Home screen has good bones: state-aware hero, quick actions, AI suggestions, gap analysis, mood outfit. But it reads as a well-organized dashboard rather than a premium style command center. Specific issues:

- **Greeting area**: `text-lg` heading feels small and generic. Settings icon treatment is functional but not elevated.
- **Today's Outfit card** (`TodayOutfitCard`): Uses `bg-foreground/[0.02]` — nearly invisible surface. The 2-col garment grid has tight `gap-1.5`. The "Swipe right to wear →" hint text looks like a tooltip. Buttons are heavy at `h-12` with thick font-bold.
- **Planned outfit hero** (inline in Home.tsx): Uses `surface-hero` but tiny `w-12 h-12` thumbnails and cramped badges.
- **Quick actions row**: Two equal-weight buttons feel flat. Both use `surface-inset` — no differentiation from each other.
- **AI Suggestions**: `surface-hero` works, but the header row (sparkle icon + "STYLED FOR YOU" + stale indicator + refresh button) is busy. Garment circles at `w-16 h-16` are small.
- **Wardrobe gap + mood buttons**: Both use `surface-interactive` — identical weight. Mood outfit button is visually same as gap analysis CTA.
- **Empty/no-outfit states**: `p-10 text-center` with a generic icon-in-rounded-square pattern.

## Plan

### 1. Home.tsx — Greeting + Hero upgrades

**Greeting**: Bump to `text-xl` with tighter tracking. Remove Sora font-family override (use the global heading stack). Add a subtle date line below the greeting as `label-editorial` to ground the screen temporally (e.g., "Sunday, 15 March").

**Planned outfit hero**: Increase thumbnail size from `w-12 h-12` to `w-14 h-14`. Add `rounded-xl` instead of `rounded-lg`. Use `surface-hero` class properly (already does). Remove the `p-3` cramped padding, use `p-4`.

**No-outfit / empty states**: Reduce padding from `p-10` to `p-8`. Make the icon container more editorial — remove the rounded-2xl background box, use just the icon at a larger size with lower opacity. Make the CTA button use the accent color explicitly.

**Weather alert banner**: Fine as-is.

**Tertiary section** (gap + mood): Add a `label-editorial` overline "More for you" or similar above this section. This separates it from the primary content above.

### 2. TodayOutfitCard.tsx — Make it feel like THE outfit

- Increase garment grid gap from `gap-1.5` to `gap-2`
- Change image aspect ratio from `4/5` to `3/4` — slightly taller, more fashion-forward
- Remove the explicit "Swipe right to wear →" text (the UI should feel intuitive without instruction text)
- Reduce button height from `h-12` to `h-11` and soften the font-bold to font-semibold on the outline button
- Make the "See details →" link slightly more present — `text-[11px]` with proper tracking instead of generic `text-xs`
- Remove the `bg-foreground/[0.02]` and use `surface-hero` class for consistency with the planned-outfit card

### 3. QuickActionsRow.tsx — Subtle differentiation

- Keep the two-button layout
- Add icon opacity differentiation: both icons at `text-muted-foreground/70` but on hover brighten
- Increase height from `h-11` to `h-12` and use `rounded-2xl` for rounder, more premium feel
- Keep `surface-inset`

### 4. AISuggestions.tsx — More luxurious

- Increase garment circle size from `w-16 h-16` to `w-[72px] h-[72px]`
- Clean up the header: remove the sparkle icon inline, keep just the editorial label and the refresh button. Move `StaleIndicator` to be less prominent (smaller, more muted).
- Increase CTA button height from `h-9` to `h-10`
- Add subtle top border separator between header and content via a thin `border-b border-border/10` on the header row

### 5. index.css — No surface system changes needed

Everything uses the existing surface tokens correctly. No CSS changes needed.

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Home.tsx` | Greeting typography, date line, planned-outfit sizing, empty state refinement, tertiary overline |
| `src/components/home/TodayOutfitCard.tsx` | Surface class, grid gap, aspect ratio, remove swipe hint, button refinement, details link |
| `src/components/home/QuickActionsRow.tsx` | Height, radius, icon opacity |
| `src/components/insights/AISuggestions.tsx` | Garment circle size, header cleanup, CTA height |

## What Does NOT Change

- Layout structure, section order, component hierarchy
- Surface design system tokens
- BottomNav, WeatherPill, WardrobeGapSection, mood button structure
- Navigation, routing, data fetching

