# M42 — Performance optimization pass

| Field | Value |
|---|---|
| Goal | Pre-TestFlight hardening pass: a11y coverage ≥95%, lazy-load non-tab screens, bundle audit, image cache tuning, cold-start measurement. |
| Status | TODO |
| Branch | `mobile-m42-performance` |
| PR count | 1 |
| Depends on | V0, all functional waves |
| Complexity | M |

## Background

Final polish before TestFlight cut. Catches regressions from 30+ feature waves. The single broad PR is acceptable here — gates fail loudly and the changes are mechanical.

## Files touched

### Modified (broad)
- Every Pressable / TouchableOpacity gains `accessibilityRole` + `accessibilityLabel`. Audit via grep for tappable nodes lacking the props.
- `mobile/src/navigation/RootNavigator.tsx` — wrap non-tab screens in `React.lazy(() => import('./...'))`. Tab screens stay eager (cold-start critical).
- Image components — switch to `expo-image` (intrinsic memory + disk cache) where react-native `Image` is currently used. Verify against screens with long lists.
- Bundle audit: re-run M-V0's bundle-size step; trim any unused deps surfaced by `npx depcheck mobile` or expo's import analyzer.

### New
- `mobile/src/lib/perf.ts` — `measureColdStart` helper writing breadcrumbs to Sentry on first paint.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green; bundle size <5 MB gzipped (warn threshold) is the new bar
- Manual a11y sweep: enable VoiceOver / TalkBack → walk Home / Wardrobe / OutfitDetail / Settings → no silent or unlabeled elements
- Cold-start budget: time from process spawn to first interactive paint ≤ 2.0 s on iPhone 12-class hardware (measured via `measureColdStart` breadcrumb in Sentry)
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M42 — performance optimization pass`
