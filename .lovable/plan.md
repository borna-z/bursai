

# Landing Page — Complete From-Scratch Rebuild

## What's wrong with v3.0

After analyzing every current landing component, the problems are clear:

- **Still template-feeling**: Every section follows the same pattern — label in `text-[10px] tracking-[0.4em]`, then `text-3xl md:text-5xl font-bold`, then cards with `border-white/[0.06] bg-white/[0.02]`. Zero visual variety.
- **No real narrative**: Sections don't build on each other. They're interchangeable blocks.
- **Screenshots are AI-generated mockups**: They have text artifacts and don't match the actual app. Using them hurts credibility.
- **Too much text, not enough show**: The hero has a headline, subtitle, CTA, two SSO buttons — 5 elements competing for attention.
- **Ticker is empty**: Just 4 stats repeating endlessly — no real social proof.
- **Stats are inflated/fake**: "12,500+ users", "250,000+ garments" — if these aren't real, they erode trust.

## Design Direction: "Quiet Confidence"

One visual idea per section. No repeated patterns. Let the product and typography do the work. Inspired by: Linear.app, Raycast, Arc Browser, Notion's 2025 redesign.

## Architecture — 7 sections, each visually distinct

```text
┌─────────────────────────────────────────────┐
│ HEADER  — Transparent, minimal, logo + CTA  │
├─────────────────────────────────────────────┤
│ 1. HERO — Centered text-only. One line.     │
│    Big statement. Single CTA. No image.     │
│    App screenshots appear BELOW on scroll.  │
├─────────────────────────────────────────────┤
│ 2. SHOWCASE — 3 phone mockups that slide    │
│    in as you scroll. Wardrobe / Home / Chat  │
│    Using real screenshots from the app.      │
├─────────────────────────────────────────────┤
│ 3. FEATURES — Horizontal scroll cards on    │
│    mobile, 3-col grid on desktop. Each card │
│    has icon + 2 lines. That's it.           │
├─────────────────────────────────────────────┤
│ 4. SOCIAL PROOF — Single testimonial with   │
│    large quote. Auto-rotate. No carousel    │
│    chrome. Just words + name.               │
├─────────────────────────────────────────────┤
│ 5. PRICING — 2 cards side by side.          │
│    Keep existing logic, visual cleanup.     │
├─────────────────────────────────────────────┤
│ 6. FINAL CTA — One line + one button.       │
│    FAQ accordion below. Footer at bottom.   │
├─────────────────────────────────────────────┤
│ STICKY MOBILE CTA — Keep existing           │
│ EXIT INTENT — Keep existing                 │
└─────────────────────────────────────────────┘
```

**Removed**: SocialTicker (empty metrics), StatsCounter (fake numbers), BentoGrid (replaced by simpler features), ProductShowcase (rebuilt as Showcase with scroll animation).

## Detailed Changes

### 1. `HeroSection.tsx` — Full rewrite
- **Centered layout** — no split grid, no phone mockup here
- Single massive headline: `text-7xl md:text-[6rem]` centered, tracking tight
- One subtitle line below in gray
- One white CTA button centered
- SSO buttons below CTA in a row
- Subtle radial gradient background (keep but soften)
- No badge, no scroll indicator, no right column

### 2. `ProductShowcase.tsx` — Rebuilt as scroll-triggered reveal
- 3 phone mockups in a row (reuse existing screenshots for now)
- Each phone slides up with staggered `reveal-up` delays
- Center phone larger, side phones smaller and slightly rotated
- Below phones: 3 short feature callouts (one per screen)
- Section has its own dark background distinction

### 3. `BentoGrid.tsx` → Rename/rewrite as `Features.tsx`
- Simple 3-column grid (1-col mobile)
- 6 features, each card: icon + title + one line description
- Cards have hover lift effect (`hover:-translate-y-1`)
- No "large" cards, no bento asymmetry — clean uniform grid
- Minimal borders, slightly lighter bg on hover

### 4. `TestimonialsCarousel.tsx` — Simplify dramatically
- Remove navigation arrows
- Remove dots
- Just the quote + name + stars, full width centered
- Auto-rotate every 5s with crossfade
- Larger quote text (`text-xl md:text-2xl`)
- Thin horizontal line above and below for visual separation

### 5. `PricingSection.tsx` — Minor refinement
- Keep existing structure (works well)
- Remove the `reveal-up` stagger delays (feel slow)
- Make comparison table open by default on desktop

### 6. `FooterCTA.tsx` — Simplify
- One headline + button (keep)
- FAQ accordion (keep)
- Footer links (keep)
- Remove excessive spacing

### 7. `Landing.tsx` — Restructure imports
- Remove SocialTicker import
- Remove StatsCounter import  
- Update section order: Hero → Showcase → Features → Testimonials → Pricing → FooterCTA
- Keep header transparent-until-scroll behavior
- Keep StickyMobileCTA and ExitIntentModal

### 8. CSS cleanup (`index.css`)
- Remove `ticker-track` and `ticker-scroll` keyframe (no more ticker)
- Keep `phone-mockup`, `reveal-up`, `glass-panel`, `dark-landing`
- Remove unused effects: `gradient-shift-text`, `tilt-card`, `parallax-*`, `word-reveal`

## Files Modified
- `src/pages/Landing.tsx`
- `src/components/landing/HeroSection.tsx`
- `src/components/landing/ProductShowcase.tsx`
- `src/components/landing/BentoGrid.tsx` → rewrite as Features grid
- `src/components/landing/TestimonialsCarousel.tsx`
- `src/components/landing/PricingSection.tsx`
- `src/components/landing/FooterCTA.tsx`
- `src/index.css`

## Files Deleted
- `src/components/landing/SocialTicker.tsx`
- `src/components/landing/StatsCounter.tsx`

## Files Kept As-Is
- `src/components/landing/StickyMobileCTA.tsx`
- `src/components/landing/ExitIntentModal.tsx`
- `src/components/landing/ComparisonTable.tsx`
- `src/components/landing/CookieConsent.tsx`
- `src/components/landing/LanguageSwitcher.tsx`

