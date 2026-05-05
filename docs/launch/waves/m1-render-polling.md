# M1 — Render polling

| Field | Value |
|---|---|
| Goal | Wire `useRenderJobStatus` so Studio renders flip the displayed image from raw → rendered without a manual refresh. |
| Status | TODO |
| Branch | `mobile-m1-render-polling` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | S |

## Background

Add-garment PR 1 fires `enqueue_render_job` after a Studio choice and leaves the garment at `render_status='pending'`. The mobile app currently shows the raw upload until the user pulls to refresh. Web has `useRenderJobStatus` polling `render_jobs` and swapping to `rendered_image_path` on success — port it.

## Files touched

### New
- `mobile/src/hooks/useRenderJobStatus.ts` — port from `src/hooks/useRenderJobStatus.ts`. Polls `render_jobs` for `garment_id` until `status ∈ {success, failed}` or 90s timeout. On success, invalidates the relevant garment queries.

### Modified
- `mobile/src/screens/AddPieceStep3.tsx` — kick polling on save success; show a subtle "Studio render…" pill while pending, swap to the rendered image when ready.
- `mobile/src/screens/GarmentDetailScreen.tsx` — same hook, same swap.
- `mobile/src/components/GarmentCard.tsx` — read `rendered_image_path ?? image_path` so list views update post-render.

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
