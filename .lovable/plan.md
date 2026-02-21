

# Fix: Eliminate Slow Landing Page Load

## The Problem

When an unauthenticated user visits `/`, they experience this chain of delays:

1. White screen with "Skip to content" link visible (body bg is light)
2. A spinning `Loader2` icon while Supabase auth check runs (~200-500ms)
3. Redirect to `/welcome`
4. Framer Motion crossfade animation (400ms)
5. Hero content reveal animations with staggered delays up to 550ms

Total perceived delay: 1.5-2+ seconds of non-content before the landing page feels "loaded".

## The Fix (5 changes)

### 1. Render Landing directly on `/` instead of auth-check-then-redirect
Change `Index.tsx` so unauthenticated users never see a spinner. While auth is loading, render the Landing page immediately instead of showing a loader. Only redirect to Home/onboarding AFTER auth confirms a logged-in user.

**File:** `src/pages/Index.tsx`

### 2. Remove the initial crossfade delay for first render
Set `initial={false}` on the first AnimatePresence render so the very first page appears instantly without the 400ms opacity animation. Subsequent navigations keep the crossfade.

**File:** `src/components/layout/AnimatedRoutes.tsx`

### 3. Make hero content visible immediately (no reveal delay on load)
Add hero elements as `.visible` by default on mount (or set `--reveal-delay: 0ms` for all hero children and add `.visible` class immediately). The IntersectionObserver pattern is great for scroll-triggered sections but hurts the hero which is always in view.

**File:** `src/components/landing/HeroSection.tsx` -- add `visible` class directly to hero reveal elements so they render instantly without waiting for IntersectionObserver.

### 4. Dark background on root loading state
Change the `Index.tsx` loading spinner to use a dark background (`bg-[#030305]`) so there's no white flash before the dark landing page appears.

**File:** `src/pages/Index.tsx`

### 5. Speed up the crossfade transition for dark routes
Reduce the `/welcome` and `/auth` crossfade from 400ms to 200ms.

**File:** `src/components/layout/AnimatedRoutes.tsx`

## Result

- Unauthenticated users see the landing page hero content **instantly** (0ms delay)
- No white flash, no spinner, no "skip to content" visible on blank screen
- Logged-in users still get properly redirected after auth resolves
- Scroll-triggered animations below the fold remain unchanged

## Technical Summary

| Change | File | What |
|--------|------|------|
| Show Landing while auth loads | `Index.tsx` | Render `<Landing />` instead of spinner for unauthenticated/loading state |
| Skip first-render animation | `AnimatedRoutes.tsx` | Use a ref to skip initial mount animation |
| Hero visible immediately | `HeroSection.tsx` | Add `visible` class to hero reveal elements directly |
| Dark loading background | `Index.tsx` | `bg-[#030305]` on loading container |
| Faster crossfade | `AnimatedRoutes.tsx` | 400ms to 200ms for dark route transitions |
