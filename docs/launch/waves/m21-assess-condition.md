# M21 — Assess condition → GarmentDetail

| Field | Value |
|---|---|
| Goal | Wire `assess_garment_condition` into GarmentDetail so users can run a wear/fit/repair check on any garment and store the result. |
| Status | TODO |
| Branch | `mobile-m21-assess-condition` |
| PR count | 1 |
| Depends on | V0, M9 |
| Complexity | S |

## Background

Edge function deployed. Output: `{ condition_score, wear_signals, repair_recommendations }`. Stored back on `garments.condition_assessment_jsonb`. Web has a ConditionBadge component; mobile reuses the design but in RN.

## Files touched

### New
- `mobile/src/hooks/useAssessCondition.ts` — POST `{ garment_id }`. Returns assessment, persists JSONB.
- `mobile/src/components/ConditionBadge.tsx` — pill showing score + 1-line summary.

### Modified
- `mobile/src/screens/GarmentDetailScreen.tsx` — "Check condition" CTA in the actions row; ConditionBadge under the title when assessment exists; tap → bottom sheet with full breakdown.

## Pattern reference

Standard edge-function call. UI re-uses `Chip` + `Caption` for the badge.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: open a garment → "Check condition" → confirm badge appears within ~10s with a numeric score
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M21 — assess garment condition`
