

# Use New Logo for Landing Page Only

## Overview
Save the uploaded hanger+B monogram logo as a separate asset (`burs-landing-logo.png`) and use it exclusively on the Landing page, while keeping the existing `burs-logo.png` unchanged for the rest of the app.

## Steps

1. **Copy the uploaded image** to `src/assets/burs-landing-logo.png`

2. **Update `src/pages/Landing.tsx`**:
   - Add a new import: `import bursLandingLogo from '@/assets/burs-landing-logo.png'`
   - Replace all references to `bursLogo` with `bursLandingLogo` throughout the landing page (header, hero phone mockup, final CTA, and footer)

No other files are affected -- the app logo (`DrapeLogo` component, PWA icons, etc.) continues using the existing `burs-logo.png`.

