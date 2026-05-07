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
// Persistence pattern: read-modify-write merge of `profiles.preferences`
// (preserves sibling keys — `onboarding.*`, `style_profile_v4_jsonb`,
// `accent_color`, `shopping_list_jsonb`, etc.) — mirrors the canonical merge
// in OnboardingScreen.tsx and usePickMustHaves.ts.

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { captureMutationError } from '../lib/sentry';

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

const STEP_QUERY_KEY = (userId: string | undefined) => ['coachTour:step', userId];
const STATUS_QUERY_KEY = (userId: string | undefined) => ['coachTour:status', userId];

interface CoachTourStatus {
  /** ISO timestamp when the user finished (or skipped) the tour, or null if
   * the tour is still pending. */
  completedAt: string | null;
}

/**
 * Defensive parser — accepts the raw `preferences.coach_tour_completed_at`
 * value and returns a strictly-typed CoachTourStatus. Anything else
 * downgrades to `completedAt: null` so a malformed JSONB column doesn't
 * crash the consumer.
 */
function parseStatus(value: unknown): CoachTourStatus {
  if (typeof value === 'string' && value.length > 0) {
    return { completedAt: value };
  }
  return { completedAt: null };
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

  // Status query — reads `profiles.preferences.coach_tour_completed_at`.
  // Defensive: any read error falls through to `completedAt = null` which
  // would normally show the tour, BUT we gate `shouldShow` on
  // `status.isSuccess` AND `!completedAt` so an in-flight or errored profile
  // load defaults to "don't show" rather than racing the user with an
  // overlay before we know whether it should appear at all.
  const status = useQuery<CoachTourStatus, Error>({
    queryKey: STATUS_QUERY_KEY(user?.id),
    enabled: !!user,
    staleTime: Infinity, // one-shot read; the mutation below sets the cache directly.
    queryFn: async () => {
      if (!user) return { completedAt: null };
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      const prefs = (data?.preferences ?? null) as Record<string, unknown> | null;
      return parseStatus(prefs?.coach_tour_completed_at ?? null);
    },
  });

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

  const completeMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      // Read-modify-write merge — preserve every sibling preferences key
      // (onboarding.*, language, style_profile_v4_jsonb, accent_color,
      // shopping_list_jsonb, etc.). UPDATE on a JSONB column with a fresh
      // object replaces the entire value, not merges, so we MUST hydrate
      // the existing row first.
      const { data: existing, error: readError } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle();
      if (readError) throw readError;

      const prevPrefs = (existing?.preferences ?? {}) as Record<string, unknown>;
      const completedAt = new Date().toISOString();
      const mergedPrefs = {
        ...prevPrefs,
        coach_tour_completed_at: completedAt,
      };

      const { error: writeError } = await supabase
        .from('profiles')
        .update({ preferences: mergedPrefs })
        .eq('id', user.id);
      if (writeError) throw writeError;
    },
    onMutate: () => {
      // Optimistic — flip the cached status immediately so the overlay
      // disappears before the round-trip lands. If the write fails, the
      // onError below rolls back via the previous snapshot.
      const prev = queryClient.getQueryData<CoachTourStatus>(
        STATUS_QUERY_KEY(user?.id),
      );
      queryClient.setQueryData<CoachTourStatus>(STATUS_QUERY_KEY(user?.id), {
        completedAt: new Date().toISOString(),
      });
      return { prev };
    },
    onError: (err, _vars, context) => {
      const ctx = context as { prev: CoachTourStatus | undefined } | undefined;
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(STATUS_QUERY_KEY(user?.id), ctx.prev);
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
  }, [currentStep, completeMutation, queryClient, user?.id]);

  const skip = useCallback(() => {
    // Skip jumps directly to completion, same persistence path as the
    // final advance(). Mirrors the wave brief: "skip = mark done now".
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
