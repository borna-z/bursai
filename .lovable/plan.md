
# 25+ Premium Polish Upgrades for DRAPE

A curated list of improvements across UI consistency, motion, accessibility, performance, and code quality. Each is a small, focused change -- together they elevate the app to a noticeably more polished level.

---

## MOTION AND ANIMATION

### 1. Unify remaining inline spring transitions to EASE_CURVE
Several `motion.button` elements in `Home.tsx` (occasion chips, sub-option chips, onboarding nudge) still use inline `{ type: 'spring', stiffness: 500, damping: 30, mass: 0.5 }` instead of the shared `EASE_CURVE` tween. Same in `BottomNav.tsx` nav-pill.
- **Files:** `Home.tsx`, `BottomNav.tsx`

### 2. Add entrance animations to Settings rows
Settings rows appear instantly. Wrap each `SettingsRow` in the existing `StaggerItem` pattern more consistently and add `animate-drape-in` to `SettingsGroup` children.
- **File:** `SettingsGroup.tsx`

### 3. Smooth skeleton-to-content crossfade
Currently content pops in when loading finishes. Add a `motion.div` fade wrapper (opacity 0 to 1, 300ms) around post-loading content in `Home.tsx`, `Wardrobe.tsx`, `Insights.tsx`.
- **Files:** `Home.tsx`, `Wardrobe.tsx`, `Insights.tsx`

### 4. Add page exit animations
`AnimatedRoutes` has enter transitions but exit animations are minimal. Add a `drape-out` exit variant to `AnimatedPage` so pages slide out subtly when navigating away.
- **Files:** `animated-page.tsx`, `AnimatedRoutes.tsx`

### 5. Bottom nav haptic feedback on tap
Import the existing `haptics.ts` utility and trigger a light haptic on tab switch for native-app feel.
- **File:** `BottomNav.tsx`

---

## SPACING AND LAYOUT

### 6. Consistent section label component
Replace all inline `<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">` with the existing `SectionHeader` component for consistency.
- **Files:** `Home.tsx`, `Wardrobe.tsx`, `Plan.tsx`

### 7. Increase BottomNav height from h-16 to h-[72px]
Match the upgraded PageHeader height for visual symmetry. Adjust `pb-20` in `AppLayout` to `pb-[88px]`.
- **Files:** `BottomNav.tsx`, `AppLayout.tsx`

### 8. Add horizontal page padding constant
Currently `px-4` is hardcoded everywhere. Create a shared `PAGE_PADDING` class string in a layout constants file for single-source consistency.
- **New file:** `src/lib/layout.ts`, then update page files

### 9. Widen max-content width on tablets
`max-w-lg` (512px) is tight on iPad. Add a responsive `sm:max-w-xl` breakpoint for slightly wider content on tablet viewports.
- **Files:** All page components using `max-w-lg mx-auto`

### 10. Add vertical breathing room to EmptyState
Increase `py-16` to `py-20` and `mb-6` to `mb-8` for a more generous empty state.
- **File:** `EmptyState.tsx`

---

## VISUAL POLISH

### 11. Glassmorphism consistency: unify card surfaces
Some cards use `bg-card/70 backdrop-blur-md`, others use `bg-muted/20 backdrop-blur-sm`. Standardize to the `glass-card` utility class from `index.css`.
- **Files:** `Home.tsx` (stat cards), `skeletons.tsx`, `SettingsGroup.tsx`

### 12. Add subtle border-radius to LazyImage
Images currently have no border radius. Add `rounded-lg` as default to `LazyImage` for softer edges matching the Scandinavian aesthetic.
- **File:** `lazy-image.tsx`

### 13. Upgrade skeleton shimmer direction
Current shimmer goes left-to-right. Change to a diagonal sweep (135deg) for a more premium loading feel.
- **File:** `index.css` (`.skeleton-shimmer` gradient angle)

### 14. Weather widget icon size bump
The weather icon container (`w-12 h-12`) feels small relative to the 4xl temperature text. Bump to `w-14 h-14` and icon to `w-8 h-8`.
- **File:** `WeatherWidget.tsx`

