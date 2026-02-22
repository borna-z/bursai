

# UI & UX Polish Plan -- "Great Feel" Upgrade

This plan focuses on micro-interactions, visual hierarchy, and tactile feedback improvements across all main screens to make the app feel truly premium and delightful.

---

## 1. Home Page -- Hero Greeting & Create Flow

**Current state**: The greeting is plain text in a standard PageHeader. The occasion grid and style selector work but feel flat.

**Changes**:
- Replace the plain PageHeader greeting with a larger, more expressive greeting block inside the page body (Sora font, text-2xl, with a subtle fade-in). Add the user's first name if available from profile data.
- Add a soft gradient accent line under the greeting (2px, accent-indigo, 40% opacity, 80px wide) for visual anchoring.
- Make occasion cards slightly taller with a subtle background tint when selected (accent/8 instead of accent/5), and add a thin inner shadow for depth.
- Add a "pulse" micro-animation on the Generate button when an occasion is selected (a gentle scale breathe, 3s loop) to draw attention.
- Wrap the style chips in a horizontal scroll container with a fade-out mask on the right edge to hint at scrollability.

## 2. Bottom Navigation -- Refined Active State

**Current state**: The nav pill is a simple accent/10 rounded rectangle.

**Changes**:
- Add a tiny 3px dot indicator below the active icon (accent color, rounded-full) in addition to the pill, for a cleaner "iOS 18" look.
- Increase the pill's blur slightly (backdrop-blur-sm on the pill itself) for a more glass-like feel.
- Add a subtle scale-up (1.08) on the active icon with a spring transition for a bouncy, alive feel.

## 3. Wardrobe -- Card Refinements & Empty State

**Current state**: Grid cards use glass-card styling. The empty state is functional but bland.

**Changes**:
- Add a soft 1px inner shadow to grid cards (`shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]` in dark mode) for a glass edge highlight.
- Add a gentle hover/press lift effect: translate-y of -2px on tap with a spring transition.
- Make the garment image slightly zoom (scale 1.03) on press for a tactile feel.
- Improve the empty state with a larger illustration area, animated Shirt icon (gentle float animation), and a more inviting CTA.

## 4. Plan Page -- Day Transitions & Weather

**Current state**: Day switching uses animate-drape-in. The WeekStrip is functional but compact.

**Changes**:
- Add a directional slide to the day content: slide-left when moving forward in days, slide-right when going back, using framer-motion AnimatePresence with a direction state.
- Make the selected day in WeekStrip have a subtle scale-up (1.1) with a spring animation.
- Add a soft color tint to the WeekStrip day number based on planned status: accent for planned, success for worn.

## 5. AI Chat -- Conversational Polish

**Current state**: Messages render cleanly but without personality.

**Changes**:
- Add a typing indicator with three animated dots (scale pulse, staggered) instead of just a spinner when the assistant is streaming.
- Add a subtle slide-up animation (translateY 8px to 0, 200ms) for each new message as it appears.
- Make the welcome state more inviting: larger icon, a gradient text effect on the greeting, and pill-shaped suggestion buttons with a glass-chip style.

## 6. Settings -- Visual Hierarchy

**Current state**: Settings rows are clean but all visually equal weight.

**Changes**:
- Add a user profile card at the top of Settings: avatar circle (initials or photo), user email, and subscription badge. This creates a personal connection.
- Add subtle icon background circles (w-8 h-8 rounded-full bg-accent/8) behind each settings icon for visual rhythm.

## 7. Global Micro-Interactions

**Changes across all pages**:
- **Pull-to-refresh**: Add a custom branded indicator -- the DRAPE monogram that rotates while refreshing, replacing the default spinner.
- **Page transitions**: Slightly increase the exit animation opacity duration (from 0.35s to 0.4s) for smoother page leaves.
- **Toast notifications**: Style success toasts with a subtle green-tinted left border and a check icon, error toasts with red.
- **Skeleton loading**: Add a warmer shimmer direction (left-to-right instead of diagonal) and slightly slower animation (2s instead of 1.5s) for a calmer loading feel.

## 8. Typography Refinements

**Changes**:
- Increase letter-spacing on section headers from `tracking-wide` to `tracking-widest` for a more luxurious uppercase look.
- Add `font-feature-settings: "ss01"` to heading elements for stylistic alternates in Inter/Sora (if available).

---

## Technical Details

### Files to modify:
1. `src/pages/Home.tsx` -- Greeting block, occasion card tweaks, generate button animation
2. `src/components/layout/BottomNav.tsx` -- Active dot indicator, spring scale on active icon
3. `src/pages/Wardrobe.tsx` -- Card inner shadow, press animation
4. `src/pages/Plan.tsx` -- Directional day transitions
5. `src/pages/AIChat.tsx` -- Typing indicator, message animations
6. `src/pages/Settings.tsx` -- Profile card at top
7. `src/components/layout/PageHeader.tsx` -- No changes (Home will use custom greeting instead)
8. `src/components/ui/section-header.tsx` -- Wider letter-spacing
9. `src/index.css` -- Shimmer animation timing, toast border styles, new utility classes
10. `src/lib/motion.ts` -- Add spring config constant for bouncy interactions
11. `src/components/layout/PullToRefresh.tsx` -- Branded refresh indicator
12. `src/components/ui/sonner.tsx` -- Toast styling overrides

### New components:
- `src/components/settings/ProfileCard.tsx` -- User identity card for settings top

### Dependencies:
- No new packages needed. All changes use existing framer-motion, Tailwind, and Lucide.

### Risk:
- Low. All changes are additive visual polish. No data flow or business logic modifications.
- Performance: spring animations use `will-change-transform` to prevent paint jank.

