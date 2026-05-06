# M1 — Render polling

| Field | Value |
|---|---|
| Goal | Wire `useRenderJobStatus` so Studio renders flip the displayed image from raw → rendered without a manual refresh. |
| Status | DONE (PR #728) |
| Branch | `mobile-m1-render-polling` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | S |

## Background

Add-garment PR 1 fires `enqueue_render_job` after a Studio choice and leaves the garment at `render_status='pending'`. The mobile app currently shows the raw upload until the user pulls to refresh. Web has `useRenderJobStatus` polling `render_jobs` and swapping to `rendered_image_path` on success — port it.

## Files touched

### New
- `mobile/src/hooks/useRenderJobStatus.ts` — port from `src/hooks/useRenderJobStatus.ts`. Polls `render_jobs` for `garment_id` until `status ∈ {succeeded, failed}`. On any terminal status, invalidates `['garments']` and `['garment', user.id, garmentId]` so the cached row picks up the worker's `render_status` flip. No local timeout (an earlier 90 s budget was removed in the Codex loop — it stranded late-completing renders on the original photo).

### Modified
- `mobile/src/screens/GarmentDetailScreen.tsx` — call `useRenderJobStatus` while `garment.render_status === 'pending' | 'rendering'`; replace the static "Studio" pill with a three-state pill (Studio render… / Studio / hidden). Hero swaps to `rendered_image_path` automatically once the cache invalidate triggers `useGarment` to refetch.
- `mobile/src/navigation/RootNavigator.tsx` — swap the `GarmentDetail` route from `Placeholders.GarmentDetail` to the real `GarmentDetailScreen`. Without this the polling hook never mounts and the wave's acceptance criteria can't be observed. (Codex P1 round 5 on PR #728 — surfaced the broader fact that every "real" screen under `mobile/src/screens/` stays registered as a placeholder pending the systematic screen-mount pass; this PR mounts only the screen M1 actually depends on.)
- `mobile/App.tsx` — add `QueryClientProvider` (wrapping `AuthProvider`, since `AuthContext` calls `useQueryClient()` on sign-out) and `AuthProvider`. The placeholder GarmentDetail route didn't need either; the real `GarmentDetailScreen` consumes `useAuth` + multiple `useQuery` hooks and would crash without these providers at the root. (Codex P1 round 7 on PR #728.)

### Unchanged (originally listed; verified out of scope)
- `mobile/src/screens/AddPieceStep3.tsx` — save success calls `nav.reset` to `GarmentDetail` synchronously, so any pill on Step 3 unmounts before the first poll could land. The polling lives on `GarmentDetailScreen` (its destination) rather than the step the user just left.
- `mobile/src/components/GarmentCard.tsx` — already reads `rendered_image_path ?? original_image_path` (W2). The hook's `['garments']` invalidate triggers list refetch; the card picks up the new path with no code change.

### Tracker
- Flip M1 → DONE in `overview.md`; CURRENT WAVE → M2; append `completion-log.md`.

## Pattern reference

Web hook lifts cleanly. Mobile diffs:
- Use React Query `useQuery` with `refetchInterval` instead of `setInterval`.
- `enabled: !!garmentId && !isTerminal` so the query stops itself.
- Invalidate `['garments', user?.id]` and `['garment', garmentId]` on terminal success.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: add a garment via Studio, observe pending pill, watch image swap on render success, confirm GarmentDetail shows rendered image
- Code-reviewer: approved

## Deploy

None. Mobile-only. `enqueue_render_job` and `render_garment_image` are already deployed from prior waves.

## PR template

Title: `feat(mobile): M1 — render polling + image swap`

Body uses the standard template in `overview.md`. PR mentions: hook port, three call sites, no edge function changes.
