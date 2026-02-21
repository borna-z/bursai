

# Landing Page Copy Improvements — Text Only

## Summary

Small, high-impact copy changes to make the product clearer (AI wardrobe + styling app) while keeping the premium tone. No design, layout, color, spacing, component, or animation changes.

## Changes

### 1. Hero Section — New Copy (all 14 languages)

Replace these translation keys:

| Key | Current (EN) | New (EN) |
|-----|-------------|----------|
| `landing.badge` | "Sustainable AI Styling" | "AI Wardrobe & Stylist" |
| `landing.hero` | "Designed for the next dimension." | "Rediscover your wardrobe." |
| `landing.hero_desc` | "Pure Scandinavian minimalism meets brutal computational power in a frictionless experience." | "BURS turns your clothes into effortless outfits — personalized for your day, weather, and style." |
| `landing.get_started` | "Get Started" | "Try BURS" |
| `landing.explore` | "Explore" | "See how it works" |

Swedish equivalents:

| Key | New (SV) |
|-----|----------|
| `landing.badge` | "AI-garderob & stylist" |
| `landing.hero` | "Aterupptack din garderob." |
| `landing.hero_desc` | "BURS gor dina klader till enkla outfits — anpassade for din dag, vader och stil." |
| `landing.get_started` | "Testa BURS" |
| `landing.explore` | "Se hur det funkar" |

All 14 languages will be updated with equivalent translations.

### 2. Add Trust Line Under Hero Buttons

Add a small text line below the CTA buttons in the hero section:

**EN:** "Private by design · Built for real wardrobes · Made for everyday life"
**SV:** "Privat fran grunden · Byggt for riktiga garderober · Gjort for vardagen"

New translation key: `landing.trust_line`

This requires a tiny addition to `Landing.tsx` — one `<p>` element below the existing button `<div>`, using the same reveal animation style already in use.

### 3. Brand Consistency — "Burs" to "BURS"

Fix inconsistent casing in these keys (all languages):

| Key | Current (EN) | Fixed |
|-----|-------------|-------|
| `landing.sust_desc` | "...Burs helps you..." | "...BURS helps you..." |
| `landing.cta_desc` | "...Rediscover your style with Burs." | "...Rediscover your style with BURS." |

Same fix in SV and all other languages where "Burs" appears lowercase in landing keys.

### 4. Final CTA Button Label

The final CTA button (Slide 7) currently uses `t('landing.login')` which shows "Log In". Change it to use `t('landing.get_started')` so it says "Try BURS" — matching the hero CTA.

This is a one-word change in `Landing.tsx` line 344.

---

## Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `src/i18n/translations.ts` | Update 5 existing keys + add 1 new key (`landing.trust_line`) across all 14 languages. Fix "Burs" to "BURS" in 2 keys. |
| 2 | `src/pages/Landing.tsx` | Add trust line `<p>` under hero buttons (line ~164). Change final CTA from `landing.login` to `landing.get_started` (line 344). |

**Total: 2 files. No design changes. No new components. No layout changes.**

