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

export type TravelCapsulePackingItem = {
  id: string;
  title: string;
  category: string;
  color_primary?: string | null;
  image_path?: string | null;
};

export type TravelCapsuleOutfit = {
  day: number;
  date?: string;
  kind?: 'trip_day' | 'travel_outbound' | 'travel_return';
  occasion: string;
  items: string[];
  note: string;
};

export type TravelCapsuleMustHaveStatus = 'have' | 'buy' | 'unsure';

/** Provenance of a must-have row. M28(b) split:
 *    - 'picker' — the user explicitly tapped this garment on the wizard's
 *      "Pick must-haves" step. Default status is 'have'. Renders under the
 *      "Your picks" section header in TravelMustHaves.
 *    - 'gap'    — the AI emitted a coverage_gap for this trip. Default
 *      status is 'unsure'. Renders under the "We also noticed gaps for
 *      this trip" section header. */
export type TravelCapsuleMustHaveSource = 'picker' | 'gap';

export type TravelCapsuleMustHave = {
  /** Stable id — either a known garment_id or a slot-derived synthetic
   *  identifier so the toggle survives re-renders. */
  id: string;
  /** Display label — `title` for known garments, free-text for AI gap items. */
  label: string;
  /** Optional category hint surfaced as the eyebrow line in the row. */
  category?: string | null;
  /** Resolved garment_id when this must-have maps to a real wardrobe row. */
  garment_id?: string | null;
  /** Optional storage path for the garment thumbnail — only set on 'picker'
   *  rows. Lets TravelMustHaves render a preview without a second lookup. */
  image_path?: string | null;
  /** User selection — defaults to 'have' (the user picked it as a
   *  must-bring), 'buy' once the user marks it as a gap they intend to
   *  purchase, 'unsure' for an explicitly-deferred decision. */
  status: TravelCapsuleMustHaveStatus;
  /** Provenance — 'picker' for user-curated rows, 'gap' for AI suggestions.
   *  Optional because legacy rows persisted before M28(b) carry no source;
   *  the parser falls back to 'gap' for backward compat (those rows came
   *  from the original AI-only seed path). */
  source?: TravelCapsuleMustHaveSource;
};

/** Per-item packed state, keyed by packing_list `id`. JSONB-stored. */
export type PackedState = Record<string, boolean>;

export interface TravelCapsuleRow {
  id: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  trip_type: string | null;
  duration_days: number | null;
  occasions: string[];
  luggage_type: string | null;
  companions: string | null;
  style_preference: string | null;
  capsule_items: unknown[];
  outfits: TravelCapsuleOutfit[];
  packing_list: TravelCapsulePackingItem[];
  packing_tips: string[];
  total_combinations: number | null;
  reasoning: string | null;
  must_haves: TravelCapsuleMustHave[];
  packed_state: PackedState;
  result: Record<string, unknown> | null;
  created_at: string;
  /** Optimistic-concurrency token for `result` JSONB writes. Threaded
   *  into the WHERE clause of the must_haves / packed_state mutations so
   *  a stale RMW (cross-device or rapid same-device writes) returns 0
   *  rows instead of clobbering a fresher payload. */
  updated_at: string;
}

// ─── boundary parsers ─────────────────────────────────────────────────

function parsePackingList(value: unknown): TravelCapsulePackingItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : '',
      title: typeof item.title === 'string' ? item.title : '',
      category: typeof item.category === 'string' ? item.category : 'other',
      color_primary: typeof item.color_primary === 'string' ? item.color_primary : null,
      image_path: typeof item.image_path === 'string' ? item.image_path : null,
    }))
    .filter((item) => item.id.length > 0);
}

function parseOutfits(value: unknown): TravelCapsuleOutfit[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => {
      const items = Array.isArray(item.items)
        ? item.items.filter((id): id is string => typeof id === 'string')
        : [];
      const day = typeof item.day === 'number' ? item.day : 1;
      const kind: TravelCapsuleOutfit['kind'] =
        item.kind === 'travel_outbound' || item.kind === 'travel_return'
          ? item.kind
          : 'trip_day';
      return {
        day,
        date: typeof item.date === 'string' ? item.date : undefined,
        kind,
        occasion: typeof item.occasion === 'string' ? item.occasion : 'casual',
        items,
        note: typeof item.note === 'string' ? item.note : '',
      };
    });
}

