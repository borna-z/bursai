

## Make `/welcome` the Default Landing Page

### What Happens
When someone visits `burs.me` (the root `/` path) without being logged in, they will be redirected to `/welcome` (the Landing page) instead of being sent to the login-protected Home page.

Currently, `/` points to the protected `<Home />` component -- if a user isn't logged in, `ProtectedRoute` likely redirects them to `/auth`. We want unauthenticated visitors to see `/welcome` instead.

### Changes

**1. Update `src/App.tsx`**
- Change the root route (`/`) from the protected Home to a new `IndexRedirect` component
- This component checks if the user is logged in:
  - **Logged in** --> show `<Home />` (the dashboard)
  - **Not logged in** --> redirect to `/welcome`

**2. Alternatively (simpler approach)**
- Add a redirect: make `/` render a small component that uses `useAuth()` to check session state and navigates accordingly
- Keep `/welcome` as the Landing page route (already exists)

### Technical Detail

```
/ (root)
  |-- logged in?  --> <Home />
  |-- not logged in? --> redirect to /welcome
```

This way, when someone types `burs.me` in their browser:
- New visitors see the welcome/landing page
- Returning logged-in users go straight to their dashboard

### Files

| File | Change |
|------|--------|
| `src/App.tsx` | Replace the `/` route with a conditional redirect component |
| `src/pages/Index.tsx` | Update or repurpose as the redirect logic (or create inline) |

