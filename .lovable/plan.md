

# Remove OutfitsPreview from Home Page

The `OutfitsPreview` component (showing a 2×2 grid of recent outfits under "Suggestions") will be removed from the Home page.

## Changes

### `src/pages/Home.tsx`
- Remove the lazy import of `OutfitsPreview`
- Remove `<OutfitsPreview />` from the Suspense block

No other files need editing. The component file itself can stay — it's harmless and may be useful elsewhere later.

