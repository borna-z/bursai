// useDeleteAccount — wraps the `delete_user_account` edge function and
// signs the user out on success. The function is server-idempotent (24-
// table cascade with `ON DELETE CASCADE` + an explicit ai_response_cache
// sweep) so a network retry doesn't double-delete or strand orphan rows.
//
// App Store guideline 5.1.1(v) requires in-app account deletion, so this
// is a launch blocker — App Store reviewers test the path on day-one
// review. The screen layer (`SettingsAccountScreen`, `SettingsPrivacy
// Screen`) gates the call behind a typed-confirm dialog (`DELETE`) to
// avoid clickjacking + accidental taps, mirroring web's PR #712 pattern.
//
// Sign-out is best-effort after the cascade lands — even if it fails the
// remote rows are already gone; the local session will fail-fast on the
// next request and the auth listener clears the cache regardless.

import { useMutation } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { callEdgeFunction } from '../lib/edgeFunctionClient';
import { captureMutationError } from '../lib/sentry';

export function useDeleteAccount() {
  // AuthContext's signOut callback explicitly nulls user/session/profile
  // and clears every cache + the signed-URL Map + the offline queue,
  // even if the underlying supabase.auth.signOut() returns a transient
  // error. Codex P2 round 2: a raw supabase.auth.signOut() can fail
  // before clearing the local session, leaving the user inside the
  // protected app with a deleted auth user. The context-level wrapper
  // is the canonical "leave the app" path.
  const { signOut } = useAuth();

  return useMutation({
    mutationFn: async () => {
      // delete_user_account performs a 24-table cascade — body is empty;
      // the user's auth context drives the scope server-side.
      // idempotent: true so the wrapper sends X-Idempotency-Key. The
      // server-side ordering for THIS function is `checkIdempotency`
      // BEFORE `enforceRateLimit` (verified in
      // supabase/functions/delete_user_account/index.ts:64,72), so a
      // same-key client retry replays the cached/pending response
      // without bouncing off the rate limit. retries: 1 lets a timeout
      // mid-cascade recover instead of stranding the user inside the
      // app with their auth user already gone — Codex P2 round 3 on
      // PR #735. (Reset's ordering is the OPPOSITE — see useResetStyleMemory.)
      await callEdgeFunction('delete_user_account', {
        body: {},
        retries: 1,
        idempotent: true,
      });
      // Always tear down the local session — even if the remote
      // sign-out call fails transiently, the server-side rows are gone
      // and the next request will 401-fail. AuthContext's signOut
      // wrapper guarantees the local clear lands.
      await signOut();
    },
    onError: captureMutationError('useDeleteAccount'),
  });
}
