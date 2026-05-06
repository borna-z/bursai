# Mobile Launch — M0 — Sentry foundations + onError sweep

**Goal:** Initialize Sentry for the mobile app and add `onError` reporting to every existing mutation hook so future waves ship with error telemetry from day one.

**Status:** 🔄 TODO
**Branch:** `mobile-w0-sentry` (cut from `main` — policy update 2026-05-06)
**PR count:** 1
**Depends on:** none (this unlocks every later wave)
**Complexity:** S

---

## Why first

Every later wave adds new error surfaces — new mutations, new edge function calls, new screens. Without Sentry initialized, those errors land in component state and disappear. Two hours of work that retroactively makes every M1–M12 PR observable.

---

## Files touched

**New:**
- `mobile/src/lib/sentry.ts`

**Modified:**
- `mobile/App.tsx` — top-of-file Sentry init, wrap default export
- `mobile/package.json` — add `@sentry/react-native`
- `mobile/.env.example` — add `EXPO_PUBLIC_SENTRY_DSN`
- `mobile/app.json` — add `@sentry/react-native/expo` to plugins array
- Every existing mutation hook in `mobile/src/hooks/`:
  - `useAddGarment.ts`
  - `useAnalyzeGarment.ts`
  - `useGenerateOutfit.ts`
  - `useMoodOutfit.ts`
  - `useStyleChat.ts`
  - `useWardrobeGaps.ts`
  - Any other file matching `useMutation` (verify with `Grep "useMutation" mobile/src/hooks` first)

**Tracker (same PR):**
- `docs/launch/mobile-launch-overview.md` — flip M0 row + advance pointer to M1
- `docs/launch/completion-log.md` — append row
- `CLAUDE.md` (root) — update CURRENT WAVE pointer to M1

---

## Code skeletons

### 1. `mobile/src/lib/sentry.ts` (new)

```ts
// Sentry init for React Native via Expo. Called once from App.tsx, before any
// React tree mounts. DSN comes from EXPO_PUBLIC_SENTRY_DSN; absent in dev,
// present in EAS production builds via eas.json secrets. Sample rate 0.2
// matches web (src/main.tsx).

import * as Sentry from '@sentry/react-native';

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    if (__DEV__) console.log('[sentry] no DSN — skipping init');
    return;
  }
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
    debug: __DEV__,
    enableNative: !__DEV__, // skip native bridge inside Expo Go (only EAS dev/prod builds bundle native)
  });
  initialized = true;
}

/**
 * onError handler for every useMutation in mobile/. Tags the captured error
 * with the mutation scope so we can filter in Sentry by `mutation:<name>`.
 *
 * Pattern: `onError: captureMutationError('useAddGarment')`.
 */
export function captureMutationError(scope: string) {
  return (error: unknown) => {
    if (!initialized) return;
    Sentry.withScope((s) => {
      s.setTag('mutation', scope);
      Sentry.captureException(error);
    });
  };
}

export { Sentry };
```

### 2. `mobile/App.tsx` modifications

Add at the **very top** of the file (before any other imports that might throw):

```ts
import { initSentry, Sentry } from './src/lib/sentry';
initSentry();
```

Change the default export at the bottom of the file from:
```ts
export default App;
```
to:
```ts
export default Sentry.wrap(App);
```

(`Sentry.wrap` is a no-op when Sentry isn't initialized, so dev-without-DSN behavior is preserved.)

### 3. `mobile/package.json`

Add to `dependencies`:
```json
"@sentry/react-native": "~6.0.0"
```

After the wave file is committed and pushed, the user runs `cd mobile && npm install`. Do not run install in the agent session — let the user pick it up to avoid lockfile churn.

### 4. `mobile/.env.example`

Append:
```
EXPO_PUBLIC_SENTRY_DSN=
```

### 5. `mobile/app.json` plugins array

Update the `plugins` field:
```json
"plugins": [
  "expo-font",
  "expo-localization",
  ["@sentry/react-native/expo", {
    "organization": "burs",
    "project": "burs-mobile"
  }]
]
```

(Sentry's Expo plugin handles the native iOS/Android side at EAS Build time; Expo Go ignores it.)

### 6. Mutation hook diffs — pattern to apply to every file

Each existing hook gets two changes:

a) Add the import:
```ts
import { captureMutationError } from '../lib/sentry';
```

b) Add `onError` to the `useMutation` config — preserve any existing `onError` callback by composing both:

If the hook has no existing `onError`:
```ts
return useMutation({
  mutationFn: async (params) => { /* unchanged */ },
  onSuccess: () => { /* unchanged */ },
  onError: captureMutationError('<scope>'),
});
```

