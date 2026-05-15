# Phase 3 — Screen splits

**Roadmap:** [Modularization roadmap](./2026-05-16-burs-modularization-roadmap.md)
**Previous phase:** [Phase 2 — Stylist hooks](./2026-05-16-burs-modularization-phase-2-stylist-hooks-design.md)
**Next phase:** [Phase 4 — Types & batch pipeline](./2026-05-16-burs-modularization-phase-4-types-and-batch-design.md)
**Suggested branch:** `refactor/screen-splits`

## Problem

Four screens have grown into UI-state-management hybrids that mix multiple UI surfaces in a single file:

- `screens/GarmentDetailScreen.tsx` (1163 lines) — 3 tabs + action sheet + condition assessment + render status.
- `screens/OutfitGenerateScreen.tsx` (907 lines) — animated loading state + result grid + save + retry flow.
- `screens/StyleMeScreen.tsx` (811 lines) — weather modal + occasion/formality chips + anchor picker + generation + result card.
- `screens/VisualSearchScreen.tsx` (749 lines) — picker + mutation + web-match results grid + paywall gate.

Out of scope (well-factored despite size): `StyleChatScreen`, `PaywallScreen`, `PhotoFeedbackScreen`, `LiveScanScreen`.

## Goal

Each screen becomes a thin orchestrator that composes named sub-components. Sub-components are reusable where the seam is natural (`OutfitGenerateLoading`, `StyleMeResultCard`), and otherwise live as private siblings in the same directory.

## Approach

For each screen, the orchestrator keeps:
- Route/navigation handling
- Top-level data fetching
- Composition of sub-components

Sub-components own their own UI state, animations, and event handlers.

## Scope

### `GarmentDetailScreen`

- `GarmentDetailScreen.tsx` — orchestrator: data fetch + tab selector state + composition.
- `GarmentDetail/GarmentDetailTabs.tsx` *(new)* — tab content branching (Info / Outfits / Similar). Each tab can have its own internal sub-components if useful.
- `GarmentDetail/GarmentActionSheet.tsx` *(new)* — mark-worn / mark-laundry / delete / edit-navigate mutations.

Target orchestrator size: < 500 lines.

### `OutfitGenerateScreen`

- `OutfitGenerateScreen.tsx` — orchestrator: hook + result state + save/try-again handlers.
- `OutfitGenerate/OutfitGenerateLoading.tsx` *(new)* — `Animated` progress bar + `LOADING_MESSAGES` rotation. Self-contained.

Target orchestrator size: < 450 lines.

### `StyleMeScreen`

- `StyleMeScreen.tsx` — orchestrator: occasion/formality chips + anchor picker + generation kickoff + result composition.
- `StyleMe/StyleMeWeatherSheet.tsx` *(new)* — modal for weather toggle + manual entry. Owns its own animated state.
- `StyleMe/StyleMeResultCard.tsx` *(new)* — outfit card with Preview / Saved / Error branches, save + restyle buttons. Reusable from other screens later if shapes match.

Target orchestrator size: < 450 lines.

### `VisualSearchScreen`

- `VisualSearchScreen.tsx` — orchestrator: picker + mutation + paywall gating.
- `VisualSearch/VisualSearchResults.tsx` *(new)* — web-match results grid + link routing.

Target orchestrator size: < 500 lines.

### Out of scope

- Restyling, theme changes, or copy edits.
- Replacing `Animated` with `Reanimated`.
- Adding new behavior (e.g., a new tab in `GarmentDetail`).

## Files touched

| Path | Change |
|---|---|
| `mobile/src/screens/GarmentDetailScreen.tsx` | Slim orchestrator. |
| `mobile/src/screens/GarmentDetail/GarmentDetailTabs.tsx` *(new)* | Tab content. |
| `mobile/src/screens/GarmentDetail/GarmentActionSheet.tsx` *(new)* | Action sheet. |
| `mobile/src/screens/OutfitGenerateScreen.tsx` | Slim orchestrator. |
| `mobile/src/screens/OutfitGenerate/OutfitGenerateLoading.tsx` *(new)* | Loading animation. |
| `mobile/src/screens/StyleMeScreen.tsx` | Slim orchestrator. |
| `mobile/src/screens/StyleMe/StyleMeWeatherSheet.tsx` *(new)* | Weather modal. |
| `mobile/src/screens/StyleMe/StyleMeResultCard.tsx` *(new)* | Result card. |
| `mobile/src/screens/VisualSearchScreen.tsx` | Slim orchestrator. |
| `mobile/src/screens/VisualSearch/VisualSearchResults.tsx` *(new)* | Results grid. |
| `mobile/src/screens/__tests__/*` | Update existing tests if any; add render test for each new sub-component (snapshot or minimal). |

## Acceptance criteria

- Each orchestrator screen file < 500 lines.
- Each new sub-component is renderable in isolation in a test (smoke render with default props).
- No visual diff: side-by-side comparison of each screen before/after on a device shows pixel-equivalent layout.
- All navigation paths still work: tab switching in GarmentDetail, modal open/close in StyleMe weather sheet, retry in OutfitGenerate, paywall gate in VisualSearch.
- Lint clean, all existing tests pass.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Modal state lives in orchestrator and sub-component disagree on open/closed | Lift modal state to orchestrator; pass `isOpen` + `onClose` props down. Document this pattern in the new files. |
| Animated values become stale when extracted | Initialize `Animated.Value` inside the sub-component (its own ref). Don't pass `Animated.Value` across the boundary. |
| Translation strings get re-resolved at the wrong scope | Keep `useTranslation()` in the same component that renders the string. Don't pre-resolve in the orchestrator. |

## Verification before completion

```bash
npm test --prefix mobile
npm run lint --prefix mobile
# Manual on device:
#   - Open garment detail → switch tabs → tap action sheet → close.
#   - Tap Generate on Style Me → result renders → tap regenerate.
#   - Tap Generate Outfit → loading animation → result.
#   - Visual search → upload → paywall → results.
```

## When picking this up cold

1. Read each of the four screen files end-to-end.
2. Identify top-level JSX blocks (often a `<View>` with a single role each — header, tabs, modal, action sheet).
3. Note any state that is local to one block — that state should move with the block.
4. Note any state shared across blocks — that state stays in the orchestrator.
5. Plan one screen at a time; commit each split as its own commit within the PR so review can be staged.
