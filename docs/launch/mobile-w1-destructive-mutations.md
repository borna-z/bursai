# Mobile Launch — M1 — Destructive mutations: account deletion + reset style memory

**Goal:** Replace the four fake `Alert.alert(...)` stubs across Settings screens with real edge-function calls. Account deletion (App Store guideline 5.1.1(v)) and reset-style-memory share a destructive-mutation UX pattern, so they ship together.

**Status:** 🔜 TODO
**Branch:** `mobile-w1-destructive-mutations`
**PR count:** 1
**Depends on:** M0 (uses `captureMutationError`)
**Complexity:** M

---

## Background

Both edge functions already exist server-side and do the full cascade work:
- `supabase/functions/delete_user_account/index.ts` — GDPR cascade across 20+ tables + Storage cleanup, idempotent
- `supabase/functions/reset_style_memory/index.ts` — atomic RPC + audit logs

Mobile work is hooks + UI only.

---

## Files touched

**New:**
- `mobile/src/hooks/useDeleteAccount.ts`
- `mobile/src/hooks/useResetStyleMemory.ts`

**Modified:**
- `mobile/src/screens/SettingsAccountScreen.tsx` — L150 area (delete-account fake Alert)
- `mobile/src/screens/SettingsPrivacyScreen.tsx` — L91 area (reset-memory fake Alert) + L111 area (delete-account fake Alert)
- `mobile/src/screens/SettingsScreen.tsx` — L156 area (reset-memory fake Alert)
- `mobile/src/screens/SettingsStyleScreen.tsx` — L130 area (reset-memory fake Alert)

**Tracker (same PR):**
- `docs/launch/mobile-launch-overview.md` — flip M1 row + advance pointer to M2
- `docs/launch/completion-log.md` — append row
- `CLAUDE.md` (root) — update CURRENT WAVE pointer to M2

---

## Code skeletons

### 1. `mobile/src/hooks/useDeleteAccount.ts` (new)

```ts
// Calls the existing delete_user_account edge function and signs the user
// out on success. Server-side function does the full GDPR cascade
// (garments, outfits, wear_logs, planned_outfits, render_jobs, subscriptions,
// push_subscriptions, profiles, storage objects, auth.users) — mobile just
// invokes it. Two-step UX confirmation lives in the calling screen.

import { useMutation } from '@tanstack/react-query';

import { supabaseUrl } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';

interface DeleteAccountResponse {
  success: boolean;
  message: string;
}

export function useDeleteAccount() {
  const { session, user, signOut } = useAuth();

  return useMutation<DeleteAccountResponse, Error, void>({
    mutationFn: async () => {
      const accessToken = session?.access_token;
      if (!accessToken || !user) throw new Error('Not authenticated');

      const response = await fetch(`${supabaseUrl}/functions/v1/delete_user_account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          // If user double-taps confirm, the server-side x-idempotency-key cache
          // returns the original response instead of attempting a second cascade.
          'x-idempotency-key': `delete-${user.id}-${Date.now()}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`delete_user_account ${response.status}: ${text}`);
      }
      return (await response.json()) as DeleteAccountResponse;
    },
    onSuccess: async () => {
      // Sign out clears local session + queryClient. AuthContext's SIGNED_OUT
      // listener flushes the AsyncStorage cache via Supabase's adapter.
      await signOut();
    },
    onError: captureMutationError('useDeleteAccount'),
  });
}
```

### 2. `mobile/src/hooks/useResetStyleMemory.ts` (new)

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabaseUrl } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';

interface ResetStyleMemoryResponse {
  ok: true;
  tables_cleared: Record<string, number>;
}

