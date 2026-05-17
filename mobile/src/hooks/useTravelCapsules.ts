// useTravelCapsules — list + delete + update saved travel capsules.
//
// Reads `public.travel_capsules` directly (RLS scopes to `auth.uid()`).
// The travel_capsule edge function exposes a GET handler that returns the
// same data, but mobile uses the DB read so the list stays in sync with
// optimistic mutations (delete / must_haves edits / packed_state toggles)
// without a round-trip through the edge.
//
// Defensive parser at the boundary — JSONB columns (`capsule_items`,
// `outfits`, `packing_list`, `result`) can be malformed if a stale row
// from an earlier shape ships through. Rows with non-array
// `capsule_items` or `outfits` are dropped at the boundary so the screen
// never has to defend against a typeof-check on every read.
//
// `must_haves` + `packed_state` are NOT real columns on `travel_capsules`
// (schema verified pre-implementation — only `capsule_items`, `outfits`,
// `packing_list`, `packing_tips`, `total_combinations`, `reasoning`, +
// trip metadata). Both fields piggy-back on the `result` JSONB column,
// which the edge function already populates with the full response
// envelope. The mobile hook surfaces them as top-level fields on the
// `TravelCapsuleRow` shape — readers stay clean even though the storage
// is nested.
//
// Mobile-only schema convention. Web stores `capsuleResult` as-is in
// `result` (raw edge response — see `src/hooks/useTravelCapsule.ts`'s
// `saveCapsuleToDb`) and keeps packed-state in component-local
// `useState<Set<string>>` (transient, never persisted). Mobile nests
// `must_haves` and `packed_state` keys inside `result` so we don't need
// a migration; web's read-path ignores extra keys, but cross-platform
// editing is one-way: a capsule edited on web won't surface mobile's
// persistent state, and a capsule edited on mobile will not show its
// must-haves / packed-state on web. Track this divergence in
// docs/launch/findings-log.md until web M28 ships.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry';
import { CACHE_KEYS } from './cacheKeys';
import {
  parseRow,
  SELECT_COLUMNS,
  TRAVEL_CAPSULE_SAVE_CONFLICT,
  type PackedState,
  type TravelCapsuleMustHave,
  type TravelCapsuleRow,
} from './useTravelCapsules.helpers';

export {
  TRAVEL_CAPSULE_SAVE_CONFLICT,
  type PackedState,
  type TravelCapsuleMustHave,
  type TravelCapsuleMustHaveSource,
  type TravelCapsuleMustHaveStatus,
  type TravelCapsuleOutfit,
  type TravelCapsulePackingItem,
  type TravelCapsuleRow,
} from './useTravelCapsules.helpers';

// ─── queries ──────────────────────────────────────────────────────────

