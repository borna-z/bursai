

## Fix Signup Flow and Enforce 8-Character Password Minimum

### Problem 1: Signup gives misleading feedback
After signing up, the app shows "Account created! You are now logged in." but if email confirmation is required, the user is NOT logged in. The `signUp` call returns no error even when email confirmation is pending -- the user just sits on the auth page with no guidance to check their inbox.

**Fix**: Check the signup response for `data.user.identities`. When the array is empty, it means the email is already registered. When there's a user but no session, it means email confirmation is required. Show appropriate messages:
- No session returned: "Check your email to confirm your account"
- Empty identities: "An account with this email already exists"

### Problem 2: Password minimum is 6 characters, should be 8
The client-side validation and all translation strings say "at least 6 characters" but the user wants 8.

**Fix**: Update the validation check from `< 6` to `< 8` and update all translation strings across all 14 locales.

---

### Files to change

**`src/pages/Auth.tsx`** (2 changes)
- Change `password.length < 6` to `password.length < 8` on line 63
- Update `handleSignUp` success handling: check if `data.session` exists. If no session, show "Check your email to confirm your account" instead of "Account created! You are now logged in."

**`src/contexts/AuthContext.tsx`** (1 change)
- Update `signUp` to return `data` alongside `error` so the Auth page can inspect `session` and `user.identities`

**`src/pages/ResetPassword.tsx`** (1 change)
- Change `password.length < 6` to `password.length < 8` on line 47

**`src/i18n/translations.ts`** (~28 string updates across 14 locales)
- Update `auth.min_password`: "at least 6" becomes "at least 8" in all locales
- Update `auth.password_too_short`: "must be at least 6" becomes "must be at least 8" in all locales
- Update `auth.account_created`: change to "Check your email to confirm your account" (since auto-confirm is off)
- Add new key `auth.email_already_registered` for the identities-empty edge case

### Technical detail

The current `signUp` function in `AuthContext.tsx` discards the response data. The fix changes it to also return the full signup data so the Auth page can check:

```
const { data, error } = await supabase.auth.signUp({ ... });
return { data, error };
```

Then in Auth.tsx:
```
const { data, error } = await signUp(email, password);
if (!error && data?.user && !data.session) {
  // Email confirmation required
  toast.success(t('auth.check_email'));
} else if (!error && data?.user?.identities?.length === 0) {
  // Already registered
  toast.error(t('auth.already_exists'));
}
```
