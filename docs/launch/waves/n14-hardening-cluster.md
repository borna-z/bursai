# N14 — No-migration hardening cluster

| Field | Value |
|---|---|
| Goal | Land seven small, code-only follow-ups from `findings-log.md` ("Track for:" items) that don't need a DB migration. Pure bugfix / polish — no behaviour change beyond the explicit fix. |
| Status | TODO |
| Branch | `mobile-n14-hardening-cluster` |
| PR count | 1 |
| Depends on | N13 (sibling-module split landed for `OutfitDetailScreen` + `StyleQuizV4Step` — N14 edits orchestrator files only) |
| Complexity | M |

## Background

Findings log accumulated seven "Track for:" items across M1 / M25 / M30 / M35 / M37 / M32 that are all (a) code-only (no migration), (b) bounded to a single file or hook each, (c) directly user-facing or quietly-broken-today. Cluster them into one PR so each fix lands with a green CI pass instead of seven near-identical PRs.

## Items

| ID | Finding date | Location | Fix |
|---|---|---|---|
| F1 (M37 P2) | 2026-05-08 | `mobile/src/screens/OutfitDetailScreen.tsx` anchor hydration `useEffect` | Add `hydratedRef` (set true after the read resolves); `persistAnchor` skips a late hydration write if the user has already touched anchor state. Eliminates the sub-second flicker window where a fast tap is clobbered by the AsyncStorage read. |
| F2 (M35 P2) | 2026-05-08 | `mobile/src/hooks/useWeather.ts` + `mobile/src/hooks/useForecast.ts` | Extract the duplicated `getConditionFromCode(code)` WMO mapper to `mobile/src/lib/weatherCodes.ts`. Both hooks import. `getPrecipitationFromCode` + `getWindCategory` (only in `useWeather`) move along too since they're the same shape; not a behaviour change. |
| F3 (M25 P2 — slider) | 2026-05-07 | `mobile/src/screens/onboarding/StyleQuizV4Step.primitives.tsx` `PercentSlider` | Flip `onStartShouldSetPanResponder` from `() => false` to `() => true` so a single tap commits the position via the existing `onPanResponderGrant` handler. Drag continues to work via the existing move handler — no regression. |
| F4 (M25 P2 — grid) | 2026-05-07 | `mobile/src/screens/onboarding/StyleQuizV4Step.primitives.tsx` `ColorGrid` | Bump container `gap` from `12` to `16` to keep ≥4 px inter-target padding when 44 pt swatches wrap. |
| F5 (M30 P2) | 2026-05-07 | `mobile/App.tsx` `usePushTokenRegistration` | Register `Notifications.addPushTokenListener(...)` once the user is signed in. On token rotation, re-fire `mutateRef.current()` (the same registration mutation) so the new token is upserted to `push_subscriptions` mid-session. Listener removed on user change / unmount. |
| F6 (M1 P2 — key) | 2026-05-05 | `mobile/src/hooks/useRenderJobStatus.ts` | Scope the query key to `['render_job', user?.id, garmentId]` for consistency with the rest of the mobile cache (`['garment', user?.id, id]`). No behaviour change — keys are not consumed elsewhere. |
| F7 (M1 P2 — failure badge) | 2026-05-05 | `mobile/src/screens/GarmentDetailScreen.tsx` studio badge | Read the snapshot from `useRenderJobStatus` (currently discarded). When `garment.render_status === 'failed'`, render a destructive-tinted "Render unavailable" badge in the same hero-badge slot instead of letting the pill silently disappear. (No retry CTA — re-enqueue is out of scope for N14.) |
| F8 (M30 P3) | 2026-05-08 | `mobile/src/components/icons.tsx` + `mobile/src/screens/SettingsAccountScreen.tsx` | Add `ReceiptIcon`; swap the Restore Purchases row from `RotateIcon` to `ReceiptIcon` so `RotateIcon` is reserved for "reset / refresh" semantics (`SettingsPrivacyScreen` reset style memory, `LiveScanScreen` torch flip, etc.). |

## Files touched

### Modified
- `mobile/src/screens/OutfitDetailScreen.tsx` — F1
- `mobile/src/hooks/useWeather.ts` — F2 (import + drop local helpers)
- `mobile/src/hooks/useForecast.ts` — F2 (import + drop local helper)
- `mobile/src/screens/onboarding/StyleQuizV4Step.primitives.tsx` — F3 + F4
- `mobile/App.tsx` — F5
- `mobile/src/hooks/useRenderJobStatus.ts` — F6
- `mobile/src/screens/GarmentDetailScreen.tsx` — F7
- `mobile/src/components/icons.tsx` — F8 (`ReceiptIcon`)
- `mobile/src/screens/SettingsAccountScreen.tsx` — F8 (swap import + JSX)

### New
- `mobile/src/lib/weatherCodes.ts` — F2 (extracted shared helpers)

### Tests
- `mobile/src/lib/__tests__/weatherCodes.test.ts` — unit cover for the three pure helpers (mirrors N7 / N13 helper-test pattern).

## Method

For each item, smallest viable diff. No new abstractions, no scope creep. All hooks remain exported with the same signatures.

For F2: the move is mechanical — copy the three pure functions into `weatherCodes.ts`, replace the in-file declarations with imports, run typecheck. The original copies stay byte-identical (no rewrite).

For F5: the existing `usePushTokenRegistration` already pins `mutateRef`. The new effect mounts a listener that calls `mutateRef.current()` on each rotation event, keyed on `user.id` so a sign-out tears it down.

For F7: the existing `useRenderJobStatus(renderJobGarmentId)` call discards the snapshot. Re-bind it and read `garment?.render_status === 'failed'` to render a destructive badge (`backgroundColor: t.destructiveSoft`, text color `t.destructive`) replacing the spinner pill. The badge appears once the snapshot's terminal-failed branch invalidates the garment row and `render_status` flips to `'failed'` server-side.

## Acceptance gates

- TypeScript: 0 errors
- Lint: 0 warnings under `"src/**/*.{ts,tsx}"` glob
- Jest: passes (new `weatherCodes.test.ts` covers the extracted helpers)
- expo-doctor: passes
- expo export: under bundle-size threshold

## Anti-patterns

- Don't add a retry-render CTA in F7 (out of scope; needs a re-enqueue path that isn't on this branch).
- Don't refactor `PercentSlider` beyond the one-line `onStartShouldSetPanResponder` flip.
- Don't reorganise the WMO ranges in F2 — copy verbatim, edit later if a real bug appears.
- Don't rewrite `useRenderJobStatus`'s comment block — only the query-key line + the snapshot-return surface change in F6.

## Out of scope (track for future N-wave)

- Migration-required items (wear_logs UNIQUE, outfit_feedback UNIQUE, `increment_wear_count` RPC, outfit_items ownership trigger, push_subscriptions WITH CHECK, onboarding_garment_count upper bound) — needs explicit user-authorised migration PR.
- a11y primitive overhauls (Chip role audit, SettingsRow busy prop) — primitive ripple, separate PR.
- M37 cross-device anchor column — migration-required.
- Cross-platform Stripe-restore alert + Subscription card UX — separate Settings-polish PR.
- Stale push-token cron sweep — needs a new edge function (not authorised by N14 scope).
