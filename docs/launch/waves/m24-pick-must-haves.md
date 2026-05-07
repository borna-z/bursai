# M24 — Pick Must-Haves → WardrobeGaps follow-up

| Field | Value |
|---|---|
| Goal | After gap analysis runs, surface a "Pick your must-haves" follow-up that converts gaps into a prioritized purchase shortlist. |
| Status | DONE (PR #750) |
| Branch | `mobile-m24-pick-must-haves` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | S |

## Background

Web `PickMustHaves.tsx` page accepts gap-analysis output and lets users mark which gaps they want to actually purchase, persisting the shortlist. Mobile already has WardrobeGapsScreen; add a "Save as shopping list" follow-up step.

## Files touched

### New
- `mobile/src/hooks/usePickMustHaves.ts` — local state + a small `must_haves` table write (or persisted as `profiles.preferences.shopping_list_jsonb` to avoid a new table — confirm with user before adding a table).
- `mobile/src/screens/PickMustHavesScreen.tsx` — gap rows with checkboxes + priority slider + "Save list" CTA.

### Modified
- `mobile/src/screens/WardrobeGapsScreen.tsx` — "Pick must-haves" CTA below the gap list → navigate to PickMustHaves.
- `mobile/src/screens/ProfileScreen.tsx` (or Settings) — surface saved list count under "Shopping list" row.

## Pattern reference

Web reference; storage shape decided when the wave is picked up. Default to JSONB-on-profiles unless a real table is justified.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: run gap analysis → tap "Pick must-haves" → check 3 gaps → save → reopen → confirm shortlist persists
- Code-reviewer: approved

## Deploy

None (unless a new table is added — then run `db push`).

## PR template

Title: `feat(mobile): M24 — Pick must-haves follow-up`
