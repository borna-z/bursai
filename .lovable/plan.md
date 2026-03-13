

# Shorten "Why this works" section on Outfit Detail

The AI explanation text is displayed in full, making the section too long. Fix: truncate to 2 lines with a "Read more" toggle.

## Change: `src/pages/OutfitDetail.tsx` (lines 354-363)

Replace the plain `<p>` with a clamped block that shows max 2 lines by default, with a small "Read more / Less" toggle button:

- Add `useState` for `expanded` (default `false`)
- Apply `line-clamp-2` on the paragraph when collapsed
- Show a subtle text button below to toggle expand/collapse
- When expanded, remove the clamp

Single file change, ~15 lines of code.

