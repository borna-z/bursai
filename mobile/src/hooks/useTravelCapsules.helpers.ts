// Pure parsers + types + sentinel for `useTravelCapsules`. Lives in a
// sibling file so the hook body stays focused on TanStack wiring.

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

/** Thrown when an optimistic-concurrency-guarded RMW UPDATE on
 *  `travel_capsules.result` finds the row's `updated_at` has moved since
 *  the cached snapshot. Callers can detect this sentinel to surface a
 *  "Save conflict" toast and refetch instead of retrying blindly.
 *
 *  Defensive only — the proper fix is an atomic `jsonb_set` RPC; tracked
 *  in docs/launch/findings-log.md (M28) for a post-launch migration. */
export const TRAVEL_CAPSULE_SAVE_CONFLICT = 'travel_capsule_save_conflict';

export const SELECT_COLUMNS = [
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

// ─── boundary parsers ─────────────────────────────────────────────────

export function parsePackingList(value: unknown): TravelCapsulePackingItem[] {
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

export function parseOutfits(value: unknown): TravelCapsuleOutfit[] {
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

export function parseMustHaves(value: unknown): TravelCapsuleMustHave[] {
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

export function parsePackedState(value: unknown): PackedState {
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
export function parseRow(raw: Record<string, unknown>): TravelCapsuleRow | null {
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