### 15. Premium accent color picker: larger swatches
Color swatches at `w-8 h-8` are hard to tap on mobile. Increase to `w-10 h-10` with `gap-3` for better touch targets.
- **File:** `AccentColorPicker.tsx`

### 16. Add divider line between SettingsGroup blocks
Add a subtle `border-t border-border/30 mt-2` between the main group and the sign-out group in Settings for visual separation.
- **File:** `Settings.tsx`

---

## TYPOGRAPHY

### 17. Increase PageHeader title size
Bump from `text-lg` to `text-xl` for more visual weight in the header, matching the "premium app" feel.
- **File:** `PageHeader.tsx`

### 18. Badge font-weight refinement
Current badges use `font-semibold`. Switch to `font-medium` for a calmer, more refined look.
- **File:** `badge.tsx`

### 19. Subtitle line-height improvement
Add `leading-relaxed` to subtitle text in `PageHeader` for better readability when subtitles are present.
- **File:** `PageHeader.tsx`

---

## ACCESSIBILITY

### 20. Add aria-labels to icon-only buttons
Several icon-only buttons (refresh, swap, filter toggles) lack `aria-label`. Add descriptive labels.
- **Files:** `Home.tsx`, `Wardrobe.tsx`, `OutfitSlotCard.tsx`

### 21. Keyboard focus ring on Chip component
The `Chip` component has no `focus-visible` ring. Add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1` to the chip variants.
- **File:** `chip.tsx`

### 22. Screen reader text for stat cards
Add `sr-only` labels to the stat cards so screen readers announce "Total garments: 42" instead of just "42".
- **File:** `Home.tsx` (InsightsSection stat grid)

---

## PERFORMANCE

### 23. Memoize occasion/style arrays
`OCCASIONS` and `STYLES` arrays in `Home.tsx` are defined at module scope (good), but the grid rendering could benefit from `React.memo` on the occasion button component to prevent re-renders when only selection state changes.
- **File:** `Home.tsx`

### 24. Lazy-load Insights tab content
The Insights tab on Home is rendered even when not visible. Wrap in a conditional render that only mounts when `activeTab === 'insights'` (already partially done, but the `InsightsSection` data hooks fire regardless).
- **File:** `Home.tsx`

### 25. Add `will-change-transform` to animated bottom nav pill
The `motion.div` with `layoutId="nav-pill"` triggers layout animations. Adding `will-change-transform` prevents paint jank.
- **File:** `BottomNav.tsx`

---

## CODE QUALITY

### 26. Extract shared motion constants (duration, stagger)
Expand `src/lib/motion.ts` with commonly reused values: `DURATION_FAST = 0.15`, `DURATION_DEFAULT = 0.25`, `STAGGER_DELAY = 0.04`.
- **File:** `src/lib/motion.ts`

### 27. Extract tab switcher into reusable component
The segmented control pattern (Home tab switcher, AI Chat mode switcher) is duplicated. Extract into a generic `SegmentedControl` component.
- **New file:** `src/components/ui/segmented-control.tsx`
- **Files updated:** `Home.tsx`, `AIChat.tsx`

### 28. Standardize loading spinner pattern
Some pages use `<Loader2 className="w-8 h-8 animate-spin text-accent" />` inline, others use skeleton grids. Create a `PageSpinner` component for consistency.
- **New file:** `src/components/layout/PageSpinner.tsx`
- **Files updated:** `Settings.tsx`, `AIChat.tsx`, and others

---

## Summary

| Category | Count |
|----------|-------|
| Motion and Animation | 5 |
| Spacing and Layout | 5 |
| Visual Polish | 6 |
| Typography | 3 |
| Accessibility | 3 |
| Performance | 3 |
| Code Quality | 3 |
| **Total** | **28** |

All changes are incremental Tailwind class swaps, small component extractions, or constant definitions. No architectural changes or new dependencies required.
