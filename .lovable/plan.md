

# BURS Landing Page Redesign — Complete Rebuild Plan

## Overview
Complete redesign of `/welcome` into a premium, cinematic 2026 landing page for BURS as an AI wardrobe operating system. This replaces the current Landing.tsx and all landing section components with a new architecture built from scratch.

## Architecture

The current page has ~8 sections across 10 component files. The new page will have 14 sections across ~15 new/rewritten component files, plus new CSS for the visual system.

```text
src/pages/Landing.tsx                    ← rewrite (orchestrator + navbar + scroll logic)
src/components/landing2/                 ← new directory for all sections
  HeroSection.tsx                        ← cinematic hero with floating product cards
  TrustStrip.tsx                         ← animated marquee strip
  ProblemSection.tsx                     ← 3 premium cards
  SystemSection.tsx                      ← sticky scroll feature story (5 states)
  AIStylistSection.tsx                   ← radial glow + floating prompt chips
  WardrobeVisualSection.tsx              ← editorial garment grid
  OutfitBuilderSection.tsx               ← split-screen composition
  WeeklyPlannerSection.tsx               ← glass day cards
  HowItWorksSection.tsx                  ← orbital step cards
  PricingSection.tsx                     ← free vs premium
  SocialProofSection.tsx                 ← floating testimonial cards
  FinalCTASection.tsx                    ← cinematic closing
  LandingFooter.tsx                      ← premium minimal footer
src/index.css                            ← add new landing2 CSS block
```

## Technical Approach

### Visual System (CSS)
Add a new CSS block `.landing-v2` with:
- Base background: `#05070A`
- Surface tokens as CSS variables (`--surface`, `--surface-elevated`, `--border-subtle`)
- Accent colors: cyan `#1ED0E7`, violet `#8B7CFF`
- New keyframes: `mesh-drift`, `glow-breathe`, `marquee-scroll`, `scan-line`, `float-gentle`, `shimmer-border`
- Sticky section support classes
- Reduced motion media query wrapping all animations
- Glass panel variant with the new color system

### Navbar (in Landing.tsx)
- Transparent initially, transitions to `backdrop-blur-xl` + border on scroll via `scrollY > 80` state
- Links: Features, How it Works, Pricing, AI Stylist (scroll-to anchors)
- Right: "Sign In" text link + "Start Free" pill CTA
- Mobile: full-screen overlay menu with staggered item reveals

### Hero Section
- Full viewport height with layered background: CSS radial gradients (no canvas for perf)
- Animated mesh via 3 large absolutely-positioned gradient blobs with slow CSS animation
- ~10 particles (existing particle system, recolored)
- Center: headline cluster with staggered text reveal using framer-motion
- Floating product cards (pure CSS/HTML mockups — phone frame, wardrobe card, AI card, planner strip) positioned absolutely with `anti-gravity` float animation
- Subtle scan-line CSS animation crossing the phone mockup
- Two CTAs: "Start Free" (solid) + "Watch the Experience" (ghost)
- Microtext below CTAs

### Trust Strip
- Horizontal auto-scrolling marquee (CSS `@keyframes marquee-scroll` on duplicated list)
- 5-6 text pills with dot separators
- Subtle top/bottom borders

### Problem Section
- 3 cards using `--surface-elevated` background
- Staggered reveal-up animation
- Hover: translateY(-4px) + border shimmer (gradient border animation)
- Minimal icon treatment (lucide icons, 1.5 stroke, muted)

### System Section (Sticky Feature Story)
- Uses CSS `position: sticky` for left column
- Right side: 5 feature panels, each ~80vh tall, triggering state changes via IntersectionObserver
- Active feature highlighted in left nav with cyan accent
- Phone mockup visual in center changes content (CSS class swap on observed section)
- Each state shows different mock UI content inside the phone frame

### AI Stylist Section
- Deep radial gradient background (cyan + violet, very subtle)
- Central phone mockup with chat UI
- 5 floating prompt chips positioned around phone with `float-gentle` animation at different delays
- Subtle typing cursor animation

### Wardrobe Visual Section
- Asymmetric grid of garment card placeholders (CSS grid with span variations)
- Hover reveals metadata overlay with fade
- Subtle depth shadows

### Outfit Builder Section
- Split layout: left shows 3-4 garment slots, right shows assembled outfit
- Connecting flow line (SVG or CSS border) animates on scroll-reveal

### Weekly Planner Section
- 7 glass day cards in horizontal scroll (mobile) / grid (desktop)
- Cards reveal with stagger
- Active day (e.g., Wednesday) has cyan border accent

### How It Works
- 3 large cards with premium number treatment (large faded numbers)
- Animated ring/orbit detail: CSS border-radius circle with rotating gradient border
- Hover depth effect

### Pricing Section
- Reuse existing pricing logic (`getLocalizedPricing`) and translation keys where possible
- Free card: matte surface, ghost CTA
- Premium card: elevated surface + subtle cyan ambient glow, "Most Popular" badge
- Solid CTA button

### Social Proof Section
- 3 floating cards with placeholder testimonials
- Stagger reveal, subtle float animation
- Easy to swap content later

### Final CTA Section
- Soft radial bloom background
- Headline + sub + two CTAs
- Particles reused from hero

### Footer
- 4 columns: Product, Company, Legal, Support
- BURS logo + `hello@burs.com`
- Subtle divider line
- Preserves existing `/privacy`, `/terms`, `/contact` routes

## Routing
No changes needed — `/welcome` already renders `Landing`. The rewrite is in-place.

## Existing Code Preserved
- `CookieConsent` component stays
- Translation keys reused where applicable, new hardcoded English copy for new sections (i18n can be added later)
- `useLanguage`, navigation, `Helmet` SEO tags preserved
- Existing CSS reveal system reused and extended
- `framer-motion` used for hero text stagger and section transitions

## Performance
- Below-fold sections lazy-loaded (existing pattern)
- No canvas or WebGL — all effects via CSS
- Particles capped at ~12
- `will-change` used sparingly
- `prefers-reduced-motion` disables all custom animations
- Images: none required (all mockup UIs built with HTML/CSS)

## File Changes Summary
- **Rewrite**: `src/pages/Landing.tsx`
- **Create**: ~13 new section components in `src/components/landing2/`
- **Extend**: `src/index.css` with new landing v2 styles
- Old `src/components/landing/` files remain untouched (used by Index.tsx fallback and potentially other references)

