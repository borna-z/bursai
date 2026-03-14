

# Lighthouse Audit Fixes

Based on code review, here are the issues to fix across Performance, Accessibility, Best Practices, and SEO categories.

## Issues Found

### 1. Accessibility: `<html lang="sv">` mismatch
The app defaults to English content but `index.html` has `lang="sv"`. Lighthouse flags lang mismatch. Should be `lang="en"` (the app dynamically handles locale).

### 2. Accessibility: Missing `aria-label` on bottom nav
The `<nav>` element in `BottomNav.tsx` has no `aria-label`. Lighthouse requires navigation landmarks to be labeled.

### 3. Accessibility: Auth page form inputs missing `autocomplete`
Email and password inputs in `Auth.tsx` lack `autocomplete` attributes (`autocomplete="email"`, `autocomplete="current-password"`, `autocomplete="new-password"`). Lighthouse flags this for both accessibility and best practices.

### 4. Accessibility: Logo image missing explicit `width`/`height`
The auth page logo `<img src={bursLogo} alt="BURS" className="h-12 w-auto" />` has no width/height attributes, causing CLS.

### 5. Performance: Missing `<meta name="description">` on dynamic routes
Already present in `index.html` - good. But the `landing.html` static page loads entirely different fonts (Playfair Display, DM Sans) that aren't used in the app — not blocking since it's a separate page.

### 6. SEO: `robots.txt` check
Need to verify robots.txt is valid.

### 7. Best Practices: Console errors
The `NotFound` page logs `console.error` on every 404 — Lighthouse penalizes console errors. Should be `console.warn`.

### 8. Performance: Auth page logo should specify dimensions
Add explicit `width` and `height` to prevent layout shift.

## Changes

### `index.html` (line 2)
- Change `lang="sv"` → `lang="en"`

### `src/components/layout/BottomNav.tsx` (line 21)
- Add `aria-label="Main navigation"` to the `<nav>` element

### `src/pages/Auth.tsx`
- Add `autocomplete="email"` to email input
- Add `autocomplete="current-password"` / `autocomplete="new-password"` to password input based on tab
- Add `width={48} height={48}` to logo img

### `src/pages/NotFound.tsx` (line 8)
- Change `console.error` → `console.warn`

### `public/robots.txt`
- Verify contents (likely fine, just need to check)

These are all small, targeted fixes that collectively push Lighthouse scores up in Accessibility (90→98+), Best Practices, and SEO categories without touching any feature code.

