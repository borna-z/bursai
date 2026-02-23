
# DRAPE – Next Steps Plan

## Overview
The app "BURS" is being rebranded to "DRAPE". The PWA native feel is now solid. This plan covers the next phase: rebranding, landing page polish, performance, and feature improvements.

---

## Phase 1 – Rebrand BURS → DRAPE

### 1.1 Update all text references
- `index.html`: Update `<title>`, OG tags, Twitter tags, `apple-mobile-web-app-title` from "BURS" to "DRAPE"
- `public/manifest.json`: Update `name`, `short_name`, `description`
- `src/i18n/translations.ts`: Update all translation strings referencing "BURS"
- Landing page components: Update any hardcoded "BURS" text

### 1.2 Replace logo assets
- Replace `src/assets/burs-logo.png`, `burs-logo-white.png`, `burs-landing-logo.png`, etc. with new DRAPE logo assets
- Update `src/components/ui/DrapeLogo.tsx` and `BursMonogram.tsx` with new DRAPE branding
- Update favicon and PWA icons (`public/favicon.png`, `public/favicon-dark.png`, `public/icons/icon-192.png`, `public/icons/icon-512.png`)

### 1.3 Generate new OG image
- Create a new 1200×630 OG image with DRAPE branding
- Update all `og:image` and `twitter:image` meta tags

---

## Phase 2 – Landing Page Polish

### 2.1 Social proof section
- Add a "Trusted by X users" counter or testimonial quotes between Hero and How It Works
- Animated number counter on scroll reveal

### 2.2 App screenshot showcase
- Add a phone mockup in the hero or below-fold showing the actual app UI
- Use the existing `src/assets/app-screenshot-home.png` in a device frame

### 2.3 Micro-interaction improvements
- Add subtle hover states on pricing cards (lift + glow)
- Smooth number animation on pricing toggle (if adding yearly/monthly switch)

### 2.4 FAQ section
- Add an accordion FAQ section before the footer
- Common questions: "How does AI styling work?", "Is my data private?", "Can I cancel anytime?"

---

## Phase 3 – Performance

### 3.1 Image optimization
- Convert large PNGs to WebP with fallback
- Add `width`/`height` attributes to all images for CLS prevention
- Lazy-load all below-fold images

### 3.2 Font loading optimization
- Current: preload + print→all swap. Good.
- Consider subsetting fonts to reduce payload if needed

### 3.3 Bundle splitting
- Audit current lazy-loading boundaries
- Ensure auth pages, settings, and heavy features are code-split

---

## Phase 4 – Feature Improvements

### 4.1 Onboarding flow polish
- Review and refine the style quiz experience
- Add progress indicator and estimated time

### 4.2 Wardrobe quick-add improvements
- Streamline the garment upload flow
- Better AI analysis feedback with loading states

### 4.3 Outfit generation UX
- Add "regenerate" with memory of rejected suggestions
- Better explanation cards for why an outfit was suggested

### 4.4 Share outfit improvements
- Improve the share card design for social media
- Add copy-link functionality

---

## Suggested execution order
1. **Phase 1** (Rebrand) – Do first since it touches many files
2. **Phase 2.2** (App screenshot in hero) – High visual impact
3. **Phase 2.4** (FAQ section) – Quick SEO + conversion win
4. **Phase 3.1** (Image optimization) – Performance win
5. **Phase 4** – Feature work based on user feedback

