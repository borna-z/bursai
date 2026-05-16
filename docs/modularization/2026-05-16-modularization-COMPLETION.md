# BURS Modularization — Completion Log

**Date:** 2026-05-16
**Roadmap:** [Modularization roadmap](./2026-05-16-burs-modularization-roadmap.md)
**Status:** Complete. Main CI green at `5a99a389`.

## Summary

All seven roadmap phases shipped in a single overnight session, plus four follow-up PRs (Phase 5b `burs_style_engine` extraction, Phase 5c render-credit-flow extraction, EditGarmentScreen reuse of `AddPieceStep3Form`, and Phase 3 line-count polish) and one main-branch hotfix (`outfit-scoring.test.ts` import path). All twelve PRs landed on `main`. The `style_engine_suggestion_log` migration was applied to project ref `khvkwojtlkcvxjxztduj`. Four edge functions were redeployed (one at a time, per project convention).

## Shipped PRs

| PR | Title | Branch | Merge sha | Summary |
|---|---|---|---|---|
| [#852](https://github.com/borna-z/bursai/pull/852) | feat(style-engine): outfit variety — recency penalty + regenerate token (Phase 0) | `feat/style-engine-variety` | `f0e48d08` | Recency-aware scoring + suggestion log + cache-bust token; stops the "identical outfits across regenerations" bug. |
| [#853](https://github.com/borna-z/bursai/pull/853) | refactor(mobile): state foundations splits (Phase 1) | `refactor/state-foundations` | `bec33dde` | `AuthContext`, `offlineQueue`, `garmentSave` split into focused sibling modules behind stable barrels. |
| [#854](https://github.com/borna-z/bursai/pull/854) | refactor(mobile): types & batch pipeline splits (Phase 4) | `refactor/types-and-batch` | `d9c13491` | `styleProfileV4` barrel; `batchPipeline` state-machine extracted from orchestrator. |
| [#855](https://github.com/borna-z/bursai/pull/855) | refactor(supabase): edge function extractions — revenuecat + render (Phase 5) | `refactor/edge-function-extractions` | `995a598a` | `revenuecat_webhook` event handlers split; `render_garment_image` job-orchestration helpers extracted. |
| [#856](https://github.com/borna-z/bursai/pull/856) | refactor(mobile): stylist hooks splits (Phase 2) | `refactor/stylist-hooks` | `567265e3` | `useStyleChat`, `useWeekGenerator`, `usePhotoFeedback` split; identity stability tightened (see review totals). |
| [#857](https://github.com/borna-z/bursai/pull/857) | refactor(mobile): screen splits (Phase 3) | `refactor/screen-splits` | `b594ff45` | `GarmentDetail`, `OutfitGenerate`, `StyleMe`, `VisualSearch` decomposed into screen + sections + hooks. |
| [#858](https://github.com/borna-z/bursai/pull/858) | refactor(mobile): AddPiece splits (Phase 6) | `refactor/addpiece-splits` | `ac55f46c` | `AddPieceStep3` decomposed; `AddPieceStep3Form` extracted as reusable surface. |
| [#859](https://github.com/borna-z/bursai/pull/859) | fix(style-engine): correct outfit-scoring.test.ts import path (main hotfix) | `fix/outfit-scoring-test-import` | `a97858ac` | Direct-to-main hotfix; vitest runner was picking up a stale path after Phase 0 file moves. |
| [#860](https://github.com/borna-z/bursai/pull/860) | refactor(mobile): EditGarmentScreen reuse AddPieceStep3Form | `refactor/edit-garment-reuse-form` | `44ddca22` | Legacy edit screen now renders the shared form; deduplicates picker logic. |
| [#861](https://github.com/borna-z/bursai/pull/861) | refactor(supabase): render-credit-flow extraction (Phase 5c) | `refactor/render-credit-flow` | `b558ef15` | Credit-balance + reservation + refund logic lifted out of `render_garment_image` and `process_render_jobs`. |
| [#862](https://github.com/borna-z/bursai/pull/862) | refactor(supabase): burs_style_engine extraction (Phase 5b) | `refactor/edge-fns-burs-style-engine` | `5a99a389` | Outfit-set dedup + confidence extraction lifted out of `burs_style_engine/index.ts`. |
| [#863](https://github.com/borna-z/bursai/pull/863) | refactor(mobile): close screen line-count gaps (Phase 3 polish) | `refactor/screen-line-target-polish` | `328eab6b` | Final pass to bring the four Phase 3 screens under their line targets. |

## Codex review totals

**Session totals across 12 PRs:** 1 P0, 5 P1, 13 P2, 4 P3 = 23 findings.

| PR | P0 | P1 | P2 | P3 | Notes |
|---|---|---|---|---|---|
| #852 Phase 0 | 0 | 1 | 2 | 1 | Recency-window edge case; minor |
| #853 Phase 1 | 0 | 0 | 1 | 0 | Clean on first pass |
| #854 Phase 4 | 0 | 0 | 1 | 0 | Clean on first pass |
| #855 Phase 5 | 0 | 1 | 2 | 1 | Refund-path branch caught |
| #856 Phase 2 | 1 | 2 | 3 | 1 | **Highest-risk PR.** P0: `useStyleChat` returned object with unstable identity each render → infinite loop in consumers. Caught pre-merge. |
| #857 Phase 3 | 0 | 1 | 2 | 1 | Section memoization gaps |
| #858 Phase 6 | 0 | 0 | 1 | 0 | Clean on first pass |
| #859 hotfix | 0 | 0 | 0 | 0 | Trivial |
| #860 EditGarment | 0 | 0 | 0 | 0 | Clean on first pass |
| #861 Phase 5c | 0 | 0 | 1 | 0 | Clean on first pass |
| #862 Phase 5b | 0 | 0 | 0 | 0 | Clean on first pass |
| #863 Phase 3 polish | 0 | 0 | 0 | 0 | Clean on first pass |

## Self-review pass

Self-review loop run after Codex on all four follow-up PRs (#860, #861, #862, #863): **0 additional findings**. Confirms Codex caught everything real on the harder PRs and the cleanup PRs landed clean.

## Infrastructure work

- **Migration applied:** `supabase/migrations/20260516000000_style_engine_suggestion_log.sql` → project ref `khvkwojtlkcvxjxztduj` (eu-central-1). Applied via `npx supabase db push --linked --yes` post-merge of #852.
- **Edge function redeploys** (one at a time, never `--all`):
  - `burs_style_engine` — twice (Phase 0 wiring, Phase 5b extraction).
  - `revenuecat_webhook` — once (Phase 5 split).
  - `render_garment_image` — twice (Phase 5 helper extraction, Phase 5c credit-flow extraction).
  - `process_render_jobs` — once (Phase 5c credit-flow extraction).
- **Main CI green** on commit `5a99a389` (head as of session end).

## Outstanding line-target gaps (documented, accepted)

- `supabase/functions/burs_style_engine/index.ts` — **1896 lines** vs `<1100` target. Phase 5b scope only authorised dedup + confidence extraction. Remaining bulk: swap scoring, AI prompt builder, wear-log preprocessing. **Phase 5d** spec drafted alongside this completion log.
- `supabase/functions/render_garment_image/index.ts` — **1347 lines** vs `<1100` target. Closing the gap requires extracting the four garment-state DB helpers (~140 lines) which were out of Phase 5c scope. **Phase 5e** spec drafted alongside.
- `EditGarmentScreen` (post-#860) — now surfaces 2 pickers (`color_secondary`, `formality`) that the legacy edit screen hid behind conditional logic. Behaviour intentional but a visibility decision is owed to the user. **Design note drafted** alongside.

## Operational learnings (pin into runbooks)

- **`gh pr checks` blind spot.** When Vercel + Claude apps post checks first, `gh pr checks` reports green even if a later GitHub Actions run fails. Cross-reference with `gh api repos/<owner>/<repo>/commits/<sha>/check-suites` before declaring a PR green. Hit this during #859's investigation.
- **Vitest picks up edge-function tests.** Test files at `supabase/functions/**/*.test.ts` are collected by the root vitest runner. They must be written as vitest tests; Deno-style `https://deno.land/...` imports break the run. Captured as a runbook addition for `supabase/functions/CLAUDE.md`.

## Next-up backlog

- **Phase 5d** — `burs_style_engine` swap scoring + AI prompt builder + wear-log preprocessing extraction (spec drafted).
- **Phase 5e** — `render_garment_image` garment-state DB helpers extraction (spec drafted).
- **Architecture doc refresh** — `mobile/CLAUDE.md` and `supabase/functions/CLAUDE.md` entry points to reflect the new barrel structure (TBD).
- **EditGarmentScreen picker visibility** — user decision: keep both new pickers visible, or hide `formality` behind an advanced toggle (design note drafted).
