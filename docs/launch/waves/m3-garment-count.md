# M3 — useGarmentCount

| Field | Value |
|---|---|
| Goal | Port `useGarmentCount` so onboarding, paywall thresholds, and gap analyses can read a single canonical garment count without `select('*')`. |
| Status | DONE (PR #730) |
| Branch | `mobile-m3-garment-count` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | S |

## Background

Web uses `useGarmentCount()` (HEAD `count: 'exact'` query, cached) for onboarding gates ("you've added X / N garments"), gap-analysis prerequisites, and several paywall heuristics. Mobile currently calls `useGarments().data?.length`, which over-fetches. Provide a count-only hook.

## Files touched

### New
- `mobile/src/hooks/useGarmentCount.ts` — `useQuery({ queryKey: ['garments-count', user?.id], queryFn: () => supabase.from('garments').select('*', { count: 'exact', head: true }).eq('user_id', user.id), enabled: !!user })`.

### Modified call sites
- `mobile/src/screens/onboarding/StudioSelectionStep.tsx` (or wherever onboarding checks garment count)
- `mobile/src/screens/PaywallScreen.tsx` (if any free-tier threshold display exists)
- `mobile/src/screens/WardrobeGapsScreen.tsx` — gate gap analysis CTA on count >= 5

### Tracker
- Standard updates in `overview.md` + `completion-log.md`.

## Pattern reference

Trivial port. Use the standard query hook shape from `mobile/CLAUDE.md`.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: onboarding shows correct "X of N added"; gap-analysis CTA disabled below 5 garments
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M3 — useGarmentCount`
