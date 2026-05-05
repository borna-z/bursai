# M29 — Style DNA + wardrobe stats

| Field | Value |
|---|---|
| Goal | Replace 6 hardcoded ProfileScreen / Settings surfaces with real Style DNA + wardrobe stats; add ProfileScreen pull-to-refresh. |
| Status | TODO |
| Branch | `mobile-m29-style-dna` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | M |

## Background

Web has `useStyleDNA` (computes archetype + formality + color signature from feedback signals + style profile) and `useWardrobeStats` (3 HEAD count queries: garments / outfits / wear-logs). Mobile currently shows constant placeholder values for both.

## Files touched

### New
- `mobile/src/hooks/useStyleDNA.ts` — port; reads from `user_style_summaries` (M10's `memory_ingest` builds these) + falls back to a runtime classifier on style_profile_v4.
- `mobile/src/hooks/useWardrobeStats.ts` — three HEAD count queries.

### Modified
- `mobile/src/screens/ProfileScreen.tsx` — wire StyleDNA card + WardrobeStats row + add `RefreshControl` for pull-to-refresh.
- `mobile/src/screens/SettingsScreen.tsx` — wardrobe-count badge in the header.
- `mobile/src/screens/SettingsStyleScreen.tsx` — show StyleDNA preview row (full editor in M38).

## Pattern reference

Web hook lifts; mobile uses M3's `useGarmentCount` already if it shipped, otherwise the HEAD pattern direct.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: open Profile → confirm Style DNA archetype + 3 stats reflect real data; pull to refresh → numbers update
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M29 — Style DNA + wardrobe stats`
