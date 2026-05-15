# Phase 1 — State foundations

**Roadmap:** [Modularization roadmap](./2026-05-16-burs-modularization-roadmap.md)
**Previous phase:** [Phase 0 — Style engine variety](./2026-05-16-burs-modularization-phase-0-style-engine-variety-design.md)
**Next phase:** [Phase 2 — Stylist hooks](./2026-05-16-burs-modularization-phase-2-stylist-hooks-design.md)
**Suggested branch:** `refactor/state-foundations`

## Problem

Three foundational modules in `mobile/src` carry multiple unrelated concerns:

- `contexts/AuthContext.tsx` (546 lines) — auth state + storage hydration + onboarding derivation + subscription lookup + offline-queue replay trigger + provider render.
- `lib/offlineQueue.ts` (464 lines) — AsyncStorage persistence + FIFO replay + handler registry + retry cap + subscriber observer + connectivity wiring.
- `lib/garmentSave.ts` (456 lines) — pure Supabase insert + metadata extraction + offline-queue dispatch + enrichment trigger + toast/i18n + NetInfo check.

These are imported by most features. Bugs are silent and dangerous; tests are difficult because side effects are entangled with state.

## Goal

Each module exposes a stable public API while internal responsibilities live in focused sibling files. Each layer is independently testable. No behavior change for callers.

## Approach

For each module, identify natural seams, extract them, leave a thin orchestrator. Keep import paths stable via barrel re-exports where appropriate.

## Scope

### `contexts/AuthContext.tsx`

Extract pure functions; provider stays cohesive but slim.

