# M11 — Account deletion + reset style memory

| Field | Value |
|---|---|
| Goal | Wire the two destructive mutations the App Store reviewers test on day one: full account deletion and reset-style-memory. Both edge functions exist server-side. |
| Status | DONE (PR #735) |
| Branch | `mobile-m11-destructive-mutations` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | M |

## Background

App Store guideline 5.1.1(v) requires in-app account deletion. `delete_user_account` (24-table cascade, idempotent) and `reset_style_memory_atomic` RPC + `reset_style_memory` edge fn are already deployed. Mobile has neither wired.

## Files touched

### New
- `mobile/src/hooks/useDeleteAccount.ts` — POST to `/functions/v1/delete_user_account` then `supabase.auth.signOut()`.
- `mobile/src/hooks/useResetStyleMemory.ts` — POST to `/functions/v1/reset_style_memory` and invalidate `['profile']`, `['style-dna']`, `['feedback-signals']`.

### Modified
- `mobile/src/screens/SettingsAccountScreen.tsx` — Add "Delete Account" row. Two-step confirm: alert → typed-confirm dialog (the literal text "DELETE" required, mirrors web's clickjacking-mitigation pattern from PR #712).
- `mobile/src/screens/SettingsPrivacyScreen.tsx` — Add "Reset Style Memory" row + same typed-confirm.
- `mobile/src/lib/i18n.ts` — append `settings.delete_account.*`, `settings.reset_memory.*` keys.

## Pattern reference

Use `mobile/CLAUDE.md` mutation-hook shape. Both calls go through M9's `callEdgeFunction` if M9 has shipped — otherwise raw fetch with auth header.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: create a throwaway account, add 2 garments + 1 outfit, run "Reset Style Memory" — confirm `feedback_signals` empty for that user. Then "Delete Account" — confirm sign-out + 24-table cascade verified via Supabase Studio
- Code-reviewer: approved

## Deploy

None — both edge functions already deployed.

## PR template

Title: `feat(mobile): M11 — account deletion + reset style memory`
