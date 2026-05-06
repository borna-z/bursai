# M12 — Password reset + deep links

| Field | Value |
|---|---|
| Goal | Real password reset flow + deep-link handler so the email "reset password" link opens the in-app reset screen. |
| Status | DONE (PR #736) |
| Branch | `mobile-m12-password-reset` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | M |

## Background

`AuthScreen` and `ResetPasswordScreen` exist as stubs. Need: `supabase.auth.resetPasswordForEmail` integration, deep-link config (`burs://reset-password?token=...`), recovery-mode session hydration on cold start.

## Files touched

### New
- `mobile/src/hooks/useResetPassword.ts` — `requestReset(email)` calls `resetPasswordForEmail` with `redirectTo: 'burs://reset-password'`; `confirmReset(newPassword, accessToken)` calls `supabase.auth.updateUser`.

### Modified
- `mobile/src/screens/AuthScreen.tsx` — "Forgot password?" link triggers `requestReset`; show "check your email" confirmation.
- `mobile/src/screens/ResetPasswordScreen.tsx` — read `accessToken` from route params (deep-link source); show new-password form; call `confirmReset`.
- `mobile/src/navigation/RootNavigator.tsx` — declare deep-link config: `linking = { prefixes: ['burs://'], config: { screens: { ResetPassword: 'reset-password' } } }`.
- `mobile/app.json` — confirm `scheme: 'burs'` is set (M34 finalizes it).
- Supabase Auth dashboard — whitelist `burs://reset-password` as redirect URL (user action, listed in M44 external setup).

## Pattern reference

Standard supabase-js flow. RN deep-link docs from React Navigation v7.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: trigger password reset on EAS dev build; tap link in email; confirm app opens to ResetPasswordScreen with token; new password works on next sign-in
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M12 — password reset + deep links`
