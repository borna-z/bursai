

## Fix Forgot Password

### The Problem
When a user clicks the password reset link from their email, they land on `/reset-password` but see "Invalid reset link" instead of the password form. This happens because:

1. The recovery link contains a token in the URL hash (`#type=recovery&access_token=...`)
2. The `AuthContext` (parent provider) processes this token first and fires the `PASSWORD_RECOVERY` event
3. By the time `ResetPassword` component mounts and subscribes to `onAuthStateChange`, the event has already passed
4. The hash has been consumed, so the fallback hash check also fails
5. Result: `isRecovery` stays `false` and the user sees the error screen

### The Fix
Update `ResetPassword.tsx` to be more robust:

1. **Check for an existing session on mount** -- after the hash is consumed, there's still a valid session. Call `supabase.auth.getSession()` and if a session exists, show the reset form.
2. **Keep the `PASSWORD_RECOVERY` listener** as a belt-and-suspenders approach
3. **Keep the hash check** as an additional fallback

### Technical Details

| File | Change |
|------|--------|
| `src/pages/ResetPassword.tsx` | In the `useEffect`, also call `supabase.auth.getSession()` and set `isRecovery = true` if a valid session exists (since the user can only reach this page from the recovery email link). Also check URL search params for `type=recovery` in addition to the hash. |

The key insight: if a user arrives at `/reset-password` with an active session, they got there via the recovery email -- so we can safely show the password form.

