# Phase 4 — Types & batch pipeline

**Roadmap:** [Modularization roadmap](./2026-05-16-burs-modularization-roadmap.md)
**Previous phase:** [Phase 3 — Screen splits](./2026-05-16-burs-modularization-phase-3-screen-splits-design.md)
**Next phase:** [Phase 5 — Edge function extractions](./2026-05-16-burs-modularization-phase-5-edge-functions-design.md)
**Suggested branch:** `refactor/types-and-batch`

## Problem

Two cross-cutting modules carry both stable contracts and unstable internals in the same file, which makes schema bumps risky and tests heavyweight:

- `lib/styleProfileV4.ts` (761 lines) — types + defaults + validator + V4→V3 compat shim, all mixed.
- `lib/batchPipeline.ts` (549 lines) — state machine + concurrency pool + module-scope mutable registry + cleanup, all entangled. The module-scope map is a memory-leak risk when a batch is dropped uncleanly.

## Goal

`styleProfileV4` becomes a barrel re-export over four focused modules so schema evolution and compat removal can land in isolated PRs. `batchPipeline` splits into a pure state machine, a concurrency pool, and a lifecycle registry so the state machine is testable without side effects.

## Approach

### `styleProfileV4`

Split by responsibility, re-export from the existing path so consumers do not change:

- `lib/styleProfileV4/types.ts` — all `type`/`enum`/`union` definitions. Pure types, no runtime code.
- `lib/styleProfileV4/defaults.ts` — default values per field. Imported by quiz reset, profile init.
- `lib/styleProfileV4/validator.ts` — defensive parser; drops unknown fields; coerces types. Pure.
- `lib/styleProfileV4/compat.ts` — `migrateV4ToV3Compat`. Marked `@deprecated`; intended to be deleted in a future PR once V3-consuming code is gone.
- `lib/styleProfileV4.ts` — barrel re-export of the public surface.

### `batchPipeline`

Three sibling files plus an entry point:

- `lib/batchPipeline/BatchStateMachine.ts` — pure FIFO queue + state transitions (`pending → in-flight → ready/failed/saved/skipped`). No I/O. Returns transitions; the caller applies effects.
- `lib/batchPipeline/BatchConcurrencyPool.ts` — `MAX_PARALLEL = 2` execution layer that consumes the state machine's "next task" output. Performs resize + upload + analyze.
- `lib/batchPipeline/BatchLifecycle.ts` — owns the module-scope batch registry. Exposes `register(batchId)`, `unregister(batchId)`, `cleanup(batchId)`. Replaces the implicit mutable map with explicit lifecycle.
- `lib/batchPipeline.ts` — re-exports the public API consumers use today.

A batch is registered on creation, unregistered on completion or component unmount. `cleanup` is idempotent.

### Out of scope

- Changing the wire format of pipeline messages.
- Adding new states to the state machine.
- Removing `migrateV4ToV3Compat` (that is a future PR; this phase keeps it working).
- Changing `MAX_PARALLEL` or retry behavior.

## Files touched

| Path | Change |
|---|---|
| `mobile/src/lib/styleProfileV4.ts` | Becomes a barrel re-export. |
| `mobile/src/lib/styleProfileV4/types.ts` *(new)* | Type definitions. |
| `mobile/src/lib/styleProfileV4/defaults.ts` *(new)* | Defaults. |
| `mobile/src/lib/styleProfileV4/validator.ts` *(new)* | Parser/validator. |
| `mobile/src/lib/styleProfileV4/compat.ts` *(new)* | V4→V3 shim; `@deprecated`. |
| `mobile/src/lib/__tests__/styleProfileV4.test.ts` | Update; add per-module tests for validator + compat. |
| `mobile/src/lib/batchPipeline.ts` | Becomes a barrel re-export. |
| `mobile/src/lib/batchPipeline/BatchStateMachine.ts` *(new)* | Pure state machine. |
| `mobile/src/lib/batchPipeline/BatchConcurrencyPool.ts` *(new)* | Concurrency layer. |
| `mobile/src/lib/batchPipeline/BatchLifecycle.ts` *(new)* | Explicit registry. |
| `mobile/src/lib/__tests__/batchPipeline.test.ts` | Update; add state-machine-only test (no I/O), pool test with mocked I/O. |

## Acceptance criteria

- No public import path changes. `import { StyleProfileV4, defaultStyleProfileV4 } from '@/lib/styleProfileV4'` still resolves. Same for `batchPipeline` callers.
- `BatchStateMachine` has a unit test that runs without RN test setup (Node only).
- `validator` has tests for: valid input round-trips; unknown field is dropped silently; malformed enum becomes default.
- `compat` has a test that produces a valid V3 profile from a V4 sample.
- Manual: add 4 photos in batch mode → all save successfully → unmount and remount mid-batch → no orphaned timers; no warning about un-cleaned-up state.
- Lint clean, all existing tests pass.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Replacing single file with directory of same name causes import resolution issues | Verify resolution on Windows and macOS before merging. |
| Moving the module-scope map changes timing semantics | Add a test that creates a batch, awaits cleanup, then re-creates a batch with the same ID and confirms no leaked state. |
| `compat.ts` is marked deprecated but still imported by feature code | Grep all callers before merge; document each in the PR description so the future deletion PR has a clear scope. |

## Verification before completion

```bash
npm test --prefix mobile
npm run lint --prefix mobile
# Manual: batch capture flow + unmount mid-batch test.
```

## When picking this up cold

1. Read `mobile/src/lib/styleProfileV4.ts` end-to-end.
2. Read `mobile/src/lib/batchPipeline.ts` end-to-end.
3. Grep all imports of both modules; note which sub-exports are actually used. This tells you what the barrel must keep exporting.
4. Sketch the state machine on paper before writing code — every transition should be a named function that returns the next state, not a method that mutates `this`.
