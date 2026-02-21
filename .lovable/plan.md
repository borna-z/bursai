

# Unify Logo Across Entire PWA

## Summary
Replace all old logo references throughout the app with the new logo you provided (`burs-logo-white.png`). This affects the landing page, marketing pages, and the shared logo components.

## Changes

### 1. Update `BursMonogram` component (single source of truth)
**File:** `src/components/ui/BursMonogram.tsx`

Replace the `burs-hanger-logo.png` import with `burs-logo-white.png`. Since this component is used by `DrapeLogo` and all marketing pages, updating it here propagates everywhere those components are used (Terms, Privacy, Contact pages).

### 2. Update Landing page header
**File:** `src/pages/Landing.tsx`

Replace `burs-landing-logo-white.png` import with `burs-logo-white.png` so the fixed header logo matches.

### 3. Update CTA section
**File:** `src/components/landing/CTASection.tsx`

Replace `burs-landing-logo-white.png` with `burs-logo-white.png`.

### 4. Update Landing footer
**File:** `src/components/landing/LandingFooter.tsx`

Replace `burs-landing-logo-white.png` with `burs-logo-white.png`.

### 5. No changes needed for
- **Auth page** -- already uses the new logo
- **DrapeLogo** -- wraps BursMonogram, so it gets the update automatically
- **Terms, Privacy, Contact pages** -- use BursMonogram, so they get the update automatically
- **In-app pages** (Home, Settings, Wardrobe, etc.) -- these don't display a logo, they use text headers

## Technical Notes

All changes are simple import swaps -- replacing one PNG asset path with another. No layout, sizing, or logic changes are needed since all usages already render the logo as an `<img>` tag with appropriate sizing classes.

**Total files modified: 4**
- `src/components/ui/BursMonogram.tsx`
- `src/pages/Landing.tsx`
- `src/components/landing/CTASection.tsx`
- `src/components/landing/LandingFooter.tsx`
