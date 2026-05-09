# G6 — Cross-cutting card primitive (real garment thumbs + loading shimmer)

| Field | Value |
|---|---|
| Goal | `OutfitCard` accepts garment data and renders real thumbnails (2×2 grid). `GarmentCard` exposes a loading-shimmer state distinct from the gradient fallback. Closes the recurring "colored cards" complaint. |
| Status | TODO |
| Branch | `fix/mobile-g6-card-primitive` |
| PR count | 1 |
| Depends on | nothing (runs first; G1/G2/G3 consume it) |
| Complexity | M |
| Spec | [`docs/launch/g-campaign.md`](../g-campaign.md) |

## Background

`mobile/src/components/OutfitCard.tsx:62–73` takes a `hues` prop and renders `LinearGradient` tiles — never the actual garment images. Every consumer (SmartDayBanner, MoodFlowScreen, RecentOutfitTile, StyleMe result, Travel must-haves, Travel per-day outfits) inherits this look-and-feel and the user sees colored squares instead of clothes.

`mobile/src/components/GarmentCard.tsx:84–124` correctly calls `useGarmentImage(imagePath)` and overlays the `<Image>` when the URI resolves, but the gradient placeholder doubles as both "loading" and "no image," masking which is which. Web (`src/components/garments/LazyImageSimple.tsx:99–126`) renders a shimmer skeleton during fetch and falls back only on error.

`mobile/src/hooks/useGarmentImage.ts` returns `{ uri, onError }` — no `isResolving` flag. We add one without changing the URL-resolution mechanics from M2.

## Files touched

### Modified
- `mobile/src/components/OutfitCard.tsx` — add optional `garments?: { id: string; rendered_image_path: string | null; original_image_path: string | null; hue?: number }[]` prop. When present, render a row of `<Image>` thumbnails using `useGarmentImage` per item (one tile per garment, mirrors today's `hues` length-based layout); show shimmer while resolving; fall back to a per-slot gradient if a slot's URL never resolves. When absent, render the legacy `hues` gradient row (no behavior change for current callers).

### New
- `mobile/src/components/Shimmer.tsx` — small reusable Animated.View overlay (~30 lines). Single responsibility: oscillating opacity over a `t.cardSubtle` background. Used only by the new OutfitCard thumb slots in this PR (other consumers can adopt later).

### Out of scope (deferred — keep PR tight)
- `GarmentCard` shimmer + `useGarmentImage` `isResolving` flag. The existing per-garment gradient + image overlay already works; shimmer is polish, not a bug fix. Park as a follow-up if Codex flags.

## Pattern reference

- Web shimmer: `src/components/garments/LazyImageSimple.tsx:99–126` (Tailwind `animate-pulse`).
- Web outfit composition: `src/components/outfits/OutfitComposition.tsx` — 2×2 grid pattern.
- Mobile signed-URL flow: `mobile/src/hooks/useSignedUrl.ts` (post-M2 — already throws on transport errors so retry logic in `useGarmentImage` works).

## Acceptance gates

- `cd mobile && npx tsc --noEmit` → 0 errors
- `cd mobile && npx eslint "src/**/*.{ts,tsx}" --max-warnings 0` → clean
- `cd mobile && npx expo-doctor` → passes
- `cd mobile && npx expo export -p ios -o /tmp/expo-export` → bundle delta ≤ +10 KB
- All existing call sites of `<OutfitCard hues={...} />` continue to compile and render the gradient (visual sweep on HomeScreen, MoodFlowScreen, SmartDayBanner).
- New code path: pass a stub `garments={[{id, rendered_image_path: 'x.png', ...}, ...]}` to `OutfitCard` and confirm 2×2 image grid renders.
- Code-reviewer subagent: approved (P0/P1 fixed).
- Codex review: 👍 or "no bugs found" + 5-min quiet window.
- Mandatory 2nd self-review pass: clean.

## Deploy

None — mobile-only.

## PR template

Title: `fix(mobile): G6 — cross-cutting card primitive (real garment thumbs + shimmer)`

Body:
- Adds optional `garments` prop to `OutfitCard`; renders real 2×2 thumb grid via `useGarmentImage`.
- `GarmentCard` exposes `isResolving` shimmer state.
- New `Shimmer` primitive (32 lines).
- Backwards compatible: existing `hues`-only callers unchanged.
- Closes recurring "colored cards instead of garment photos" complaints across Home, Style Me, Travel, Wardrobe Gaps.
- Plan: `docs/launch/waves/g6-card-primitive.md`
- Spec: `docs/launch/g-campaign.md`
