

## Problem

The bottom navigation "Idag" tab links to `/`, which renders `Index.tsx`. That component **always** shows the splash logo animation before displaying content. This means every time you tap "Idag", the full logo draw animation plays — even though you're already logged in and inside the app.

The splash animation should only appear on the very first app open, not when navigating between tabs.

## Solution

**File: `src/pages/Index.tsx`**

Skip the splash animation entirely when the user is already authenticated. The splash is only meaningful on cold start when we don't know if the user is logged in or not.

Logic change:
- If `user` is already available (session exists in memory), set `animDone` to `true` immediately and skip the splash screen
- The splash only shows when `loading` is true (initial session check) and we don't yet know the auth state
- This way, tapping "Idag" in the bottom nav instantly shows the Home page without any animation

```text
Current flow (every visit to /):
  Index mounts → splash animation (2+ seconds) → show Home

Fixed flow:
  Index mounts →
    if user already known: skip splash → show Home instantly
    if loading (cold start): show splash → resolve auth → show content
```

### Scope
- `src/pages/Index.tsx` — one small logic change (skip splash when user is already resolved)

No other files affected.

