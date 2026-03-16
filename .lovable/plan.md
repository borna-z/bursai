

# Unify BURS Design System

## Audit Summary

After reviewing index.css, tailwind.config.ts, and 15+ component/page files, here are the inconsistencies found:

### Issues Identified

**1. Border radius chaos** — The codebase uses `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl` interchangeably across 91 files. No consistent rule for which surface gets which radius. Light mode sets `--radius: 0px` (square edges) but many components hardcode `rounded-xl`/`rounded-2xl` directly, bypassing the token.

**2. PaywallModal breaks brand palette** — Uses `from-amber-500 to-orange-500` gradient and `text-amber-600` instead of the semantic `--premium` token already defined in the design system.

**3. Section header inconsistency** — Three different patterns exist: `SectionHeader` component (label-editorial), inline `SectionLabel` in Insights (custom 11px), and raw `h2` tags with ad-hoc uppercase styling in OutfitGenerate. Should converge on `SectionHeader` or `label-editorial`.

**4. Page padding inconsistency** — Home uses `px-5 pt-8`, Insights uses `px-5 pb-12 pt-8`, Settings uses `px-6 pb-8 pt-12`, OutfitGenerate uses `p-4`. Should standardize.

**5. Button sizes mixed** — Some pages use hardcoded `h-11 rounded-xl`, others use the Button component's `size="lg"` (h-12 rounded-xl). The component and inline styles conflict.

**6. Chip component ignores light-mode radius** — Hardcodes `rounded-full` regardless of theme. In light mode (editorial, square edges), chips should still use `rounded-full` since they're pills, but interactive chips in OutfitGenerate should match surface radius.

**7. Skeleton shimmer uses custom CSS class** — Good, but the `Skeleton` component hardcodes `rounded-lg` instead of using `rounded-md` (the token-derived value from `--radius`).

**8. Glass utilities are defined but inconsistently applied** — `glass`, `glass-card`, `glass-chip`, `glass-surface` exist but most components use inline `bg-card/70 backdrop-blur-md` instead.

**9. Heading font-family conflict** — Base CSS sets headings to Sora, but light-mode override sets them to Playfair Display. The tailwind config defines `font-heading: Sora`. Components don't use `font-heading` class, relying on the CSS cascade, which is fragile.

**10. OutfitGenerate section headers use raw h2** — With inline `text-sm font-medium text-muted-foreground tracking-wide uppercase` instead of the existing `label-editorial` class.

## Plan

### File 1: `src/index.css` — Standardize spacing and surface tokens
- Add `--page-px` and `--page-pt` CSS custom properties for consistent page padding
- Add `.page-container` utility class: `max-w-lg mx-auto px-[var(--page-px)] pt-[var(--page-pt)] pb-12`
- Fix Skeleton component's base radius reference

### File 2: `src/components/ui/skeleton.tsx` — Use token radius
- Change `rounded-lg` to `rounded-[var(--radius)]` so it respects light/dark theme radius

### File 3: `src/components/PaywallModal.tsx` — Use brand premium tokens
- Replace `from-amber-500 to-orange-500` with `gradient-premium` utility
- Replace `text-amber-600` with `text-premium`
- Replace `border-amber-500/50` with `border-premium/50`

### File 4: `src/pages/OutfitGenerate.tsx` — Use label-editorial class
- Replace inline section header styling with `label-editorial` class for Occasion and Style headers
- Standardize page padding to match other pages

### File 5: `src/pages/Insights.tsx` — Use SectionHeader or label-editorial
- Replace inline `SectionLabel` component with `label-editorial` class for consistency

### File 6: `src/pages/Settings.tsx` — Standardize page padding
- Align `px-6 pb-8 pt-12` → use consistent padding values

### File 7: `src/pages/Home.tsx` — Ensure consistent page padding
- Verify and align with standardized page spacing

### File 8: `src/components/ui/AILoadingCard.tsx` — Use surface class
- Replace inline `rounded-xl border border-border/10 bg-card/60` with `surface-secondary rounded-xl`

### Summary of changes:
- **8 files** modified
- **0 new components** (reuse existing utilities)
- Standardized page padding across 4+ pages
- PaywallModal brought into brand palette
- Section headers unified to `label-editorial`
- Skeleton radius made token-aware
- Surface classes applied consistently

