
## Fix: Ghost Session Causes Onboarding Failure

### Root Cause
User `borna.zavareh@nordiskainglasningar.se` has a valid JWT token but no corresponding entry in `auth.users`. This means:
- Profile auto-creation fails (FK constraint violation)
- Any profile UPDATE returns 0 rows, causing a 406 error
- The quiz "Done" button always fails with "Something went wrong"

### Solution

#### 1. Detect ghost sessions in `useProfile.ts`
When the profile auto-create INSERT fails with a FK violation, the user's auth session is invalid. Instead of returning a fake profile object, sign the user out so they can re-authenticate properly.

**File: `src/hooks/useProfile.ts`**
- In the `if (!data)` block where auto-create fails, check if the error is a FK violation
- If so, call `supabase.auth.signOut()` to clear the ghost session
- Return `null` so the app redirects to login

#### 2. Make `useUpdateProfile` resilient
**File: `src/hooks/useProfile.ts`**
- Change `.single()` to `.maybeSingle()` in the update mutation
- If result is null (0 rows updated), throw a clear error instead of a cryptic 406

#### 3. Improve error handling in `handleQuizComplete`
**File: `src/pages/Onboarding.tsx`**
- Add a more descriptive error message when profile save fails
- Optionally suggest the user to log out and back in

#### 4. User action required
The user `borna.zavareh@nordiskainglasningar.se` must log out and create a new account (or sign in again if the account exists in the live environment). The ghost session cannot be repaired.

### Technical Details

**`src/hooks/useProfile.ts` changes:**
- In the `queryFn`, when `insertError` occurs after `!data`, check for FK violation (code `23503`)
- If FK violation detected, call `supabase.auth.signOut()` and return `null`
- In `useUpdateProfile`, replace `.single()` with `.maybeSingle()` and handle null result

**`src/pages/Onboarding.tsx` changes:**
- In the `handleQuizComplete` catch block, check if the error suggests an invalid session
- Show a more helpful toast message like "Session expired. Please log in again."
