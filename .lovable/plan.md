

# Fix Contact Link & Redesign Contact Page

## Changes

### 1. `public/landing.html` — Update footer contact link
Change `mailto:hello@burs.me` → `/contact` so it routes to the Contact page.

### 2. `src/pages/marketing/Contact.tsx` — Redesign to match landing page
- Switch from light theme (`force-light`) to dark theme matching the landing page (dark background `#030305`, white text, glass-panel inputs)
- Update email from `hello@burs.se` → `hello@burs.me`
- Restyle header, form inputs, buttons, and footer to use the same dark editorial aesthetic as the landing page (white text, subtle borders, rounded-full CTA button)
- Use the BURS monogram logo in the header consistent with landing

### 3. `src/components/landing/FooterCTA.tsx` — Already correct
The React footer already links to `/contact` — no change needed.

