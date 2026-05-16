# EditGarmentScreen — picker visibility

**Related PR:** #860 (EditGarmentScreen refactor onto `AddPieceStep3Form`)

## Decision needed

Should `EditGarmentScreen` keep showing the two pickers (`color_secondary`, `formality`) that the legacy edit screen hid?

## Context

PR #860 refactored `EditGarmentScreen` to reuse `AddPieceStep3Form` from Phase 6. The shared form surfaces all 11 metadata pickers. Two of them — `color_secondary` and `formality` — are authored at upload via AddPiece and write to existing nullable DB columns. The legacy edit screen had hidden them. Reusing the form makes them visible in edit too.

The columns already exist and accept null. AddPiece already writes to them. The legacy hide was an artifact of the legacy edit screen, not a deliberate product constraint.

## Options

| Option | What changes | Tradeoff |
|---|---|---|
| **A — Accept (current state)** | Both pickers stay visible in edit. | UX consistency between AddPiece and EditGarment; users can correct values that were auto-detected wrong at upload. Risk: minor UX widening on the edit flow that wasn't reviewed up front. |
| **B — Hide via prop** | Add `hidePickers?: Array<keyof FormState>` prop to `AddPieceStep3Form`; `EditGarmentScreen` passes `['color_secondary', 'formality']`. | Preserves legacy edit UX exactly; small form-API surface increase. |
| **C — Selective reuse** | `EditGarmentScreen` consumes the form sub-components directly instead of the full form. | Highest control, lowest reuse — likely undoes much of PR #860's gain. Not recommended. |

## Recommendation

Option A — accept current state. Rationale: the data path was already in place; the legacy hiding was incidental, not deliberate; users benefit from being able to correct auto-detected values. If a follow-up reveals a real UX issue, Option B is a cheap 5-line change.