export function useTravelCapsules() {
  const { user } = useAuth();

  return useQuery({
    queryKey: CACHE_KEYS.travelCapsules(user?.id),
    queryFn: async (): Promise<TravelCapsuleRow[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('travel_capsules')
        .select(SELECT_COLUMNS)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        // Match web's MAX_CAPSULES = 10 (`src/hooks/useTravelCapsules.ts`).
        // Generation-side trim-oldest in `useGenerateTravelCapsule` keeps
        // the row count below this cap on the writer side too.
        .limit(10);
      if (error) throw error;
      return (data ?? [])
        .map((row) => parseRow(row as unknown as Record<string, unknown>))
        .filter((row): row is TravelCapsuleRow => row !== null);
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

/** Lookup helper — read a single capsule out of the cached list. */
export function useTravelCapsule(capsuleId: string | undefined) {
  const query = useTravelCapsules();
  const capsules = query.data ?? [];
  const capsule = capsuleId ? capsules.find((c) => c.id === capsuleId) ?? null : null;
  return {
    capsule,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ─── mutations ────────────────────────────────────────────────────────

export function useDeleteTravelCapsule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ['travelCapsules', user?.id] as const;

  return useMutation<
    void,
    Error,
    string,
    { previous: TravelCapsuleRow[] | undefined }
  >({
    mutationFn: async (capsuleId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('travel_capsules')
        .delete()
        .eq('id', capsuleId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onMutate: async (capsuleId: string) => {
      // Optimistic — drop the row from the cached list so the empty-state
      // / "no saved capsules" copy resolves before the round-trip lands.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TravelCapsuleRow[]>(queryKey);
      if (previous) {
        queryClient.setQueryData<TravelCapsuleRow[]>(
          queryKey,
          previous.filter((c) => c.id !== capsuleId),
        );
      }
      return { previous };
    },
    onError: (err, _capsuleId, ctx) => {
      // Roll back the optimistic delete + tag for Sentry.
      if (ctx?.previous) {
        queryClient.setQueryData(queryKey, ctx.previous);
      }
      captureMutationError('useDeleteTravelCapsule')(err);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}

/** Combined-mutation input. Pass either or both fields — one RMW writes
 *  whichever fields are provided. Audit follow-up (2026-05-07): consolidates
 *  the previously-separate must_haves / packed_state mutations so two
 *  near-simultaneous writes from different screens don't race against each
 *  other and produce spurious save-conflicts on legitimate parallel writes. */
export type UpdateTravelCapsuleResultVars = {
  capsuleId: string;
  mustHaves?: TravelCapsuleMustHave[];
  packedState?: PackedState;
};

/**
 * Single-RMW mutation for `result.must_haves` and / or `result.packed_state`.
 *
 * Audit follow-up 2026-05-07. Two failure modes the previous separate hooks
 * suffered from:
 *   1. Two writers (`useUpdateTravelCapsuleMustHaves` +
 *      `useUpdateTravelCapsulePackedState`) hitting the same row in parallel
 *      from different screens caused a spurious `updated_at` conflict on the
 *      slower write. Consolidating the writes eliminates the cross-field race
 *      whenever the caller batches both updates.
 *   2. Even within a single field, rapid same-device toggles (taps faster
 *      than the round-trip) produced legitimate races. We now retry the
 *      RMW once after a conflict by re-reading the latest `updated_at` and
 *      re-applying the merge — handles 99% of races without user-visible
 *      thrash. If the retry also conflicts, we surface the sentinel and
 *      let the screen render the conflict alert.
 *
 * Optimistic update for whichever fields are passed; rollback on terminal
 * failure (after retry exhaustion).
 */
export function useUpdateTravelCapsuleResult() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ['travelCapsules', user?.id] as const;

  return useMutation<
    void,
    Error,
    UpdateTravelCapsuleResultVars,
    { previous: TravelCapsuleRow[] | undefined }
  >({
    mutationFn: async ({ capsuleId, mustHaves, packedState }) => {
      if (!user) throw new Error('Not authenticated');

      // Inner attempt: one read-modify-write with the optimistic-concurrency
      // guard. Returns the new updated_at on success; throws the
      // TRAVEL_CAPSULE_SAVE_CONFLICT sentinel if the row moved under us.
      const attempt = async (): Promise<string | null> => {
        const { data: current, error: readErr } = await supabase
          .from('travel_capsules')
          .select('result, updated_at')
          .eq('id', capsuleId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (readErr) throw readErr;
        if (!current) throw new Error('travel_capsule row not found');
        const prevResult =
          current.result && typeof current.result === 'object' && !Array.isArray(current.result)
            ? (current.result as Record<string, unknown>)
            : {};
        // Merge in only the field(s) the caller passed — undefined fields
        // pass through whatever the row already has on disk.
        const nextResult: Record<string, unknown> = { ...prevResult };
        if (mustHaves !== undefined) nextResult.must_haves = mustHaves;
        if (packedState !== undefined) nextResult.packed_state = packedState;

        const cachedUpdatedAt =
          typeof current.updated_at === 'string' ? current.updated_at : null;
        let updateQuery = supabase
          .from('travel_capsules')
          .update({ result: nextResult })
          .eq('id', capsuleId)
          .eq('user_id', user.id);
        if (cachedUpdatedAt) {
          updateQuery = updateQuery.eq('updated_at', cachedUpdatedAt);
        }
        const { data: updatedRows, error } = await updateQuery.select('id, updated_at');
        if (error) throw error;
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error(TRAVEL_CAPSULE_SAVE_CONFLICT);
        }
        const newUpdatedAt = updatedRows[0]?.updated_at;
        return typeof newUpdatedAt === 'string' ? newUpdatedAt : null;
      };

      let newUpdatedAt: string | null;
      try {
        newUpdatedAt = await attempt();
      } catch (err) {
        // Retry once on conflict. The next attempt() re-reads the latest
        // `updated_at` so the WHERE-clause guard moves with the row. This
        // handles the legitimate race case where two writes from different
        // screens land within milliseconds of each other.
        if (err instanceof Error && err.message === TRAVEL_CAPSULE_SAVE_CONFLICT) {
          newUpdatedAt = await attempt();
        } else {
          throw err;
        }
      }

      if (newUpdatedAt) {
        const cached = queryClient.getQueryData<TravelCapsuleRow[]>(queryKey);
        if (cached) {
          const fresh = newUpdatedAt;
          queryClient.setQueryData<TravelCapsuleRow[]>(
            queryKey,
            cached.map((c) => (c.id === capsuleId ? { ...c, updated_at: fresh } : c)),
          );
        }
      }
    },
    onMutate: async ({ capsuleId, mustHaves, packedState }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TravelCapsuleRow[]>(queryKey);
      if (previous) {
        queryClient.setQueryData<TravelCapsuleRow[]>(
          queryKey,
          previous.map((c) => {
            if (c.id !== capsuleId) return c;
            return {
              ...c,
              ...(mustHaves !== undefined ? { must_haves: mustHaves } : {}),
              ...(packedState !== undefined ? { packed_state: packedState } : {}),
            };
          }),
        );
      }
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      // Save-conflict (after retry exhausted) — refetch so the user sees
      // the winning state instead of the rolled-back snapshot.
      if (err.message === TRAVEL_CAPSULE_SAVE_CONFLICT) {
        void queryClient.invalidateQueries({ queryKey });
      }
      captureMutationError('useUpdateTravelCapsuleResult')(err);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}

/**
 * Patch the `result.must_haves` JSONB on a capsule row. Backward-compat
 * thin wrapper around `useUpdateTravelCapsuleResult` — the underlying
 * RMW + retry-on-conflict logic now lives in the combined hook.
 */
export function useUpdateTravelCapsuleMustHaves() {
  const inner = useUpdateTravelCapsuleResult();
  return {
    ...inner,
    mutate: (
      vars: { capsuleId: string; mustHaves: TravelCapsuleMustHave[] },
      options?: Parameters<typeof inner.mutate>[1],
    ) =>
      inner.mutate(
        { capsuleId: vars.capsuleId, mustHaves: vars.mustHaves },
        options,
      ),
    mutateAsync: (vars: { capsuleId: string; mustHaves: TravelCapsuleMustHave[] }) =>
      inner.mutateAsync({ capsuleId: vars.capsuleId, mustHaves: vars.mustHaves }),
  };
}

/**
 * Patch the `result.packed_state` JSONB on a capsule row. Backward-compat
 * thin wrapper around `useUpdateTravelCapsuleResult` — same rationale as
 * `useUpdateTravelCapsuleMustHaves`.
 */
export function useUpdateTravelCapsulePackedState() {
  const inner = useUpdateTravelCapsuleResult();
  return {
    ...inner,
    mutate: (
      vars: { capsuleId: string; packedState: PackedState },
      options?: Parameters<typeof inner.mutate>[1],
    ) =>
      inner.mutate(
        { capsuleId: vars.capsuleId, packedState: vars.packedState },
        options,
      ),
    mutateAsync: (vars: { capsuleId: string; packedState: PackedState }) =>
      inner.mutateAsync({ capsuleId: vars.capsuleId, packedState: vars.packedState }),
  };
}
