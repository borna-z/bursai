# Mobile — RN app context

Patterns and conventions for `mobile/`. Read once per session.

## Stack

| Field | Value |
|---|---|
| Runtime | Expo SDK 54, React Native |
| Branch | `main` (all PRs target main; the prior `feat/mobile-rn-app` launch-branch policy was retired 2026-05-06) |
| Backend | Supabase project ref `khvkwojtlkcvxjxztduj` (shared with web) |
| State | TanStack React Query for server state; component-local `useState` for UI state |
| Navigation | React Navigation v7 native-stack; custom 4-tab `MainTabsScreen` |
| Theme | `src/theme/tokens.ts` + `useTokens()` from `src/theme/ThemeProvider.tsx` |
| Telemetry | `@sentry/react-native` (pinned 6.x; M0) |

## Build & run

```bash
cd mobile
npm run ios        # iOS Simulator (Xcode required)
npm run android    # Android emulator
npm start          # Expo dev server
```

Required env (`mobile/.env`, never committed):
```
EXPO_PUBLIC_SUPABASE_URL=https://khvkwojtlkcvxjxztduj.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>
EXPO_PUBLIC_SENTRY_DSN=<dsn>            # optional in dev, required in EAS builds
```

## Patterns

### Mutation hook shape

Every mutation hook mirrors `mobile/src/hooks/useAddGarment.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseUrl } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';

export function useThing() {
  const queryClient = useQueryClient();
  const { user, session } = useAuth();

  return useMutation({
    mutationFn: async (input) => {
      if (!user) throw new Error('Not authenticated');
      // supabase.from('table')... OR fetch via callEdgeFunction (M9+)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['x'] }),
    onError: captureMutationError('useThing'),
  });
}
```

For queries: `useQuery({ queryKey: ['x', user?.id], enabled: !!user, queryFn: ... })`.

### Edge function call pattern

Pre-M9 (raw fetch):
```ts
const res = await fetch(`${supabaseUrl}/functions/v1/<name>`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify(payload),
});
```

Post-M9: import `callEdgeFunction` from `../lib/edgeFunctionClient` — handles auth, retry, classification, AbortSignal, 402 paywall surfacing. Use it everywhere except SSE streams (which read the raw `Response`).

### Tokens

Always go through `useTokens()`. Never hardcode hex (`#FBF7EF`) inside a screen — call `t.card`. The accent is warm gold; no other brand colors. Borders + neutrals do everything else.

### Italic Playfair

Reserved for: page titles, large numerals, eyebrows on signature spots, statement copy. Not body.

### Eyebrows

Uppercase 10 px, 0.18em tracking, `fg2`. Above almost every section title.

### Bottom sheets / modals

React Native `Modal` + `Animated`, OR `@gorhom/bottom-sheet` if already in deps for that feature. Stay consistent within a single feature surface.

### Append-only locales

`mobile/src/i18n/locales/*.ts` — never reorganize existing keys. New strings append; agents trust prior keys exist.

## Things to know

- **Avatar feature deprecated 2026-04-21.** `avatars` bucket dropped. Don't wire avatar UI without checking with the user first.
- **Sentry pinned at `@sentry/react-native@6.x`.** `package.json` `expo.install.exclude` prevents expo-doctor from auto-bumping. Don't bump pre-launch.
- **Studio render flow.** `enqueue_render_job` is fire-and-forget; UI polls `render_jobs` via `useRenderJobStatus` (M1) and swaps in `rendered_image_path` on success.
- **LiveScan uses `react-native-vision-camera` + on-device ML** (MLKit on Android, Apple Vision on iOS) for auto-detect / auto-snap. Does NOT run in Expo Go — test on EAS dev build.
- **Web type imports allowed.** `import type { Database } from '../../../src/integrations/supabase/types'` is fine — type-only imports strip at build time. Runtime imports of web code are forbidden.
- **No new design primitives without checking.** Reuse `Eyebrow`, `PageTitle`, `Caption`, `Button`, `IconBtn`, `Chip`, `Card`, `SettingsRow`, `ListRow`, `BottomNav`, `OutfitCard`, `GarmentCard`.

## Per-wave gates (V0 CI runs them)

```bash
cd mobile && npx tsc --noEmit          # 0 errors
cd mobile && npx eslint "src/**/*.{ts,tsx}" --max-warnings 0   # NOT `src --ext .ts,.tsx`
cd mobile && npx expo-doctor           # passes
cd mobile && npx expo export -p ios -o /tmp/expo-export    # bundle size assertion
```

