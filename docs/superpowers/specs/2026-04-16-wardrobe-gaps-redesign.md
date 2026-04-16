# Wardrobe Gaps Redesign — "The Stylist's Pick"

**Date**: 2026-04-16
**Scope**: Frontend-only editorial redesign of the Wardrobe Gaps feature
**Goal**: Strip card wrappers, make it breathe, transform gap results from a dashboard into a personal stylist's recommendation that feels authoritative and curated

## Emotional Direction

"My stylist knows what I need" — the AI disappears and it feels like a personal shopper who studied your wardrobe and knows the ONE piece that will transform it. Same editorial DNA as the Travel Edit redesign.

## Files Changed

| File | Change Type |
|------|------------|
| `src/components/gaps/GapStateViews.tsx` | Remove `StateSurface` card wrappers from all 7 state components, flatten layout |
| `src/components/gaps/GapResultsPanel.tsx` | Remove hero card pass-through, replace horizontal scroll with vertical list, change error banner style |
| `src/components/gaps/GapHeroCard.tsx` | Remove card wrapper + gradient, flatten on page |
| `src/components/gaps/GapSecondaryCard.tsx` | Rewrite from 280px scroll card to flat vertical list item |
| `src/pages/GarmentGaps.tsx` | Minor spacing adjustments |

## Files NOT Changed

| File | Reason |
|------|--------|
| `src/components/gaps/gapTypes.ts` | Types unchanged |
| `src/components/gaps/gapRouteState.ts` | Route logic unchanged |
| `src/hooks/useAdvancedFeatures.ts` | Hook unchanged |
| Any edge function | Purely frontend |
| Any DB schema | No migrations |
| `src/i18n/locales/en.ts` / `sv.ts` | Feature already uses i18n well — no new keys needed |

---

## Fix 1: Remove StateSurface Card Wrappers (GapStateViews.tsx)

**Replaces**: The `StateSurface` component that wraps every non-results state in `rounded-[1.25rem] border border-border/40 bg-card p-5`.

### StateSurface removal
- Delete the `StateSurface` component entirely
- Replace all `<StateSurface>` usages with a `<motion.section>` that has the same animation but NO card styling:
  ```
  className="pt-5 mt-5 border-t border-border/40"
  ```
- Keep `initial={{ opacity: 0, y: 10 }}`, `animate`, and `transition` from the existing `StateSurface`

### StateTitle, StateEyebrow, StateIcon — keep as-is
- These are already correct typography (Playfair italic, uppercase tracking, rounded icon chip)
- No changes needed

### GapHero (intro section)
- Remove the card wrapper: `rounded-[1.25rem] border border-border/40 bg-card px-5 py-6`
- Replace with flat section — just the flex layout with icon + text + status chips
- Keep the `motion.section` with same animation
- Status chips already use `rounded-full border` — keep them

### GapLockedState
- Replace `<StateSurface>` with flat `<motion.section className="mt-5 border-t border-border/40 pt-5">`
- The `WardrobeProgress` widget: remove its card wrapper (`rounded-[1.25rem] border border-border/40 bg-background/60 p-4`) — just render `<WardrobeProgress compact />` with `mt-4`

### GapReadyState
- Replace `<StateSurface>` with flat section
- The three info chips (categories, color, shopping): change from `rounded-[1.25rem] border border-border/40 bg-background/60 p-4` grid cards to inline pills: `rounded-full border border-border/40 bg-background/60 px-3 py-1.5 text-[0.76rem]` in a `flex flex-wrap gap-2`

### GapAutorunState
- Replace `<StateSurface>` with flat section
- No other changes

### GapLoadingState
- Replace `<StateSurface>` with flat section
- `AILoadingOverlay` stays — already has `border-none bg-background/55 p-0 shadow-none`

### GapErrorState
- Replace `<StateSurface>` with flat section
- No other changes

### GapInsufficientWardrobeState
- Replace `<StateSurface>` with flat section
- No other changes

### GapNoGapsState
- Replace `<StateSurface>` with flat section
- No other changes

---

## Fix 2: Flatten GapHeroCard

**Replaces**: Card with `rounded-[1.25rem] border border-border/40 bg-card p-5` and radial gradient.

### Remove
- The card wrapper: `<motion.article className="relative overflow-hidden rounded-[1.25rem] border border-border/40 bg-card p-5">`
- The radial gradient `<div aria-hidden>` overlay
- The inner `<div className="relative">` wrapper (no longer needed without the gradient)

