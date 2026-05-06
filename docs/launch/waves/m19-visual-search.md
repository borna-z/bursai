# M19 — Visual Search → AddPiece

| Field | Value |
|---|---|
| Goal | Add a third entry mode to AddPiece — Camera / Library / Visual Search — that uses `visual_search` to find similar wardrobe items + similar online products. |
| Status | TODO |
| Branch | `mobile-m19-visual-search` |
| PR count | 1 |
| Depends on | V0, M9 |
| Complexity | M |

## Background

Discover tab is cut. Visual Search routes to AddPiece flow as a third entry option. User uploads a reference photo, edge function returns embeddings + nearest matches in the wardrobe + nearest online products. Tap a wardrobe match → GarmentDetail. Tap an online match → import flow (M20).

## Files touched

### New
- `mobile/src/hooks/useVisualSearch.ts` — POST reference image → returns `{ wardrobe_matches, web_matches }`.
- `mobile/src/screens/VisualSearchScreen.tsx` — capture/upload UI, two result rows (Your wardrobe / Found online).

### Modified
- `mobile/src/screens/AddPieceStep1.tsx` — add "Search by photo" entry alongside Camera + Library.
- `mobile/src/navigation/RootNavigator.tsx` — register VisualSearch route.

## Pattern reference

Standard upload-then-edge-function pattern. M2 signed-URL cache helps with the result thumbnails.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: tap "Search by photo" → upload an existing wardrobe item photo → confirm exact match in "Your wardrobe" row
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M19 — Visual Search in AddPiece`
