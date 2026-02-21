

## Redesign Landing Page -- Dark Futuristic Theme

### Overview
Transform the current warm, light landing page into a dark, immersive "space noir" design inspired by the provided HTML. The new design features a deep black background (#030305), aurora glow effects, glassmorphism panels, floating animations, and the Space Grotesk font -- while keeping all existing content sections and functionality intact.

### Changes

**1. Add Space Grotesk font to `index.html`**
- Add `Space+Grotesk:wght@300;400;700` to the existing Google Fonts link

**2. Update `tailwind.config.ts`**
- Add `'Space Grotesk'` to fontFamily options

**3. Add dark landing styles to `src/index.css`**
- Add `.dark-landing` class with the deep black background (#030305)
- Add `.aurora-glow` radial gradient background effect
- Add `.glass-panel` glassmorphism style (rgba white 2%, blur 20px, subtle border)
- Add `.anti-gravity` and `.anti-gravity-delayed` floating keyframe animations
- Keep all existing styles untouched

**4. Rewrite `src/pages/Landing.tsx`** -- major visual overhaul
- Remove `force-light` wrapper; replace with `dark-landing` dark theme wrapper
- Background: deep space black (#030305) with aurora glow overlay
- Header: glassmorphism style, transparent with blur, white text on dark
- Hero section:
  - Large aurora glow behind content
  - "Designad for nasta dimension" headline adapted to English: "Designed for the next dimension"
  - Subtitle about Scandinavian minimalism meets computational power
  - Two CTAs: "Get Started" (solid white) and "Explore" (glass outline)
  - Floating animation on decorative elements
- All existing sections preserved (How It Works, Sustainability, Pricing, Download, etc.) but restyled:
  - Cards use `.glass-panel` instead of `bg-card border-border`
  - Text colors: white (#f3f4f6) for headings, gray-400 for body
  - Borders: rgba(255,255,255,0.05) instead of warm beige
  - Stats and pricing cards get glassmorphism treatment
- Footer: dark with subtle top border, same links
- All scroll-reveal animations and navigation logic preserved
- All `navigate('/auth')` calls preserved

### What stays the same
- All routing and navigation logic
- All content sections (How It Works, Sustainability, Mission, Pricing, Download)
- Mobile menu functionality
- Scroll-reveal observer
- SEO meta tags (Helmet)
- BursMonogram component usage

### Visual Result
- Deep space-black landing page with subtle aurora glow effects
- Glassmorphism cards and panels
- Floating/anti-gravity animations on hero decorative elements
- High contrast white text on dark background
- Premium, futuristic feel while maintaining Scandinavian minimalism

