// useFirstRunCoach — first-run coach overlay sequencer (M27).
//
// Drives the 4-step Home → Wardrobe → Add → Outfits coachmark walk-through.
// Source of truth for "completed" is `profiles.preferences.coach_tour_completed_at`
// (ISO timestamp). When set → tour is done → no overlay surfaces ever again.
//
// Cross-screen state strategy (per wave brief):
// The coachmark sequence spans FOUR screens. The user navigates between them
// between steps. We lift `currentStep` into the React Query cache keyed by
// `user.id` so every screen reads the same value WITHOUT prop drilling or a
// new context. `advance()` increments via `setQueryData` which triggers a
// re-render in every consumer of the same key. Each per-screen coachmark
// only renders when `currentStep === <its index>` AND the persisted
// completion timestamp is null.
//
// Defensive read: profile load failures default `shouldShow = false` so the
// tour never pops up on transient network errors and confuses the user.
//
// Persistence pattern: atomic JSONB merge of `profiles.preferences` via the
// `merge_profile_preferences_jsonb` RPC (Theme 1 post-launch audit). The
// RPC takes a row-level lock and applies Postgres' `||` merge so sibling
// keys (`onboarding.*`, `style_profile_v4_jsonb`, `accent_color`,
// `shopping_list_jsonb`, etc.) are preserved even if another writer fires
// in the same tick. Replaces the earlier client-side R-M-W which lost
// keys under contention on first launch.
//
// M27 R1 review additions (2026-05-07):
//   1. Retroactive trigger gate. Pre-M27 users have no
//      `coach_tour_completed_at` so on next launch they'd see the tour even
//      after weeks of usage. The audit follow-up (2026-05-07) replaced the
//      original `created_at > 7 days` heuristic with a stronger
//      onboarding-completion signal. The original gate produced two failure
//      modes: (a) false negatives — users 1-7 days old who completed
//      onboarding before M27 saw the tour with stale state; (b) false
//      positives — 8+-day-old accounts that never finished onboarding got
//      seeded as "tour done" before they earned it. The new gate fires the
//      seed write when the user has FINISHED onboarding (precise signal:
//      `preferences.onboarding.completed_at` set, OR legacy proxy:
//      `preferences.onboarding.completed === true` AND
//      `style_profile_v4_jsonb` exists) AND that completion is more than
//      ONBOARDING_AGE_THRESHOLD_MS ago (anti-replay so users mid-flow
//      don't get the tour seeded out from under them).
//   2. AsyncStorage persistence of `currentStep` keyed on user.id. A
//      force-quit mid-tour previously dropped the user back to step 1; we
//      hydrate from disk on mount and clear on completion / skip.
//   3. Mutation rollback resets `currentStep` to 0 on error so a failed
//      completion write doesn't leave the user stranded on step 4.
//   4. Status query errors → Sentry (the prior `useQuery` errors were
//      silently swallowed).

import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { log } from '../lib/log';
import { captureMutationError, Sentry } from '../lib/sentry';
import { CACHE_KEYS } from './cacheKeys';

/** Total number of coach overlay steps. Used by both the gating logic and
 * the "1 of 4" progress indicator inside CoachOverlay. */
export const COACH_TOUR_TOTAL = 4;

/** Step index → screen mapping (consumed by per-screen coachmarks):
 *   0 = Home (Today's look hero)
 *   1 = Wardrobe (garment grid)
 *   2 = Add (FAB on MainTabs)
 *   3 = Outfits (saved-outfits header)
 */
export type CoachStep = 0 | 1 | 2 | 3;

// Audit Issue #2 — local key factories kept as thin wrappers around the
// shared `CACHE_KEYS` factory so the rest of this hook (which references
// them in many places) doesn't need to change shape.
const STEP_QUERY_KEY = (userId: string | undefined) => CACHE_KEYS.coachTourStep(userId);
const STATUS_QUERY_KEY = (userId: string | undefined) => CACHE_KEYS.coachTourStatus(userId);

// AsyncStorage key prefix — per-user so a sign-out / sign-in to a different
// account on the same device doesn't resurrect a stale step value.
const STEP_STORAGE_KEY = (userId: string) => `burs.coachTour.step.${userId}`;

// Anti-replay threshold for the onboarding-completion gate. A user who
// finished onboarding within this window is still mid-session — we don't
// want to seed `coach_tour_completed_at` and rob them of the tour they just
// earned. One hour is generous: a typical onboarding-to-Home transition is
// seconds, and a backgrounded session that re-foregrounds well after the
// user genuinely stopped using the app is rare. After this window elapses
// without the user having seen the tour, the seed write fires.
const ONBOARDING_AGE_THRESHOLD_MS = 60 * 60 * 1000;

