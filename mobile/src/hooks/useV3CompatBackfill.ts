// useV3CompatBackfill — one-shot per-session migration for pre-M25 users.
//
// Background: M25 introduced dual-write of `preferences.styleProfile` (V3-shaped
// mirror) alongside `preferences.style_profile_v4_jsonb` (canonical V4). The AI
// engine consumers (`burs_style_engine`, `_shared/outfit-scoring*`,
// `_shared/style-summary-builder`, `suggest_outfit_combinations`,
// `shopping_chat`, `style_chat`) read `preferences.styleProfile` in V3 vocab.
// Users who completed onboarding BEFORE the M25 dual-write landed have V4 data
// but NO V3 mirror — the AI emits empty / generic prompt lines for them on
// every outfit / chat / score path until they retake the quiz.
//
// This hook detects that state once per app session per user and back-fills
// the V3 mirror by running `migrateV4ToV3Compat(v4)` (without touched flags —
// we accept the default-as-answer cost; better than empty). Idempotent: if
// `preferences.styleProfile` already exists with at least one V3 mirror key,
// we no-op.
//
// Why hook (not edge function): mobile already has the V4 record cached on
// `profile.preferences`, the migration helper is already client-side, and a
// per-user backfill is cheap. A server-side batch backfill is the alternative
// path; the trade-off is mobile-only coverage today (web users are unaffected
// because web's onboarding always wrote both shapes from M25 onward, and a
// pre-M25 web user retaking the quiz on web also dual-writes).
//
// Mount point: AuthContext, after the profile resolves. The dedupe ref keeps
// the write at most once per (app session × user.id).

import { useEffect, useRef } from 'react';

import { supabase } from '../lib/supabase';
import { Sentry } from '../lib/sentry';
import {
  migrateV4ToV3Compat,
  parseStyleProfileV4,
} from '../lib/styleProfileV4';
import type { Profile } from '../contexts/AuthContext';

/** "Has a non-empty V3 mirror" sniffer. Presence of `version: 4` only means
 *  the V4 record exists; the mirror's distinguishing keys are V3-vocab only.
 *  We test for `bursGoal` (V3-only key emitted by the shim) OR a V3-vocab
 *  `gender` value (`male`/`female`/`nonbinary`) since those don't appear in
 *  V4 and can't be present unless the shim ran. If neither is present, the
 *  styleProfile slot is either missing or only contains the V4 raw — backfill. */
function hasV3Mirror(prefs: Record<string, unknown> | null | undefined): boolean {
  if (!prefs || typeof prefs !== 'object') return false;
  const sp = (prefs as Record<string, unknown>).styleProfile;
  if (!sp || typeof sp !== 'object') return false;
  const obj = sp as Record<string, unknown>;
  if (typeof obj.bursGoal === 'string' && obj.bursGoal.length > 0) return true;
  const g = obj.gender;
  if (g === 'male' || g === 'female' || g === 'nonbinary' || g === 'prefer_not') {
    return true;
  }
  return false;
}

/**
 * Mount once at the auth root (AuthContext). Runs the V3-compat backfill at
 * most once per (app session × user.id).
 */
export function useV3CompatBackfill(profile: Profile | null): void {
  // Session-scoped dedupe so a profile refresh during the session doesn't
  // re-trigger the write. Module-scope would survive sign-out / sign-in to
  // a different account, which we don't want — keep it on the hook so it
  // resets when AuthProvider re-mounts (sign-out clears profile → next
  // sign-in starts a fresh ref).
  const ranForUserRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!profile) return;
    const userId = profile.id;
    if (!userId) return;
    if (ranForUserRef.current.has(userId)) return;

    const prefs = (profile.preferences ?? null) as Record<string, unknown> | null;
    const v4Raw = prefs?.style_profile_v4_jsonb;
    if (!v4Raw || typeof v4Raw !== 'object') return;
    if (hasV3Mirror(prefs)) return;

    // Mark before the async work so a fast re-render with the same profile
    // doesn't double-fire. If the write fails we leave the mark in place —
    // a noisy retry loop on a misconfigured row would be worse than waiting
    // for the next app launch.
    ranForUserRef.current.add(userId);

    let cancelled = false;
    (async () => {
      try {
        // Read the freshest preferences row before merging — the cached
        // `profile.preferences` could be a snapshot from before another
        // writer (web onboarding, future RPC, etc.) updated it. Canonical
        // RMW pattern (mirrors useFirstRunCoach completion path).
        const { data: row, error: readError } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('id', userId)
          .maybeSingle();
        if (cancelled || readError) {
          if (readError) {
            Sentry.addBreadcrumb({
              category: 'v3-compat-backfill',
              level: 'warning',
              message: 'read failed',
              data: { code: (readError as { code?: string }).code },
            });
          }
          return;
        }

        const fresh = (row?.preferences ?? {}) as Record<string, unknown>;
        const freshV4 = fresh.style_profile_v4_jsonb;
        // Re-check on the fresh row in case another client just wrote the
        // mirror or removed the V4 record between the cached profile read
        // and our select.
        if (!freshV4 || typeof freshV4 !== 'object') return;
        if (hasV3Mirror(fresh)) return;

        // Run the migration without touched flags — we don't have them for
        // pre-M25 users. The cost is that scalar defaults (`paletteVibe`,
        // `patternComfort`, etc.) are written as definitive answers. That's
        // strictly better than the current "empty mirror → AI flies blind"
        // state and matches what these users would have gotten if they'd
        // completed onboarding post-M25 with the same skip pattern.
        const v4 = parseStyleProfileV4(freshV4);
        const styleProfile = migrateV4ToV3Compat(v4);

        const merged: Record<string, unknown> = {
          ...fresh,
          styleProfile,
        };

        const { error: writeError } = await supabase
          .from('profiles')
          .update({ preferences: merged })
          .eq('id', userId);
        if (cancelled) return;
        if (writeError) {
          Sentry.addBreadcrumb({
            category: 'v3-compat-backfill',
            level: 'error',
            message: 'write failed',
            data: { code: (writeError as { code?: string }).code },
          });
          return;
        }
        Sentry.addBreadcrumb({
          category: 'v3-compat-backfill',
          level: 'info',
          message: 'backfilled styleProfile mirror',
        });
      } catch (err) {
        Sentry.addBreadcrumb({
          category: 'v3-compat-backfill',
          level: 'error',
          message: 'threw',
          data: { error: String(err) },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);
}
