// Pure helpers + types for `useGenerateTravelCapsule`. Lives in a
// sibling file so the hook body stays focused on TanStack wiring.

import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import type {
  TravelCapsuleMustHave,
  TravelCapsuleOutfit,
  TravelCapsulePackingItem,
} from './useTravelCapsules';

/** Re-export of the canonical sentinel under the historic name —
 *  TravelCapsuleScreen still imports it as `TRAVEL_CAPSULE_SUBSCRIPTION_SENTINEL`. */
export const TRAVEL_CAPSULE_SUBSCRIPTION_SENTINEL = SUBSCRIPTION_SENTINEL;

export type TravelCapsuleWeather = {
  temperature_min: number;
  temperature_max: number;
  condition?: string;
};

export type GenerateTravelCapsuleParams = {
  destination: string;
  dates: { start: string; end: string };
  occasions: string[];
  /** Optional inferred weather window (web sends `null` when the lookup
   *  failed; the edge function defaults to 10–22°C). */
  weather?: TravelCapsuleWeather | null;
  /** Mirrors web's request envelope. Defaults preserve the edge function's
   *  fallbacks when undefined. */
  tripType?: string;
  outfitsPerDay?: number;
  /** Optional list of garment IDs the user explicitly wants in the capsule.
   *  M28(b) wired the mobile wizard's new "Pick must-haves" step to this
   *  parameter — each id becomes a `source: 'picker'` entry in the saved
   *  must_haves array (status='have'), distinct from the AI-emitted
   *  `coverage_gaps` which seed `source: 'gap'` entries (status='unsure').
   *  See `seedMustHaves` below. */
  mustHaveItemIds?: string[];
  /** Optional companion to `mustHaveItemIds` — a snapshot of the picked
   *  garments' display data (title / category / image) so the hook can
   *  hydrate the must_haves rows without a second query. The screen passes
   *  this from `useFlatGarments().data`; ids without a matching snapshot
   *  fall back to a label of just the id (defensive). */
  mustHaveGarments?: readonly {
    id: string;
    title?: string | null;
    category?: string | null;
    image_path?: string | null;
  }[];
  minimizeItems?: boolean;
  includeTravelDays?: boolean;
  luggageType?: 'carry_on' | 'carry_on_personal' | 'checked';
  companions?: 'solo' | 'partner' | 'friends' | 'family';
  stylePreference?: 'casual' | 'balanced' | 'dressy';
};

export type EdgeCapsuleItem = {
  id: string;
  title: string;
  category: string;
  color_primary?: string;
  image_path?: string;
};

/** Coverage-gap entry as emitted by `supabase/functions/travel_capsule/index.ts`
 *  (`buildCoverageGaps`). Always carries a stable enum `code`, a human
 *  `message`, and optionally an `uncovered_outfits` count or a list of
 *  `missing_slots`. */
export type EdgeCoverageGap = {
  code: string;
  message: string;
  missing_slots?: string[];
  uncovered_outfits?: number;
};

export type EdgeTravelCapsuleResponse = {
  capsule_items?: EdgeCapsuleItem[];
  outfits?: TravelCapsuleOutfit[];
  packing_list?: TravelCapsulePackingItem[];
  packing_tips?: string[];
  coverage_gaps?: EdgeCoverageGap[];
  total_combinations?: number;
  reasoning?: string;
  trip_type?: string;
  duration_days?: number;
  weather_min?: number | null;
  weather_max?: number | null;
  error?: string;
};

export type GenerateTravelCapsuleResult = {
  capsule_id: string;
  capsule_items: EdgeCapsuleItem[];
  packing_list: TravelCapsulePackingItem[];
  must_haves: TravelCapsuleMustHave[];
  outfits: TravelCapsuleOutfit[];
};

