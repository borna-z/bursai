# Phase 5d — burs_style_engine deep extraction

**Roadmap:** [Modularization roadmap](./2026-05-16-burs-modularization-roadmap.md)
**Previous phase:** [Phase 5 — Edge function extractions](./2026-05-16-burs-modularization-phase-5-edge-functions-design.md)
**Related:** [Phase 5e — render_garment_image state extraction](./2026-05-17-burs-modularization-phase-5e-render-garment-state-design.md)
**Suggested branch:** `refactor/burs-style-engine-deep-extraction`

## Problem

`supabase/functions/burs_style_engine/index.ts` is still 1896 lines after Phase 5b (which extracted dedup + confidence into `_shared/outfit-combination.ts` and `_shared/outfit-scoring.ts`). The original Phase 5 spec set a <1100 line target for the orchestrator. Three large concerns are still inlined:

- Swap scoring (`scoreSwapCandidates`, `visualWeight`, swap-mode branching) — sits between line 371 and the suggest path.
- AI prompt assembly (`aiRefine` + the system prompt, combo descriptions, stylist enhancement, explanation guidance, `TOOL_SELECT` / `TOOL_SUGGEST` declarations) — lines 197–370.
- Wear-log preprocessing (the block around line 1260 that builds `wearPatterns`, `styleVector`, `socialMap`, `comfortProfile`, `personalUniform`, plus seasonal-transition and formality plumbing) — currently inlined into the request handler.

These are pure transformations over preloaded data; nothing in them performs DB writes or external I/O. They are testable in isolation and currently are not.

## Goal

`burs_style_engine/index.ts` drops below 1100 lines. Three new pure `_shared/*` modules expose stable APIs covered by Deno-runnable vitest specs. No behavior change for callers.

## Approach

For each concern: lift the function(s) verbatim into a new shared module, keep public symbols stable, leave a thin call from the orchestrator. The orchestrator continues to own HTTP, auth, DB reads, response shaping. Phase 0 + Phase 5b invariants are preserved exactly — see Risks.

## Scope

### In

#### `_shared/outfit-swap.ts` *(new)*

Extracts swap-mode logic:

- `scoreSwapCandidates(...)` — current implementation at line 564.
- `visualWeight(garment)` — current implementation at line 371.
- Any private helpers used only by the above.

`computeSwapConfidence` already lives in `_shared/outfit-combination.ts` (re-exported) — leave it there; `outfit-swap.ts` imports it.

Pure module. Input: preloaded garment rows + slot + weather + preferences. Output: scored candidates + confidence.

#### `_shared/outfit-ai-prompts.ts` *(new)*

Extracts AI prompt assembly:

- `aiRefine(...)` — current implementation at line 243.
- `TOOL_SELECT` and `TOOL_SUGGEST` declarations (lines 197 + 214).
- System prompt string, combo-description builder, stylist enhancement string, explanation-guidance string.

Pure module. Input: garments + context + tool-call params. Output: refined selection / suggestion payload. The fetch to the model provider is performed via an injected client to keep the module unit-testable without network.

#### `_shared/wear-context.ts` *(new)*

Extracts the wear-log preprocessing block (around line 1260):

- `buildWearContext(wearLogs, garments, feedbackSignals)` — returns `{ wearPatterns, styleVector, socialMap, comfortProfile, personalUniform }`.
  - `feedbackSignals` is the third argument because the current inlined block calls `buildComfortStyleProfile(wearLogs, garments, feedbackSignals)` at `supabase/functions/burs_style_engine/index.ts:1267-1269`; dropping it would change `comfortProfile` for users with feedback history. Pass it through verbatim.
- Seasonal-transition + formality plumbing currently colocated with that block.

Pure module. Input: raw `wear_logs` rows + garment rows + preloaded feedback signals. Output: derived context object. The orchestrator continues to perform the DB reads (including `feedback_signals`); `wear-context.ts` only consumes the result.

### Out

