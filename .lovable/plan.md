

# Rebrand to BURS + New Landing Page

## Overview
Rename the app from "DRAPE" to "BURS" everywhere and create a premium Scandinavian minimalist landing page at the root marketing route.

---

## Part 1: Global Rebrand DRAPE --> BURS

All occurrences of "DRAPE" will be replaced with "BURS" across these files:

- **`src/components/ui/DrapeLogo.tsx`** -- Update wordmark text from "DRAPE" to "BURS", alt text, and rename file export
- **`src/pages/Auth.tsx`** -- Title text "DRAPE" to "BURS"
- **`index.html`** -- Page title, meta tags, OG tags, Twitter tags
- **`public/manifest.json`** -- App name and short_name
- **`src/i18n/translations.ts`** -- All translation strings referencing "DRAPE" (tutorial titles, chat welcome, GDPR info, etc.) across all languages
- **`src/index.css`** -- Comment text
- **`supabase/functions/shopping_chat/index.ts`** -- User-Agent and system prompt
- **`supabase/functions/style_chat/index.ts`** -- Any references
- **Other edge functions** -- Scan and update any remaining mentions

---

## Part 2: Landing Page

Create a new **`src/pages/Landing.tsx`** -- a high-conversion, English-language marketing page with these sections:

1. **Hero** -- "BURS" wordmark, tagline ("Your AI-powered personal stylist"), CTA button ("Get Started" links to /auth)
2. **Features** -- 3-column grid: AI Outfit Generator, Smart Calendar Planning, Digital Wardrobe
3. **How it Works** -- 3-step visual flow: Add clothes, Set your day, Get styled
4. **Social Proof / Trust** -- Privacy-first, no data sharing, cancel anytime
5. **CTA Footer** -- Final call-to-action with download/signup prompt
6. **Footer** -- Links to /privacy, /terms, /contact

Design:
- Scandinavian minimalist: lots of whitespace, charcoal on off-white
- Smooth scroll-reveal animations using the existing `animate-fade-in` utility
- Fully responsive (mobile-first)
- Dark mode support via existing theme tokens

---

## Part 3: Routing Update

- **`src/App.tsx`** -- Add a new public route for the landing page (e.g., `/welcome` or update the Index route)
- Unauthenticated users visiting `/` will see the landing page; authenticated users go straight to Home

---

## Technical Details

**Files to create:**
- `src/pages/Landing.tsx`

**Files to modify:**
- `src/components/ui/DrapeLogo.tsx`
- `src/pages/Auth.tsx`
- `src/App.tsx`
- `index.html`
- `public/manifest.json`
- `src/i18n/translations.ts`
- `src/index.css`
- `src/pages/Home.tsx` (localStorage keys `drape_last_*` to `burs_last_*`)
- Edge functions with "DRAPE" references

**No database changes needed.**

