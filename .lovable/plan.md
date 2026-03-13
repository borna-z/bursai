

## Fix Black Screen During Page Transitions

### Root Cause
Two issues combine to create a black flash:

1. **`AnimatePresence mode="sync"`** — Both the exiting and entering pages render simultaneously. The entering page starts with `opacity: 0` (from `routeVariants.initial`), so for a brief moment neither page is visible → black flash.

2. **`ProtectedRoute` loading state has no background** — The `min-h-screen` spinner div has no `bg-background` class, so during auth resolution the underlying dark body color shows through.

### Fix

**1. `src/components/layout/AnimatedRoutes.tsx`**
- Change `AnimatePresence mode="sync"` to `mode="wait"` — this ensures the old page fully exits before the new one enters, eliminating the overlap where both are semi-transparent.
- Add `bg-background` to the `motion.div` style so the animation wrapper always has the correct theme background instead of transparent.

**2. `src/components/auth/ProtectedRoute.tsx`**
- Add `bg-background` to the loading spinner container so it matches the theme during auth resolution.

**3. `src/components/layout/PageSkeleton.tsx`**
- Already has `bg-background` — no change needed.

### Files to edit
1. `src/components/layout/AnimatedRoutes.tsx` — change mode to `"wait"`, add `bg-background` class
2. `src/components/auth/ProtectedRoute.tsx` — add `bg-background` to loading container

