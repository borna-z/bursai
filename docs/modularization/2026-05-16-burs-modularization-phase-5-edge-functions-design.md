# Phase 5 — Edge function extractions

**Roadmap:** [Modularization roadmap](./2026-05-16-burs-modularization-roadmap.md)
**Previous phase:** [Phase 4 — Types & batch pipeline](./2026-05-16-burs-modularization-phase-4-types-and-batch-design.md)
**Next phase:** [Phase 6 — AddPiece splits](./2026-05-16-burs-modularization-phase-6-addpiece-design.md)
**Suggested branch:** `refactor/edge-function-extractions`

## Problem

Three edge functions exceed comfortable size and mix multiple concerns inside `index.ts`. Per `CLAUDE.md`, each function is its own deploy unit, and shared changes to `_shared/*` require redeploying every dependent function. The split strategy must respect this — extract only into `_shared/*` modules when the redeploy blast radius is small or zero.

- `supabase/functions/revenuecat_webhook/index.ts` (1837) — signature validation + state machine + idempotency. **0 dependents today.**
- `supabase/functions/render_garment_image/index.ts` (1989) — category classification + prompt enrichment + Gemini call + validation + credit consumption. **1 dependent (`process_render_jobs`).**
- `supabase/functions/burs_style_engine/index.ts` (1780) — auth + scoring + combo dedup + confidence ranking + failure explanation. **0 dependents today** (note: Phase 0 already extends this function in non-shared ways; Phase 5 picks up the deeper extractions afterward).

Deferred (already split internally per audit): `style_chat`, `travel_capsule`. Not in this phase.

## Goal

Each oversized function becomes < 1100 lines and the extracted shared modules are unit-tested in Deno. Redeploys are kept to direct consumers only.

## Approach

For each function, extract the most testable seam:

1. `revenuecat_webhook` → state machine + signature validator.
2. `render_garment_image` → prompt builder + validator.
3. `burs_style_engine` → outfit deduplication + confidence ranker.

## Scope

### `revenuecat_webhook`

- `_shared/revenuecat-state-machine.ts` *(new)* — pure state machine mapping RevenueCat events (`INITIAL_PURCHASE`, `RENEWAL`, `EXPIRATION`, `CANCELLATION`, `BILLING_ISSUE`, etc.) to subscription state updates. Includes out-of-order event protection.
- `_shared/revenuecat-signature.ts` *(new)* — HMAC signature validation. Uses `timingSafeEqual`.
- `revenuecat_webhook/index.ts` — handler shell: parse → validate signature → run state machine → persist → respond.
- `_shared/__tests__/revenuecat-state-machine.test.ts` *(new)* — comprehensive event-flow tests.

Redeploys: 1 (just `revenuecat_webhook`).

### `render_garment_image`

- `_shared/render-prompt-builder.ts` *(new)* — `RenderPromptEnrichment` type + extraction + prompt assembly + multi-prompt retry strategy. Pure logic over input metadata.
- `_shared/render-validator.ts` *(new)* — post-generation validation (reject shoe-on-mannequin, missing item, etc.) returning a typed error or `ok`.
- `render_garment_image/index.ts` — handler: eligibility → credit check → call builder → call Gemini → call validator → persist → respond.
- `_shared/__tests__/render-prompt-builder.test.ts` *(new)* — prompt assembly + retry-prompt generation tests.
- `_shared/__tests__/render-validator.test.ts` *(new)* — validation rule tests.

Redeploys: 2 (`render_garment_image` and `process_render_jobs`, which invokes it internally).

### `burs_style_engine`

- `_shared/outfit-deduplication.ts` *(new)* — `hashOutfit(itemIds)`, `isExactMatch`, `isColorSwap`, `isSilhouetteSwap`. Pure functions; 3 dedup edge cases that the audit identified.
- `_shared/outfit-confidence.ts` *(new)* — confidence scoring + ranking + quality gates extracted from the in-line block.
- `burs_style_engine/index.ts` — leaner orchestrator: load wardrobe → score → build combos → dedup → confidence rank → AI refine → log (from Phase 0) → respond.
- `_shared/__tests__/outfit-deduplication.test.ts` *(new)* — exact/color/silhouette match tests.
- `_shared/__tests__/outfit-confidence.test.ts` *(new)* — ranking + quality gate tests.

