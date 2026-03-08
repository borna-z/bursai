

# Landing 2.0 — Futuristic 3D Redesign

## Vision
Transform the landing from a static scroll page into an immersive, interactive 3D experience. A floating hanger model rotates in the hero, garments orbit in the features section, and scroll-driven animations create a cinematic journey. Every section is rebuilt for conversion, traffic, and engagement.

## New Dependencies
- `@react-three/fiber@^8.18` + `three@^0.133` + `@react-three/drei@^9.122.0` — 3D scene rendering
- No other new deps needed (framer-motion already installed)

## Architecture

```text
Landing 2.0 Flow:
┌─────────────────────────────────┐
│  1. Sticky Glass Header + SSO  │
│  2. 3D Hero (rotating hanger)  │
│  3. Social Proof Ticker        │
│  4. Interactive Feature Cards   │
│  5. 3D Phone Mockup Walkthrough│
│  6. Stats Counter Section      │
│  7. Sustainability + Globe     │
│  8. Testimonials Carousel      │
│  9. Pricing (toggle monthly/yr)│
│ 10. Final CTA + 3D Element    │
│ 11. SEO Footer                 │
└─────────────────────────────────┘
```

## 35 Steps

### Phase 1 — Foundation (Steps 1–5)
1. **Install 3D packages** — Add `@react-three/fiber@^8.18`, `three@^0.133`, `@react-three/drei@^9.122.0`
2. **Create 3D scene wrapper** — `src/components/landing/Scene3D.tsx` with Canvas, lighting, environment map, post-processing bloom, and `Suspense` fallback
3. **Build floating hanger model** — Procedural 3D hanger using `@react-three/drei` primitives (torus, cylinder) with metallic material, slow auto-rotate, and mouse-follow parallax via `useFrame`
4. **Redesign Hero section** — Split layout: left = headline + CTAs, right = 3D hanger scene. Headline uses word-by-word reveal. Two CTAs: "Get Started Free" (white, prominent) + "Sign in with Google" (glass SSO button)
5. **Add SSO buttons to Hero** — Google + Apple sign-in buttons directly in the hero using existing `lovable.auth.signInWithOAuth()`, reducing friction to zero clicks before signup

### Phase 2 — Social Proof & Trust (Steps 6–10)
6. **Create animated ticker bar** — Horizontal scrolling marquee showing "X users styled today", "Y outfits created", "Z garments saved" with live-looking counters
7. **Add trust logos section** — "Featured in" row with placeholder publication logos (Vogue, TechCrunch, etc.) in grayscale, hover to color
8. **Build testimonial cards** — 3 rotating testimonial cards with avatar, quote, rating stars, auto-carousel using Embla
9. **Add user count badge** — Animated counter in hero showing total signups, creates FOMO
10. **Create "As seen on" schema markup** — Add JSON-LD structured data for SEO rich snippets

### Phase 3 — Features Reimagined (Steps 11–17)
11. **Redesign FeaturesShowcase** — Replace flat grid with full-width horizontal scroll sections, each feature gets its own viewport-height panel
12. **Feature 1: Snap & Organize** — Left: animated phone mockup showing garment upload flow. Right: description + micro-interaction demo
13. **Feature 2: AI Styling** — 3D floating outfit cards that assemble from separate garments on scroll
14. **Feature 3: Weekly Planner** — Interactive mini-calendar with drag preview animation
15. **Feature 4: Style Insights** — Animated chart/graph that draws itself on scroll entry
16. **Feature 5: AI Chat** — Typing animation showing a real conversation with the stylist
17. **Feature 6: Smart Shopping** — Product cards flying into a "gap analysis" visualization

### Phase 4 — How It Works 3D Walkthrough (Steps 18–21)
18. **Create 3D phone mockup component** — Floating phone with screen content that changes per step, using `@react-three/drei` `RoundedBox` + `Html` for screen content
19. **Step 1: Upload** — Phone tilts showing camera UI, garment thumbnail appears
20. **Step 2: AI Processes** — Particles flow around phone, tags appear
21. **Step 3: Get Styled** — Phone shows outfit result, confetti particles burst