export function useResetStyleMemory() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<ResetStyleMemoryResponse, Error, void>({
    mutationFn: async () => {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');
      const response = await fetch(`${supabaseUrl}/functions/v1/reset_style_memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`reset_style_memory ${response.status}: ${text}`);
      }
      return (await response.json()) as ResetStyleMemoryResponse;
    },
    onSuccess: () => {
      // Bust everything that derives from style memory.
      queryClient.invalidateQueries({ queryKey: ['style-dna', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
    },
    onError: captureMutationError('useResetStyleMemory'),
  });
}
```

### 3. Account deletion screen wiring (SettingsAccountScreen.tsx + SettingsPrivacyScreen.tsx)

Replace the existing fake `Alert.alert('Account deletion requested', ...)` in BOTH screens with this pattern:

```tsx
import { useDeleteAccount } from '../hooks/useDeleteAccount';

const { mutate: deleteAccount, isPending: isDeleting } = useDeleteAccount();

const handleDeleteAccount = () => {
  Alert.alert(
    'Delete account',
    'This permanently removes your wardrobe, outfits, plans, style memory, and subscription. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Are you sure?',
            'Tap Confirm to permanently delete your account.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Confirm',
                style: 'destructive',
                onPress: () =>
                  deleteAccount(undefined, {
                    onError: (err) =>
                      Alert.alert('Could not delete account', err.message),
                  }),
              },
            ],
          );
        },
      },
    ],
  );
};

// In the JSX, ensure the destructive row reflects loading state:
// disabled={isDeleting}
```

### 4. Reset-style-memory wiring (3 screens — identical at every call site)

Replace the existing fake Alerts in SettingsScreen.tsx (L156), SettingsPrivacyScreen.tsx (L91), SettingsStyleScreen.tsx (L130):

```tsx
import { useResetStyleMemory } from '../hooks/useResetStyleMemory';

const { mutate: resetMemory, isPending: isResetting } = useResetStyleMemory();

const handleResetStyleMemory = () => {
  Alert.alert(
    'Reset style memory',
    'BURS will forget your past outfit reactions and pairing preferences. Your wardrobe and outfits stay.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () =>
          resetMemory(undefined, {
            onSuccess: () => Alert.alert('Done', 'Style memory cleared.'),
            onError: (err) => Alert.alert('Could not reset', err.message),
          }),
      },
    ],
  );
};

// Row gets disabled={isResetting}.
```

---

## Acceptance gates

```bash
cd mobile && npx tsc --noEmit
```
Expected: 0 errors.

**Manual smoke test (test user only):**
1. Create a throwaway test user via the existing AuthScreen sign-up flow.
2. Add 1 garment to seed `garments`/`render_jobs`/`feedback_signals` rows.
3. Tap Settings → Account → Delete → confirm → confirm again.
4. Verify: app navigates back to AuthScreen, user is signed out, and (via Supabase MCP or SQL editor) `select count(*) from garments where user_id = '<test-id>'` returns 0.
5. Recreate the user, seed style memory rows by reacting to an outfit.
6. Tap Settings → Privacy → Reset style memory → confirm. See "Done" alert.
7. Verify `select count(*) from feedback_signals where user_id = '<test-id>'` returns 0.

**Grep verification — no fakes remain:**
```bash
grep -n "Account deletion requested\|Style memory cleared" mobile/src/screens/Settings*.tsx
```
Expected: zero matches (except the *real* "Style memory cleared" success alert above, which is desired).

**Code-reviewer subagent:** see `mobile/CLAUDE.md`.

---

## PR template

**Title:** `feat(mobile): M1 — real account deletion + reset style memory`

**Body:**
```
## Wave
M1 — Destructive mutations (`docs/launch/mobile-w1-destructive-mutations.md`)

## Problem
Four Settings screens fire fake Alert.alert(...) stubs for account deletion
and reset-style-memory. App Store guideline 5.1.1(v) requires a real account
deletion path. Both edge functions already exist server-side; mobile only
needs the hooks + screen wiring.

## Fix
- New hook `useDeleteAccount` calling `delete_user_account` edge function
  with idempotency key + signOut on success
- New hook `useResetStyleMemory` calling `reset_style_memory` edge function
  with style-DNA / profile / ai-suggestions cache invalidation
- Two-step destructive Alert pattern at every call site (Settings, Privacy,
  Style)
- Loading state via `isPending` on each row

## Files touched
- New: mobile/src/hooks/useDeleteAccount.ts, mobile/src/hooks/useResetStyleMemory.ts
- Modified: mobile/src/screens/{SettingsAccountScreen,SettingsPrivacyScreen,SettingsScreen,SettingsStyleScreen}.tsx

## Verification
- TypeScript: 0 errors
- Code-reviewer subagent: approved
- Manual test: delete a throwaway test user end-to-end → confirmed cascade
  (Supabase: 0 garments after delete)
- Reset memory test: feedback_signals cleared post-reset

## Out of scope
- (None)
```

---

## Tracker updates (in this PR)

1. `docs/launch/mobile-launch-overview.md`:
   - M1 row Status: `🔄 TODO` → `[DONE] (PR #<N>, 2026-05-XX)`
   - CURRENT WAVE pointer → M2
   - LAST UPDATED → today

2. `docs/launch/completion-log.md`:
   - `| 2026-05-XX | M1 | feat(mobile): real account deletion + reset style memory | PR #<N> |`

3. `CLAUDE.md` root:
   - CURRENT WAVE → `Mobile Launch M2 — Privacy/Terms + password reset + deep links`
   - CURRENT WAVE FILE → `docs/launch/mobile-w2-privacy-password.md`
