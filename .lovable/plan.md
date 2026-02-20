

# Redesign Landing Page -- Dark Mode Nordic Futuristic

## Overview
Complete rewrite of `src/pages/Landing.tsx` with a strict dark-mode, Nordic minimalist, sustainability-focused design. The page will force dark mode regardless of user theme preference and feature the BURS logo prominently in the hero.

## Sections

### 1. Sticky Header
- Dark glass header (`bg-[#0a0a0a]/80 backdrop-blur-md`) with BURS logo + wordmark on the left
- Nav links: "How it works", "Sustainability", "Our Mission" (smooth scroll anchors)
- "Get Early Access" CTA button (white pill on dark)
- Mobile hamburger menu with slide-down drawer

### 2. Hero Section
- Full viewport height, centered layout
- BURS logo displayed large (w-32/w-48)
- Headline: **"Rediscover Your Wardrobe with AI."**
- Sub-headline about sustainability and wearing what you own
- Two CTA buttons: App Store + Google Play (styled as pill outlines with Apple/Play icons)
- Subtle radial glow behind logo + faint grid overlay for depth
- Right side: phone mockup placeholder showing app screenshot concept

### 3. How It Works (3 steps)
- Section ID `#how-it-works` for smooth scroll
- Steps: Snap your clothes, AI works its magic, Wear and Care
- Uses `Shirt`, `Sparkles`, `Heart` (hanger-style) icons from Lucide
- Large step numbers (01, 02, 03) with descriptions
- Clean border-separated rows

### 4. Sustainability Banner
- Full-width dark section with slightly elevated background
- Large quote: "The most sustainable garment is the one already in your closet."
- `Leaf` icon accent, subtle stats (reduce fast fashion, extend garment life)

### 5. Trust / Mission Section
- ID `#mission`
- Three-card grid: Privacy-first, Zero lock-in, Offline-ready

### 6. Final CTA
- "Join the movement" with Get Early Access button
- BURS logo small

### 7. Footer
- Logo + copyright, Privacy/Terms/Contact links
- Social icons (Instagram, Twitter/X) via Lucide

## Design Details
- **Forces dark mode**: The landing page wrapper applies `dark` class and uses hardcoded dark colors (`bg-[#0a0a0a]`, `text-gray-100`, etc.) so it always renders dark regardless of user theme
- **Typography**: Inter (body) + Sora (headings) -- already available in the project
- **Animations**: Staggered `animate-fade-in` with `animation-delay-*` classes already in Tailwind config
- **Fully responsive**: Mobile-first with `md:` breakpoints for desktop layouts
- **Monochrome palette**: White text on charcoal, white/5 borders, subtle hover glows

## Technical Changes

### File: `src/pages/Landing.tsx`
- Full rewrite with new sections, dark-mode-forced design, and sustainability focus
- Imports: `bursLogo` from assets, Lucide icons, `useNavigate`, `Helmet`
- Mobile nav state managed via `useState`

### No other files need changes
- Routing already exists (`/welcome`)
- Logo asset already in place
- All animation utilities already configured

