# M46 — Trial start offline-queue retry

| Field | Value |
|---|---|
| Goal | Wrap `callStartTrial` in the existing offline-queue retry pattern so a momentary Supabase outage during sign-up doesn't leave a paying user without their trial. |
| Status | IN PR #876 (stacked on M45 PR #875) — created from Day 0 audit 2026-05-17 (Copilot escalation #2, Medium severity) |
| Branch | `mobile-m46-trial-offline` |
| PR count | 1 |
| Depends on | nothing |
| Complexity | S |

## Background

Copilot's review of `AuthContext.tsx` flagged:

> ⚠️ **Trial call fire-and-forget**: `callStartTrial()` has no retry or error recovery — if Supabase is momentarily unavailable, trial never starts. Should be queued or retried via offline queue.

The offline-queue pattern is well-established in `useAddGarment` via `persistGarmentWithOfflineFallback`. This wave mirrors that pattern for the trial-start call.

The risk is asymmetric: a user signs up, the call silently fails, they pay later expecting a trial discount that was never recorded. This is reputation + support cost, not a launch blocker by Copilot's rating (Medium), but treated as must-ship in the audit because it touches paid-conversion reliability.

## Files touched

### Modified

- `mobile/src/contexts/AuthContext.tsx` — replace fire-and-forget `void callStartTrial()` with the offline-queue wrapper.
- Possibly: `mobile/src/lib/offlineQueue.ts` — add a new job kind `'start_trial'` if the queue is kind-scoped (verify by reading the file first).

### New

- None expected. The pattern reuses existing infrastructure.

## Code skeletons

### AuthContext.tsx — replace fire-and-forget call

Find the current `callStartTrial` invocation. It looks something like:

```ts
// BEFORE — fire-and-forget
void callStartTrial(userId).catch((err) => {
  // swallows error; trial never starts on failure
});
```

Replace with:

```ts
// AFTER — offline-queue wrap, mirrors useAddGarment pattern
await enqueueStartTrial(userId, {
  onPermanentFailure: (err) => captureMutationError('startTrial')(err),
});
```

Where `enqueueStartTrial` lives in `mobile/src/lib/offlineQueue.ts` (add if not present) and:
- Tries the call immediately.
- On network error: persists to the offline queue, retries on connectivity restore.
- On 4xx (non-network): captures to Sentry, surfaces user-facing toast via existing offline-banner mechanism.
- Marks the trial as `pending_trial` in local state until the call succeeds, so the paywall doesn't show "you have no trial" in the brief gap before sync.

### offlineQueue.ts — extend if needed

```ts
type QueueJob =
  | { kind: 'add_garment'; ... }
  | { kind: 'start_trial'; userId: string }
  | ...;

export async function enqueueStartTrial(
  userId: string,
  opts: { onPermanentFailure?: (err: unknown) => void } = {}
): Promise<void> {
  try {
    await callStartTrial(userId);
  } catch (err) {
    if (isTransientError(err)) {
      await persistToQueue({ kind: 'start_trial', userId });
      throw new OfflineQueuedError('start_trial');
    }
    opts.onPermanentFailure?.(err);
    throw err;
  }
}
```

Read the existing `offlineQueue.ts` before writing — match the helper names and the persist/replay shape exactly.

## Acceptance gates

- `cd mobile && npx tsc --noEmit` → 0 errors
- `cd mobile && npx eslint "src/**/*.{ts,tsx}" --max-warnings 0` → 0 warnings
- Jest: add a smoke test asserting `enqueueStartTrial` enqueues on network error and is replayed on next online sweep.
- Manual on iOS dev build:
  - Sign up while airplane-mode is ON → trial shows as pending; banner indicates queued action.
  - Restore connectivity → trial activates within ~5s; banner clears.
  - Sign up while online → trial activates immediately; no banner.

## PR template

Title: `fix(mobile): M46 — trial-start offline-queue retry`

Body:
```
## Wave
M46 — Trial-start offline-queue retry (`docs/launch/waves/m46-trial-start-offline.md`)

## Problem
`callStartTrial` was fire-and-forget. A momentary Supabase outage during sign-up leaves the user without their trial entitlement. Reported by Copilot as Medium severity; escalated to launch must-ship in Day 0 audit.

## Fix
- New `enqueueStartTrial` helper in `lib/offlineQueue.ts` mirroring the `useAddGarment` offline pattern.
- `AuthContext.tsx` replaces `void callStartTrial(...)` with the new enqueue wrapper.
- Smoke test added for the enqueue + replay cycle.

## Verification
- TypeScript: 0 errors
- Lint: 0 warnings
- Jest smoke: passing
- Code-reviewer subagent: approved
- Manual airplane-mode test: trial queued → activates on reconnect

## Out of scope
- Other AuthContext defensive-only fixes (Copilot #4) — post-launch
```

## Tracker updates (same PR)

1. `docs/launch/may-2026-sprint/00-overview.md` — flip M46 status to DONE.
2. `docs/launch/mobile-launch-overview.md` — append M46 row.
3. `docs/launch/completion-log.md` — append M46 row.
4. `docs/launch/findings-log.md` — close Copilot escalation #2.
