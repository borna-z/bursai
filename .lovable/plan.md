

# Hyperreality Landing Page Redesign

A full visual overhaul of every landing section to create an immersive, cinematic, high-contrast experience with glowing gradients, animated mesh backgrounds, dramatic typography, and depth-rich visuals.

---

## Design Direction

Dark cinematic canvas (#030305) with vivid accent glows (indigo, cyan, amber), animated gradient meshes, large bold typography, frosted-glass panels with luminous borders, and smooth scroll-triggered reveals. Think: Apple Vision Pro marketing meets high-fashion editorial.

---

## Changes

### 1. New CSS — Hyperreality Effects (`index.css`)
- **Animated gradient mesh** background keyframes (slow-moving multi-color blobs)
- **Glow orb** utility classes with pulsing radial gradients (indigo, cyan, amber)
- **Luminous border** class — borders that glow on hover with colored halos
- **Text shimmer** keyframe — a light sweep across headline text
- **Noise texture overlay** — subtle grain for depth via a CSS pseudo-element
- **Hyper-glass** panel class — stronger glass with colored border glow and inner shadow

### 2. Hero Section — Full Rewrite (`HeroSection.tsx`)
- **Background**: Animated gradient mesh with 3 overlapping radial gradients (indigo, cyan, violet) that slowly orbit
- **Badge**: Glowing pill with pulsing dot and luminous border
- **Headline**: Massive (text-6xl/8xl) with text-shimmer animation, white-to-transparent gradient
- **Subtext**: Slightly larger, softer gray, wider letter-spacing
- **CTA button**: Gradient border (indigo→cyan) with inner white fill, hover glow halo effect
- **SSO buttons**: Hyper-glass panels with subtle colored borders
- **Right side**: Replace empty glow with an animated orb cluster — 3 overlapping gradient circles that float and pulse (pure CSS, no 3D)
- **Scroll indicator**: Animated line instead of chevron

### 3. Header — Floating Capsule (`Landing.tsx`)
- Detach from edges — `mx-4 mt-4 rounded-2xl` floating capsule style
- Hyper-glass background with luminous bottom border
- Logo glow on hover
- Nav links with underline-on-hover animation
- CTA button: gradient border pill

### 4. Social Ticker — Glow Accents (`SocialTicker.tsx`)
- Each stat icon gets a subtle colored glow (Users=cyan, Shirt=rose, Sparkles=amber, Globe=indigo)
- Separator dots between items with glow
- Slightly larger text

### 5. Trust Logos — Luminous on Hover (`TrustLogos.tsx`)
- Each logo gets a colored underline glow on hover
- Staggered fade-in animation
- "Featured in" label with line accents on both sides

### 6. How It Works — Cinematic Cards (`HowItWorks.tsx`)
- Replace glass-panel cards with hyper-glass cards that have colored top-edge glows (blue, amber, emerald)
- Number nodes get pulsing glow rings
- Vertical connector line becomes a gradient (indigo→cyan→emerald)
- Cards get subtle parallax offset on scroll

### 7. Features Showcase — Glow Grid (`FeaturesShowcase.tsx`)
- Each card gets a subtle animated gradient border on hover
- Icon containers get colored background glow matching their accent
- Add a floating orb behind the grid (ambient decoration)
- Increase card padding and add inner glow shadow

### 8. Stats Counter — Dramatic Numbers (`StatsCounter.tsx`)
- Numbers use gradient text (white→gray shimmer)
- Each stat gets a subtle radial glow behind it
- Divider lines between stats on desktop
- Icons get colored tints matching their meaning

### 9. Sustainability — Split Glow (`SustainabilitySection.tsx`)
- Leaf icon gets emerald glow halo
- Stats cards get luminous borders
- Quote text uses text-shimmer effect
- Background gets a subtle emerald gradient mesh

### 10. Testimonials — Cinematic Slides (`TestimonialsCarousel.tsx`)
- Quote card gets hyper-glass treatment with colored border
- Star ratings glow amber
- Navigation dots get active glow state
- Add subtle quote marks as large decorative elements

### 11. Pricing — Premium Contrast (`PricingSection.tsx`)
- Free card: hyper-glass with luminous border
- Premium card: animated gradient border (indigo→cyan→amber cycling)
- Toggle switch gets glow effect
- "Popular" badge pulses with amber glow
- Price numbers use gradient text

### 12. CTA Section — Maximum Impact (`CTASection.tsx`)
- Full-width gradient mesh background
- Headline with text-shimmer
- CTA button with animated gradient border and glow halo
- Floating orbs as ambient decoration

### 13. Remove unused 3D files
- Delete `Scene3D.tsx` and `FloatingHanger.tsx` (no longer needed)

---

## Files Modified
- `src/index.css` — new hyperreality CSS utilities and keyframes
- `src/pages/Landing.tsx` — floating header redesign
- `src/components/landing/HeroSection.tsx` — full rewrite with gradient mesh and orbs
- `src/components/landing/SocialTicker.tsx` — glow accents
- `src/components/landing/TrustLogos.tsx` — luminous hover
- `src/components/landing/HowItWorks.tsx` — cinematic cards
- `src/components/landing/FeaturesShowcase.tsx` — glow grid
- `src/components/landing/StatsCounter.tsx` — dramatic numbers
- `src/components/landing/SustainabilitySection.tsx` — emerald glow
- `src/components/landing/TestimonialsCarousel.tsx` — cinematic slides
- `src/components/landing/PricingSection.tsx` — premium glow
- `src/components/landing/CTASection.tsx` — maximum impact
- Delete `src/components/landing/Scene3D.tsx`
- Delete `src/components/landing/FloatingHanger.tsx`

