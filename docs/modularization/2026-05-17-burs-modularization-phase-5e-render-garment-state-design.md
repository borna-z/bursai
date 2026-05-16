# Phase 5e — render_garment_image state extraction

**Roadmap:** [Modularization roadmap](./2026-05-16-burs-modularization-roadmap.md)
**Previous phase:** [Phase 5 — Edge function extractions](./2026-05-16-burs-modularization-phase-5-edge-functions-design.md)
**Related:** [Phase 5d — burs_style_engine deep extraction](./2026-05-17-burs-modularization-phase-5d-burs-style-engine-deep-extraction-design.md)
**Suggested branch:** `refactor/render-garment-state`

## Problem

`supabase/functions/render_garment_image/index.ts` is 1347 lines after Phase 5c (which extracted credit flow). The original Phase 5 spec set a <1100 line target. The remaining bulk is four DB-touching helpers that own the garment render lifecycle's state transitions:

- `updateGarmentRenderState` (line 116)
- `claimGarmentRender` (line 133)
- `safeMarkRenderFailed` (line 168)
- `safeRestoreOrFailRender` (line 209)

They write to the `garments` table and contain the contention + idempotency logic that gates concurrent invocations. Currently they live inline and are not unit-tested.

## Goal

`render_garment_image/index.ts` drops below 1100 lines. A new `_shared/render-garment-state.ts` module owns the four helpers with vitest coverage of claim contention and restore-or-fail idempotency. No behavior change.

## Approach

Lift the four helpers verbatim into a new shared module. Port the existing transaction pattern 1:1 — no new transactions, no semantic changes. The orchestrator keeps HTTP/CORS/auth, eligibility, credit consumption, the Gemini call, validation, retry orchestration, response shaping.

## Scope

### In

#### `_shared/render-garment-state.ts` *(new)*

Four exports, each accepting an injected Supabase client (so tests can stub):

- `updateGarmentRenderState(client, garmentId, patch, context)` — state transition. Throws on DB error.
- `claimGarmentRender(client, garmentId, mannequinPresentation, force?)` — atomic claim via `.update(...).in('render_status', allowed).select('id').maybeSingle()`. Returns `Promise<boolean>` (true iff the row was claimed). Preserve this exact contract — the current orchestrator uses the return value directly as a boolean.
- `safeMarkRenderFailed(client, garmentId, updates, context)` — terminal failure write. Wraps the `garments` update in `try/catch`; only logs to `console.error` when persisting the failure state itself errors or crashes. The normal-path success of marking a render failed produces no log entry — preserve this exactly.
- `safeRestoreOrFailRender(client, garmentId, ...)` — idempotent restore-or-fail used by the retry path. Falls back to `safeMarkRenderFailed` when there is no prior good render to restore.

All four touch the `garments` table. The module owns the SQL/RPC details; the orchestrator only calls these functions.

### Out

- Eligibility checks, credit flow, Gemini call, validator, retry policy. All stay in orchestrator.
- HTTP/CORS/auth handling. Stays in orchestrator.
- New transactions or RPC patterns. Spec explicitly forbids — port 1:1.
- Migrations. No schema change.

## Files touched

| Path | Change |
|---|---|
| `supabase/functions/render_garment_image/index.ts` | Slim to <1100 lines; call into new shared module. |
| `supabase/functions/_shared/render-garment-state.ts` *(new)* | The four lifecycle helpers. |
| `supabase/functions/_shared/__tests__/render-garment-state.test.ts` *(new, vitest)* | Claim contention + restore-or-fail idempotency + error logging. |

## Acceptance criteria

- `supabase/functions/render_garment_image/index.ts` < 1100 lines.
- `npx vitest run` clean.
- Test coverage includes:
  - Claim contention: two concurrent `claimGarmentRender` calls for the same garment — exactly one returns `true`, the other returns `false`. (`claimGarmentRender` returns `Promise<boolean>`; do not refactor it into an object return.)
  - `safeRestoreOrFailRender` idempotency: calling twice in succession converges to the same row state.
  - `safeMarkRenderFailed` writes the `garments` row to `render_status='failed'` on the normal path and emits `console.error` only when the underlying `.update(...)` errors or throws — matching the current behavior.
- No behavior change — manual smoke: render a single garment end-to-end against staging; verify the same `garments` row state transitions occur.
- Lint clean.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| DB-write helpers have race conditions if state moves between read and write | Port the existing transaction pattern 1:1; do not introduce new transactions. Side-by-side diff the new module against the pre-refactor `index.ts` block. |
| `process_render_jobs` may import one of these helpers | Grep `process_render_jobs` for direct imports before push. If it imports any, redeploy it in the same PR. Document the redeploy plan in the PR body. |
| Subtle change in error-log payload shape breaks observability | Snapshot the existing error-log payload on a known failure case; assert the new module produces a byte-identical payload in tests. |
| Stubbed Supabase client in tests diverges from the real client surface | Use the same typed client interface the orchestrator uses; share fixtures with existing edge-function tests. |

## Verification before completion

```bash
npx vitest run
npx eslint . --max-warnings 0
git diff --check
wc -l supabase/functions/render_garment_image/index.ts
```

Manual smoke against staging: trigger a render, confirm garment state transitions through `pending` → `processing` → terminal state as before.

## Redeploy

`render_garment_image` always. `process_render_jobs` only if grep shows it imports the new module.

```bash
npx supabase functions deploy render_garment_image --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
# if process_render_jobs imports the new module:
npx supabase functions deploy process_render_jobs --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

## When picking this up cold

1. Read Phase 5 spec end-to-end, then Phase 5c notes (in roadmap or completion log).
2. Read the current `supabase/functions/render_garment_image/index.ts` end-to-end (lines 1–1347).
3. Grep callers of `updateGarmentRenderState`, `claimGarmentRender`, `safeMarkRenderFailed`, `safeRestoreOrFailRender` across `supabase/functions/`.
4. Confirm the transaction semantics in each helper by reading the SQL/RPC it issues — note any `select ... for update` / `update ... where state = ?` patterns; these are the contention guards and must be preserved.
5. Capture a render lifecycle trace from staging logs before the refactor for diffing.
