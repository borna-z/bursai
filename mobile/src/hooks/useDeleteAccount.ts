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
import {
  clearQueue,
  pauseReplaysAndWaitSettled,
  resumeReplays,
} from '../lib/offlineQueue';
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
      // 401 handling: the previous round-7 attempt (post-error
      // getUser() to "verify the cascade ran") still wasn't safe per
      // Codex round 8 — supabase.auth.getUser() also returns null/
      // error for plain session-invalid cases where the cascade never
      // ran, so a fall-through-to-signOut on a 401 could mislead the
      // user that their account was deleted while server data remained.
      //
      // Without a server-side "user_was_deleted" signal we can't
      // disambiguate from the client. Surface the 401 (and every other
      // error) to the screen, which asks the user to sign in again and
      // retry. If the cascade succeeded the first time, the user's
      // sign-in attempt will fail (account gone) — at that point the
      // AuthScreen surfaces the canonical "no such user" message. No
      // false-success path. Codex P1 round 8 on PR #735.
      //
      // Codex P1 round 13: pause queue replays + wait for in-flight
      // pass to settle BEFORE the delete cascade runs. Without this,
      // a queued add-garment-save replaying after delete_user_account's
      // storage-path enumeration but before the auth user is deleted
      // would insert a new row pointing at a freshly-uploaded storage
      // object the cascade never removes — orphan media after the
      // account is gone.
      await pauseReplaysAndWaitSettled();
      try {
        // retries: 3 (Codex P2 round 13) — a same-key retry within
        // the cascade window can receive a 409 Retry-After ("still
        // in-flight") from the idempotency helper. With backoff +
        // jitter ~1s/2s/4s the third retry typically lands after the
        // cascade completes (<5s observed) and gets the cached 200.
        // The idempotency key ensures the cascade itself runs once.
        await callEdgeFunction('delete_user_account', {
          body: {},
          retries: 3,
          idempotent: true,
        });
        // Clear the queue ONLY after the cascade succeeds — none of
        // the pending items will be relevant against a deleted user
        // and `signOut()` below also re-clears as defense-in-depth.
        // If the cascade FAILS, leave the queue alone so the user can
        // retry the delete (or any other queued action) later.
        await clearQueue();
        // Always tear down the local session — even if the remote
        // sign-out call fails transiently, the server-side rows are
        // gone and the next request will 401-fail. AuthContext's
        // signOut wrapper guarantees the local clear lands.
        await signOut();
      } finally {
        resumeReplays();
      }
    },
    onError: captureMutationError('useDeleteAccount'),
  });
}
