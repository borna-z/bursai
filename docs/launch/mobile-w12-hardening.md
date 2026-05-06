# Mobile Launch — M12 — Hardening: a11y + bundle audit + lazy loading

**Goal:** Pre-TestFlight hardening sweep — accessibilityRole/accessibilityLabel coverage to ≥95% on all interactive elements, screen-level `React.lazy()` for non-tab routes to drop cold-start time, and a one-time bundle audit to flag bloat.

**Status:** 🔜 TODO
**Branch:** `mobile-w12-hardening`
**PR count:** 1
**Depends on:** M0–M11 ideally (so a11y sweep covers all final UI)
**Complexity:** M

---

## Files touched

**Modified:**
- Every screen with interactive elements (`Pressable`, `TouchableOpacity`) — add `accessibilityRole` + `accessibilityLabel` where missing
- `mobile/src/RootNavigator.tsx` — wrap non-tab screen imports in `React.lazy()` + `Suspense` fallback (the existing `Spinner` component)
- Possibly `mobile/App.tsx` — Suspense boundary at root if not already there

**Tracker (same PR):** standard.

---

## A11y sweep priorities (from the M0 audit findings)

Highest-impact screens to fix first:
1. `MonthCalendarScreen` — 6% coverage (date cells lack labels). Add `accessibilityLabel={\`${date}, ${plannedOutfitName}\`}` per cell.
2. `AuthScreen` — 50% coverage. Email/password inputs need `accessibilityLabel` + `accessibilityHint`.
3. `InsightsScreen` — 67%. Gauge + PaletteBar + bars need verbal descriptions of the chart values.

Pattern for every `Pressable`:
```tsx
<Pressable
  onPress={...}
  accessibilityRole="button"
  accessibilityLabel="<verbal description of action>"
  accessibilityHint="<optional, what happens after>"
>
```

For decorative icons (no action), set `accessible={false}` or `accessibilityElementsHidden` on the wrapping element.

Aim ≥95% across the codebase. Use VoiceOver (iOS Simulator: Settings → Accessibility → VoiceOver → On) to spot-check.

---

## Lazy loading

Pattern (apply to non-tab screens only — tabs stay eager):

```tsx
import React, { lazy, Suspense } from 'react';
import { Spinner } from './components/Spinner';

const ResetPasswordScreen = lazy(() => import('./screens/ResetPasswordScreen'));
const TravelCapsuleScreen = lazy(() => import('./screens/TravelCapsuleScreen'));
// ... 25+ more

const wrap = (Component: React.LazyExoticComponent<any>) => (props: any) => (
  <Suspense fallback={<Spinner />}>
    <Component {...props} />
  </Suspense>
);

// In Stack.Screen definitions:
<Stack.Screen name="ResetPassword" component={wrap(ResetPasswordScreen)} />
```

Skip lazy on: `MainTabsScreen`, `HomeScreen`, `WardrobeScreen`, `PlanScreen`, `InsightsScreen` (tabs — eager keeps the tab transition snappy).

---

## Bundle audit (one-time)

```bash
cd mobile && npx expo export --platform ios --output-dir /tmp/bundle-audit
ls -lh /tmp/bundle-audit/*.bundle
# Check the gzipped size; flag if >5MB
```

If >5MB, identify the heaviest imports via `source-map-explorer` (install dev-only). Flag findings to log.

---

## Acceptance gates

```bash
cd mobile && npx tsc --noEmit
```
0 errors.

**a11y manual sweep with VoiceOver:**
- Open Settings → Accessibility → VoiceOver → On.
- Walk through every screen. Every Pressable announces a meaningful label.

**Cold-start measurement:**
- `npx expo start --no-dev --minify` to simulate prod.
- Open app on physical device, time from tap-to-interactive on the Home tab. Target <2s on a 2-year-old iPhone.
- Compare to pre-lazy baseline. Should drop by 200-500ms.

**Code-reviewer subagent:** mandatory.

---

## PR template

**Title:** `feat(mobile): M12 — a11y sweep + screen lazy loading + bundle audit`

**Body:** Problem (a11y gaps; eager screen imports inflate cold-start). Fix (a11y sweep + React.lazy on non-tab screens). Verification above. Out of scope: VoiceOver Rotor customisation, dynamic type scaling per screen.

---

## Tracker updates: M12 → DONE, pointer → M13.
