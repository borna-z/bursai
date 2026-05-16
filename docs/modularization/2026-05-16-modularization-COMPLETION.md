# BURS Modularization — Completion Log

**Date:** 2026-05-16
**Roadmap:** [Modularization roadmap](./2026-05-16-burs-modularization-roadmap.md)
**Status:** Complete. Main CI green at `5a99a389`.

## Summary

All seven roadmap phases shipped in a single overnight session, plus four follow-up PRs (Phase 5b `burs_style_engine` extraction, Phase 5c render-credit-flow extraction, EditGarmentScreen reuse of `AddPieceStep3Form`, and Phase 3 line-count polish) and one regular PR fixing a test-import path that broke main CI after #852 (#859). All twelve PRs landed on `main`. The `style_engine_suggestion_log` migration was applied to project ref `khvkwojtlkcvxjxztduj`. Four edge functions were redeployed (one at a time, per project convention).

## Shipped PRs

| PR | Title | Branch | Merge sha | Summary |
|---|---|---|---|---|
| [#852](https://github.com/borna-z/bursai/pull/852) | feat(style-engine): outfit variety — recency penalty + regenerate token (Phase 0) | `feat/style-engine-variety` | `f0e48d08` | Recency-aware scoring + suggestion log + cache-bust token; stops the "identical outfits across regenerations" bug. |
| [#853](https://github.com/borna-z/bursai/pull/853) | refactor(mobile): state foundations splits (Phase 1) | `refactor/state-foundations` | `bec33dde` | `AuthContext`, `offlineQueue`, `garmentSave` split into focused sibling modules behind stable barrels. |
| [#854](https://github.com/borna-z/bursai/pull/854) | refactor(mobile): types & batch pipeline splits (Phase 4) | `refactor/types-and-batch` | `d9c13491` | `styleProfileV4` barrel; `batchPipeline` state-machine extracted from orchestrator. |
| [#855](https://github.com/borna-z/bursai/pull/855) | refactor(supabase): edge function extractions — revenuecat + render (Phase 5) | `refactor/edge-function-extractions` | `995a598a` | `revenuecat_webhook` event handlers split; `render_garment_image` job-orchestration helpers extracted. |
| [#856](https://github.com/borna-z/bursai/pull/856) | refactor(mobile): stylist hooks splits (Phase 2) | `refactor/stylist-hooks` | `567265e3` | `useStyleChat`, `useWeekGenerator`, `usePhotoFeedback` split. Codex was quota-exhausted on this PR; self-review was the only automated signal. |
| [#857](https://github.com/borna-z/bursai/pull/857) | refactor(mobile): screen splits (Phase 3) | `refactor/screen-splits` | `b594ff45` | `GarmentDetail`, `OutfitGenerate`, `StyleMe`, `VisualSearch` decomposed into screen + sections + hooks. |
| [#858](https://github.com/borna-z/bursai/pull/858) | refactor(mobile): AddPiece splits (Phase 6) | `refactor/addpiece-splits` | `ac55f46c` | `AddPieceStep3` decomposed; `AddPieceStep3Form` extracted as reusable surface. |
| [#859](https://github.com/borna-z/bursai/pull/859) | fix(style-engine): correct outfit-scoring.test.ts import path (main hotfix) | `fix/outfit-scoring-test-import` | `a97858ac` | Regular PR (branch → main) fixing the bad test import that broke main CI after #852. Also folds in a -0 leak fix on the recency penalty. |
| [#860](https://github.com/borna-z/bursai/pull/860) | refactor(mobile): EditGarmentScreen reuse AddPieceStep3Form | `refactor/edit-garment-reuse-form` | `44ddca22` | Legacy edit screen now renders the shared form; deduplicates picker logic. |
| [#861](https://github.com/borna-z/bursai/pull/861) | refactor(supabase): render-credit-flow extraction (Phase 5c) | `refactor/render-credit-flow` | `b558ef15` | Credit-balance + reservation + refund logic lifted out of `render_garment_image` and `process_render_jobs`. |
| [#862](https://github.com/borna-z/bursai/pull/862) | refactor(supabase): burs_style_engine extraction (Phase 5b) | `refactor/edge-fns-burs-style-engine` | `5a99a389` | Outfit-set dedup + confidence extraction lifted out of `burs_style_engine/index.ts`. |
| [#863](https://github.com/borna-z/bursai/pull/863) | refactor(mobile): close screen line-count gaps (Phase 3 polish) | `refactor/screen-line-target-polish` | `328eab6b` | Final pass to bring the four Phase 3 screens under their line targets. |

## Codex review status

**Session totals across 12 PRs:** 1 P1, 6 P2, 0 P0/P3 = 7 findings on PRs Codex actually reviewed. Five PRs received no automated review (zero activity, no quota message); two PRs (#855, #856) were skipped because Codex returned a quota-exhausted comment. The strict-gate Codex loop was therefore degraded for the session; see the operational learning below.

| PR | Codex outcome | P0 | P1 | P2 | P3 | Notes |
|---|---|---|---|---|---|---|
| #852 Phase 0 | No review posted | — | — | — | — | No Codex comment or quota message recorded on the PR. |
| #853 Phase 1 | No review posted | — | — | — | — | No Codex comment or quota message recorded on the PR. |
| #854 Phase 4 | No review posted | — | — | — | — | No Codex comment or quota message recorded on the PR. |
| #855 Phase 5 | Quota exhausted | — | — | — | — | "You have reached your Codex usage limits" comment, no review. |
| #856 Phase 2 | Quota exhausted | — | — | — | — | "You have reached your Codex usage limits" comment, no review. |
| #857 Phase 3 | No review posted | — | — | — | — | No Codex comment or quota message recorded on the PR. |
| #858 Phase 6 | Reviewed | 0 | 0 | 1 | 0 | P2: AddPiece save-in-flight guard sync concern. |
| #859 hotfix | No review posted | — | — | — | — | No Codex comment recorded. |
| #860 EditGarment | Reviewed | 0 | 1 | 4 | 0 | P1: outerwear-canonical mapping on edit save. P2s: remount on id change, outerwear search, unknown-metadata preservation, lowercase-category preservation. |
| #861 Phase 5c | "No issues found" | 0 | 0 | 0 | 0 | "Didn't find any major issues. Breezy!" |
| #862 Phase 5b | Reviewed | 0 | 0 | 1 | 0 | P2: `isColorSwap` sort by invariant fit keys. |
| #863 Phase 3 polish | "No issues found" | 0 | 0 | 0 | 0 | "Didn't find any major issues. Already looking forward to the next diff." |

## Self-review pass

Self-review loop on the four follow-up PRs (#860, #861, #862, #863): no additional findings recorded. Given the gaps in Codex coverage above, the self-review safety net was effectively the only signal on the unreviewed PRs (#852, #853, #854, #857, #859) and the two quota-blocked PRs (#855, #856). This is a coverage gap the merge gate did not catch.

## Infrastructure work

- **Migration applied:** `supabase/migrations/20260516000000_style_engine_suggestion_log.sql` → project ref `khvkwojtlkcvxjxztduj` (eu-central-1). Applied via `npx supabase db push --linked --yes` post-merge of #852.
- **Edge function redeploys** (one at a time, never `--all`):
  - `burs_style_engine` — twice (Phase 0 wiring, Phase 5b extraction).
  - `revenuecat_webhook` — once (Phase 5 split).
  - `render_garment_image` — twice (Phase 5 helper extraction, Phase 5c credit-flow extraction).
  - `process_render_jobs` — twice (Phase 5 `_shared/` change in `revenuecat`/`render` modules transitively required redeploy; Phase 5c credit-flow extraction).
- **Main CI green** on commit `5a99a389` (head as of session end).

## Outstanding line-target gaps (documented, accepted)

- `supabase/functions/burs_style_engine/index.ts` — **1896 lines** vs `<1100` target. Phase 5b scope only authorised dedup + confidence extraction. Remaining bulk: swap scoring, AI prompt builder, wear-log preprocessing. A follow-up phase (Phase 5d) is recommended but no spec has been written yet.
- `supabase/functions/render_garment_image/index.ts` — **1347 lines** vs `<1100` target. Closing the gap requires extracting the four garment-state DB helpers (~140 lines) which were out of Phase 5c scope. A follow-up phase (Phase 5e) is recommended but no spec has been written yet.
- `EditGarmentScreen` (post-#860) — now surfaces 2 pickers (`color_secondary`, `formality`) that the legacy edit screen hid behind conditional logic. Behaviour intentional but a visibility decision is owed to the user. No design note has been written yet.

## Operational learnings (pin into runbooks)

- **`gh pr checks` blind spot.** When Vercel + Claude apps post checks first, `gh pr checks` reports green even if a later GitHub Actions run fails. Cross-reference with `gh api repos/<owner>/<repo>/commits/<sha>/check-suites` before declaring a PR green. Hit this during #859's investigation.
- **Vitest picks up edge-function tests.** Test files at `supabase/functions/**/*.test.ts` are collected by the root vitest runner. They must be written as vitest tests; Deno-style `https://deno.land/...` imports break the run. Captured as a runbook addition for `supabase/functions/CLAUDE.md`.
- **Codex merge gate must verify Codex actually responded.** Five of the twelve PRs in this session received no Codex review at all (no review comment, no quota message), and two more were quota-blocked. The merge gate ("👍 / no-bugs / 5-min quiet") was satisfied by silence on those PRs, which is exactly the failure mode the gate is supposed to prevent. Future runs must distinguish "Codex reviewed and found nothing" from "Codex never posted" — check `gh api repos/.../pulls/<n>/reviews` for a `chatgpt-codex-connector[bot]` entry before merging.

## Next-up backlog

All items below are open work; specs/design notes need to be written before the next session picks them up.

- **Phase 5d** — `burs_style_engine` swap scoring + AI prompt builder + wear-log preprocessing extraction. Spec not yet written.
- **Phase 5e** — `render_garment_image` garment-state DB helpers extraction (~140 lines). Spec not yet written.
- **Architecture doc refresh** — `mobile/CLAUDE.md` and `supabase/functions/CLAUDE.md` entry points to reflect the new barrel structure.
- **EditGarmentScreen picker visibility** — user decision owed: keep both new pickers (`color_secondary`, `formality`) visible, or hide `formality` behind an advanced toggle. Design note not yet written.