### Phase 5 — Conversion Optimization (Steps 22–27)
22. **Redesign Pricing section** — Add monthly/yearly toggle with animated price transition, highlight savings percentage with pulsing badge
23. **Add comparison table** — Expandable "Compare plans" accordion showing feature-by-feature Free vs Premium
24. **Sticky bottom CTA bar** — Mobile: fixed bottom bar appears after scrolling past hero with "Start Free" button, dismissable
25. **Exit-intent detection** — On desktop mouse leaving viewport top, show subtle modal: "Before you go — try BURS free for 7 days"
26. **Scroll progress indicator** — Thin gradient line at top of page showing scroll position
27. **Add urgency element** — "Join X others who signed up this week" with real-ish counter near CTA

### Phase 6 — SEO & Traffic (Steps 28–31)
28. **Comprehensive meta tags** — Dynamic OG tags per section anchor, Twitter cards, canonical URL, hreflang tags for all 14 languages
29. **Add FAQ section** — Accordion with 6-8 common questions, using JSON-LD FAQ schema for Google rich results
30. **Improve page speed** — Lazy-load 3D scenes below fold, use `Intersection Observer` to mount Canvas only when visible, preload critical fonts
31. **Add language switcher to header** — Globe icon dropdown showing all 14 languages with flags, persists selection

### Phase 7 — Full i18n (Steps 32–33)
32. **Add all new landing translation keys** — ~80 new keys across all 14 locales covering: ticker text, testimonials, FAQ, comparison table, sticky CTA, exit intent, new feature descriptions
33. **RTL support for landing** — Ensure all new sections respect `dir="rtl"` for Arabic and Farsi, mirror 3D phone position

### Phase 8 — Polish & Ship (Steps 34–35)
34. **Performance audit** — Ensure 3D Canvas uses `frameloop="demand"` when not in viewport, add `will-change` hints, reduce particle count on mobile, disable 3D on `prefers-reduced-motion`
35. **Mobile-first responsive pass** — All 11 sections tested at 375px, 390px, 428px widths. 3D scenes render at lower resolution on mobile. Sticky CTA only on mobile. Touch-friendly feature scroll

## Technical Details

### 3D Approach
- Use procedural geometry (no .glb files to load) for the hanger model — keeps bundle small
- `@react-three/drei` provides `Float`, `MeshDistortMaterial`, `Environment`, `ContactShadows` for premium feel
- Each 3D scene wrapped in its own `Canvas` with `frameloop="demand"` + IntersectionObserver to only render when visible
- Fallback: on low-power devices or `prefers-reduced-motion`, show static gradient + icon instead of 3D

### SSO Integration
- Already implemented via `lovable.auth.signInWithOAuth('google' | 'apple')` 
- New: surface these buttons in the Hero and sticky CTA, not just the Auth page
- After SSO click from landing, redirect to onboarding flow

### Conversion Strategy
- **Above fold**: SSO + email signup visible immediately (zero scroll to action)
- **Mid page**: Feature sections each end with contextual CTA ("Try AI Styling Free")
- **Bottom**: Pricing comparison + final CTA with urgency counter
- **Mobile**: Sticky bottom bar after hero scroll

### File Changes
- **New files**: `Scene3D.tsx`, `FloatingHanger.tsx`, `PhoneMockup3D.tsx`, `SocialTicker.tsx`, `TestimonialsCarousel.tsx`, `FAQSection.tsx`, `StickyMobileCTA.tsx`, `LanguageSwitcher.tsx`, `ScrollProgress.tsx`, `ComparisonTable.tsx`, `ExitIntentModal.tsx`
- **Rewrite**: `HeroSection.tsx`, `FeaturesShowcase.tsx`, `HowItWorks.tsx`, `PricingSection.tsx`, `SustainabilitySection.tsx`, `CTASection.tsx`, `LandingFooter.tsx`
- **Update**: `Landing.tsx` (new section order + 3D lazy loading), `translations.ts` (80+ new keys × 14 locales), `index.css` (new animation classes)
- **Remove**: `TrialBanner.tsx` (merged into hero), `MissionSection.tsx` (merged into sustainability), `DownloadSection.tsx` (merged into footer)