- Phase 0 variety logic: `regenerate_token` parsing, `recencyMap` load, `recentSuggestionPenalty` application in the score loop, `low_variety` field in the response. All stays inline in the orchestrator.
- Phase 5b dedup + confidence: `_shared/outfit-combination.ts` and `_shared/outfit-scoring.ts` are untouched (except backwards-compat re-exports as needed).
- Hash logging on AI-success and deterministic-fallback paths. Stays in orchestrator.
- DB reads (`wear_logs`, `garments`, preferences). Stays in orchestrator.
- Response shape and HTTP/auth/CORS. Stays in orchestrator.

## Files touched

| Path | Change |
|---|---|
| `supabase/functions/burs_style_engine/index.ts` | Slim to <1100 lines; call into three new shared modules. |
| `supabase/functions/_shared/outfit-swap.ts` *(new)* | Swap scoring + `visualWeight`. |
| `supabase/functions/_shared/outfit-ai-prompts.ts` *(new)* | `aiRefine` + tool declarations + prompt strings. |
| `supabase/functions/_shared/wear-context.ts` *(new)* | `buildWearContext` + seasonal/formality helpers. |
| `supabase/functions/_shared/outfit-combination.ts` | Extend backwards-compat re-exports if any swap helpers were imported externally (grep first). |
| `supabase/functions/_shared/__tests__/outfit-swap.test.ts` *(new)* | Vitest specs for swap scoring + confidence. |
| `supabase/functions/_shared/__tests__/outfit-ai-prompts.test.ts` *(new)* | Vitest specs for prompt assembly + tool-call shapes (mocked model client). |
| `supabase/functions/_shared/__tests__/wear-context.test.ts` *(new)* | Vitest specs for derived structures over fixture wear_logs, including a case where `feedbackSignals` is non-empty so `comfortProfile` reflects feedback contribution. |

## Acceptance criteria

- `supabase/functions/burs_style_engine/index.ts` < 1100 lines.
- Three new `_shared/*` modules ship with vitest specs; `npx vitest run` clean across the repo.
- No regressions in the existing edge-function test suites.
- Manual smoke: generate mode, suggest mode, swap mode all return outfits with the same response shape against the staging environment.
- Phase 0 + Phase 5b invariants preserved (see Risks).
- Tests use vitest convention. No Deno-std URL imports inside the test files.
- Lint clean.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `aiRefine` extraction touches the prompt that affects LLM output | Prompt strings extracted byte-for-byte; sanity-check by running a generate call against the pre-refactor vs post-refactor module locally before push. Diff the model response payloads. |
| Wear-context extraction shifts import order or breaks symbol visibility | Keep public symbols stable; grep callers of `buildSocialContextMap`, `buildPersonalUniform`, `resolveOccasionSubmode` before moving. |
| Phase 0 variety logic accidentally moved into a shared module | Variety state (`regenerate_token`, `recencyMap`, `recentSuggestionPenalty`, `low_variety`) explicitly listed in Out-of-scope; spec-reviewer subagent checks that none of these symbols appear inside the new shared files. |
| Phase 5b confidence/dedup behavior regresses | Phase 5b modules are untouched; new modules only consume their exports. Run the existing `outfit-combination.test.ts` / `outfit-scoring.test.ts` suites unchanged. |
| Hash logging silently drops on one branch | Hash-log call sites stay in the orchestrator on both AI-success and deterministic-fallback paths; grep `hash` in `index.ts` post-refactor to confirm both paths still log. |

## Verification before completion

```bash
npx vitest run
npx eslint . --max-warnings 0
git diff --check
wc -l supabase/functions/burs_style_engine/index.ts
```

Manual smoke against staging: generate + suggest + swap, compare response JSON to a pre-refactor capture.

## Redeploy

`burs_style_engine` only. No other function imports these new shared modules at the time this spec is written. If a future change adds a dependent, redeploy that too.

```bash
npx supabase functions deploy burs_style_engine --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

## When picking this up cold

1. Read Phase 5 spec end-to-end, then Phase 5b notes (in roadmap or completion log).
2. Read the current `supabase/functions/burs_style_engine/index.ts` end-to-end (lines 1–1896).
3. Grep all importers of `_shared/outfit-combination` and `_shared/outfit-scoring` to confirm the public surface.
4. Sketch the `wear-context.ts` API on paper before touching code — note which inputs the orchestrator currently passes to `scoreGarment` and whether they originate from the wear-context block.
5. Capture a generate/suggest/swap response payload from staging before the refactor for diffing.