interface CoachTourStatus {
  /** ISO timestamp when the user finished (or skipped) the tour, or null if
   * the tour is still pending. */
  completedAt: string | null;
  /** ISO timestamp the user finished onboarding, or null if still pending.
   * Sourced from `preferences.onboarding.completed_at` (precise) — when
   * absent on legacy rows we fall back to `profiles.created_at` paired
   * with the `onboarding.completed === true` boolean + V4 quiz presence
   * proxy. The retro gate fires when this is set AND older than
   * ONBOARDING_AGE_THRESHOLD_MS. */
  onboardingCompletedAt: string | null;
}

/**
 * Defensive parser — accepts the raw `preferences` JSONB + `created_at` and
 * returns a strictly-typed CoachTourStatus. Anything else downgrades to
 * `completedAt: null` / `onboardingCompletedAt: null` so a malformed JSONB
 * column doesn't crash the consumer.
 *
 * `onboardingCompletedAt` resolution order (audit follow-up 2026-05-07):
 *   1. `preferences.onboarding.completed_at` — precise signal written by
 *      mobile's OnboardingScreen.finish() going forward.
 *   2. Legacy proxy: `preferences.onboarding.completed === true` AND
 *      `preferences.style_profile_v4_jsonb` exists → use `profiles.created_at`
 *      as a best-available timestamp. (A user who finished onboarding but
 *      didn't write completed_at must have done so before this audit
 *      follow-up; their account age is the closest safe lower bound.)
 *   3. Otherwise null — user hasn't finished onboarding; tour stays pending.
 */
function parseStatus(prefs: Record<string, unknown> | null, createdAt: string | null): CoachTourStatus {
  const onboarding =
    prefs?.onboarding && typeof prefs.onboarding === 'object'
      ? (prefs.onboarding as Record<string, unknown>)
      : null;

  const completedAtRaw = prefs?.coach_tour_completed_at;
  const completedAt =
    typeof completedAtRaw === 'string' && completedAtRaw.length > 0
      ? completedAtRaw
      : null;

  let onboardingCompletedAt: string | null = null;
  const obCompletedAt = onboarding?.completed_at;
  if (typeof obCompletedAt === 'string' && obCompletedAt.length > 0) {
    onboardingCompletedAt = obCompletedAt;
  } else {
    const obCompleted = onboarding?.completed === true;
    const hasV4 =
      !!prefs?.style_profile_v4_jsonb &&
      typeof prefs.style_profile_v4_jsonb === 'object';
    if (obCompleted && hasV4) {
      onboardingCompletedAt = createdAt;
    }
  }

  return { completedAt, onboardingCompletedAt };
}

/**
 * useFirstRunCoach — single subscription point for the per-screen
 * coachmarks. Consumers render their overlay when `shouldShow` is true AND
 * `currentStep` matches the screen's assigned index.
 */
