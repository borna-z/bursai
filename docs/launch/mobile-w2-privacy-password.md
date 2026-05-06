# Mobile Launch — M2 — Privacy/Terms links + password reset deep link

**Goal:** Replace the privacy-policy Alert with `Linking.openURL`, replace the 700ms setTimeout fake on password reset with real `supabase.auth.resetPasswordForEmail`, and wire the `burs://reset-password` deep-link handler so reset emails land back in the app.

**Status:** 🔜 TODO
**Branch:** `mobile-w2-privacy-password`
**PR count:** 1
**Depends on:** M0
**Complexity:** M

---

## Files touched

**Modified:**
- `mobile/src/screens/SettingsPrivacyScreen.tsx` — L67 area (privacy link Alert) + add Terms row
- `mobile/src/screens/ResetPasswordScreen.tsx` — L60 area (replace setTimeout fake)
- `mobile/src/RootNavigator.tsx` — add `linking` config to `NavigationContainer`

**External (user, parallel — does NOT block PR):**
- [ ] Add `burs://reset-password` to Supabase Auth dashboard → URL Configuration → Redirect URLs (project ref `khvkwojtlkcvxjxztduj`)
- [ ] Confirm `https://burs.me/privacy` and `https://burs.me/terms` return 200 (web Wave 11 work)

**Tracker (same PR):**
- `docs/launch/mobile-launch-overview.md` — flip M2 → DONE, advance pointer to M3
- `docs/launch/completion-log.md` — append row
- `CLAUDE.md` root — pointer to M3

---

## Code skeletons

### 1. `SettingsPrivacyScreen.tsx` — replace L67 Alert with two real `Linking` rows

```tsx
import { Linking } from 'react-native';

// Replace the existing privacy-policy Alert.alert(...) with:
<SettingsRow
  label="Privacy policy"
  onPress={() => Linking.openURL('https://burs.me/privacy')}
  accessibilityLabel="Open privacy policy in browser"
/>
<SettingsRow
  label="Terms of service"
  onPress={() => Linking.openURL('https://burs.me/terms')}
  accessibilityLabel="Open terms of service in browser"
/>
```

If a "Terms" row doesn't exist yet, add it directly below the privacy row in the same section.

### 2. `ResetPasswordScreen.tsx` — replace setTimeout block at L60