If it has an existing `onError`:
```ts
const reportError = captureMutationError('<scope>');
return useMutation({
  mutationFn: async (params) => { /* unchanged */ },
  onSuccess: () => { /* unchanged */ },
  onError: (err, vars, ctx) => {
    reportError(err);
    // existing onError body here
  },
});
```

The `<scope>` string is the hook's name (e.g. `'useAddGarment'`).

For non-mutation hooks (queries — `useQuery`/`useInfiniteQuery`), Sentry captures via the global error boundary; no per-hook change needed.

### 7. (If `useStyleChat.ts` has manual try/catch around streaming)

`StyleChatScreen` uses SSE streaming via `mobile/src/lib/sse.ts`. If the existing `useStyleChat` hook catches errors and stuffs them into `useState` instead of using `useMutation`, replace the silent catch with:
```ts
} catch (err) {
  Sentry.captureException(err);
  setError(err instanceof Error ? err.message : 'Stream failed');
}
```
Read `useStyleChat.ts` first to confirm the exact shape; the master plan (`docs/launch/mobile-launch-fix-plan-2026-05-31.md` § P1.0) has the verbatim diff if needed.

---

## Acceptance gates

```bash
cd mobile && npx tsc --noEmit
```
Expected: `0 errors`.

**Manual smoke test (post-merge, on a dev build with `EXPO_PUBLIC_SENTRY_DSN` set in `.env`):**
1. Force a throw inside any `mutationFn` (e.g. add `if (Math.random() < 0.5) throw new Error('sentry-test')` to `useAddGarment` temporarily — revert before merge).
2. Trigger the mutation from the UI.
3. Within 30s the error appears in Sentry dashboard tagged `mutation:useAddGarment`.
4. Revert the test throw.

**Grep verification:**
```bash
grep -rL "captureMutationError\|onError" mobile/src/hooks/*.ts | grep -v __tests__
```
Output should be empty (every hook either has captureMutationError or is a pure query that doesn't need it).

**Code-reviewer subagent:** see `mobile/CLAUDE.md` for the verbatim brief. Required before push.

---

## PR template

**Title:** `feat(mobile): M0 — Sentry init + onError sweep across mutations`

**Body:**
```
## Wave
M0 — Sentry foundations + onError sweep (`docs/launch/mobile-w0-sentry.md`)

## Problem
No remote error telemetry on mobile. Mutations swallow errors into local
component state. Every later launch wave would ship blind.

## Fix
- Init `@sentry/react-native` from a new `mobile/src/lib/sentry.ts` helper
- Wrap App default export in `Sentry.wrap` for global crash capture
- Add `captureMutationError(scope)` to every existing mutation hook in
  `mobile/src/hooks/`
- Wire Sentry's Expo plugin in `app.json` so EAS Build links the native SDK
- Add `EXPO_PUBLIC_SENTRY_DSN` to `.env.example`

## Files touched
- New: mobile/src/lib/sentry.ts
- Modified: mobile/App.tsx, mobile/package.json, mobile/app.json, mobile/.env.example
- Modified: mobile/src/hooks/{useAddGarment,useAnalyzeGarment,useGenerateOutfit,useMoodOutfit,useStyleChat,useWardrobeGaps}.ts (and any other useMutation found via grep)

## Verification
- TypeScript: 0 errors
- Code-reviewer subagent: approved
- Manual smoke test deferred to post-merge (requires DSN in EAS secrets)

## External setup checklist (parallel — does not block merge)
- [ ] User creates Sentry project `burs-mobile` and copies DSN into EAS secrets
- [ ] DSN added to local `mobile/.env` for dev verification

## Out of scope
- Source-map upload to Sentry (deferred to M13 TestFlight wave when EAS Build is configured)
- Sentry Performance tracing on screen transitions (post-launch v1.0.1)
```

---

## Tracker updates (in this PR)

1. In `docs/launch/mobile-launch-overview.md`:
   - Flip M0 row's Status from `🔄 TODO` to `[DONE] (PR #<N>, 2026-05-XX)`
   - Update CURRENT WAVE pointer block to `M1 — Destructive mutations`
   - Update LAST UPDATED to today

2. In `docs/launch/completion-log.md`:
   - Append: `| 2026-05-XX | M0 | feat(mobile): Sentry init + onError sweep | PR #<N> |`

3. In `CLAUDE.md` (root):
   - Update `CURRENT WAVE` line to `Mobile Launch M1 — Destructive mutations`
   - Update `CURRENT WAVE FILE` to `docs/launch/mobile-w1-destructive-mutations.md`

PR-number placeholder: amend the same commit immediately after `gh pr create`, then `git push --force-with-lease`.
