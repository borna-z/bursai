
# Update OG Image with Logo

## What Changes
Replace the current OG image (`public/og-image.png`) with a new 1200x630 version that includes:

- The **hanger-B monogram** logo (from `src/assets/burs-hanger-logo.png`) rendered in white, centered above the "BURS" wordmark
- The same **dark space-noir background** (#030305) matching the landing page
- Subtle aurora glow effect behind the logo for depth
- "BURS" wordmark below the icon in Space Grotesk font
- "Your AI Stylist" tagline in lighter gray beneath

## Technical Approach
Since OG images must be static PNG files (social crawlers cannot render HTML/CSS), I will generate a new `public/og-image.png` using an HTML-to-image approach rendered at build time, or create it as a pre-rendered static asset.

The composition will be:
- 1200x630px canvas
- Dark gradient background matching landing (#030305 to #0a0a12)
- White hanger-B monogram centered, approximately 120px tall
- "BURS" text in white, tracked, below the icon
- "Your AI Stylist" subtitle in gray (#888)
- Faint radial aurora glow (blue-indigo) behind the logo center

No code changes needed beyond replacing the image file — all meta tags already point to `/og-image.png` with correct dimensions.

## File Modified
- `public/og-image.png` — replaced with new design incorporating the logo
