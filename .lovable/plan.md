

## Remove Background from BURS Logo

### Problem
The BURS logo PNG (`burs-landing-logo.png`) has a visible background (appears as a gray/checkered square on the page). This looks unprofessional -- the logo mark should float cleanly on the page background without any container shape.

### Solution

Create an inline SVG component for the BURS "B" monogram that renders with a transparent background. This replaces all `<img src={bursLandingLogo}>` instances on the landing page and marketing pages.

### Changes

**1. New file: `src/components/ui/BursMonogram.tsx`**

A simple SVG component that renders the BURS "B" mark in pure charcoal (#111111) with no background. It accepts `size` and `className` props. The monogram will be a clean, geometric "B" inspired by the existing logo shape -- a stylized letter with a subtle fabric-fold aesthetic.

**2. Update `src/pages/Landing.tsx`**

Replace all 4 instances of `<img src={bursLandingLogo}>` with `<BursMonogram>`:
- Header logo (size 36)
- Hero logo (size 80)
- Final CTA logo (size 56)
- Footer logo (size 20)

Remove the `rounded-xl` / `rounded-2xl` classes since SVG needs no border-radius clipping.

**3. Update `src/pages/marketing/Terms.tsx`, `PrivacyPolicy.tsx`, `Contact.tsx`**

Replace `<img src={bursLogo}>` with `<BursMonogram>` in the header of each page.

**4. Update `src/components/ui/DrapeLogo.tsx`**

Replace `<img src={bursLogoSrc}>` with `<BursMonogram>` for the icon variant, so the in-app logo also renders without a background.

### Files Modified

| File | Change |
|------|--------|
| `src/components/ui/BursMonogram.tsx` | New SVG component for the BURS "B" mark |
| `src/pages/Landing.tsx` | Replace 4 img tags with BursMonogram |
| `src/pages/marketing/Terms.tsx` | Replace img with BursMonogram |
| `src/pages/marketing/PrivacyPolicy.tsx` | Replace img with BursMonogram |
| `src/pages/marketing/Contact.tsx` | Replace img with BursMonogram |
| `src/components/ui/DrapeLogo.tsx` | Replace img with BursMonogram |

