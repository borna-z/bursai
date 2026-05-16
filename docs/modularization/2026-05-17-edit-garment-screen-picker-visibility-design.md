# EditGarmentScreen — picker visibility

**Related PR:** #860 (EditGarmentScreen refactor onto `AddPieceStep3Form`)
**Suggested branch:** none — this is a decision record, not an implementation spec.

## Problem

PR #860 refactored `mobile/src/screens/EditGarmentScreen.tsx` to reuse `AddPieceStep3Form` from Phase 6 instead of rendering its own field set. The shared form surfaces all 11 metadata pickers. Two of them — `color_secondary` and `formality` — are authored at upload via AddPiece and write to existing nullable DB columns. The legacy edit screen (pre-#860) hid both. Reusing the form makes them visible in edit too. We need to decide whether to keep them visible or restore the legacy hide.

## Goal

Pick one option (A / B / C below), document the rationale, leave a paper trail so the next reviewer of the EditGarmentScreen UX understands why the pickers appear (or don't).

## Approach

Compare three options on the same axes — UX consistency, reuse cost, form-API surface — and recommend one.

## Scope

### In

- Decision on visibility of `color_secondary` and `formality` pickers inside `EditGarmentScreen`.
- Rationale captured in this file.

### Out

- Any change to the AddPiece flow (those pickers stay visible there regardless).
- DB schema changes (both columns already exist and accept null).
- Other metadata pickers — they were already visible in the legacy edit screen and remain visible after #860.

## Options

| Option | What changes | Tradeoff |
|---|---|---|
| **A — Accept (current state)** | Both pickers stay visible in edit. | UX consistency between AddPiece and EditGarment; users can correct values that were auto-detected wrong at upload. Risk: minor UX widening on the edit flow that wasn't reviewed up front. |
| **B — Hide via prop** | Add `hidePickers?: Array<keyof FormState>` prop to `AddPieceStep3Form`; `EditGarmentScreen` passes `['color_secondary', 'formality']`. | Preserves legacy edit UX exactly; small form-API surface increase. |
| **C — Selective reuse** | `EditGarmentScreen` consumes the form sub-components directly instead of the full form. | Highest control, lowest reuse — likely undoes much of PR #860's gain. Not recommended. |

## Recommendation

**Option A — accept current state.** Rationale: the data path was already in place (AddPiece already writes both columns; both columns already accept null); the legacy hiding was incidental, not a deliberate product constraint; users benefit from being able to correct auto-detected values. If a follow-up reveals a real UX issue, Option B is a cheap five-line change.

## Files touched

| Path | Change |
|---|---|
| *(none)* | This is a decision record. No code change ships with this document. |

If the decision is revisited and Option B is chosen later, the implementation would touch:

| Path | Change |
|---|---|
| `mobile/src/screens/AddPieceStep3/AddPieceStep3Form.tsx` | Accept `hidePickers?: Array<keyof FormState>`; gate the two pickers on it. |
| `mobile/src/screens/EditGarmentScreen.tsx` | Pass `hidePickers={['color_secondary', 'formality']}`. |

## Acceptance criteria

- Decision is recorded in this file and linked from PR #860's follow-up notes.
- If Option A: no further action.
- If Option B or C: a separate PR opens with the file changes above and references this document.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Users edit `color_secondary` or `formality` in error and lose AddPiece's auto-detected value | Both columns are nullable; the legacy "save unchanged" path is preserved by PR #860's category-casing fix. A misedit is recoverable by re-running detection. |
| The "incidental hide" claim is wrong — the legacy edit screen hid them deliberately | Git history on `mobile/src/screens/EditGarmentScreen.tsx` shows no commit comment or PR description justifying the hide. Treated as incidental until evidence surfaces. |
| Adding the pickers widens the edit-screen scroll length on small devices | The form already renders nine other pickers; adding two does not meaningfully change the scroll behavior. |

## Verification

```bash
# Confirm both DB columns exist and accept null
grep -n "color_secondary\|formality" src/integrations/supabase/types.ts

# Confirm AddPieceStep3Form surfaces both pickers
grep -n "colorSecondary\|formality" mobile/src/screens/AddPieceStep3/AddPieceStep3Form.tsx

# Confirm the legacy EditGarmentScreen hid them (pre-#860)
git log --all --oneline -- mobile/src/screens/EditGarmentScreen.tsx
# Then inspect the commit immediately before 44ddca22 (#860 merge):
git show <pre-merge-sha>:mobile/src/screens/EditGarmentScreen.tsx | grep -n "color_secondary\|colorSecondary\|formality"
```

## When picking this up cold

1. Read PR #860's description and the merge commit `44ddca22`.
2. Open `mobile/src/screens/EditGarmentScreen.tsx` on `main` and confirm it now renders `AddPieceStep3Form` directly.
3. Open `mobile/src/screens/AddPieceStep3/AddPieceStep3Form.tsx` and locate the two pickers (search for `addpiece.step3.field.colorSecondary` and `addpiece.step3.field.formality`).
4. If the user has reported a real UX issue with either picker showing in edit, implement Option B; otherwise this record stands as-is.
