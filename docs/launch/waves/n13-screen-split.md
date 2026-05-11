# N13 — Oversized screen split (N7 follow-up)

| Field | Value |
|---|---|
| Goal | Same shape as N7 (which split 5 hooks >500 LOC into focused modules). Split the top 6 screens >1000 LOC into focused sibling modules. Behaviour unchanged. |
| Status | TODO |
| Branch | `mobile-n13-screen-split` |
| PR count | 1 |
| Depends on | N7 |
| Complexity | L |

## Background

The 2026-05-10 audit identified six screens >1000 LOC. These are 2-3× the post-N7 module-size target and dominate the file-size distribution in `mobile/src/`. Splitting follows the N7 methodology exactly: extract pure helpers and child sections into sibling modules, keep public exports identical, add a unit test for each extracted helper module.

## Targets (current LOC → target main LOC)

| Screen | Current | Target main | Notes on extraction |
|---|---|---|---|
| `OutfitDetailScreen.tsx` | 1790 | ≤700 | Extract: slot edit sheet, accessory suggestion section, combination suggestion section, flatlay section, clone-DNA section. Each becomes a `OutfitDetail.<feature>.tsx`. |
| `StyleQuizV4Step.tsx` | 1586 | ≤600 | Extract: per-step renderers (palette, occasion, formality, body) into `StyleQuizV4.<step>.tsx` siblings. Keep the orchestrator. |
| `StyleChatScreen.tsx` | 1165 | ≤600 | Extract: message list, composer, mode toggle, history sheet integration. Mirrors the existing `useStyleChat.ts` / `.helpers.ts` / `.stream.ts` split shipped in N7. |
| `SettingsStyleScreen.tsx` | 1121 | ≤500 | Extract: per-section editors (the 8 sections from M38) into `SettingsStyle.<section>.tsx`. |
| `TravelCapsuleScreen.tsx` | 1081 | ≤500 | Extract: garment picker, weather row, capsule preview into `TravelCapsule.<feature>.tsx`. |
| `HomeScreen.tsx` | 1024 | ≤500 | Extract: hero card, recent outfits row, day intelligence card, milestone card into `Home.<feature>.tsx`. |

## Files touched

### New (sibling modules — one per extracted section)
Approximate count: 20-25 new sibling files. Each screen contributes 3-5 children.

### Modified
- The six screens above — reduced to orchestrator role.
- `mobile/src/__mocks__/` — extend if needed (no expected churn).

### Tests
- One unit test per extracted pure-helper module (mirrors N7 — `__tests__/<screen>.<feature>.test.tsx`).

## Method

For each screen, follow the N7 procedure verbatim:

1. Identify pure helpers first (functions with no React hooks). Move to `<screen>.helpers.ts`. Add a smoke test exercising the extracted helpers.
2. Identify self-contained sections (a `<View>` subtree consuming a stable subset of state). Move to `<screen>.<feature>.tsx` and import as a child.
3. Public export shape stays identical: `export default function <ScreenName>()`.
4. TanStack query keys, Sentry breadcrumb tags, SQL — unchanged.
5. After each split, run gates locally.

## Anti-patterns

- Don't create a new state library or context just to pass props down. Prop drilling for the extracted sections is fine.
- Don't change behavior or copy. Pure refactor.
- Don't introduce new design primitives — reuse `Eyebrow`, `PageTitle`, `Caption`, `Button`, `IconBtn`, `Chip`, `Card`, `SettingsRow`, `ListRow`, `BottomNav`, `OutfitCard`, `GarmentCard` as before.

## Acceptance gates

- TypeScript: 0 errors
- Lint: 0 warnings under `"src/**/*.{ts,tsx}"` glob
- expo-doctor: passes
- Bundle export: under bundle-size threshold
- All 6 target screens drop below their LOC ceiling
- Snapshot/manual: each screen renders identically pre- and post-split (manual sweep on simulator)
- Each new helper module has at least one unit test
- Code-reviewer: approved
- Codex review loop: ≥1 positive signal

## Deploy

None. No migrations, no edge function changes.

## PR template

Title: `refactor(mobile): N13 — split 6 oversized screens into focused modules`

Body modeled on N7 PR (#813): bullet per split, current → target LOC delta, list of new sibling files.

## Risk notes

- Largest of the three audit-followup PRs. Expect a long Codex loop. Budget accordingly.
- Watch for hidden coupling — a child section using `useStateInParent`-style closures will fail at extraction time. Lift state up before splitting.
- Snapshot each screen pre-split for visual regression spotting.
