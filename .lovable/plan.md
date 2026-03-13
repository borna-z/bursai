

# Animated Wardrobe Gap Analysis Loading State

## What
Replace the plain skeleton loading with an animated "AI scanning" experience — a radar/pulse animation with a wardrobe icon, animated progress phases, and staggered text updates showing what the AI is doing.

## Design
- **Central animated icon**: A pulsing radar ring effect around the `Sparkles` icon (concentric rings expanding outward)
- **Phase text rotation**: Cycle through descriptive messages like "Scanning wardrobe…", "Finding gaps…", "Building suggestions…" with a crossfade
- **Skeleton cards**: 3 placeholder cards that shimmer in with staggered delays, each with a subtle scale-in animation
- **Progress dots**: Animated bouncing dots indicator below the phase text

## Changes

### `src/components/discover/WardrobeGapSection.tsx` (lines 96–114)
Replace the loading block with:
- A centered container with the `Sparkles` icon surrounded by 2–3 concentric `motion.div` rings that scale up and fade out on loop (radar pulse)
- A `AnimatePresence` text block that cycles through 3 phase strings every ~2.5s using `useState` + `useEffect` interval
- 3 skeleton cards with staggered `motion.div` wrappers (scale-in + fade)

### `src/i18n/translations.ts`
Add phase strings:
- `discover.gap_phase_1`: "Scanning your wardrobe…" / "Skannar din garderob…"
- `discover.gap_phase_2`: "Identifying style gaps…" / "Identifierar stilluckor…"
- `discover.gap_phase_3`: "Building suggestions…" / "Bygger förslag…"

