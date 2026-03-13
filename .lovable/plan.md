

# Redesign Contact Page to Match Landing.html Warm Beige Theme

## Context
The static `landing.html` uses a warm beige editorial design (`#F5F0E8` background, `#1C1917` ink, Playfair Display + DM Sans fonts). The Contact page currently uses a dark theme (`#030305`). The user wants all marketing pages to match the landing.html aesthetic. Privacy and Terms already use `force-light` with a neutral theme — Contact is the outlier.

## Changes

### `src/pages/marketing/Contact.tsx` — Full redesign to match landing.html
- Replace dark background (`#030305`) with warm beige (`#F5F0E8`)
- Replace white text with dark ink (`#1C1917`)
- Use Playfair Display for headings, DM Sans for body (matching landing.html fonts)
- Restyle inputs: beige surface (`#EDE8DF`), border `#DDD8CF`, dark text
- Restyle submit button: dark ink background (`#1C1917`) with beige text (matching `.btn-primary` from landing)
- Header: BURS monogram logo + back link to `/`, matching the warm color scheme
- Footer: warm beige styling with muted links (`#6B6560`), matching landing footer colors
- Update email to `hello@burs.me` (already correct)
- Keep the same form logic and structure, just retheme everything

### Color mapping (landing.html → Contact page)
- `--bg: #F5F0E8` → page background
- `--surf: #EDE8DF` → input backgrounds
- `--border: #DDD8CF` → borders
- `--ink: #1C1917` → text, buttons
- `--muted: #6B6560` → secondary text
- `--faint: rgba(28,25,23,.35)` → placeholder text

