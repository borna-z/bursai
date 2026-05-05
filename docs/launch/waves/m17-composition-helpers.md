# M17 — Compositional helpers (flatlay + accessories + combinations + clone DNA)

| Field | Value |
|---|---|
| Goal | Wire the four outfit-composition helpers into OutfitDetail and StyleMe so users can extend an existing outfit instead of generating from scratch. |
| Status | TODO |
| Branch | `mobile-m17-composition-helpers` |
| PR count | 1 |
| Depends on | V0, M13 |
| Complexity | L |

## Background

Edge functions: `generate_flatlay`, `suggest_accessories`, `suggest_outfit_combinations`, `clone_outfit_dna`. All deployed; none wired in mobile. They share a "given an outfit, return variations / additions / a flatlay image" shape.

## Files touched

### New
- `mobile/src/hooks/useGenerateFlatlay.ts` — POST outfit → returns rendered flatlay image URL. Show in ShareOutfit / OutfitDetail.
- `mobile/src/hooks/useSuggestAccessories.ts` — POST outfit → returns 3–5 accessory garment IDs from the user's wardrobe.
- `mobile/src/hooks/useSuggestCombinations.ts` — POST outfit → returns 3 alternative outfit completions.
- `mobile/src/hooks/useCloneOutfitDNA.ts` — POST outfit → returns a fresh outfit that mirrors the source's style profile.

### Modified
- `mobile/src/screens/OutfitDetailScreen.tsx` — "Suggest accessories", "Try variations", "Clone DNA" actions in the action row.
- `mobile/src/screens/ShareOutfitScreen.tsx` — "Generate flatlay" button → swap displayed image to the rendered flatlay.

## Pattern reference

Each hook is a thin `callEdgeFunction(...)` wrapper. UI uses the existing `OutfitCard` for variation results.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: open an outfit → "Suggest accessories" → confirm 3–5 garments appear and tap-to-add works; "Generate flatlay" → confirm flatlay image renders within ~15s
- Code-reviewer: approved

## Deploy

None — all four edge functions already deployed.

## PR template

Title: `feat(mobile): M17 — composition helpers (flatlay + accessories + combinations + clone DNA)`
