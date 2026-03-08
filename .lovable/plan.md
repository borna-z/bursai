

## Performance and Mobile-First Layout Overhaul

### Problems Identified

1. **Landing ProductShowcase**: Phone mockups are 280px/220px fixed widths — overflow on small screens. Side phones hidden on mobile, only center shown. Labels hidden too. No responsive scaling.
2. **Wardrobe page**: `max-w-lg mx-auto` constrains width unnecessarily. Grid row height hardcoded to 220px — doesn't adapt. Virtual grid `maxHeight: calc(100vh - 200px)` creates nested scroll issues. `pt-12` wastes vertical space on small screens.
3. **Outfit Detail**: `pb-32` excessive bottom padding. Hero grid always 2-col even for single items on narrow screens.
4. **Route transitions**: Full AnimatePresence with scale+translate on every route change adds perceived lag. Exit animation blocks incoming page render.
5. **Phone mockup CSS**: Fixed pixel sizes, no responsive breakpoints, `float-phone` animation runs continuously (GPU cost).
6. **Landing PricingSection**: Feature grid `grid-cols-2 sm:grid-cols-3` works but padding `p-8 md:p-10` tight on very small devices.

### Plan

**1. Make phone mockups responsive on landing page**
- Replace fixed `width: 280px / 220px` with responsive sizes using `clamp()` or percentage widths
- Show all 3 phones on mobile but smaller (e.g., center phone ~55vw, side phones ~40vw)
- Show all 3 labels on mobile instead of hiding them
- Remove continuous `float-phone` animation (replace with `will-change: none` at rest)

**2. Optimize route transitions for speed**
- Reduce transition duration from 0.4s to 0.2s
- Remove `scale: 0.98` from route variants (scale triggers compositing on every route change)
- Simplify to opacity-only fade for faster perceived navigation

**3. Fix Wardrobe mobile layout**
- Remove `pt-12` top padding, use `pt-safe` or `pt-4` for tighter header
- Fix virtual grid `maxHeight` to use proper parent scrolling instead of nested scroll container
- Make grid 3-col on wider phones (375px+) for denser gallery feel
- Reduce `gap-2.5` to `gap-1.5` for tighter editorial grid

**4. Fix Outfit Detail mobile spacing**
- Reduce `pb-32` to `pb-24` (still clears bottom nav)
- Make hero image grid full-bleed (remove `rounded-b-3xl` on mobile for edge-to-edge feel)

**5. Landing page general mobile fixes**
- Reduce hero `text-5xl` to `text-4xl` on very small screens
- Make pricing card padding `p-5` on mobile instead of `p-8`
- Ensure footer links wrap properly on narrow screens

**6. Performance quick wins**
- Add `content-visibility: auto` to below-fold landing sections via CSS
- Remove `backdrop-filter` from elements that don't need it on mobile (expensive)
- Reduce `AnimatePresence mode="wait"` to `mode="sync"` for route transitions so pages don't block each other

### Files to Change
- `src/index.css` — responsive phone mockup sizes, content-visibility
- `src/components/landing/ProductShowcase.tsx` — responsive layout, show all phones on mobile
- `src/components/landing/HeroSection.tsx` — smaller text on small screens
- `src/components/landing/PricingSection.tsx` — tighter mobile padding
- `src/components/layout/AnimatedRoutes.tsx` — faster transitions
- `src/pages/Wardrobe.tsx` — tighter spacing, fix virtual grid scroll, denser grid
- `src/pages/OutfitDetail.tsx` — reduce bottom padding, full-bleed hero
- `src/pages/Plan.tsx` — minor spacing adjustments