### Replace with
- `<motion.article>` with no card classes — just the animation props + `className="mt-2"`
- All inner content stays identical: hero-eyebrow, item name in Playfair italic, meta chips, pairing thumbnails, +N outfit count, insight text, action row

### Keep exactly
- Hero eyebrow: `text-[11px] font-medium uppercase tracking-[0.18em] text-accent/70`
- Item name: `font-display italic text-[1.4rem] leading-tight tracking-[-0.02em]`
- Meta chips: category + color with dot
- Pairing garments: thumbnails + sparkle placeholder
- `+{new_outfits}` in `font-display italic text-[1.8rem] text-accent`
- Key insight in `font-display italic text-[13px] text-foreground/55`
- Price chip + "Find this" button with Search + ExternalLink icons

---

## Fix 3: Replace Horizontal Scroll with Vertical List (GapResultsPanel.tsx)

**Replaces**: The `-mx-5 overflow-x-auto` horizontal scroll container with `flex snap-x snap-mandatory gap-3 px-5`.

### Remove
- The horizontal scroll wrapper: `<div className="-mx-5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">`
- The inner flex container: `<div className="flex snap-x snap-mandatory gap-3 px-5">`

### Replace with
- Simple `<div>` wrapper (no special classes) containing the secondary gap items
- Each `GapSecondaryCard` now renders as a vertical list item (see Fix 4)

### Error banner
- Change from: `rounded-[1.2rem] border border-destructive/20 bg-destructive/5 px-4 py-3`
- Change to: `border-l-2 border-destructive/40 pl-3 py-2` (left-border accent, matching Travel Edit pattern)

---

## Fix 4: Rewrite GapSecondaryCard as Vertical List Item

**Replaces**: 280px fixed-width horizontal scroll card with `rounded-[1.25rem] border border-border/40 bg-card p-4`.

### New layout
- Container: `border-t border-border/20 pt-4 mt-4` divider (no card, no fixed width)
- Top row: item name (left, `text-[0.92rem] font-medium`) + outfit count (right, `font-display italic text-[1.1rem] text-accent` with "outfits" label below)
- Reason: `text-[0.78rem] text-foreground/60 line-clamp-2 mt-1`
- Meta row: category chip + color dot/name + price range — `flex items-center gap-2 mt-2 text-[0.72rem]`
- Actions row: "Why this?" expandable toggle (left) + "Find this" outline button (right) — `flex items-center justify-between mt-2.5`

### Keep
- "Why this?" expand/collapse with `AnimatePresence` + `motion.p` — same pattern
- `hapticLight()` on expand toggle
- `openGoogle(gap.search_query)` on find button
- Stagger animation per item — but cap at `Math.min(index, 8) * 0.04`

### Remove
- `w-[280px] shrink-0 snap-start` fixed-width scroll card styling
- `flex-col gap-3` card layout
- `bg-card` background

### Props change
- Remove `index?: number` default — make it required: `index: number`
- Component still receives `gap: GapResult` and `index: number`

---

## Fix 5: Minor Spacing in GarmentGaps.tsx

- The `GapHero` component no longer has card padding, so the `motion.div` wrapper around it may need `mb-0` instead of relying on the card's internal padding
- Check that the `AnimatePresence` states flow cleanly into the flat layout

---

## Design Tokens Used

All from existing BURS design system — no new tokens:

| Token | Usage |
|-------|-------|
| `font-display italic` | Item names, titles (Playfair Display) |
| `label-editorial` / eyebrow pattern | Section labels |
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary text |
| `border-border/40` | Section dividers |
| `border-border/20` | Lighter dividers between secondary items |
| `bg-secondary/65` | StateIcon background |
| `text-accent` | Gold outfit count, hero eyebrow |
| `EASE_CURVE` | All Framer Motion transitions |
| `hapticLight()` | Expand toggle interaction |

## Testing

- Existing `GarmentGaps.test.tsx` — should still pass (component API unchanged)
- Existing `gapRouteState.test.ts` — should still pass (no route logic changes)
- Manual verification: all 8 view states render correctly (locked, ready, autorun, loading, error, results, no-gaps, insufficient)
- Manual verification: hero gap displays with pairing thumbnails
- Manual verification: secondary gaps expand "Why this?" insight
- Manual verification: "Find this" opens Google search
- Visual check: light + dark mode

## Out of Scope

- No edge function changes
- No DB migrations
- No new i18n keys (feature already fully internationalized)
- No changes to gapTypes, gapRouteState, or useAdvancedFeatures
- No new npm packages
