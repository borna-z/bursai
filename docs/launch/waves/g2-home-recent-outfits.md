# G2 — Home: Recent Outfits real flatlay thumbnails

| Field | Value |
|---|---|
| Goal | `RecentOutfitTile` on HomeScreen renders real garment thumbnails per outfit (2×2 grid) instead of a flat colored gradient. |
| Status | TODO |
| Branch | `fix/mobile-g2-home-recent-outfits` |
| PR count | 1 |
| Depends on | G6 (uses upgraded `OutfitCard` with `garments` prop) |
| Complexity | S |
| Spec | [`docs/launch/g-campaign.md`](../g-campaign.md) |

## Background

`mobile/src/screens/HomeScreen.tsx:767–824` defines `RecentOutfitTile`. Lines 789–796 render only a `LinearGradient` filled with `outfitGradientHue()`. Web's equivalent (`src/components/home/TodayOutfitHero.tsx:97–131` → `OutfitComposition`) renders real garment thumbs in a 2×2 grid via `getPreferredGarmentImagePath()` + `LazyImageSimple`.

A working pattern already exists in the same file at lines 688–727 (`OutfitThumb`). G2 adopts G6's upgraded `OutfitCard` so we don't duplicate the thumbnail-grid logic.

## Files touched

### Modified
- `mobile/src/screens/HomeScreen.tsx` — `RecentOutfitTile`: replace the bare gradient (lines 789–796) with `<OutfitCard garments={outfit.outfit_items.slice(0, 4).map(it => ({ id: it.garment.id, rendered_image_path: it.garment.rendered_image_path, original_image_path: it.garment.original_image_path }))} />`. Keep metadata row (occasion / vibe / title) below the card.

### Verified (no edit)
- `mobile/src/hooks/useOutfits.ts` — confirm the query already populates `outfit.outfit_items[].garment.{rendered_image_path, original_image_path}`. If it doesn't, extend the `.select()` to include those columns. This is the only data-layer touch allowed; no schema changes.

## Pattern reference

- Existing `OutfitThumb` at HomeScreen lines 688–727 — same pattern, kept for the today-hero slot.
- Post-G6 `OutfitCard` accepts `garments` and handles 2×2 grid + shimmer + gradient fallback.
- Web reference: `src/components/outfits/OutfitComposition.tsx` (2×2 grid, garment images).

## Acceptance gates

- `cd mobile && npx tsc --noEmit` → 0 errors
- `cd mobile && npx eslint "src/**/*.{ts,tsx}" --max-warnings 0` → clean
- `cd mobile && npx expo-doctor` → passes
- Bundle delta ≤ +2 KB
- Visual sweep: open HomeScreen with at least 3 saved outfits → recent-outfit tiles show garment images, not solid gradients.
- If a recent outfit has no resolved garment images, the tile falls back to the gradient (no broken-image icon, no blank tile).
- Code-reviewer subagent: approved.
- Codex review: 👍 or "no bugs found" + 5-min quiet window.
- Mandatory 2nd self-review pass: clean.

## Deploy

None.

## PR template

Title: `fix(mobile): G2 — Home recent outfits show real garment thumbnails`

Body:
- `RecentOutfitTile` consumes G6's upgraded `OutfitCard` with `garments` prop.
- 2×2 thumb grid + shimmer + gradient fallback.
- Verified `useOutfits` query shape includes `outfit_items[].garment.{rendered_image_path,original_image_path}`.
- Plan: `docs/launch/waves/g2-home-recent-outfits.md`