- `auth/hydrateAuthFromStorage.ts` — reads cached session + profile from AsyncStorage, returns shape ready for context init. No side effects beyond reads.
- `auth/subscriptionTierFromProfile.ts` — pure selector mapping profile row → subscription tier enum.
- `auth/deriveOnboardingStatus.ts` — already exists per audit; ensure it is exported and used by the context (don't duplicate).
- `hooks/useOfflineQueueReplay.ts` *(new)* — owns the "when auth becomes valid, replay offline queue" effect, removing this from `AuthContext`.

Provider responsibilities after refactor: load → set state → wire Supabase auth listeners → expose context value. Target line count: < 250.

### `lib/offlineQueue.ts`

Split by axis:

- `lib/offlineQueue/persistence.ts` — AsyncStorage read/write, byte/item caps, serialization. No retry or observer logic.
- `lib/offlineQueue/dispatcher.ts` — FIFO dispatch loop, handler registry, retry cap (3 attempts).
- `lib/offlineQueue/subscriber.ts` — observer pattern, change notifications.
- `lib/offlineQueue/connectivity.ts` — NetInfo wiring + `isOnlineNow()`.
- `lib/offlineQueue/index.ts` — barrel re-export of public surface (`enqueue`, `registerHandler`, `subscribe`, `replay`).

Existing imports of `from '@/lib/offlineQueue'` continue to work.

### `lib/garmentSave.ts`

Three layers, each callable on its own:

- `lib/garmentSave/persistGarmentRaw.ts` — pure Supabase insert + return row. No metadata, no toast, no offline. Throws on error.
- `lib/garmentSave/persistGarmentWithMetadata.ts` — calls `persistGarmentRaw` then triggers metadata extraction (mask/color) + enrichment.
- `lib/garmentSave/persistGarmentWithOfflineQueue.ts` — checks NetInfo; if offline, enqueues; else delegates to `persistGarmentWithMetadata`.
- `lib/garmentSave/index.ts` — barrel re-export.

Toast / i18n calls are removed from the persistence layer and moved to the call site (typically `useAddGarment` / `AddPieceStep3`). The call site is in a position to display the right toast in the right language; the persistence layer should not assume a UI exists.

### Out of scope

- Changing the wire format of offline-queue items (would require migration of stored items).
- Reworking the `useAddGarment` hook beyond the toast move (that may be needed in a later phase).
- Touching `useAuth` consumers — all of them keep their existing imports.

## Files touched

| Path | Change |
|---|---|
| `mobile/src/contexts/AuthContext.tsx` | Slim down to provider + listeners only. |
| `mobile/src/auth/hydrateAuthFromStorage.ts` *(new)* | Storage read helpers extracted. |
| `mobile/src/auth/subscriptionTierFromProfile.ts` *(new)* | Pure selector. |
| `mobile/src/auth/deriveOnboardingStatus.ts` | Ensure exported (may already exist). |
| `mobile/src/hooks/useOfflineQueueReplay.ts` *(new)* | Owns the auth→replay effect. |
| `mobile/src/lib/offlineQueue.ts` *(delete)* | Replaced by directory of same name. |
| `mobile/src/lib/offlineQueue/index.ts` *(new)* | Barrel. |
| `mobile/src/lib/offlineQueue/persistence.ts` *(new)* | AsyncStorage layer. |
| `mobile/src/lib/offlineQueue/dispatcher.ts` *(new)* | FIFO + retry. |
| `mobile/src/lib/offlineQueue/subscriber.ts` *(new)* | Observer. |
| `mobile/src/lib/offlineQueue/connectivity.ts` *(new)* | NetInfo. |
| `mobile/src/lib/garmentSave.ts` *(delete)* | Replaced by directory of same name. |
| `mobile/src/lib/garmentSave/index.ts` *(new)* | Barrel. |
| `mobile/src/lib/garmentSave/persistGarmentRaw.ts` *(new)* | Pure insert. |
| `mobile/src/lib/garmentSave/persistGarmentWithMetadata.ts` *(new)* | + metadata. |
| `mobile/src/lib/garmentSave/persistGarmentWithOfflineQueue.ts` *(new)* | + offline gate. |
| Call sites of `garmentSave` that consumed implicit toasts | Add explicit toast at call site. |
| `mobile/src/lib/__tests__/offlineQueue.test.ts` | Update to import from new structure; add a per-file unit test for persistence and dispatcher. |
| `mobile/src/lib/__tests__/garmentSave.test.ts` | Update; add per-layer tests. |
| `mobile/src/contexts/__tests__/AuthContext.test.tsx` | Update; add pure-function tests for extracted helpers. |

## Acceptance criteria

- `AuthContext.tsx` < 250 lines; `offlineQueue/*` and `garmentSave/*` no individual file > 200 lines.
- All extracted pure functions have at least one unit test that does not require a React Native test environment.
- No public import path changes: `import { useAuth } from '@/contexts/AuthContext'`, `import { enqueue } from '@/lib/offlineQueue'`, `import { persistGarment } from '@/lib/garmentSave'` all still work.
- Manual smoke test: add a garment online → succeeds; toggle offline (DevTools or NetInfo mock) → garment queues; toggle online → queue replays; sign out → context clears.
- All existing tests pass without modification beyond import path updates.
- Lint clean: `npm run lint --prefix mobile` (root ESLint config ignores `mobile/**`; run via the mobile package).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Hidden coupling between toast and persistence breaks UX | Grep all `garmentSave` call sites before refactor; explicitly add toast at each. List in the PR description. |
| Replacing `offlineQueue.ts` with a directory of same name causes import resolution issues on case-insensitive filesystems | Verify on Windows + macOS before pushing. If issues, rename directory to `offlineQueueModule/` and update barrel path. |
| Storage format change accidentally introduced | Persistence layer must use the same serialization functions; freeze the JSON shape with a test that round-trips a sample item. |

## Verification before completion

```bash
npm test --prefix mobile
npm run lint --prefix mobile
# Manual: build + run mobile, exercise offline path with NetInfo mock or airplane mode.
```

## When picking this up cold

1. Read `mobile/src/contexts/AuthContext.tsx` end-to-end.
2. Read `mobile/src/lib/offlineQueue.ts` end-to-end.
3. Read `mobile/src/lib/garmentSave.ts` end-to-end.
4. Grep call sites: `import.*garmentSave`, `import.*offlineQueue`, `useAuth`.
5. List all toast strings inside `garmentSave.ts` before deletion so they can be reproduced at call sites in the same languages.
