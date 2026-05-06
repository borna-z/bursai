# M10 — Memory event queue

| Field | Value |
|---|---|
| Goal | Wire `useFeedbackSignals` so save/wear/skip/swap actions persist to `memory_ingest` even across offline periods. |
| Status | DONE (PR #734) |
| Branch | `mobile-m10-memory-event-queue` |
| PR count | 1 |
| Depends on | V0, M5 (offline queue), M9 (edge fn client) |
| Complexity | M |

## Background

`memory_ingest` edge function shipped in Wave 8.5 PR A (#709). Web has `memoryEventQueue.ts` + `useFeedbackSignals` writing all save / wear / skip / swap / never_suggest events through it. Mobile has a thin `memoryIngest.ts` that fires-and-forgets; signals are silently dropped on connectivity loss.

## Files touched

### New
- `mobile/src/lib/memoryEvents.ts` — typed event creators: `saveOutfitEvent`, `wearOutfitEvent`, `skipOutfitEvent`, `swapGarmentEvent`, `neverSuggestGarmentEvent`, `quickReactionEvent`, `likePairEvent`, `dislikePairEvent`. Output shape matches `memory_ingest` body contract: `{ signal_type, ... }` (NOT `event_type` — that mismatch was the Wave 8.5 P0 caught in #712).
- `mobile/src/hooks/useFeedbackSignals.ts` — exposes `recordEvent(type, payload)` that pushes to the offline queue (M5) tagged `'memory-event'`. Queue handler calls `callEdgeFunction('memory_ingest', event, { retries: 0 })` (idempotency on the server side handles dupes).

### Modified
- `mobile/src/lib/memoryIngest.ts` — replace fire-and-forget with `recordEvent` from the new hook.
- `mobile/src/screens/OutfitsScreen.tsx`, `OutfitDetailScreen.tsx`, `OutfitGenerateScreen.tsx`, `MoodOutfitScreen.tsx`, `StyleMeScreen.tsx`, `UnusedOutfitsScreen.tsx` — every save / wear / skip CTA fires a typed event.
- `mobile/src/screens/GarmentDetailScreen.tsx` — never-suggest CTA fires `neverSuggestGarmentEvent`.

## Pattern reference

Web `memoryEventQueue.ts` + `useFeedbackSignals.ts`. The queue handler registration goes through M5's `offlineQueue` rather than a separate localStorage key.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Grep: every save / wear / skip / never-suggest CTA dispatches via `recordEvent` (no direct `supabase.from('feedback_signals').insert`)
- Manual: airplane mode → save outfit + wear outfit + never-suggest; restore network; confirm 3 rows in `feedback_signals` via Supabase Studio
- Code-reviewer: approved

## Deploy

None — `memory_ingest` already deployed.

## PR template

Title: `feat(mobile): M10 — memory event queue + feedback signals sweep`