/** Build the seed must-haves list. M28(b) introduced two-tier seeding:
 *
 *  PRIMARY (`source: 'picker'`) — for each id in `mustHaveItemIds` the
 *    matching garment summary from `mustHaveGarments` becomes a row tagged
 *    `status: 'have'`. These appear in TravelMustHaves under the
 *    "Your picks" section. Stable id: `pick-<garmentId>`.
 *
 *  SECONDARY (`source: 'gap'`) — the AI-emitted `coverage_gaps` array
 *    surfaces "what's missing for this trip from the user's current
 *    wardrobe". Each gap becomes a tri-state row tagged `status: 'unsure'`
 *    rendered under the "We also noticed gaps for this trip" header.
 *    Stable id: `gap-<code>` (or `gap-<code>-<n>` on duplicate codes —
 *    see below).
 *
 *  Order: picker entries first (the user-curated layer is the primary
 *  story), then gaps. Empty `mustHaveItemIds` is supported — the screen
 *  treats it as "AI-only" mode and the resulting array is gaps-only.
 *
 *  Both layers persist into the same `must_haves` JSONB array — the
 *  TravelMustHaves screen splits them by `source` for display.
 *
 *  When both arrays are empty (well-stocked wardrobe + no picks), this
 *  returns []; TravelMustHavesScreen renders the empty-state Card. */
export function seedMustHaves(
  coverageGaps: EdgeCoverageGap[],
  pickerIds: readonly string[],
  pickerGarments: readonly {
    id: string;
    title?: string | null;
    category?: string | null;
    image_path?: string | null;
  }[],
): TravelCapsuleMustHave[] {
  // ─── Primary: user-curated picker entries ─────────────────────────────
  // Build a lookup table once so an O(N) pickerIds loop doesn't degrade
  // into O(N*M). Defensive — `pickerGarments` may not include every id
  // (e.g. wardrobe filter narrowed the snapshot before the user advanced),
  // in which case the picker entry falls back to the bare id as label.
  const lookup = new Map<string, (typeof pickerGarments)[number]>();
  for (const g of pickerGarments) {
    if (typeof g?.id === 'string' && g.id.length > 0) lookup.set(g.id, g);
  }

  const seenPickerIds = new Set<string>();
  const picks: TravelCapsuleMustHave[] = [];
  for (const id of pickerIds) {
    if (typeof id !== 'string' || id.length === 0) continue;
    // Defensive against accidental duplicates in the picker selection —
    // the screen should already dedupe but a stale state reduce could
    // sneak one through. Keep first occurrence, drop duplicates.
    if (seenPickerIds.has(id)) continue;
    seenPickerIds.add(id);
    const snapshot = lookup.get(id);
    picks.push({
      id: `pick-${id}`,
      label: snapshot?.title ?? id,
      category: snapshot?.category ?? null,
      garment_id: id,
      image_path: snapshot?.image_path ?? null,
      status: 'have' as const,
      source: 'picker' as const,
    });
  }

  // ─── Secondary: AI coverage_gaps ──────────────────────────────────────
  // Audit follow-up (2026-05-07): the AI can emit two gaps with the same
  // `code` (e.g. two distinct missing slots that both classify as
  // `missing_top`). Without a per-code counter the synthesized ids
  // (`gap-<code>`) collide, breaking React's reconciliation (key
  // warnings + state bleed when one row's status flips and the duplicate
  // keys make React reuse the wrong DOM/native node). Keep the first
  // occurrence as `gap-<code>` (preserves any persisted ids that already
  // landed under the previous shape) and append `-<n>` for subsequent
  // ones starting at n=2.
  const counts = new Map<string, number>();
  const gaps: TravelCapsuleMustHave[] = coverageGaps
    .filter((gap) => typeof gap?.code === 'string' && gap.code.length > 0)
    .map((gap) => {
      const seen = (counts.get(gap.code) ?? 0) + 1;
      counts.set(gap.code, seen);
      const id = seen === 1 ? `gap-${gap.code}` : `gap-${gap.code}-${seen}`;
      return {
        id,
        label: gap.message ?? '',
        // No clean category for gap rows — leave null so the row eyebrow
        // doesn't render a stray label.
        category: null,
        garment_id: null,
        image_path: null,
        status: 'unsure' as const,
        source: 'gap' as const,
      };
    });

  return [...picks, ...gaps];
}
