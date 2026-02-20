

## Redesign Landing Page -- Light, Minimal, App-Matched

### Vision

Replace the current dark-mode landing page with a light, warm design that matches the app's Scandinavian aesthetic (#F6F4F1 background, #111111 charcoal text, Sora + Inter fonts). The BURS logo takes center stage as the hero element. App screenshots showcase features. The footer includes all required legal links (Privacy Policy, Terms of Service, Contact) for GDPR compliance and Google API verification.

### Current Problems
- Landing page uses a completely different dark theme (`bg-[#0a0a0a]`) that clashes with the app's warm off-white identity
- No clear legal footer structure for GDPR/Google compliance
- Hero focuses on text, not on the brand logo
- Only one app screenshot shown; no feature walkthrough

### New Layout

```text
+------------------------------------------+
|  Sticky Header: Logo + Nav + CTA         |
+------------------------------------------+
|                                          |
|  HERO: Large BURS logo centered          |
|  Tagline: "Rediscover your wardrobe."    |
|  Subtitle (one line)                     |
|  [Get Started] button                    |
|                                          |
+------------------------------------------+
|                                          |
|  HOW IT WORKS (3 steps)                  |
|  Each step: number + icon + text         |
|  + phone mockup with app screenshot      |
|                                          |
+------------------------------------------+
|                                          |
|  SUSTAINABILITY quote + stats            |
|  (bg-muted/30 tinted section)            |
|                                          |
+------------------------------------------+
|                                          |
|  TRUST section (3 cards: privacy,        |
|  zero lock-in, always on)               |
|                                          |
+------------------------------------------+
|                                          |
|  FINAL CTA: logo + "Join the movement"  |
|  [Get Started]                           |
|                                          |
+------------------------------------------+
|  FOOTER:                                 |
|  Logo | Privacy Policy | Terms of        |
|  Service | Contact | Social icons        |
|  (C) 2026 BURS AB                        |
|  "All data processed per GDPR."          |
+------------------------------------------+
```

### Specific Changes

**1. `src/pages/Landing.tsx` -- Complete visual overhaul**

- Switch from `bg-[#0a0a0a] text-gray-100` to `bg-background text-foreground` (uses the app's CSS variables: warm off-white in light mode, dark in dark mode)
- Header: `bg-background/80 backdrop-blur-md border-b border-border` instead of dark hardcoded colors
- Hero section:
  - Center the BURS logo large (80px icon) as the primary visual element
  - Below it: "Rediscover your wardrobe." headline in Sora font
  - One-liner subtitle
  - Single CTA button: `bg-foreground text-background` (ink/paper inversion) with rounded-full
  - Subtle radial gradient glow behind the logo using `bg-accent/5`
- Phone mockup: keep the existing screenshot but style the phone frame to match light theme (`border-border` instead of dark borders)
- How It Works: use `text-foreground` and `text-muted-foreground` instead of hardcoded grays; step numbers in `text-muted/10` for watermark effect
- Sustainability section: `bg-muted/30` background instead of `bg-white/[0.02]`; stats grid with `bg-background` cells and `border border-border`
- Mission/Trust section: cards with `bg-card border border-border rounded-2xl` instead of dark backgrounds
- Final CTA: same ink/paper button style
- Footer: comprehensive legal links row with Privacy Policy, Terms of Service, Contact, social icons, copyright with "BURS AB", and a small GDPR compliance note

**2. Footer legal compliance for Google API verification**

The footer will include:
- Link to `/privacy` (Privacy Policy page -- already exists)
- Link to `/terms` (Terms of Service page -- already exists)
- Link to `/contact` (Contact page -- already exists)
- Copyright: "(C) 2026 BURS AB"
- Small note: "Your data is processed in accordance with GDPR."
- These are the standard requirements for Google API/OAuth consent screen verification

**3. `src/pages/marketing/Terms.tsx` and `src/pages/marketing/PrivacyPolicy.tsx` -- Minor branding fix**

- Change Helmet titles from "BURS" to match consistently (already correct)
- Ensure the contact section in PrivacyPolicy uses `privacy@burs.se` instead of `privacy@example.com`
- Translate the Swedish "Kontakt" / "For fragor om integritet" section to English in PrivacyPolicy.tsx for consistency with the English landing page

**4. `src/pages/marketing/Contact.tsx` -- Fix placeholder email**

- Change `hello@example.com` to `hello@burs.se`
- Change `<title>Contact | DRAPE</title>` to `Contact | BURS`
- Fix Swedish meta description to English

**5. Animation approach**

- Keep existing `useScrollReveal` hook for all sections
- Hero logo gets a subtle `animate-fade-in` with slight scale-up on load
- Sections use staggered `scroll-reveal` with CSS `--delay` variables (existing pattern)
- CTA buttons use the existing `hover:scale-105` pattern
- Phone mockup keeps the subtle `hover:rotate-0` tilt effect

**6. Route change**

- In `App.tsx`, change the Landing route from `/welcome` to be the public-facing root, or keep `/welcome` but ensure the landing page link structure is clear. Since `/` is already the protected Home route, keep Landing at `/welcome` but ensure footer links point back correctly.

### Files Modified

| File | What changes |
|------|-------------|
| `src/pages/Landing.tsx` | Full visual overhaul: light theme, logo-first hero, app-matched colors, legal footer |
| `src/pages/marketing/PrivacyPolicy.tsx` | Fix contact email, translate Swedish contact section to English |
| `src/pages/marketing/Contact.tsx` | Fix DRAPE to BURS in title, fix placeholder email, fix Swedish meta |
| `src/pages/marketing/Terms.tsx` | No changes needed (already correct) |

### What stays the same
- All routes (`/privacy`, `/terms`, `/contact`, `/welcome`)
- `useScrollReveal` hook
- App screenshots and logo assets
- All existing legal page content and structure
