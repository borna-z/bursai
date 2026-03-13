

# Redesign Discover Page — Clean & Enhanced

## Current State
The Discover page has three sections with redundant uppercase section headers ("CHALLENGES", "WARDROBE GAP ANALYSIS", "STYLE TOOLS"). The WardrobeGapSection already exists and works well. DiscoverStyleTools only has one card (Mood Outfit) making it feel sparse.

## Design Changes

### 1. `src/pages/Discover.tsx` — Streamlined layout
- Remove the separate `DiscoverStyleTools` import/render entirely
- Merge the Mood Outfit tool into a single row below the gap section as a simple inline card
- Increase breathing space: `space-y-12` instead of `space-y-10`
- Keep header but refine subtitle

### 2. `src/components/discover/WardrobeGapSection.tsx` — Remove section heading
- Delete the `<h3>` with `discover.gap_heading` text
- Keep only the reset button (float it right when results are showing)
- The CTA card itself already has a title ("Find what's missing") so the heading is redundant

### 3. `src/components/discover/DiscoverChallenges.tsx` — Remove section heading
- Remove the `<h3>` challenges heading and "See all" link (it just links to `/discover` which is the same page)
- Let the challenge cards speak for themselves — cleaner, more editorial

### 4. `src/components/discover/DiscoverStyleTools.tsx` — Inline into Discover page
- Instead of a separate section with a heading, render the single Mood Outfit tool as a full-width card directly in `Discover.tsx`
- Delete the `DiscoverStyleTools` component (or simplify it to not render a heading)
- Style it as a prominent card with a subtle gradient, matching the Apple Minimalism brand — no section header needed

### 5. Overall visual refinements
- Replace `space-y-10` with `space-y-8` for tighter grouping
- Add a subtle divider or extra spacing between sections instead of uppercase labels
- Keep the page header (title + subtitle) as the only labeled element

### Files to edit
- `src/pages/Discover.tsx` — remove DiscoverStyleTools, inline Mood Outfit card
- `src/components/discover/WardrobeGapSection.tsx` — remove heading h3
- `src/components/discover/DiscoverChallenges.tsx` — remove heading + "see all" link
- `src/components/discover/DiscoverStyleTools.tsx` — simplify to headingless single card or delete

