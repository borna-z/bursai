# M4 — Duplicate detection

| Field | Value |
|---|---|
| Goal | Wire `detect_duplicate_garment` so Step 3 of AddPiece warns when the new garment is likely already in the wardrobe. |
| Status | DONE (PR #731) |
| Branch | `mobile-m4-duplicate-detection` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | M |

## Background

Edge function `detect_duplicate_garment` is deployed and gated. Web wires it from `BatchCaptureStep` post-analyze. Mobile's AddPiece flow currently saves any garment without a duplicate check.

## Files touched

### New
- `mobile/src/hooks/useDetectDuplicate.ts` — POST to `/functions/v1/detect_duplicate_garment` with `{ garment_id_or_pending: ..., ai_raw }`. Returns `{ matches: Array<{ garment_id; score; reason }> }`.

### Modified
- `mobile/src/screens/AddPieceStep3.tsx` — call after analyze settles; if `matches[0].score >= threshold`, show a `Modal` ("Looks like you already have this — Add anyway / View existing"). On "View existing", navigate to GarmentDetail. On "Add anyway", continue save flow.
- `mobile/src/lib/i18n.ts` — append `addpiece.duplicate.*` keys (en + sv if M33 has shipped; otherwise en-only with TODO note).

## Pattern reference

Standard fetch hook. Threshold: lift the value web uses (typically `score >= 0.85`).

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: add a garment that's clearly a duplicate of an existing one — confirm modal appears with both options
- Code-reviewer: approved

## Deploy

None — `detect_duplicate_garment` already deployed.

## PR template

Title: `feat(mobile): M4 — duplicate-detection modal in AddPieceStep3`