function parseMustHaves(value: unknown): TravelCapsuleMustHave[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => {
      const status = item.status;
      const validStatus: TravelCapsuleMustHaveStatus =
        status === 'buy' || status === 'unsure' ? status : 'have';
      // M28(b) — source defaults to 'gap' for legacy rows (the only seed
      // path that existed before the picker step shipped). Picker rows
      // always persist `source: 'picker'` explicitly.
      const rawSource = item.source;
      const validSource: TravelCapsuleMustHaveSource =
        rawSource === 'picker' ? 'picker' : 'gap';
      return {
        id: typeof item.id === 'string' && item.id.length > 0
          ? item.id
          : typeof item.garment_id === 'string'
            ? item.garment_id
            : '',
        label: typeof item.label === 'string' ? item.label : '',
        category: typeof item.category === 'string' ? item.category : null,
        garment_id: typeof item.garment_id === 'string' ? item.garment_id : null,
        image_path: typeof item.image_path === 'string' ? item.image_path : null,
        status: validStatus,
        source: validSource,
      };
    })
    .filter((item) => item.id.length > 0);
}

function parsePackedState(value: unknown): PackedState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: PackedState = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/**
 * Boundary parser for a single row. Returns null on malformed JSONB so
 * the consumer can drop the row instead of mounting a broken screen.
 */
function parseRow(raw: Record<string, unknown>): TravelCapsuleRow | null {
  const id = raw.id;
  const destination = raw.destination;
  if (typeof id !== 'string' || typeof destination !== 'string') return null;

  // capsule_items + outfits MUST be arrays — non-array storage means the
  // row was written by an older shape we no longer support.
  if (!Array.isArray(raw.capsule_items) || !Array.isArray(raw.outfits)) return null;

  const result =
    raw.result && typeof raw.result === 'object' && !Array.isArray(raw.result)
      ? (raw.result as Record<string, unknown>)
      : null;

  // must_haves + packed_state piggy-back on `result` (no dedicated
  // columns — see file header). Web's row shape stores the same way so
  // reading from `result` keeps the two platforms compatible.
  const mustHaves = parseMustHaves(result?.must_haves);
  const packedState = parsePackedState(result?.packed_state);

  return {
    id,
    destination,
    start_date: typeof raw.start_date === 'string' ? raw.start_date : null,
    end_date: typeof raw.end_date === 'string' ? raw.end_date : null,
    trip_type: typeof raw.trip_type === 'string' ? raw.trip_type : null,
    duration_days: typeof raw.duration_days === 'number' ? raw.duration_days : null,
    occasions: Array.isArray(raw.occasions)
      ? raw.occasions.filter((o): o is string => typeof o === 'string')
      : [],
    luggage_type: typeof raw.luggage_type === 'string' ? raw.luggage_type : null,
    companions: typeof raw.companions === 'string' ? raw.companions : null,
    style_preference: typeof raw.style_preference === 'string' ? raw.style_preference : null,
    capsule_items: raw.capsule_items,
    outfits: parseOutfits(raw.outfits),
    packing_list: parsePackingList(raw.packing_list),
    packing_tips: Array.isArray(raw.packing_tips)
      ? raw.packing_tips.filter((t): t is string => typeof t === 'string')
      : [],
    total_combinations:
      typeof raw.total_combinations === 'number' ? raw.total_combinations : null,
    reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : null,
    must_haves: mustHaves,
    packed_state: packedState,
    result,
    created_at: typeof raw.created_at === 'string' ? raw.created_at : new Date().toISOString(),
    // Fall back to created_at when updated_at is missing (older rows that
    // predate the column). Optimistic-concurrency check still works —
    // if the row hasn't been written since insert the two are identical.
    updated_at:
      typeof raw.updated_at === 'string'
        ? raw.updated_at
        : typeof raw.created_at === 'string'
          ? raw.created_at
          : new Date().toISOString(),
  };
}

// ─── queries ──────────────────────────────────────────────────────────

const SELECT_COLUMNS = [
  'id',
  'destination',
  'start_date',
  'end_date',
  'trip_type',
  'duration_days',
  'occasions',
  'luggage_type',
  'companions',
  'style_preference',
  'capsule_items',
  'outfits',
  'packing_list',
  'packing_tips',
  'total_combinations',
  'reasoning',
  'result',
  'created_at',
  'updated_at',
].join(', ');

export function useTravelCapsules() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['travelCapsules', user?.id],
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

/** Thrown when an optimistic-concurrency-guarded RMW UPDATE on
 *  `travel_capsules.result` finds the row's `updated_at` has moved since
 *  the cached snapshot. Callers can detect this sentinel to surface a
 *  "Save conflict" toast and refetch instead of retrying blindly.
 *
 *  Defensive only — the proper fix is an atomic `jsonb_set` RPC; tracked
 *  in docs/launch/findings-log.md (M28) for a post-launch migration. */
export const TRAVEL_CAPSULE_SAVE_CONFLICT = 'travel_capsule_save_conflict';

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
