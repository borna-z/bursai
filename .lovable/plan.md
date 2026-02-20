

# Update Hero Section

## What changes
Replace the current centered hero (lines 66-103) with the new two-column layout featuring:
- **Left column**: Status badge ("Sustainable AI Styling"), headline, subtext, and two CTA buttons ("Get Early Access" + "See The App")
- **Right column**: Minimalist phone mockup frame with app screenshot placeholder and fallback text
- Background glow repositioned to top-left quarter

## Technical details

### File: `src/pages/Landing.tsx`
- Replace lines 66-103 (the current hero section) with the provided two-column hero layout
- Wire up button `onClick` handlers to `navigate('/auth')` to match existing behavior
- Use `bursLogo` as the phone screenshot image source (since no separate app screenshot exists yet) -- this gives the mockup real content instead of a broken image
- Keep all other sections (header, how-it-works, sustainability, mission, CTA, footer) unchanged

### Key adaptations from the provided code
- Convert plain `<button>` elements to use `onClick={() => navigate('/auth')}` for routing
- Replace the hardcoded `/burs-app-screenshot.png` with the imported `bursLogo` asset as a placeholder
- Maintain the existing `animate-fade-in` classes for consistency with the rest of the page

