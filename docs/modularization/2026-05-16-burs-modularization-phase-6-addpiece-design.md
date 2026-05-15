# Phase 6 — AddPiece splits

**Roadmap:** [Modularization roadmap](./2026-05-16-burs-modularization-roadmap.md)
**Previous phase:** [Phase 5 — Edge function extractions](./2026-05-16-burs-modularization-phase-5-edge-functions-design.md)
**Next phase:** *(end of roadmap)*
**Suggested branch:** `refactor/addpiece-splits`

## Problem

`mobile/src/screens/AddPieceStep3.tsx` (1297 lines) is the heaviest mobile screen. It owns:

- Photo review UI
- Title input
- 11 metadata pickers (category, color, material, fit, pattern, formality, seasons, etc.) — 11 `useState` calls
- Duplicate detection
- Save flow with 3 `useRef` guards
- Two `useEffect` cleanup branches
- Batch handling (single-piece and batch-mode share this screen)
- Modal sheet for save-choice (save / save & add another / discard)

`EditGarmentScreen.tsx` (713 lines) likely follows the same picker pattern and may benefit from the same split. Inspect before deciding.

Wave R is now complete and merged (per 2026-05-16 user direction), so this phase is unblocked.

## Goal

Split `AddPieceStep3` into a thin orchestrator + a form sub-component + a save-flow sub-component. Lift the picker form into a reusable shape that `EditGarmentScreen` can consume.

## Approach

The 11 metadata pickers are a logical unit. The save-flow (cleanup refs, batch handling, save-choice sheet) is another. Extract both. The orchestrator stays for navigation, photo review, and composition.

## Scope

### `AddPieceStep3`

- `AddPieceStep3.tsx` — orchestrator: photo review + title + composition of form & save-flow. Target < 600 lines.
- `AddPieceStep3/AddPieceStep3Form.tsx` *(new)* — owns picker state and validators. Inputs: initial values + onChange callback. Outputs: validated metadata via the callback. Reusable across AddPiece and Edit flows.
- `AddPieceStep3/AddPieceStep3SaveFlow.tsx` *(new)* — owns save mutation, cleanup refs, batch handling, save-choice sheet. Inputs: validated metadata. Outputs: save events (success/failure/navigate-back).
- `AddPieceStep3/garmentMetadataForm.types.ts` *(new)* — shared input/output type for the form so consumers cannot drift.

### `EditGarmentScreen` (optional within this phase)

Open the file. If it duplicates the picker pattern, refactor it to consume `AddPieceStep3Form` directly. If its shape diverges materially, leave it for a follow-up and document the gap in the PR.

### Out of scope

- Changing the metadata schema (categories, materials, fits, patterns, etc.).
- Changing the batch pipeline (that is Phase 4).
- Replacing the duplicate detection algorithm.
- Visual redesign of the form.

## Files touched

| Path | Change |
|---|---|
| `mobile/src/screens/AddPieceStep3.tsx` | Slim orchestrator. |
| `mobile/src/screens/AddPieceStep3/AddPieceStep3Form.tsx` *(new)* | Picker form + validators. |
| `mobile/src/screens/AddPieceStep3/AddPieceStep3SaveFlow.tsx` *(new)* | Save mutation + cleanup + sheet. |
| `mobile/src/screens/AddPieceStep3/garmentMetadataForm.types.ts` *(new)* | Shared form types. |
| `mobile/src/screens/EditGarmentScreen.tsx` *(maybe)* | Refactor to use `AddPieceStep3Form` if shapes align. |
| `mobile/src/screens/__tests__/AddPieceStep3.test.tsx` | Update; add tests for form validation and save flow. |
| `mobile/src/screens/__tests__/AddPieceStep3Form.test.tsx` *(new)* | Smoke render + validation cases. |

## Acceptance criteria

- `AddPieceStep3.tsx` < 600 lines.
- `AddPieceStep3Form` renders independently in a test with sensible default props and emits valid metadata on change.
- `AddPieceStep3SaveFlow` cleanup refs are unit-testable (or at least integration-tested via React Testing Library).
- Manual:
  - Single-piece flow: add photo → fill form → save → garment appears.
  - Batch flow: add multiple photos → progress through each → all save.
  - Cancel mid-flow: no stale state, no orphaned timers.
  - Duplicate detection: add a near-duplicate photo → warning shown.
- Lint clean, all existing tests pass.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Cleanup refs subtly relied on rendering order; extraction breaks them | Add a test that mounts the screen, triggers a save, and unmounts during the save — assert no warning, no orphaned timer. |
| 11 `useState` calls become a prop-drilling mess | Use a single reducer (`useReducer`) inside the form for picker state; expose one onChange callback. |
| Duplicate detection logic accidentally bypassed | Keep the existing `useDetectDuplicate` hook call at the orchestrator level (it is the source of truth for the duplicate-warning UI). The form does not call it. |
| EditGarmentScreen has subtle differences that block direct reuse | If divergence is > 20% of the form, leave EditGarmentScreen for a follow-up PR; do not force a fragile merge. |

## Verification before completion

```bash
npm test --prefix mobile
npx eslint "mobile/src/**/*.{ts,tsx}" --max-warnings 0
# Manual on device: single + batch AddPiece flows, including mid-flow cancel.
```

## When picking this up cold

1. Read `mobile/src/screens/AddPieceStep3.tsx` end-to-end. This is the most complex screen in the codebase.
2. Read `mobile/src/screens/EditGarmentScreen.tsx` end-to-end and decide whether to include it in this phase.
3. Read `mobile/src/hooks/useAddGarment.ts`, `useDetectDuplicate.ts`, `batchPipeline.ts` so you understand the dependencies before splitting.
4. Sketch the form props/types before touching code; the reducer shape determines everything else.
5. Confirm Phase 4 is merged (`batchPipeline` split) before starting — otherwise you will be untangling two refactors at once.
