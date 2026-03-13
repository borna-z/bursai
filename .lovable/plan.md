

# Redesign AI Suggestions Block — Premium Hero Layout

## Current State
The AISuggestions card feels cramped: small 5-column garment grid, tight spacing, a collapsible explanation buried at the bottom, and navigation arrows competing with the refresh button in the header.

## New Design

### Layout — Full-width hero card with generous breathing space
- Remove the `Card` wrapper; use a borderless, full-bleed section with more vertical padding
- **Hero garment display**: Show the first 3 garments as large overlapping circles (like avatar stacks) instead of a cramped 5-col grid, with remaining items as a `+N` badge
- **Title**: Larger (18px), with the occasion as a subtle uppercase label above it
- **Explanation**: Always visible as a single-line italic subtitle below the title (no collapsible)
- **CTA row**: Two buttons side by side — primary "Wear this" and ghost "Plan" with calendar icon
- **Navigation**: Dot indicators at the bottom instead of arrow buttons in the header
- **Refresh**: Subtle icon button in the top-right corner only

### Visual Treatment
- Subtle gradient background tint using `bg-gradient-to-br from-primary/[0.04] to-transparent`
- Rounded-2xl with no border (or very faint `border-border/10`)
- `py-7 px-6` for generous internal spacing
- Staggered entrance animation on garment images

### Structure
```text
┌─────────────────────────────────┐
│  ✦ Today's Look          ↻     │  ← uppercase label + refresh
│                                 │
│     [occasion badge]            │
│   Title of the Outfit           │  ← 18px semibold
│   "Because these colors..."     │  ← 13px muted explanation
│                                 │
│   ◯  ◯  ◯  ◯  +2              │  ← large garment circles
│                                 │
│  [ Wear this →]  [ 📅 Plan ]   │  ← two buttons
│                                 │
│         • ○ ○                   │  ← dot navigation
└─────────────────────────────────┘
```

### Loading State
- Keep the animated loading indicator but add more top/bottom padding

### Premium Gate
- Same blurred overlay approach but with matching new layout proportions

## Files to Edit
- **`src/components/insights/AISuggestions.tsx`** — full redesign of `HeroSlide`, header, navigation, and premium gate

