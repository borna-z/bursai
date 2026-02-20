

## Changes to the Landing Page

### 1. Replace "Get Early Access" with "Log In"
All buttons currently labeled "Get Early Access" will be changed to "Log In" -- this applies to:
- The header CTA button
- The mobile drawer button
- The final CTA section at the bottom

### 2. Add "How to Download" Section
A new section will be added between the final CTA and the footer, showing users how to install BURS on their devices:

- **iPhone card**: Apple logo icon + step-by-step instructions (Open in Safari, tap Share, tap "Add to Home Screen")
- **Android card**: Android logo icon (from lucide's `Smartphone` or a custom SVG) + instructions (Open in Chrome, tap menu, tap "Install App" or "Add to Home Screen")
- Both cards will be displayed side by side on desktop, stacked on mobile

Since lucide-react does not include Apple/Android brand icons, inline SVG paths for the Apple logo and Android logo (simple, recognizable silhouettes) will be used directly in the component.

### Technical Details

| File | Change |
|------|--------|
| `src/pages/Landing.tsx` | Replace all "Get Early Access" text with "Log In". Add a new "Download" section with Apple and Android install instructions using inline SVG brand icons. Update the nav links array to include the new download section. |

The new section will follow the same Scandinavian minimal design system: `scroll-reveal` animations, Sora font headings, `border-border` cards, and muted color palette.
