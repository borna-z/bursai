

## Reorder Signup Fields: Password Before Confirm Password

Currently in the signup form, the "Confirm password" field appears before the "Password" field. This should be reversed so users enter their password first, then confirm it.

### Change

**`src/pages/Auth.tsx`** — In the signup form, move the "Password" field (with its show/hide toggle) above the "Confirm password" field. No logic changes needed, just reorder the JSX blocks.

