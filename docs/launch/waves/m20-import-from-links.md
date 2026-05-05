# M20 — Import garments from links → AddPiece

| Field | Value |
|---|---|
| Goal | Paste a product URL → import_garments_from_links scrapes the page → user confirms → garment lands in wardrobe with pre-filled fields. |
| Status | TODO |
| Branch | `mobile-m20-import-from-links` |
| PR count | 1 |
| Depends on | V0, M9 |
| Complexity | M |

## Background

Edge function `import_garments_from_links` already deployed. Web `LinkImportForm.tsx` is the reference. Mobile entry: AddPieceStep1 gets a fourth option ("Import from link") OR (cleaner) a separate "Paste link" button.

## Files touched

### New
- `mobile/src/hooks/useImportFromLinks.ts` — POST `{ urls: string[] }` → returns parsed garment proposals.
- `mobile/src/screens/ImportFromLinkScreen.tsx` — paste-URL field, multi-URL textarea optional, list of parsed proposals with edit + confirm per row.

### Modified
- `mobile/src/screens/AddPieceStep1.tsx` — "Import from link" entry.
- `mobile/src/navigation/RootNavigator.tsx` — register ImportFromLink route.
- iOS Share extension consideration: deferred — track in findings-log.md as "post-launch: native share-sheet integration."

## Pattern reference

Web `LinkImportForm.tsx` UI patterns. Mobile uses a `TextInput` with paste detection.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: paste 2 known product URLs (e.g. arket.com, weekday.com) → confirm both parse with title/category/colors prefilled; save 1 → confirm in wardrobe
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M20 — import garments from links`
