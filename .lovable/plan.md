

## Fix Accent Color Issues + Redesign Wardrobe FAB Menu

### Problem 1: Accent Color Appearing White

The `applyAccent()` function in `ThemeContext.tsx` updates `--accent` and `--accent-indigo` CSS variables but does **not** update `--accent-foreground`. The CSS defaults have `--accent-foreground: 0 0% 100%` (white in light mode). This means anywhere using `text-accent-foreground` without a matching `bg-accent` will render white/invisible text.

**Affected areas** include the `InsightsBanner` ring stroke (uses `--primary` instead of `--accent`), and several buttons/badges throughout the app.

**Fix:**
- Update `applyAccent()` in `ThemeContext.tsx` to also set `--accent-foreground` based on the resolved theme (white for light, dark for dark — matching contrast needs of each accent color).
- In `InsightsBanner.tsx`, change the ring stroke from `hsl(var(--primary))` to `hsl(var(--accent))` so it respects the user's chosen accent color.

### Problem 2: Redesign FAB Menu in Wardrobe

The current FAB pops up two plain `bg-card` buttons. This will be redesigned into a premium Apple-style radial menu.

**New design:**
- **Backdrop**: Semi-transparent blur overlay when open (`bg-background/60 backdrop-blur-sm`).
- **Menu items**: Each option gets a larger icon circle (`w-12 h-12 rounded-full bg-accent text-accent-foreground`) with a label beside it, staggered animation upward.
- **Three options**: "Add from Photo" (Camera), "BURS Live Scan" (ScanLine), "Import from Link" (Link icon) — adding a third creative entry point.
- **FAB button**: Changes to accent-colored (`bg-accent text-accent-foreground`) instead of primary, with smooth 45° rotation on open.
- **Stagger animation**: Each menu item animates in with increasing delay for a premium cascading feel.

### Files to Edit
1. **`src/contexts/ThemeContext.tsx`** — Fix `applyAccent()` to set `--accent-foreground` properly
2. **`src/components/home/InsightsBanner.tsx`** — Use accent color for the usage ring
3. **`src/pages/Wardrobe.tsx`** — Redesign `AddFAB` component with premium radial menu

