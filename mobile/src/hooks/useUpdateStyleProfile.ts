// useUpdateStyleProfile — partial-update mutation for the V4 style profile.
//
// SettingsStyleScreen (M38) lets the user edit slices of `style_profile_v4_jsonb`
// post-onboarding. Each section calls this hook with a partial patch — the
// mutation merges the patch into the cached V4 profile, recomputes the V3-
// compat mirror, and writes BOTH back atomically via the
// `merge_profile_preferences_jsonb` RPC (top-level keys: `style_profile_v4_jsonb`
// + `styleProfile`).
//
// Why we recompute the V3 mirror on every edit: AI engine consumers
// (`burs_style_engine`, `_shared/outfit-scoring*`, `style_chat`, …) read
// `preferences.styleProfile` in V3 vocab. If we only updated the V4 slot,
// those consumers would keep emitting prompts based on the stale onboarding-
// time mirror. See `mobile/src/lib/styleProfileV4.ts:migrateV4ToV3Compat`.
//
// Atomicity: the RPC takes a row-level write lock and applies right-wins
// merge in a single statement — concurrent writers (e.g. Apply on two
// sections in quick succession) cannot interleave-clobber each other's
// keys. See `supabase/migrations/20260507120400_atomic_profile_jsonb_merge_rpcs.sql`.
//
// Touched semantics: this hook is called AFTER onboarding, so the user is
// editing values they may or may not have explicitly tapped originally.
// We pass `undefined` for `touched` to migrateV4ToV3Compat — every edit
// is treated as a definitive answer (matches web's edit path: a field
// shown as a current value and re-saved IS what the user wants).

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { captureMutationError } from '../lib/sentry';
import {
  defaultStyleProfileV4,
  migrateV4ToV3Compat,
  parseStyleProfileV4,
  type StyleProfileV4,
} from '../lib/styleProfileV4';

/** Partial-update payload — any subset of V4 fields. The hook merges it
 * into the cached V4 profile so callers can patch one section at a time. */
export type StyleProfilePatch = Partial<StyleProfileV4>;

/** Read the current V4 profile from the in-memory AuthContext profile.
 * Falls back to defaults when no quiz answers exist yet (e.g. a user who
 * skipped onboarding entirely and lands on SettingsStyle). The defensive
 * parser drops malformed fields rather than throwing. */
function readCurrentV4(prefs: unknown): StyleProfileV4 {
  if (!prefs || typeof prefs !== 'object') return defaultStyleProfileV4();
  const obj = prefs as Record<string, unknown>;
  const raw = obj['style_profile_v4_jsonb'] ?? obj['style_profile_v4'];
  if (!raw) return defaultStyleProfileV4();
  return parseStyleProfileV4(raw);
}

export function useUpdateStyleProfile() {
  const queryClient = useQueryClient();
  const { user, profile, refreshProfile } = useAuth();

  return useMutation({
    mutationFn: async (patch: StyleProfilePatch) => {
      if (!user) throw new Error('Not authenticated');

      const current = readCurrentV4(profile?.preferences);
      // Right-wins merge: caller patch overrides current values. Version
      // is force-pinned to 4 so a stale cached profile cannot persist a
      // wrong version literal back to the column.
      const next: StyleProfileV4 = { ...current, ...patch, version: 4 };

      // Recompute the V3 mirror so legacy AI engine readers see the new
      // values. Pass no `touched` map — edits are definitive answers.
      const v3Mirror = migrateV4ToV3Compat(next);

      const rpcPatch: Record<string, unknown> = {
        style_profile_v4_jsonb: next,
        styleProfile: v3Mirror,
      };

      const { error } = await supabase.rpc('merge_profile_preferences_jsonb', {
        p_patch: rpcPatch,
      });
      if (error) throw new Error(error.message);

      return next;
    },
    onSuccess: async () => {
      // Refresh AuthContext's cached profile so SettingsStyleScreen reads
      // the new values on its next render. Without this, the screen would
      // keep showing the pre-mutation state until the next auth event.
      await refreshProfile();
      // Style DNA derives from the V4 profile (fallback path) — invalidate
      // so the preview card on this screen + ProfileScreen re-renders with
      // the new values. The summary-row path uses staleTime: 5min and is
      // not affected by direct V4 edits anyway.
      queryClient.invalidateQueries({ queryKey: ['styleDNA', user?.id] });
    },
    onError: captureMutationError('useUpdateStyleProfile'),
  });
}