Locate the existing `handleSubmit` function (search for `setTimeout` — that's the fake delay). Replace its body with:

```tsx
import { supabase } from '../lib/supabase';
import { Sentry } from '../lib/sentry';

const handleSubmit = async () => {
  if (!isValidEmail(email)) {
    setError('Enter a valid email');
    return;
  }
  setIsSending(true);
  setError(null);
  try {
    const { error: rpcError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'burs://reset-password',
    });
    if (rpcError) throw rpcError;
    if (!isMounted.current) return;
    setSent(true);
  } catch (err) {
    Sentry.captureException(err);
    if (!isMounted.current) return;
    setError('Could not send reset email. Try again in a moment.');
  } finally {
    if (isMounted.current) setIsSending(false);
  }
};
```

### 3. Deep-link handler in `RootNavigator.tsx`

Add the `linking` config and pass it to `NavigationContainer`:

```tsx
import { Linking } from 'react-native';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types'; // wherever your param list lives

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['burs://', 'https://burs.me'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      // Preserve any existing OAuth-callback handler — Supabase auth callback
      // currently handled by a custom listener; do not duplicate it here.
    },
  },
};

// In the NavigationContainer JSX:
<NavigationContainer linking={linking} theme={...}>
  ...
</NavigationContainer>
```

### 4. `ResetPasswordScreen.tsx` — handle the recovery deep link on mount

Supabase's reset email lands at `burs://reset-password#access_token=...&refresh_token=...&type=recovery`. The native deep-link parsing path:

```tsx
import { useEffect } from 'react';
import { useRoute, RouteProp } from '@react-navigation/native';

useEffect(() => {
  // When opened from a recovery email, hydrate the session so the
  // new-password form below is authenticated.
  (async () => {
    const url = await Linking.getInitialURL();
    if (!url) return;
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) return;
    const params = new URLSearchParams(url.slice(hashIndex + 1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');
    if (type === 'recovery' && accessToken && refreshToken) {
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      // Switch UI to "set new password" mode (use whichever local state
      // ResetPasswordScreen already has — typically `setSent(true)` plus
      // a separate `setRecoveryMode(true)` flag).
    }
  })().catch((err) => Sentry.captureException(err));
}, []);
```

The screen already has a `sent` boolean for the post-send confirmation state. Add a `recoveryMode` boolean and render a "set new password" form instead of the "we sent you an email" state when `recoveryMode === true`. Submitting calls `supabase.auth.updateUser({ password: newPassword })`.

---

## Acceptance gates

```bash
cd mobile && npx tsc --noEmit
```
0 errors.

**Manual smoke test (physical device required for deep link):**
1. Sign out. Open AuthScreen → tap Forgot password → enter test email → submit. See "we sent you an email" state.
2. Verify Supabase Auth dashboard shows the recovery email was sent.
3. Tap the link in the email on the same device. App opens to ResetPasswordScreen in recovery mode.
4. Set new password → success → sign in with new password. Verified.
5. Tap Privacy policy → browser opens `https://burs.me/privacy`.
6. Tap Terms of service → browser opens `https://burs.me/terms`.

**Grep verification:**
```bash
grep -n "setTimeout\|burs.me/privacy" mobile/src/screens/{SettingsPrivacyScreen,ResetPasswordScreen}.tsx
```
Should NOT return the fake-delay setTimeout in ResetPasswordScreen.

**Code-reviewer subagent:** mandatory before push.

---

## PR template

**Title:** `feat(mobile): M2 — privacy/terms links + real password reset + burs:// deep link`

**Body:**
```
## Wave
M2 — Privacy/Terms + password reset (`docs/launch/mobile-w2-privacy-password.md`)

## Problem
Privacy policy fires Alert.alert("visit burs.me/privacy"). Terms link missing
entirely. ResetPassword fakes success with setTimeout instead of calling
supabase.auth.resetPasswordForEmail. No deep-link handler for the recovery
URL Supabase emails.

## Fix
- Linking.openURL for privacy + terms rows
- Real supabase.auth.resetPasswordForEmail(email, { redirectTo: burs://reset-password })
- NavigationContainer `linking` config with burs:// + https://burs.me prefixes
- Deep-link handler hydrates session from recovery URL hash and switches
  ResetPasswordScreen to "set new password" mode

## Files touched
- Modified: mobile/src/screens/SettingsPrivacyScreen.tsx (L67 area + new Terms row)
- Modified: mobile/src/screens/ResetPasswordScreen.tsx (L60 area + recovery-mode useEffect)
- Modified: mobile/src/RootNavigator.tsx (add linking config)

## Verification
- TypeScript: 0 errors
- Code-reviewer subagent: approved
- Manual test on physical device: recovery email → tap link → app opens →
  set new password → sign in works

## External setup (parallel — does not block merge)
- [ ] User adds `burs://reset-password` to Supabase Auth → URL Configuration → Redirect URLs
- [ ] Web side ships /privacy and /terms pages on burs.me (Wave 11)

## Out of scope
- (None)
```

---

## Tracker updates (in this PR)

1. `docs/launch/mobile-launch-overview.md`: M2 → DONE, pointer → M3.
2. `docs/launch/completion-log.md`: append `| 2026-05-XX | M2 | feat(mobile): privacy/terms + password reset deep link | PR #<N> |`.
3. `CLAUDE.md` root: CURRENT WAVE → `Mobile Launch M3 — Travel capsule end-to-end`.
