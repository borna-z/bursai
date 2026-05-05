# M7 — Batch add flow

| Field | Value |
|---|---|
| Goal | Multi-photo capture → multi-garment save in a single AddPiece session. |
| Status | TODO |
| Branch | `mobile-m7-batch-add` |
| PR count | 1 |
| Depends on | V0, M4 (duplicate-detection per item), M5 (offline queue per item) |
| Complexity | L |

## Background

Web `BatchCaptureStep.tsx` lets a user photograph 5–20 garments in a row, runs analyze on each, surfaces duplicates inline, and saves the batch atomically (per-row failure isolated). Mobile currently has no batch path.

## Files touched

### New
- `mobile/src/screens/BatchAddScreen.tsx` — enter from AddPiece "Batch" button. Photo grid with per-tile state: `pending → analyzing → ready → duplicate? → saving → done | failed`.
- `mobile/src/hooks/useBatchSaveGarments.ts` — orchestrates the per-item analyze + duplicate-check + save chain. Per-item failure does not block others.
- `mobile/src/components/BatchTile.tsx` — single grid cell rendering its current state.

### Modified
- `mobile/src/screens/AddPieceStep1.tsx` — surface "Batch" entry alongside existing single-garment entry.

## Pattern reference

Web `BatchCaptureStep.tsx` is the source for state machine semantics; UI is reimplemented native. Reuse:
- `useAnalyzeGarment` per tile
- `useDetectDuplicate` from M4 per tile
- `useAddGarment` per tile, but tagged with `batchId` so the offline queue from M5 can replay them as a group

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: batch of 8 photos including 1 duplicate; confirm 7 save, 1 prompts user, all reflect correctly post-save
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M7 — batch add flow`