Redeploys: 1 (just `burs_style_engine`). If Phase 2's stylist-hooks work created a need for `style_chat` to reuse confidence ranking, expand to 2 deploys and note in PR.

### Out of scope

- Splitting `style_chat`, `travel_capsule`, `process_render_jobs` further.
- Cross-function refactors of auth/rate-limit boilerplate (already centralized in `scale-guard.ts`).
- Changing the AI provider or prompt schemas.
- Re-running RevenueCat backfill or historical event replay.

## Files touched

| Path | Change |
|---|---|
| `supabase/functions/_shared/revenuecat-state-machine.ts` *(new)* | Pure state machine. |
| `supabase/functions/_shared/revenuecat-signature.ts` *(new)* | Signature validator. |
| `supabase/functions/revenuecat_webhook/index.ts` | Slim handler. |
| `supabase/functions/_shared/render-prompt-builder.ts` *(new)* | Prompt assembly. |
| `supabase/functions/_shared/render-validator.ts` *(new)* | Post-gen validator. |
| `supabase/functions/render_garment_image/index.ts` | Slim handler. |
| `supabase/functions/_shared/outfit-deduplication.ts` *(new)* | Hash + match. |
| `supabase/functions/_shared/outfit-confidence.ts` *(new)* | Ranking + gates. |
| `supabase/functions/burs_style_engine/index.ts` | Slim engine. |
| `supabase/functions/_shared/__tests__/*` | New Deno tests for each shared module. |

## Acceptance criteria

- Each function's `index.ts` < 1100 lines after the extraction.
- Each new `_shared/*` module has Deno tests covering its main paths.
- `deno test --allow-all` passes from `supabase/functions/`.
- Smoke test in staging (preview branch):
  - RevenueCat: send a test `INITIAL_PURCHASE` event from RevenueCat sandbox → subscription updated.
  - Render: enqueue a render job for a garment → image generated and validated.
  - Style engine: call `mode: 'generate'` with a seeded wardrobe → outfit returned, hash logged (Phase 0), confidence score in response.
- PR description lists redeploy commands:
  ```bash
  npx supabase functions deploy revenuecat_webhook --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
  npx supabase functions deploy render_garment_image --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
  npx supabase functions deploy process_render_jobs --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
  npx supabase functions deploy burs_style_engine --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
  ```
  Functions are deployed one at a time per `CLAUDE.md`.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Forgetting to redeploy `process_render_jobs` after `_shared/render-*` change | PR template explicitly lists both deploys. CI does not redeploy automatically. |
| Out-of-order RevenueCat event handling regresses | Port existing out-of-order protection 1:1 into the new state machine. Test with a deliberate out-of-order pair. |
| Render validator becomes too strict and rejects valid outputs | Threshold tunables stay in the validator module as exported constants; keep current values. |
| Style engine confidence ranking shifts and outfit choice changes for cached states | Acceptable per Phase 0 changes; flagged in PR. |

## Verification before completion

```bash
cd supabase/functions
deno test --allow-all _shared/__tests__/

# Local smoke (one function at a time)
npx supabase functions serve revenuecat_webhook
# send a fixture payload, observe response
```

After merge, redeploy in this order (one at a time):
1. `revenuecat_webhook`
2. `render_garment_image`
3. `process_render_jobs`
4. `burs_style_engine`

## When picking this up cold

1. Read each of the three `index.ts` files end-to-end.
2. Read existing `_shared/*` modules (`scale-guard.ts`, `outfit-scoring.ts`, `outfit-combination.ts`, `burs-ai.ts`, `idempotency.ts`) so extractions follow established style.
3. Confirm Phase 0 is merged before starting the `burs_style_engine` extraction — otherwise Phase 0's variety changes will be untangling at the same time as Phase 5's structural ones.
4. Pick one function and finish it before starting the next. Three sub-PRs inside one branch is acceptable if each is reviewable on its own.
