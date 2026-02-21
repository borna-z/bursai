
# Apply Dark Glass Aesthetic Across Entire PWA

## Summary
Make the entire in-app experience match the Auth page's dark noir glass aesthetic. The dark background (#030305), glass cards with `backdrop-blur`, white/opacity text -- applied globally through the theme system so it cascades everywhere automatically.

## Approach
Instead of editing every single page file, we leverage the existing CSS variable system and dark theme. By tuning the dark theme tokens to match the Auth page look and defaulting to dark mode, all pages (Home, Wardrobe, Plan, Stylist, Settings, Insights, etc.) inherit the aesthetic automatically.

## Changes

### 1. CSS Dark Theme Tokens (`src/index.css`)
Adjust the `.dark` block to match the Auth page noir:
- `--background`: shift from `0 0% 5%` to `240 20% 2%` (closer to #030305)
- `--card`: adjust to `240 10% 7%` at reduced opacity for glass card effect
- `--border`: soften to `0 0% 14%` for subtler glass borders
- `--muted`: tune for shimmer visibility on the darker bg

### 2. Default to Dark Mode (`src/contexts/ThemeContext.tsx`)
- Change default theme from `'system'` to `'dark'` so new users get the noir look immediately
- Keep the light/dark/system toggle in Settings for users who prefer light mode

### 3. BottomNav Glass Update (`src/components/layout/BottomNav.tsx`)
- Update the nav background from `bg-background/60` to a more explicit dark glass: `bg-[#030305]/80 backdrop-blur-xl border-t border-white/[0.06]`
- Remove the `shadow` in favor of the subtle top border (matching Auth page divider style)

### 4. PageHeader Glass Update (`src/components/layout/PageHeader.tsx`)
- Update from `bg-background/70` to dark glass styling: `bg-[#030305]/70 backdrop-blur-xl border-b border-white/[0.06]`
- Remove the `shadow` bottom line for the cleaner glass border

### 5. AppLayout Background (`src/components/layout/AppLayout.tsx`)
- Add explicit `bg-[#030305]` to ensure the noir background is consistent regardless of theme variable rendering timing

### 6. Settings Appearance - Keep Theme Toggle
- No changes needed -- users can still switch to light if they want, but dark is now default

## What Automatically Inherits
Because the app uses CSS variables (`bg-background`, `text-foreground`, `bg-card`, `border-border`, etc.) throughout, these pages get the dark look for free:
- **Home** -- all cards, stat grids, occasion buttons, style chips
- **Wardrobe** -- garment cards, filters, search bar
- **Plan** -- day cards, week strip, outfit slots
- **Stylist/AI Chat** -- chat bubbles, input area
- **Settings** -- all settings groups and rows
- **Insights** -- stat cards, charts, bars
- **Add/Edit Garment** -- form inputs, selectors
- **Outfit pages** -- detail views, generation UI

## Technical Notes
- No new files or dependencies needed
- Total files modified: **5** (index.css, ThemeContext, AppLayout, BottomNav, PageHeader)
- The aurora glows are NOT added (per your request) -- just the clean dark background + glass surfaces
- All existing functionality (pull-to-refresh, animations, scroll behaviors) remains unchanged
