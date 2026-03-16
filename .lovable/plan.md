

# Premium Polish Pass -- Align App with burs.me/welcome

## Source of Truth: burs.me/welcome

The landing page establishes a clear design language:
- **Typography**: Playfair Display 900 for headlines, DM Sans 300-500 for body. All labels are 10-12px uppercase with 2-5px letter-spacing.
- **Color**: Warm beige #F5F0E8 bg, #EDE8DF surfaces, #DDD8CF borders, #1C1917 ink, #6B6560 muted text.
- **Shape**: Square edges everywhere (no border-radius). Only the phone frame mockup uses radius.
- **Spacing**: Generous -- 72px section padding, 28px gaps, 36px margins. Everything breathes.
- **Interaction**: Subtle transitions on cubic-bezier(.22,1,.36,1), no bounce/spring effects. Hover reveals via border-color changes and underlines.
- **Buttons**: Square, uppercase 11px tracking 2.5px, solid ink fill for primary, ghost border for secondary.
- **Depth**: Flat. No shadows on cards. Only phone mockups have decorative shadow. Borders define edges, not shadows.
- **Feedback chips/tags**: 9-11px uppercase, square edges, border-only.

## Discrepancies Found

### 1. CSS: `--radius` set to 0px in light mode but app ignores it everywhere
Light mode sets `--radius: 0px` but components hardcode `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-full`. The design system variable is being bypassed by ~90% of components. The surface utilities (`surface-hero`, `surface-secondary`, etc.) don't include any radius, but every component that uses them adds its own `rounded-2xl`.

**Fix**: This is the single biggest gap. Rather than touching 90 files, add a CSS layer that in light mode forces key rounded classes to 0. Components keep their dark-mode radius and light mode gets the editorial square look.

### 2. Button component uses `rounded-xl` hardcoded
The cva definition in `button.tsx` uses `rounded-xl` in the base class. In light mode this should be 0.

**Fix**: Replace `rounded-xl` with `rounded-[var(--radius)]` so the token controls it.

### 3. Chip component uses `rounded-full` hardcoded
Always pill-shaped. Landing page tags are square.

**Fix**: Use `rounded-[var(--radius,9999px)]` -- dark mode radius token gives rounded, light mode gives square.

### 4. Badge component uses `rounded-full` hardcoded
Same issue as Chip.

**Fix**: Same approach.

### 5. SettingsGroup card uses `rounded-2xl`
Should be token-aware.

**Fix**: Replace with `rounded-[var(--radius)]`.

### 6. Sheet (bottom sheet) uses hardcoded `bg-background/80 backdrop-blur-xl`
Landing page has no glass effects in light mode. Light mode already strips blur from header/nav, but Sheet keeps it.

**Fix**: The existing CSS pattern already strips blur from nav/header in light mode. Add a similar rule for sheets, or keep blur for sheets since they're overlays (acceptable deviation). No change needed here -- sheets are modal overlays where blur is functional.

### 7. Home page `surface-hero` still has shadow in light mode
`surface-hero` applies `box-shadow` inline. Landing page is flat, no card shadows.

**Fix**: Already handled by `.card-clean` light-mode override, but `surface-hero` has its own shadow. Add light-mode override.

### 8. EmptyState icon container uses `rounded-3xl`
Should be token-aware.

### 9. Home page "no_outfit" and "empty_wardrobe" cards use `rounded-2xl`
Should use token.

### 10. OutfitDetail sticky bottom bar buttons use `rounded-2xl`
Should use token.

### 11. Wardrobe segmented control uses `rounded-xl` and inner `rounded-[10px]`
Should use token.

### 12. QuickActionsRow uses `rounded-2xl`
Should use token.

### 13. AISuggestions container uses `rounded-2xl`
Should use token.

### 14. "AI Feedback" label in OutfitDetail (line 706) is hardcoded English
Should use `t()`.

### 15. console.log still in OutfitDetail line 459
Should be removed.

## Implementation Plan

### Approach: CSS-level token enforcement + targeted component fixes

Rather than editing 40+ component files to replace every `rounded-*` with a variable, use a CSS override layer that in light mode overrides the most common radius patterns. Then fix the 6 shared primitive components (Button, Chip, Badge, Skeleton, SettingsGroup, EmptyState) where the token matters most.

### File 1: `src/index.css` -- Light-mode radius + shadow overrides

Add to the existing light-mode editorial overrides section:
- Override `surface-hero` to remove box-shadow in light mode
- Override `surface-secondary`, `surface-interactive`, `surface-inset` to use square borders
- No need to override every `rounded-*` class globally (would break intentional circles like avatars)

### File 2: `src/components/ui/button.tsx` -- Token-aware radius
- Replace hardcoded `rounded-xl` in base cva class with `rounded-[var(--radius,0.75rem)]`
- Replace `rounded-xl` in size variants with same

### File 3: `src/components/ui/chip.tsx` -- Token-aware radius
- Replace `rounded-full` in base cva class with `rounded-[var(--radius,9999px)]`

### File 4: `src/components/ui/badge.tsx` -- Token-aware radius
- Replace `rounded-full` with `rounded-[var(--radius,9999px)]`

### File 5: `src/components/settings/SettingsGroup.tsx` -- Token-aware radius
- Replace `rounded-2xl` with `rounded-[var(--radius,1rem)]`

### File 6: `src/components/layout/EmptyState.tsx` -- Token-aware radius
- Replace `rounded-3xl` with `rounded-[var(--radius,1.5rem)]`

### File 7: `src/pages/Home.tsx` -- Token-aware radius on key cards
- Replace `rounded-2xl` on hero cards, weather alert, etc with `rounded-[var(--radius,1rem)]`

### File 8: `src/components/home/QuickActionsRow.tsx` -- Token-aware radius
- Replace `rounded-2xl` with `rounded-[var(--radius,1rem)]`

### File 9: `src/components/insights/AISuggestions.tsx` -- Token-aware radius
- Replace `rounded-2xl` on container

### File 10: `src/pages/OutfitDetail.tsx` -- Clean up
- Remove console.log on line 459
- i18n the "AI Feedback" label on line 706
- Token-aware radius on sticky bar buttons

### File 11: `src/pages/Wardrobe.tsx` -- Token-aware segmented control
- Replace `rounded-xl` on segmented control with `rounded-[var(--radius,0.75rem)]`

### File 12: `src/i18n/translations.ts` -- Add AI feedback key

## Summary

- **12 files** modified
- **0 new components**
- Core principle: Make `--radius` the single source of truth so light mode (0px = editorial square) and dark mode (0.75rem = glass rounded) both work from the same component code
- Fix shared primitives (Button, Chip, Badge, Skeleton, SettingsGroup, EmptyState)
- Fix high-visibility cards on Home, AISuggestions, QuickActions, Wardrobe, OutfitDetail
- Clean up remaining hardcoded English and debug logging
- No structural changes, no feature removal, no new design language

