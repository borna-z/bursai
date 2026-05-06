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

import { supabase } from '../lib/supabase';
import { callEdgeFunction } from '../lib/edgeFunctionClient';
import { captureMutationError } from '../lib/sentry';

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      // delete_user_account performs a 24-table cascade — body is empty;
      // the user's auth context drives the scope server-side.
      // retries: 1 because the cascade is idempotent (re-deleting an
      // already-deleted user returns success), but a hung first attempt
      // shouldn't block the user forever.
      await callEdgeFunction('delete_user_account', { body: {}, retries: 1 });
      // Sign out locally — AuthContext's SIGNED_OUT listener clears the
      // React Query cache, signed-URL cache, and offline queue. Best-
      // effort: a sign-out failure here doesn't roll back the remote
      // delete (impossible) and the next request will 401-fail anyway.
      try {
        await supabase.auth.signOut();
      } catch {
        // Swallowed — the remote cascade is the canonical signal.
      }
    },
    onError: captureMutationError('useDeleteAccount'),
  });
}