The eslint glob form matters — `--ext .ts,.tsx` and `"src/**/*.{ts,tsx}"` produce different warning sets, and CI uses the glob. Mismatching forms have bitten before (PR #775: local `--ext` form passed, CI glob caught `react-hooks/exhaustive-deps` warnings that `--max-warnings 0` upgraded to a failure).

For migrations: `npx supabase migration list --linked` clean + `npx supabase db push --linked --dry-run --yes`.
For edge function changes: `deno check supabase/functions/<name>/index.ts`.

## Module layout (post-Phases 1–6)

The modularization roadmap (2026-05-16) restructured several oversized files into barrel-organized sibling modules. Public import paths stayed stable so consumers didn't need touching — but knowing the internal layout matters when extending or debugging.

| Public import | Barrel directory | Internals |
|---|---|---|
| `import { useAuth } from '@/contexts/AuthContext'` | `contexts/AuthContext.tsx` (provider + listeners; < 250 lines) | Auth helpers extracted to `auth/`: `hydrateAuthFromStorage.ts` (storage hydration + `selectProfile` + `loadOrCreateProfile` + `isFreshSignup`), `deriveOnboardingStatus.ts`, `types.ts`. (The Phase 1 spec also listed `subscriptionTierFromProfile.ts` but that helper was never extracted; subscription tier is derived inside `useSubscription`.) Auth→queue replay effect: `hooks/useOfflineQueueReplay.ts`. |
| `import { enqueue, replay, ... } from '@/lib/offlineQueue'` | `lib/offlineQueue/index.ts` (barrel) | `persistence.ts` (AsyncStorage + byte/item caps + JSON shape), `dispatcher.ts` (FIFO + retry cap + HaltReplayError + single-flight `replayInFlight`), `subscriber.ts` (observer pattern), `connectivity.ts` (NetInfo + `isOnlineNow`). |
| `import { persistGarment, persistGarmentWithOfflineFallback } from '@/lib/garmentSave'` | `lib/garmentSave/index.ts` (barrel) | `persistGarmentRaw.ts` (pure insert), `persistGarmentWithMetadata.ts` (+ mask + enrichment trigger), `persistGarmentWithOfflineQueue.ts` (+ NetInfo gate), `renderEnqueueToast.ts` (opt-in toast helper that callers pass via `onRenderEnqueueFailure`). |
| `import { useStyleChat } from '@/hooks/useStyleChat'` | `hooks/useStyleChat.ts` (orchestrator) | `useStyleChatStreaming.ts` (SSE mechanics), `useStyleChatHistory.ts` (persisted-history fetch + parse), `useStyleChatUI.ts` (mode pills + chips + anchor + refine state machine), `useStyleChat.helpers.ts` + `useStyleChatTurn.helpers.ts` (pure builders). |
| `import { useWeekGenerator } from '@/hooks/useWeekGenerator'` | `hooks/useWeekGenerator.ts` (orchestrator) | `useWeekGenerationLoop.ts` (7-day loop + per-day error capture), `useWeatherAndContext.ts`. |
| `import { usePhotoFeedback } from '@/hooks/usePhotoFeedback'` | `hooks/usePhotoFeedback.ts` (orchestrator) | `useFeedbackFetch.ts` (edge-function call + error classification), `useFeedbackCleanup.ts` (selfie + temp blob sweep + tracking refs), `lib/feedbackNormalizer.ts`. |
| `import * as batch from '@/lib/batchPipeline'` | `lib/batchPipeline/index.ts` (barrel) | `BatchStateMachine.ts` (PURE — `createItems`, `selectStartCandidates`, `transitionTo*` helpers, `shouldNeedReview`), `BatchConcurrencyPool.ts` (I/O glue — resize + upload + analyze, calls helpers via `Object.assign(item, helperResult)` so identity is preserved), `BatchLifecycle.ts` (register/cleanup). Phase 4 audit (#867) wired the pool through the helpers so the state machine isn't dead code. |
| `import type { StyleProfileV4, ... } from '@/lib/styleProfileV4'` | `lib/styleProfileV4/index.ts` (barrel) | `types.ts`, `defaults.ts`, `validator.ts`, `compat.ts` (`migrateV4ToV3Compat` returns `V3MirroredProfile` — V4 with the enum fields swapped for V3-narrowed strings; the V3CompatShape index signature contributes loosely-typed mirror keys without overriding the narrowed enums). |
| `import { AddPieceStep3Form } from './AddPieceStep3/AddPieceStep3Form'` | `screens/AddPieceStep3.tsx` (orchestrator) | `AddPieceStep3/AddPieceStep3Form.tsx` (11 metadata pickers + reducer; accepts `hidePickers?: readonly HideablePickerKey[]` so EditGarmentScreen can hide `formality` behind its advanced toggle), `AddPieceStep3/AddPieceStep3SaveFlow.tsx` (save mutation + cleanup refs + batch handling), `AddPieceStep3/garmentMetadataForm.types.ts`. |

Phase 3 screen splits (`GarmentDetail`, `OutfitGenerate`, `StyleMe`, `VisualSearch`) follow the same pattern: orchestrator screen + sibling sub-components under a directory of the screen name. Section components are pure render with no fetch — orchestrator owns the queries.

## Code-reviewer subagent brief (verbatim — paste before push)

> Review this diff against `main`. Check: (1) does it satisfy the wave's acceptance criteria as written in `docs/launch/waves/m<N>-<slug>.md`? (2) are any callers of changed symbols broken? (3) does new code follow the `useAddGarment.ts` hook pattern (`useAuth` + `supabase` from `../lib/supabase` + `captureMutationError` on mutations + `callEdgeFunction` on edge calls when M9 has shipped)? (4) any drift from the wave file's skeletons or scope creep? (5) for screens, does it use existing primitives (`Eyebrow`, `PageTitle`, `Caption`, `Button`, `Chip`, `Card`) and `useTokens()` (no hardcoded hex)? (6) for migrations: timestamp matches the MCP-applied one; idempotent guards present where needed. Report under 200 words. Flag P0 (blocks merge) vs P1 (fix in this PR) vs P2 (track in findings-log).

If the reviewer flags a regression: fix → re-run gates → re-review.

## Anti-patterns

- New state libraries (Zustand/Jotai/etc.) without asking
- Direct imports from `tokens.ts` inside a component (use `useTokens()`)
- `display: 'none'` for animations (use `Animated.Value`)
- Reaching into `../src` runtime code (type imports OK)
- Hand-reimplementing `useGarments` / `useProfile` / etc. — port the web hook, don't reinvent

## Pointers

- Wave plan: `docs/launch/overview.md`
- Wave files: `docs/launch/waves/`
- Code reference for hook pattern: `mobile/src/hooks/useAddGarment.ts`
- Theme tokens: `mobile/src/theme/tokens.ts`
