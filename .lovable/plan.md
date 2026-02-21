

## Ultimate Immersive Landing Page -- Full Animation Overhaul

### Vision
Transform the landing page into a full-screen, section-by-section scrollytelling experience. Each section occupies the full viewport and animates in from different directions (bottom-up, left, right, scale, fade) as you scroll. Minimalistic content, maximum cinematic impact.

### New Animation System

**1. `src/index.css` -- Add directional reveal classes and full-page section styles**

New CSS classes:
- `.section-full` -- each section is `min-h-screen` with `position: sticky` layering behavior
- `.reveal-up` -- slides in from bottom (translateY(80px) to 0)
- `.reveal-down` -- slides in from top (translateY(-80px) to 0)
- `.reveal-left` -- slides in from right (translateX(80px) to 0)
- `.reveal-right` -- slides in from left (translateX(-80px) to 0)
- `.reveal-scale` -- scales from 0.85 to 1 with fade
- `.reveal-rotate` -- subtle 3D rotation entry (rotateX(8deg) to 0)
- All `.reveal-*` classes start invisible and transition on `.visible` class
- Stagger utility: `.stagger > *:nth-child(n)` with incremental delays
- Horizontal rule animation: `.line-grow` -- a divider that grows from center outward
- Text reveal: `.text-reveal` -- characters/words fade in sequentially
- Parallax layers: `.parallax-slow`, `.parallax-fast` -- different scroll speeds via CSS transforms

**2. `src/pages/Landing.tsx` -- Complete section-by-section redesign**

Structure becomes a sequence of full-viewport "slides":

- **Hero (slide 1)**: Full screen. Title animates word-by-word. Subtitle fades up. CTAs scale in. Particles + aurora remain. Scroll-down chevron pulses at bottom.

- **Trial Banner (slide 2)**: Slides in from bottom (`reveal-up`). Glass panel scales in (`reveal-scale`). Text staggers in.

- **How It Works (slide 3)**: Full screen. The three steps animate in from alternating sides -- step 1 from left, step 2 from right, step 3 from left (`reveal-left` / `reveal-right` alternating). Large step numbers parallax at a slower rate than the text.

- **Sustainability (slide 4)**: Full screen. The quote reveals with a `reveal-scale` zoom-in effect. Stats grid items fly in from bottom with stagger (`reveal-up` + stagger). The leaf icon rotates in.

- **Mission / Trust (slide 5)**: Full screen. Cards reveal from bottom-up with stagger. Each card has a subtle hover 3D tilt effect (CSS perspective transform on hover).

- **Pricing (slide 6)**: Full screen. Free card slides in from left, Premium card from right simultaneously. Badge pops in with delay.

- **Final CTA (slide 7)**: Full screen. Logo scales in, text reveals up, button pulses gently. Aurora glow intensifies.

- **Download (slide 8)**: Cards slide in from bottom with stagger.

- **Footer**: Fades in last.

**3. Enhanced IntersectionObserver**

Replace the single simple observer with a more sophisticated one that:
- Detects scroll direction (up vs down) and applies appropriate animation class
- Supports re-triggering animations when scrolling back up (elements that leave viewport reset)
- Uses a lower threshold (0.1) for earlier trigger
- Handles all `.reveal-*` variants

**4. CSS-only parallax layers**

Add 2-3 decorative floating geometric shapes (thin lines, circles, dots) that move at different speeds using `transform: translateY(calc(var(--scroll) * -0.3))` updated via a lightweight scroll listener that sets a CSS custom property.

**5. Smooth section transitions**

Add subtle gradient overlays between sections (dark to transparent) so they feel like they "layer" on top of each other as you scroll down. Each section gets a `z-index` that increments, creating depth.

### Technical Details

**Files modified:**
- `src/index.css` -- ~60 new lines of reveal/parallax/stagger CSS
- `src/pages/Landing.tsx` -- Full rewrite with new animation classes, enhanced observer, parallax scroll listener, full-screen sections

**Performance:**
- All animations use `transform` and `opacity` only (GPU-accelerated, no layout thrashing)
- Single `requestAnimationFrame` scroll listener for parallax CSS variable
- IntersectionObserver for reveal triggers (no scroll event spam)
- No external libraries needed

**What stays the same:**
- All content and copy
- All `navigate('/auth')` calls
- Logo image usage
- Particle star-field in hero
- Mobile menu
- SEO meta tags

