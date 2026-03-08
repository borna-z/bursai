

# Push /welcome Landing Page to Premium Level

## Diagnosis
The current implementation is structurally sound but visually flat. Every section uses the same rhythm (centered headline + grid of cards), creating monotony. The hero lacks a "wow" centerpiece. Cards are empty gray rectangles. There's no visual depth layering between sections, no section-to-section transitions, no dramatic typography scale, and hover interactions are basic. It reads like a well-structured template rather than a cinematic product launch.

## Key Improvements

### 1. CSS Visual System Upgrades (index.css)
- Add `lv2-section-divider` — a gradient horizontal line between sections that fades from transparent → cyan → transparent, creating visual rhythm
- Add `lv2-parallax-layer` — CSS transform-based parallax for background elements on scroll
- Add `lv2-text-gradient` — premium gradient text effect (white → cyan subtle) for key headlines
- Add `lv2-hover-lift` — more dramatic card hover with 3D perspective tilt using CSS `perspective` and `rotateX/Y`
- Add `lv2-light-beam` — a subtle diagonal light streak that sweeps across sections on scroll
- Increase `lv2-reveal` travel distance to 50px and duration to 1s for more cinematic entrance
- Add `lv2-blur-in` reveal variant — elements fade in from blurred to sharp
- Add `lv2-scale-reveal` — elements scale from 0.92 to 1.0 during reveal
- Add `lv2-stagger-grid` — CSS-only stagger for grid children using `nth-child` delays
- Enhance `lv2-card` with inner glow on hover: `inset 0 1px 0 rgba(255,255,255,0.06)`
- Add `lv2-hero-gradient` — animated background with layered radial gradients that shift slowly
- Enhance phone mockup with stronger shadow depth and subtle inner light at top edge

### 2. Hero Section — Cinematic Upgrade
- Make headline dramatically larger: `text-5xl sm:text-6xl md:text-8xl` with tighter leading
- Add a gradient text treatment on "intelligence" (white → cyan)
- Add a subtle horizontal light beam that sweeps across hero on load (CSS animation, one-time)
- Make floating product cards more detailed: add actual text labels, mini colored squares for garments, a status indicator dot
- Add a large centered phone mockup (using the `lv2-phone` class) as the hero visual anchor between the text and floating cards
- The phone shows a simplified "Today" screen with outfit preview, date, weather pill
- Use `motion.div` with `scale: [0.95, 1]` and blur-in for the phone entrance
- Add a soft vignette overlay at bottom of hero fading to `#05070A` for seamless section transition
- Slow down animation timings — longer delays (0.2→0.4→0.7→1.0→1.3s) for more cinematic stagger

### 3. Problem Section — More Visual Drama
- Add a large faded background text watermark ("THE PROBLEM") behind the section at 3% opacity
- Cards get inner gradient (top-left subtle light source)
- Add a thin accent line at top of each card (2px, gradient cyan→transparent)
- Increase card padding and height for more breathing room

### 4. System Section — Richer Storytelling
- Make the phone mockup content richer per feature state: show 2-3 colored garment squares for Digitize, filter pills for Organize, 2x2 outfit grid for Build, chat bubbles for Ask AI, day strips for Plan
- Add a soft glow ring behind the phone that changes color per active state (cyan for Digitize, violet for AI)
- Add connecting vertical line between feature nav items on left side with progress indicator
- Add number indicators (01–05) before each feature label

### 5. AI Stylist Section — More Immersive
- Make the section taller with more vertical padding
- Add a second layer of background: subtle radial grid pattern (very faint lines, like Apple's spatial computing visuals)
- Make floating chips slightly larger with a subtle glow on hover
- Add a second phone screen showing outfit result (smaller, offset, partially behind main phone)
- Add subtle animated connection lines from chips to the phone (SVG dashed lines, very faint)

### 6. Wardrobe Visual Section — Editorial Feel
- Replace empty gray cards with cards that have subtle fabric-like gradient textures (different per garment type)
- Add a color dot in corner of each card representing garment color
- Make the larger card more prominent with a subtle image-like gradient treatment
- Add a hover scale effect (1.02) with smooth easing

### 7. Outfit Builder Section — Flow Animation Feel
- Add a thin animated SVG connector line from pieces to the result card (dashed, fades in on reveal)
- The result card gets a subtle pulsing glow when visible
- Add small numbered badges (1-4) on piece cards
- Add a "✓ Saved" animated checkmark that appears after reveal

### 8. Weekly Planner Section — Glass Depth
- Add a subtle background gradient strip behind the cards
- Make active day card (Wed) slightly larger/elevated
- Add mini colored squares inside each day card representing outfit pieces
- Add a thin connecting line between day cards (horizontal strip)

### 9. How It Works — More Premium
- Make numbers much larger (text-8xl) and use gradient opacity fade
- Add a horizontal connecting line between the three cards with dots at intersections
- Cards get a subtle top-light gradient treatment

### 10. Section Transitions
- Add gradient dividers between key sections (Problem→System, System→AI, Planner→HowItWorks)
- These are `lv2-section-divider` elements: 1px height, 60% width, centered, gradient line

### 11. Final CTA — More Emotional
- Increase the radial bloom size and opacity slightly
- Add a second bloom layer (violet) offset
- Make headline larger (text-4xl md:text-6xl)

### 12. Typography Hierarchy Polish
- All section eyebrow labels get `text-[11px] tracking-[0.25em] uppercase` treatment with secondary color
- Headlines get `font-space` (Space Grotesk) where available for more character
- Subheadlines get slightly larger line-height (1.7) for luxury feel

## Files to Edit
- `src/index.css` — Enhanced CSS visual system (~30 new/modified rules)
- `src/components/landing2/HeroSection.tsx` — Cinematic hero with phone centerpiece, gradient text, light beam, richer floating cards
- `src/components/landing2/ProblemSection.tsx` — Background watermark, accent lines, richer cards
- `src/components/landing2/SystemSection.tsx` — Richer phone content, progress line, glow ring
- `src/components/landing2/AIStylistSection.tsx` — Grid pattern bg, larger chips, offset second phone
- `src/components/landing2/WardrobeVisualSection.tsx` — Fabric gradients, color dots, hover scale
- `src/components/landing2/OutfitBuilderSection.tsx` — SVG connectors, numbered badges, save animation
- `src/components/landing2/WeeklyPlannerSection.tsx` — Connecting line, mini outfit squares, active elevation
- `src/components/landing2/HowItWorksSection.tsx` — Larger numbers, connecting line
- `src/components/landing2/FinalCTASection.tsx` — Dual bloom, larger headline
- `src/pages/Landing.tsx` — Add section dividers between key sections

