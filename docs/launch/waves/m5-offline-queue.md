# M5 — Offline queue

| Field | Value |
|---|---|
| Goal | Persist save mutations through connectivity loss so an interrupted AddPiece save replays automatically when the network returns. |
| Status | DONE (PR #732) |
| Branch | `mobile-m5-offline-queue` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | M |

## Background

Web's `offlineQueue.ts` + `useOfflineQueue` push tagged actions to localStorage with a stable handler registry; on `online` events they replay in order. Mobile uses `@react-native-async-storage/async-storage` and `@react-native-community/netinfo`. The queue gates: AddPiece saves (M5–M8 chain), wear logs (M8 add-garment polish), feedback signals (M10 memory event queue).

## Files touched

### New
- `mobile/src/lib/offlineQueue.ts` — port from web. Handler registry keyed by action type (e.g. `'add-garment-save'`, `'wear-log'`, `'memory-event'`). Persistence via AsyncStorage. Replay on `NetInfo` connectivity restored.
- `mobile/src/hooks/useOfflineQueue.ts` — surface queue state (pending count, online flag) to UI.
- `mobile/src/components/OfflineBanner.tsx` — small banner pinned to header when offline + pending > 0.

### Modified
- `mobile/src/contexts/AuthContext.tsx` (or root provider) — register handlers + NetInfo subscription on mount; flush on sign-out.
- `mobile/src/hooks/useAddGarment.ts` — on network failure, push to queue with action `'add-garment-save'` + payload; show toast "Saved offline — will retry when back online."

## Pattern reference

Web `offlineQueue.ts` is the source. RN-specific:
- `AsyncStorage` is async; wrap reads in `useEffect` for hydration.
- `NetInfo.addEventListener('connectionChange', ...)` replaces `window.addEventListener('online', ...)`.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: airplane mode → save garment → confirm queued + banner; turn airplane mode off → confirm replay → confirm garment lands in wardrobe
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M5 — offline queue + AddPiece replay`
