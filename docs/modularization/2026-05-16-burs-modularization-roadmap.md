# BURS Modularization — Roadmap

**Date:** 2026-05-16
**Status:** Specs drafted, awaiting per-phase implementation
**Owner:** rotating (each phase picked up cold in a new Claude Code session)

## Problem

Audits across `mobile/src` and `supabase/functions` identified ~20 modules that mix unrelated concerns and have grown past comfortable size. The growth pattern is consistent: hooks/screens absorbed adjacent responsibilities (state + side effects + UI + persistence) instead of growing sibling modules. Symptoms include the style engine returning identical outfits across regenerations (cache key + no diversity scoring), 1k+-line hooks that are hard to test, and edge functions where small changes redeploy large surface area.

## Approach

Sequence the work in phases so each phase is a single PR a fresh session can pick up cold. Each phase spec is self-contained, lists exact files, names the seams, and defines acceptance criteria. Phases are ordered by leverage (foundations early) and risk (highest-churn screens late).

## Phase index

| Phase | Spec | Scope | Estimated PR size |
|---|---|---|---|
| 0 | [Style engine variety](./2026-05-16-burs-modularization-phase-0-style-engine-variety-design.md) | Stop returning identical outfits; add recency-aware scoring + cache-bust signal | Small |
| 1 | [State foundations](./2026-05-16-burs-modularization-phase-1-state-foundations-design.md) | `AuthContext`, `offlineQueue`, `garmentSave` splits | Medium |
| 2 | [Stylist hooks](./2026-05-16-burs-modularization-phase-2-stylist-hooks-design.md) | `useStyleChat`, `useWeekGenerator`, `usePhotoFeedback` splits | Medium-Large |
| 3 | [Screen splits](./2026-05-16-burs-modularization-phase-3-screen-splits-design.md) | `GarmentDetail`, `OutfitGenerate`, `StyleMe`, `VisualSearch` | Medium |
| 4 | [Types & batch pipeline](./2026-05-16-burs-modularization-phase-4-types-and-batch-design.md) | `styleProfileV4` barrel, `batchPipeline` state-machine split | Small-Medium |
| 5 | [Edge function extractions](./2026-05-16-burs-modularization-phase-5-edge-functions-design.md) | `revenuecat_webhook`, `render_garment_image`, `burs_style_engine` shared modules | Medium |
| 6 | [AddPiece splits](./2026-05-16-burs-modularization-phase-6-addpiece-design.md) | `AddPieceStep3`, possibly `EditGarmentScreen` | Medium-Large |

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
- Keep lint clean: `npx eslint "mobile/src/**/*.{ts,tsx}" --max-warnings 0`.
- For edge function phases (5): run Deno tests in each function dir and document redeploy list in the PR.
- Touch `mobile/CLAUDE.md` only when a module rename changes a documented entry point.

## Decisions log

- **2026-05-16** — Wave R is complete and deployed; Phase 6 (AddPiece) is unblocked but stays last because AddPieceStep3 is the most complex screen.
- **2026-05-16** — Specs live under `docs/superpowers/specs/` (default per brainstorming skill). No project override.
- **2026-05-16** — One spec per phase, executed sequentially in separate sessions.
