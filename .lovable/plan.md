

# Make AI Suggestions & Planned Outfit Compact

## Changes

### 1. `src/components/insights/AISuggestions.tsx` — Compact header & tighter spacing
- Reduce container padding from `py-7 px-6` to `py-4 px-4`
- Shrink garment circles from 88px to 64px
- Reduce title font from 19px to 15px
- Tighten vertical spacing (`space-y-5` → `space-y-3`)
- Make CTA buttons shorter (`h-11` → `h-9`)
- Keep the same design language, just denser

### 2. `src/pages/Home.tsx` — Compact planned outfit card
- Replace the large 4-column square grid with a single horizontal strip (thumbnails ~48px tall)
- Move occasion badge inline with the strip instead of below
- Remove the explanation text from the card (it's visible on detail page)
- Replace the full-width "View Outfit" button with a compact row: occasion badge + chevron tap target
- Keep the card clickable to navigate to outfit detail

