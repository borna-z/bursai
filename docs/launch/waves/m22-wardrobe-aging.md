# M22 — Wardrobe Aging → Insights

| Field | Value |
|---|---|
| Goal | Surface `wardrobe_aging` analysis as a panel on InsightsScreen — what's getting too old, what's never worn, what to retire. |
| Status | TODO |
| Branch | `mobile-m22-wardrobe-aging` |
| PR count | 1 |
| Depends on | V0, M9 |
| Complexity | S |

## Background

Edge function `wardrobe_aging` deployed. Inputs: user's garments + wear logs. Output: aged / unworn / retire-candidate buckets with rationale.

## Files touched

### New
- `mobile/src/hooks/useWardrobeAging.ts` — POST → returns the three buckets.
- `mobile/src/components/WardrobeAgingPanel.tsx` — three-row preview, tap a row → list of garments in that bucket.

### Modified
- `mobile/src/screens/InsightsScreen.tsx` — add WardrobeAgingPanel section.
- `mobile/src/screens/UnusedOutfitsScreen.tsx` (or new UnusedGarmentsScreen) — render the bucket detail when a row is tapped.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: open Insights → confirm panel renders with bucket counts; tap a bucket → confirm list opens with relevant garments
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M22 — wardrobe aging panel`
