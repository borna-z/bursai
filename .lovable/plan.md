

## Use Uploaded Logo on Landing Page

### What changes
1. **Copy the uploaded logo** (`burs_logo_transparent_4x-2.png`) into `src/assets/burs-landing-logo-white.png`
2. **Update `src/pages/Landing.tsx`**:
   - Replace the text-only "BURS" wordmark in the header (line 54) with an `<img>` tag using the new logo
   - Remove the `BursMonogram` from the hero section (line 99) -- the user said "don't put one underneath, just use it"
   - Remove the `BursMonogram` import if no longer needed (check footer usage at line 380 -- replace that too with the new logo image)
   - Size the header logo to roughly `h-6` and the footer logo to roughly `h-5` for crisp rendering on the dark background

### Technical detail
- The uploaded image is white text on transparent background, which works perfectly on the dark `#030305` landing
- Import as ES module: `import bursLandingLogo from '@/assets/burs-landing-logo-white.png'`
- All three `BursMonogram` usages on Landing.tsx (header, hero, footer) will be replaced or removed
- The "Join the movement" section monogram (line 300) will also be replaced with the new logo for consistency

