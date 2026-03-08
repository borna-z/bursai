

## Replace "Confirm Email" with "Confirm Password" on Signup

### Change
In `src/pages/Auth.tsx`, replace the "confirm email" field with a "confirm password" field during signup, and update the validation logic accordingly.

### Files to Edit

1. **`src/pages/Auth.tsx`**:
   - Remove `confirmEmail` state, replace with `confirmPassword` state
   - Replace the "Confirm email" input field with a "Confirm password" input (with show/hide toggle, matching the main password field)
   - Update `handleSignUp` validation: check `password === confirmPassword` instead of `email === confirmEmail`
   - Use existing translation keys `auth.confirm_password` and `auth.passwords_no_match` (already in translations.ts) instead of `auth.confirm_email` / `auth.emails_no_match`

No translation file changes needed — `auth.confirm_password` and `auth.passwords_no_match` keys already exist in all languages.

