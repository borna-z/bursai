

## Fix Light-Mode Header & Slim Down Bottom Nav

### Problem 1: Black header/status bar in light mode
The iOS status bar style is hardcoded to `black-translucent` and the body background is hardcoded to `#0D0D0D` (dark). This forces a dark header even in light mode.

**Fix in `index.html`:**
- Change `apple-mobile-web-app-status-bar-style` from `black-translucent` to `default` — this lets iOS adapt the status bar to the page background automatically
- Replace the hardcoded dark `body` background with a CSS approach that respects the color scheme: use `background: var(--background)` or a media query so light mode gets the cream background and dark mode gets the dark background

**Fix in `src/contexts/ThemeContext.tsx`:**
- The `applyAccent` function already syncs Median's status bar. No changes needed there — the `index.html` fix handles the native PWA case.

### Problem 2: Bottom nav too tall
The bottom nav uses `h-16` (64px). Reduce it to `h-12` (48px) for a slimmer bar while keeping icon and label sizes unchanged.

**Fix in `src/components/layout/BottomNav.tsx`:**
- Change `h-16` to `h-12` on the inner flex container

**Fix in `src/components/layout/AppLayout.tsx`:**
- Reduce the bottom padding from `pb-[88px]` to `pb-[72px]` to match the slimmer nav (48px nav + safe area)

### Files to edit
1. `index.html` — status bar style + body background
2. `src/components/layout/BottomNav.tsx` — nav height
3. `src/components/layout/AppLayout.tsx` — bottom padding

