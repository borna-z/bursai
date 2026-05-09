// useUpdateProfile — N3.9 (SettingsAccount profile-edit flow).
//
// Apple App Review will reject the build because the Full Name row in
// SettingsAccount currently pops an alert instead of letting the user edit
// their own display name. This hook is the persistence half of the new
// SettingsProfileEditScreen: it writes `display_name` to the user's
// `profiles` row and then hands the fresh profile back to AuthContext via
// `refreshProfile()` so the cached `useAuth()` consumers (header avatar
// initial, profile card name, settings rows) flip without a sign-out cycle.
//
// `display_name` is the canonical column on `profiles` (see
// `Profile.display_name` in AuthContext.tsx). The wave brief referenced
// `full_name`, but the schema uses `display_name`; we honour the schema.
//
// Avatar / `avatar_url` is intentionally NOT persisted here. The avatars
// bucket was dropped 2026-04-21 (mobile/CLAUDE.md) and there is no
// avatar_url column on `profiles`. The Edit Photo affordance is deferred
// to a follow-up PR; see SettingsProfileEditScreen for the deferral note.

import { useMutation } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { captureMutationError } from '../lib/sentry';

export type UpdateProfileInput = {
  /** Trimmed by the screen before submission; see DISPLAY_NAME_MAX_LEN. */
  display_name: string;
};

/** Matches the `Save` button validation in SettingsProfileEditScreen so the
 *  hook and the screen agree on the bound. The `profiles.display_name`
 *  column itself has no length cap — this is a UX clamp, not a DB one. */
export const DISPLAY_NAME_MIN_LEN = 1;
export const DISPLAY_NAME_MAX_LEN = 60;

export function useUpdateProfile() {
  const { user, refreshProfile } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      if (!user) throw new Error('Not authenticated');
      const trimmed = input.display_name.trim();
      if (trimmed.length < DISPLAY_NAME_MIN_LEN) {
        throw new Error('Name cannot be empty.');
      }
      if (trimmed.length > DISPLAY_NAME_MAX_LEN) {
        throw new Error(`Name must be ${DISPLAY_NAME_MAX_LEN} characters or fewer.`);
      }
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: trimmed })
        .eq('id', user.id);
      if (error) throw error;
      // Re-pull the row through AuthContext so every `useAuth()` consumer
      // (profile card initial, header greeting, settings rows) updates
      // without waiting for the next sign-in / cold start.
      await refreshProfile();
    },
    onError: captureMutationError('useUpdateProfile'),
  });
}
