

## Remove Phone Screenshot and Improve Logo Quality

### 1. Remove the Phone Screenshot from Hero
The hero section currently shows a phone mockup with `app-screenshot-home.png` on the right side (lines 124-129). This entire block will be removed, and the left-side content (headline, description, buttons) will be centered full-width instead of split 50/50.

- Remove the `appScreenshot` import
- Remove the phone mockup `div` (lines 124-129)
- Change the hero layout from side-by-side (`md:flex-row`) to centered single-column
- Update the text container from `md:w-1/2` to full-width centered

### 2. Higher Quality Logo
The current `BursMonogram` component uses a raster PNG image (`burs-hanger-logo.png`), which loses quality at larger sizes. It will be replaced with an inline SVG version of the hanger logo, ensuring crisp rendering at any size.

- Update `BursMonogram.tsx` to render an SVG hanger icon instead of a PNG image
- Remove the PNG import dependency
- The SVG will use `currentColor` so it adapts to light/dark themes automatically

### Technical Details

| File | Change |
|------|--------|
| `src/pages/Landing.tsx` | Remove `appScreenshot` import. Remove the phone mockup div (lines 124-129). Change hero layout to centered single-column. Update text container width classes. |
| `src/components/ui/BursMonogram.tsx` | Replace PNG `<img>` with an inline SVG hanger/coat-hook monogram that scales crisply at any size. |

