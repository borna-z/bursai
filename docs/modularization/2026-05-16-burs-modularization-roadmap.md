# BURS Modularization — Roadmap

**Date:** 2026-05-16
**Status: complete** — see [2026-05-16-modularization-COMPLETION.md](./2026-05-16-modularization-COMPLETION.md)
**Owner:** rotating (each phase picked up cold in a new Claude Code session)

## Problem

Audits across `mobile/src` and `supabase/functions` identified ~20 modules that mix unrelated concerns and have grown past comfortable size. The growth pattern is consistent: hooks/screens absorbed adjacent responsibilities (state + side effects + UI + persistence) instead of growing sibling modules. Symptoms include the style engine returning identical outfits across regenerations (cache key + no diversity scoring), 1k+-line hooks that are hard to test, and edge functions where small changes redeploy large surface area.

## Approach

Sequence the work in phases so each phase is a single PR a fresh session can pick up cold. Each phase spec is self-contained, lists exact files, names the seams, and defines acceptance criteria. Phases are ordered by leverage (foundations early) and risk (highest-churn screens late).

## Phase index

| Phase | Spec | Scope | Estimated PR size | Status |
|---|---|---|---|---|
| 0 | [Style engine variety](./2026-05-16-burs-modularization-phase-0-style-engine-variety-design.md) | Stop returning identical outfits; add recency-aware scoring + cache-bust signal | Small | **DONE** — [#852](https://github.com/borna-z/bursai/pull/852) |
| 1 | [State foundations](./2026-05-16-burs-modularization-phase-1-state-foundations-design.md) | `AuthContext`, `offlineQueue`, `garmentSave` splits | Medium | **DONE** — [#853](https://github.com/borna-z/bursai/pull/853) |
| 2 | [Stylist hooks](./2026-05-16-burs-modularization-phase-2-stylist-hooks-design.md) | `useStyleChat`, `useWeekGenerator`, `usePhotoFeedback` splits | Medium-Large | **DONE** — [#856](https://github.com/borna-z/bursai/pull/856) |
| 3 | [Screen splits](./2026-05-16-burs-modularization-phase-3-screen-splits-design.md) | `GarmentDetail`, `OutfitGenerate`, `StyleMe`, `VisualSearch` | Medium | **DONE** — [#857](https://github.com/borna-z/bursai/pull/857) + polish [#863](https://github.com/borna-z/bursai/pull/863) |
| 4 | [Types & batch pipeline](./2026-05-16-burs-modularization-phase-4-types-and-batch-design.md) | `styleProfileV4` barrel, `batchPipeline` state-machine split | Small-Medium | **DONE** — [#854](https://github.com/borna-z/bursai/pull/854) |
| 5 | [Edge function extractions](./2026-05-16-burs-modularization-phase-5-edge-functions-design.md) | `revenuecat_webhook`, `render_garment_image`, `burs_style_engine` shared modules | Medium | **DONE** — [#855](https://github.com/borna-z/bursai/pull/855) + [#862](https://github.com/borna-z/bursai/pull/862) (5b) + [#861](https://github.com/borna-z/bursai/pull/861) (5c) |
| 6 | [AddPiece splits](./2026-05-16-burs-modularization-phase-6-addpiece-design.md) | `AddPieceStep3`, possibly `EditGarmentScreen` | Medium-Large | **DONE** — [#858](https://github.com/borna-z/bursai/pull/858) + EditGarment reuse [#860](https://github.com/borna-z/bursai/pull/860) |

## How to pick up a phase

1. Read `MEMORY.md` and `CLAUDE.md` as always.
2. Read this roadmap, then the specific phase spec.
3. Read only the files named in the phase spec's "Files touched" section.
4. Branch from `main`. Branch name suggested in the phase spec.
5. Follow the spec's acceptance criteria as your verification gate before merge.

## Non-goals (deliberate)

- **Web `src/` tree.** Being deleted post-launch; refactoring it would be wasted work.
- **`PaywallScreen`, `StyleChatScreen`, `PhotoFeedbackScreen`, `LiveScanScreen`.** Large but cohesive — line count alone isn't a split signal.
- **`travel_capsule`, `style_chat` (edge).** Already split internally; no clear seam left to extract.
- **Cross-cutting renames / dependency upgrades.** Out of scope; would expand blast radius beyond the modularization goal.

## Verification across phases

Every phase MUST:
- Keep all existing tests green (mobile: `npm test --prefix mobile`; web: skipped if applicable).
- Keep lint clean: `npm run lint --prefix mobile` (root ESLint config ignores `mobile/**`; run via the mobile package).
- For edge function phases (5): run Deno tests in each function dir and document redeploy list in the PR.
- Touch `mobile/CLAUDE.md` only when a module rename changes a documented entry point.

## Decisions log

- **2026-05-16** — Wave R is complete and deployed; Phase 6 (AddPiece) is unblocked but stays last because AddPieceStep3 is the most complex screen.
- **2026-05-16** — Specs live under `docs/superpowers/specs/` (default per brainstorming skill). No project override.
- **2026-05-16** — One spec per phase, executed sequentially in separate sessions.
- **2026-05-16** — All seven phases shipped in a single overnight session via 12 PRs (#852–#863, hotfix #859 direct-to-main). See completion log for totals and learnings.

## Backlog (post-completion)

Carried over from the completion log; tracked separately from the phase index above.

- **Phase 5d** — `burs_style_engine` swap scoring + AI prompt builder + wear-log preprocessing extraction. Spec drafted in `docs/modularization/`. Closes the remaining 1896 → <1100 line gap left after Phase 5b.
- **Phase 5e** — `render_garment_image` garment-state DB helpers extraction (~140 lines). Spec drafted in `docs/modularization/`. Closes the remaining 1347 → <1100 line gap left after Phase 5c.
- **EditGarmentScreen picker visibility** — design note drafted. User decision owed on whether `color_secondary` and `formality` should remain visible after the #860 form reuse.
- **Architecture doc refresh** — `mobile/CLAUDE.md` and `supabase/functions/CLAUDE.md` entry points to reflect the new barrel structure. TBD.
