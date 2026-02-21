
# Redesign Auth Page -- Minimalistic Glass Aesthetic

## Overview
Transform the current Auth page (`/auth`) into a premium, minimalistic login experience that matches the landing page's "space noir" glass aesthetic. Add the BURS hanger-B monogram logo, glassmorphism card styling, and entrance animations.

## Visual Changes

**Background**: Replace the plain gradient with the dark noir background (#030305) featuring a subtle aurora glow effect, matching the landing page.

**Logo**: Add the hanger-B monogram (`BursMonogram` component) centered above the "BURS" wordmark, replacing the plain text heading.

**Card**: Apply glassmorphism styling -- `backdrop-blur-xl`, semi-transparent background (`bg-white/5`), subtle `border-white/10` border -- matching the landing page's `glass-panel` class.

**Typography**: Keep the Sora font for "BURS" wordmark. Make the tagline lighter and more spaced.

**Buttons**: Style the primary CTA (login/signup) with a white pill button matching the landing hero. OAuth buttons get glass styling with subtle borders.

**Animations**: Add `framer-motion` entrance animations -- the logo fades in and scales up, the card slides up with opacity, form elements stagger in sequentially.

## Technical Details

### File: `src/pages/Auth.tsx`
- Import `motion` from `framer-motion` and `BursMonogram` from `@/components/ui/BursMonogram`
- Wrap the outer container in `dark-landing` class to activate the dark theme
- Replace background classes with dark noir styling + aurora glow div
- Replace the text-only "BURS" heading with `BursMonogram` icon + styled wordmark
- Wrap the card in `motion.div` with `initial={{ opacity: 0, y: 30 }}` / `animate={{ opacity: 1, y: 0 }}` and spring transition
- Add staggered delays to logo, tagline, and card elements
- Apply glass styling to the Card: `bg-white/5 backdrop-blur-xl border-white/10`
- Style OAuth buttons with `bg-white/5 border-white/10 text-white hover:bg-white/10`
- Style the primary submit button as white pill: `bg-white text-[#030305] rounded-full`
- Style inputs with transparent dark backgrounds: `bg-white/5 border-white/10 text-white`
- Style TabsList and TabsTrigger with glass variants

### No new files or dependencies needed
All animation utilities (`framer-motion`) and glass styles (`dark-landing`, `glass-panel`, `aurora-glow`) already exist in the codebase.
