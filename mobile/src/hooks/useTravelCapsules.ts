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
// is nested. Spec asked for column-level fields, but adding columns is
// out of wave scope (no migrations) and shape compat with web's
// `useTravelCapsules` (which also nests inside `result`) keeps the two
// platforms reading the same row format.

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
  /** User selection — defaults to 'have' (the user picked it as a
   *  must-bring), 'buy' once the user marks it as a gap they intend to
   *  purchase, 'unsure' for an explicitly-deferred decision. */
  status: TravelCapsuleMustHaveStatus;
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
      return {
        id: typeof item.id === 'string' && item.id.length > 0
          ? item.id
          : typeof item.garment_id === 'string'
            ? item.garment_id
            : '',
        label: typeof item.label === 'string' ? item.label : '',
        category: typeof item.category === 'string' ? item.category : null,
        garment_id: typeof item.garment_id === 'string' ? item.garment_id : null,
        status: validStatus,
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
        .limit(50);
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

/**
 * Patch the `result.must_haves` JSONB on a capsule row. Optimistic — the
 * caller's screen reflects the toggle immediately and we reconcile on
 * settle. Failures roll back via the snapshotted previous list.
 */
export function useUpdateTravelCapsuleMustHaves() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ['travelCapsules', user?.id] as const;

  return useMutation<
    void,
    Error,
    { capsuleId: string; mustHaves: TravelCapsuleMustHave[] },
    { previous: TravelCapsuleRow[] | undefined }
  >({
    mutationFn: async ({ capsuleId, mustHaves }) => {
      if (!user) throw new Error('Not authenticated');
      // Read the current `result` payload first so the merge preserves
      // unrelated keys (web's row stores capsule_items / outfits / etc
      // inside the same blob — overwriting it would orphan that data).
      const { data: current, error: readErr } = await supabase
        .from('travel_capsules')
        .select('result')
        .eq('id', capsuleId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (readErr) throw readErr;
      const prevResult =
        current?.result && typeof current.result === 'object' && !Array.isArray(current.result)
          ? (current.result as Record<string, unknown>)
          : {};
      const nextResult = { ...prevResult, must_haves: mustHaves };
      const { error } = await supabase
        .from('travel_capsules')
        .update({ result: nextResult })
        .eq('id', capsuleId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onMutate: async ({ capsuleId, mustHaves }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TravelCapsuleRow[]>(queryKey);
      if (previous) {
        queryClient.setQueryData<TravelCapsuleRow[]>(
          queryKey,
          previous.map((c) => (c.id === capsuleId ? { ...c, must_haves: mustHaves } : c)),
        );
      }
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      captureMutationError('useUpdateTravelCapsuleMustHaves')(err);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}

/**
 * Patch the `result.packed_state` JSONB on a capsule row. Same merge
 * semantics as `useUpdateTravelCapsuleMustHaves` — read-modify-write
 * preserves sibling keys. Optimistic update + rollback on failure.
 */
export function useUpdateTravelCapsulePackedState() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ['travelCapsules', user?.id] as const;

  return useMutation<
    void,
    Error,
    { capsuleId: string; packedState: PackedState },
    { previous: TravelCapsuleRow[] | undefined }
  >({
    mutationFn: async ({ capsuleId, packedState }) => {
      if (!user) throw new Error('Not authenticated');
      const { data: current, error: readErr } = await supabase
        .from('travel_capsules')
        .select('result')
        .eq('id', capsuleId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (readErr) throw readErr;
      const prevResult =
        current?.result && typeof current.result === 'object' && !Array.isArray(current.result)
          ? (current.result as Record<string, unknown>)
          : {};
      const nextResult = { ...prevResult, packed_state: packedState };
      const { error } = await supabase
        .from('travel_capsules')
        .update({ result: nextResult })
        .eq('id', capsuleId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onMutate: async ({ capsuleId, packedState }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TravelCapsuleRow[]>(queryKey);
      if (previous) {
        queryClient.setQueryData<TravelCapsuleRow[]>(
          queryKey,
          previous.map((c) =>
            c.id === capsuleId ? { ...c, packed_state: packedState } : c,
          ),
        );
      }
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      captureMutationError('useUpdateTravelCapsulePackedState')(err);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
