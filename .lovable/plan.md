

# Fix Today Page Layout + Logo Drawing Animation

## Part 1: Fix Today Page Layout

The Home page has layout issues where buttons and elements don't align properly on mobile. The fixes are:

### Changes to `src/pages/Home.tsx`:
- **Generate CTA button**: Ensure it stays full-width with proper margin spacing. Currently `w-full h-12` but the `-mt-3` on the min garments text can cause overlap.
- **Quick Stats strip**: Add horizontal padding so the stat columns don't crowd each other on narrow screens.
- **"See all insights" button**: Move it outside the `space-y-6` container's flow so it doesn't get extra vertical spacing -- reduce the gap above it.
- **Occasion pills**: Ensure the horizontal scroll container clips correctly with proper padding compensation (`-mx-4 px-4` pattern is already there, verify it works).
- **Weather Pill alignment**: The Collapsible content from WeatherPill can push layout below it. Wrap the greeting row to prevent the expanded weather from misaligning the occasion section.

### Specific fixes:
1. Add `overflow-hidden` to the greeting row so the WeatherPill collapsible expands downward cleanly
2. Reduce excessive spacing between the Generate CTA and the stats strip
3. Ensure the "min garments" warning text doesn't use negative margin that overlaps
4. Add proper gap between AISuggestions card and the "See all insights" button

---

## Part 2: Logo Drawing Animation for App Loading Screen

Replace the plain spinner in `src/pages/Index.tsx` with a premium SVG logo that animates as if being drawn, then fades into the full app.

### New file: `src/components/ui/BursDrawLogo.tsx`
- Create an SVG version of the BURS "B" monogram using path elements
- The path uses `stroke-dasharray` and `stroke-dashoffset` to create a "drawing" effect
- After the stroke finishes drawing (~1.2s), the fill fades in (~0.4s)
- The "BURS" wordmark fades in after the icon (~0.3s delay)
- Total animation: ~2s
- Uses `framer-motion` for orchestrating the sequence

### Update: `src/pages/Index.tsx`
- Replace the plain spinner with the new `BursDrawLogo` component
- Add a fade-out transition when loading completes (the logo scales up slightly and fades out before showing content)
- Use `onAnimationComplete` to allow immediate transition if auth resolves before animation finishes

### Animation sequence:
```text
[0.0s] Screen appears with bg-background
[0.0s-1.2s] SVG monogram strokes draw in (stroke-dashoffset animation)
[1.0s-1.4s] Fill fades in as stroke completes
[1.2s-1.6s] "BURS" wordmark letters fade in with slight stagger
[auth ready] Whole logo scales to 1.05x and fades out (0.3s)
[done] Content renders
```

### Technical approach:
- SVG path data will represent the BURS "B" monogram shape (a stylized hanger/letter B)
- `stroke-dasharray` set to total path length, `stroke-dashoffset` animated from full length to 0
- CSS `@keyframes` for the draw effect (no JS needed for the core animation)
- `framer-motion` `AnimatePresence` for the exit transition
- The component checks if auth has resolved: if yes during animation, it waits for animation to finish before transitioning; if auth takes longer than animation, it shows a subtle pulse until ready

### Colors:
- Light mode: `#111111` stroke on `bg-background`
- Dark mode: `#F6F4F1` stroke on dark background
- Uses CSS `currentColor` so it automatically respects the theme