export function useFirstRunCoach(): {
  shouldShow: boolean;
  currentStep: CoachStep;
  advance: () => void;
  skip: () => void;
  isLoading: boolean;
  completedAt: string | null;
} {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Status query — reads `profiles.preferences.coach_tour_completed_at` AND
  // `profiles.created_at` so the retroactive gate can decide whether the
  // tour applies to this account at all. A read error reports to Sentry
  // (was previously swallowed) and is gated to "don't show" by `isSuccess`.
  const status = useQuery<CoachTourStatus, Error>({
    queryKey: STATUS_QUERY_KEY(user?.id),
    enabled: !!user,
    staleTime: Infinity, // one-shot read; the mutation below sets the cache directly.
    queryFn: async () => {
      if (!user) return { completedAt: null, onboardingCompletedAt: null };
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences, created_at')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      const prefs = (data?.preferences ?? null) as Record<string, unknown> | null;
      const createdAt = (data?.created_at ?? null) as string | null;
      return parseStatus(prefs, createdAt);
    },
  });

  // M27 R1 — capture status read failures. React Query v5 removed the
  // `onError` option from useQuery; an effect watching `status.error` is
  // the canonical replacement and only fires once per error transition.
  // Without this, transient profile read failures were silently swallowed.
  useEffect(() => {
    if (status.error) {
      Sentry.withScope((s) => {
        s.setTag('hook', 'useFirstRunCoach.status');
        Sentry.captureException(status.error);
      });
    }
  }, [status.error]);

  // Local-but-shared step counter. Stored in the React Query cache so every
  // screen with a coachmark sees the same value and re-renders together
  // when `advance()` runs. Defaults to 0 (Home) for first-time consumers.
  const stepQuery = useQuery<CoachStep, Error>({
    queryKey: STEP_QUERY_KEY(user?.id),
    enabled: !!user,
    staleTime: Infinity,
    queryFn: () => 0 as CoachStep,
    // Initialize the cache eagerly so the first read returns 0 instead of
    // momentarily flashing `undefined` and skipping the Home step.
    initialData: 0 as CoachStep,
  });
  const currentStep: CoachStep = stepQuery.data ?? 0;

  // M27 R1 — hydrate `currentStep` from AsyncStorage on first mount per
  // user.id so a force-quit mid-tour doesn't reset the user back to step 1.
  // The seeder runs once per user; subsequent renders are cheap (the effect
  // body short-circuits on the loaded ref).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STEP_STORAGE_KEY(user.id));
        if (cancelled || raw === null) return;
        const parsed = parseInt(raw, 10);
        if (
          !Number.isFinite(parsed) ||
          parsed < 0 ||
          parsed >= COACH_TOUR_TOTAL
        ) {
          return;
        }
        const current = queryClient.getQueryData<CoachStep>(
          STEP_QUERY_KEY(user.id),
        );
        // Only hydrate if the cache hasn't already been advanced past the
        // persisted value (e.g. a fast Next tap mid-hydration).
        if ((current ?? 0) < parsed) {
          queryClient.setQueryData<CoachStep>(
            STEP_QUERY_KEY(user.id),
            parsed as CoachStep,
          );
        }
      } catch (err) {
        log.error(err, { context: 'useFirstRunCoach.hydrate_step_failed' });
        // Best-effort: failure to hydrate just falls through to step 0.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, queryClient]);

  // Retroactive trigger gate (audit follow-up 2026-05-07). When the profile
  // resolves and shows the user finished onboarding more than
  // ONBOARDING_AGE_THRESHOLD_MS ago WITHOUT yet getting a
  // `coach_tour_completed_at` value, fire-and-forget seed the timestamp so
  // the tour stays dormant. Stronger than the original `created_at > 7 days`
  // heuristic — that signal flagged accounts that never finished onboarding
  // and missed users who finished within the first week. We DO NOT use the
  // mutation hook here — that would optimistic-flip the cached status
  // anyway, and we want a single direct write that doesn't double up with
  // the user-driven completion path. Errors silently fall through (the gate
  // is best-effort; the worst case is the user briefly sees the tour, which
  // is no worse than before this fix).
  useEffect(() => {
    if (!user || !status.isSuccess) return;
    const data = status.data;
    if (!data || data.completedAt !== null) return;
    // Gate (a) — user must have finished onboarding (precise or proxy
    // signal — see parseStatus). Users still mid-flow have null here.
    if (!data.onboardingCompletedAt) return;
    const completedMs = new Date(data.onboardingCompletedAt).getTime();
    if (!Number.isFinite(completedMs)) return;
    // Gate (b) — completion must be older than the anti-replay window so
    // we don't seed the tour out from under a user who just finished
    // onboarding seconds ago.
    if (Date.now() - completedMs < ONBOARDING_AGE_THRESHOLD_MS) return;

    let cancelled = false;
    (async () => {
      // Theme 1 (post-launch audit): atomic JSONB merge via RPC. The
      // earlier client-side R-M-W could clobber a sibling key written by
      // a concurrent writer (V3-compat backfill, onboarding finish) on
      // the same first-launch tick. The RPC takes a row-level lock and
      // applies Postgres' `||` merge in a single statement.
      const completedAt = new Date().toISOString();
      const { error: rpcError } = await supabase.rpc(
        'merge_profile_preferences_jsonb',
        { p_patch: { coach_tour_completed_at: completedAt } },
      );
      if (cancelled) return;
      if (rpcError) {
        // R1 review pickup: surface the retroactive seed failure to
        // Sentry. Pre-PR this site swallowed errors silently; the new
        // RPC can raise on transient `auth.uid() IS NULL` cold-start
        // races and we want signal when "tour re-surfaces" reports
        // come in. Breadcrumb (not exception) — best-effort path.
        Sentry.addBreadcrumb({
          category: 'first-run-coach',
          level: 'warning',
          message: 'retroactive seed RPC failed',
          data: { code: (rpcError as { code?: string }).code },
        });
        return;
      }
      queryClient.setQueryData<CoachTourStatus>(STATUS_QUERY_KEY(user.id), {
        completedAt,
        onboardingCompletedAt: data.onboardingCompletedAt,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, status.isSuccess, status.data, queryClient]);

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      // Theme 1 (post-launch audit): atomic JSONB merge via RPC. The
      // RPC takes a row-level lock + applies Postgres' `||` merge so a
      // concurrent merge (V3-compat backfill, must-haves save, onboarding
      // finish) doesn't clobber the sibling keys we leave untouched.
      const completedAt = new Date().toISOString();
      const { error: rpcError } = await supabase.rpc(
        'merge_profile_preferences_jsonb',
        { p_patch: { coach_tour_completed_at: completedAt } },
      );
      if (rpcError) throw rpcError;
    },
    onMutate: () => {
      // Optimistic — flip the cached status immediately so the overlay
      // disappears before the round-trip lands. If the write fails, the
      // onError below rolls back via the previous snapshot.
      const prev = queryClient.getQueryData<CoachTourStatus>(
        STATUS_QUERY_KEY(user?.id),
      );
      const prevStep =
        queryClient.getQueryData<CoachStep>(STEP_QUERY_KEY(user?.id)) ?? 0;
      queryClient.setQueryData<CoachTourStatus>(STATUS_QUERY_KEY(user?.id), {
        completedAt: new Date().toISOString(),
        onboardingCompletedAt: prev?.onboardingCompletedAt ?? null,
      });
      return { prev, prevStep: prevStep as CoachStep };
    },
    onSuccess: () => {
      // Tour completed — clear the persisted step so a future re-trigger
      // (e.g. a hypothetical Settings → Replay) wouldn't carry over stale
      // state. Best-effort: failure to remove the key is non-blocking.
      if (user) {
        AsyncStorage.removeItem(STEP_STORAGE_KEY(user.id)).catch((err) =>
          log.error(err, { context: 'useFirstRunCoach.clear_step_storage_failed' }),
        );
      }
    },
    onError: (err, _vars, context) => {
      const ctx = context as { prev: CoachTourStatus | undefined; prevStep: CoachStep } | undefined;
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(STATUS_QUERY_KEY(user?.id), ctx.prev);
      }
      // M27 R1 — also reset currentStep to 0 so the user doesn't get
      // stranded on step 4 (Outfits "Done") with the tour re-surfaced
      // because the rollback flipped `shouldShow` back to true. Resetting
      // to 0 lands them on Home where the rest of the sequence can replay
      // cleanly. We deliberately reset to 0 rather than ctx.prevStep —
      // prevStep would be the final step (3) which would loop the user
      // straight back into the same failing mutation on the next Next tap.
      queryClient.setQueryData<CoachStep>(STEP_QUERY_KEY(user?.id), 0 as CoachStep);
      if (user) {
        AsyncStorage.setItem(STEP_STORAGE_KEY(user.id), '0').catch((storageErr) =>
          log.error(storageErr, { context: 'useFirstRunCoach.reset_step_storage_failed' }),
        );
      }
      captureMutationError('useFirstRunCoach.complete')(err);
    },
  });

  const advance = useCallback(() => {
    const next = currentStep + 1;
    if (next >= COACH_TOUR_TOTAL) {
      // Persist completion. The optimistic onMutate above closes the
      // overlay immediately; rollback only happens if the write throws.
      completeMutation.mutate();
      return;
    }
    queryClient.setQueryData<CoachStep>(STEP_QUERY_KEY(user?.id), next as CoachStep);
    if (user) {
      AsyncStorage.setItem(STEP_STORAGE_KEY(user.id), String(next)).catch((err) =>
        log.error(err, { context: 'useFirstRunCoach.advance_step_storage_failed' }),
      );
    }
  }, [currentStep, completeMutation, queryClient, user]);

  const skip = useCallback(() => {
    // Skip jumps directly to completion, same persistence path as the
    // final advance(). Mirrors the wave brief: "skip = mark done now".
    // The Skip-confirm dialog lives in CoachOverlay so this hook stays
    // free of UI concerns.
    completeMutation.mutate();
  }, [completeMutation]);

  // Defensive gate: only show the tour when (a) auth + profile resolved
  // successfully (status.isSuccess), (b) the user actually exists, and
  // (c) the persisted timestamp is null. Errors / loading default to
  // hidden so transient failures don't surprise the user with an overlay.
  const completedAt = status.data?.completedAt ?? null;
  const shouldShow =
    !!user && status.isSuccess && completedAt === null;

  return {
    shouldShow,
    currentStep,
    advance,
    skip,
    isLoading: status.isLoading,
    completedAt,
  };
}
