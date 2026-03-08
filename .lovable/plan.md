

# Replace AI-Generated Screenshots with HTML/CSS App Mockups

## Problem
The current product showcase uses AI-generated PNG screenshots that show nonsensical content — random coats, garbled text, no real outfit logic. They hurt credibility instead of helping it.

## Solution
Replace the three static PNG images with **live HTML/CSS phone mockups** that render realistic, hardcoded app UI directly in the landing page. No image files needed. Each mockup shows a representative screen:

1. **Wardrobe screen** — A grid of 6 clothing thumbnails (using colored placeholder squares representing real garment categories: navy blazer, white tee, black jeans, brown boots, grey sweater, olive chinos) with a search bar and category chips at top
2. **Home/Today screen** — An outfit card showing 3-4 matched pieces (top + bottom + shoes + accessory) with occasion badge ("Casual Friday"), weather pill ("12°C"), and a "Wear this" CTA
3. **AI Chat screen** — 2-3 chat bubbles showing a realistic exchange: user asks "What should I wear to dinner?", AI responds with a suggestion referencing specific garment colors/types

## Technical Approach

### `ProductShowcase.tsx` — Full rewrite
- Remove all `import` of PNG screenshot assets
- Build 3 React sub-components: `MockWardrobe`, `MockOutfit`, `MockChat`
- Each renders inside the existing `.phone-mockup` frame
- Use the app's actual color palette (warm off-white bg `#F6F4F1`, charcoal text, indigo accent)
- Content is static/hardcoded — no data fetching, no auth needed
- Keep the existing layout (center phone larger, side phones rotated)

### `HeroSection.tsx` — Remove screenshot import
- Remove the `app-screenshot-home-new.png` import (hero is text-only now, no image used there)

### Asset cleanup
- The 3 PNG files in `src/assets/` (`app-screenshot-home-new.png`, `app-screenshot-wardrobe.png`, `app-screenshot-chat.png`) can be deleted since they're no longer referenced

## What each mockup shows

**Wardrobe mock**: Category chips (All, Tops, Bottoms, Shoes), then a 2×3 grid of colored rounded-rect cards each with a tiny label — feels like a real image-first wardrobe grid.

**Outfit/Today mock**: A card with "Today's Outfit" header, 3 garment slots shown as horizontal list (colored squares with labels like "Navy Blazer", "White Chinos", "Brown Loafers"), occasion badge, small weather indicator.

**Chat mock**: Dark-ish chat bubbles with realistic Q&A — "What goes with my navy blazer?" → AI reply mentioning specific wardrobe pieces with a mini garment chip inline.

## Files Modified
- `src/components/landing/ProductShowcase.tsx` — full rewrite with HTML mockups
- `src/components/landing/HeroSection.tsx` — remove unused import

## Files Deleted
- `src/assets/app-screenshot-home-new.png`
- `src/assets/app-screenshot-wardrobe.png`
- `src/assets/app-screenshot-chat.png`

