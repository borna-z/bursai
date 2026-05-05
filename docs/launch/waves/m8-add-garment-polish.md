# M8 — Add-garment UX polish

| Field | Value |
|---|---|
| Goal | Final polish on the AddPiece flow: photo replacement, inline title/category edit, error recovery, retry buttons. |
| Status | TODO |
| Branch | `mobile-m8-add-garment-polish` |
| PR count | 1 |
| Depends on | V0, M1–M7 |
| Complexity | M |

## Background

Closes the add-garment depth chain. Items here come from M10 (existing UX polish), Codex round findings on PR 1, and the parity inventory's Step 3 / GarmentDetail polish gaps.

## Files touched

### New
- `mobile/src/hooks/useReplaceGarmentImage.ts` — re-uploads `image_path` for an existing garment, clears AI fields, kicks enrichment + render again. Mirrors the swap branch in `SecondaryImageManager.tsx` (web).

### Modified
- `mobile/src/screens/AddPieceStep3.tsx` — replace-photo button (camera + gallery picker), inline title + category edit (already partly there), retry pill on enrichment / render failure.
- `mobile/src/screens/GarmentDetailScreen.tsx` — same replace + inline edit for already-saved garments.
- `mobile/src/components/ErrorState.tsx` — reusable error pill with retry handler.

## Pattern reference

`useReplaceGarmentImage` mirrors web's swap-image flow but skips the "secondary as primary" logic (mobile gets that in a follow-up if needed).

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: replace a garment photo from GarmentDetail; force a network failure during enrichment, confirm retry pill works
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M8 — AddPiece UX polish`
