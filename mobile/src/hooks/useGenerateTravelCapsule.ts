// useGenerateTravelCapsule — drives the wizard's "Build my capsule" CTA.
//
// Wraps the `travel_capsule` edge function (Gemini tool-use, ~1235 LOC).
// The function returns the AI-generated bundle but DOES NOT persist —
// verified by reading the function source end-to-end (no INSERT into
// `travel_capsules` anywhere in the POST handler). Persistence is the
// hook's responsibility, mirroring the web's `useTravelCapsule` →
// `saveCapsuleToDb` flow.
//
// Response envelope (verified at supabase/functions/travel_capsule/index.ts:1212-1226):
//   {
//     capsule_items: GarmentRow[],   // hydrated garment objects
//     outfits: PlannedCapsuleOutfit[],
//     packing_list: { id, title, category, color_primary, image_path }[],
//     packing_tips: string[],
//     coverage_gaps: CoverageGap[],
//     total_combinations: number,
//     reasoning: string,
//     trip_type: string,
//     duration_days: number,
//     weather_min: number | null,
//     weather_max: number | null,
//   }
//
// On success the hook INSERTS a row into `public.travel_capsules` and
// returns the new id alongside the response. On failure (paywall lock,
// rate limit, AbortError, etc.) it surfaces the matching sentinel:
//   - `EdgeFunctionSubscriptionLockedError` → throws 'subscription_required'
//   - all other failures → re-thrown after Sentry capture
//
// React Query's mutation contract handles retries / loading state — the
// hook keeps a per-call AbortController on top so an unmount-during-flight
// cancels the underlying fetch (matches `useGenerateOutfit`'s pattern).

import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionSubscriptionLockedError,
  SUBSCRIPTION_SENTINEL,
} from '../lib/edgeFunctionClient';
import { captureMutationError, Sentry } from '../lib/sentry';
import type {
  TravelCapsuleMustHave,
  TravelCapsuleOutfit,
  TravelCapsulePackingItem,
  TravelCapsuleRow,
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

type EdgeCapsuleItem = {
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
type EdgeCoverageGap = {
  code: string;
  message: string;
  missing_slots?: string[];
  uncovered_outfits?: number;
};

type EdgeTravelCapsuleResponse = {
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
function seedMustHaves(
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

export function useGenerateTravelCapsule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight generation when the consumer screen unmounts so
  // the trailing setState calls in callers / the underlying fetch don't
  // fire against a torn-down tree. Same pattern as useGenerateOutfit.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return useMutation<GenerateTravelCapsuleResult, Error, GenerateTravelCapsuleParams>({
    mutationFn: async (params) => {
      if (!user) throw new Error('Not authenticated');

      // Per-call controller — abort the previous in-flight call if the
      // user mashes Generate twice. The unmount cleanup above also reads
      // the ref so a screen pop kills the fetch.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const body = {
        destination: params.destination,
        start_date: params.dates.start,
        end_date: params.dates.end,
        occasions: params.occasions,
        weather: params.weather ?? null,
        trip_type: params.tripType ?? 'mixed',
        outfits_per_day: params.outfitsPerDay ?? 1,
        must_have_items: params.mustHaveItemIds ?? [],
        minimize_items: params.minimizeItems ?? true,
        include_travel_days: params.includeTravelDays ?? false,
        luggage_type: params.luggageType ?? 'carry_on_personal',
        companions: params.companions ?? 'solo',
        style_preference: params.stylePreference ?? 'balanced',
        locale: 'en',
      };

      let data: EdgeTravelCapsuleResponse;
      try {
        const raw = await callEdgeFunction<EdgeTravelCapsuleResponse>('travel_capsule', {
          body,
          // travel_capsule is slow — Gemini tool-use over the user's full
          // wardrobe routinely takes 25-45s. Bump the wrapper's timeout
          // to 60s and retry once on transient failure.
          timeoutMs: 60_000,
          retries: 1,
          signal: controller.signal,
        });
        if (!raw) {
          // 2xx with unparseable JSON body — surface as a real failure;
          // the persistence path below would fan out into broken inserts.
          throw new Error('travel_capsule_invalid_response');
        }
        data = raw;
      } catch (err) {
        if (err instanceof EdgeFunctionSubscriptionLockedError) {
          throw new Error(TRAVEL_CAPSULE_SUBSCRIPTION_SENTINEL);
        }
        throw err;
      }

      if (data?.error) throw new Error(data.error);

      const capsuleItems = data.capsule_items ?? [];
      const packingList = data.packing_list ?? [];
      const outfits = data.outfits ?? [];
      const coverageGaps = data.coverage_gaps ?? [];

      // Seed must_haves with the two-tier shape introduced in M28(b):
      //   - PRIMARY: user-curated picker entries from `mustHaveItemIds`
      //     (hydrated by `mustHaveGarments` for the display label/image),
      //     `source: 'picker'`, `status: 'have'`.
      //   - SECONDARY: AI-emitted `coverage_gaps` (what the AI thinks is
      //     missing for this trip), `source: 'gap'`, `status: 'unsure'`.
      // TravelMustHavesScreen splits by `source` to render distinct
      // "Your picks" + "We also noticed gaps" sections.
      const mustHaves = seedMustHaves(
        coverageGaps,
        params.mustHaveItemIds ?? [],
        params.mustHaveGarments ?? [],
      );

      // INSERT — the edge function does not persist. The full response
      // envelope (must_haves + initial empty packed_state + the stable
      // "everything we got back from the AI" record) is folded into the
      // `result` JSONB column so the next screen can read it as one row.
      const insertPayload = {
        user_id: user.id,
        destination: params.destination,
        trip_type: data.trip_type ?? params.tripType ?? 'mixed',
        duration_days: data.duration_days ?? 1,
        weather_min: data.weather_min ?? params.weather?.temperature_min ?? null,
        weather_max: data.weather_max ?? params.weather?.temperature_max ?? null,
        occasions: params.occasions,
        capsule_items: capsuleItems,
        outfits,
        packing_list: packingList,
        packing_tips: data.packing_tips ?? [],
        total_combinations: data.total_combinations ?? outfits.length,
        reasoning: data.reasoning ?? '',
        start_date: params.dates.start,
        end_date: params.dates.end,
        luggage_type: params.luggageType ?? 'carry_on_personal',
        companions: params.companions ?? 'solo',
        style_preference: params.stylePreference ?? 'balanced',
        result: {
          ...data,
          must_haves: mustHaves,
          packed_state: {} as Record<string, boolean>,
        },
      };

      // Project only columns that exist in the canonical migration
      // (`supabase/migrations/00000000000000_initial_schema.sql:1255-1277`)
      // — `travel_capsules.updated_at` is not part of the schema, and
      // PostgREST rejects the entire insert response when the projection
      // names an unknown column, which would throw before we ever seed
      // the cache. Synthesize the optimistic-row timestamp locally below
      // (the `result` JSONB optimistic-concurrency token derives from the
      // row's own writes anyway, not from this initial insert).
      const { data: row, error: insertErr } = await supabase
        .from('travel_capsules')
        .insert(insertPayload)
        .select('id, created_at')
        .single();
      if (insertErr) throw insertErr;
      if (!row?.id) throw new Error('travel_capsule: insert returned no id');

      // Optimistically seed the React Query cache with the row we just
      // wrote. Without this, the subsequent `nav.navigate('TravelMustHaves',
      // { capsuleId })` from the consumer screen mounts TravelMustHavesScreen
      // → its `useTravelCapsule(capsuleId)` reads from the cached
      // `['travelCapsules', user.id]` list (already populated from a prior
      // visit), `capsules.find((c) => c.id === capsuleId)` returns
      // `undefined`, and the screen renders an empty state until the
      // `onSuccess` invalidate-then-refetch round-trips back from the
      // server. That round-trip is racy — frequently the user sees a blank
      // must-haves list for hundreds of ms (sometimes longer when the
      // 60-second `staleTime` debounces a second observer subscribing
      // before the refetch settles), reported 2026-05-09 as "travel
      // capsule generates then nothing shows." Inject the new row at the
      // head of the cached list, capped to MAX_CAPSULES (mirrors the
      // server-side trim above), and let the existing `onSuccess`
      // invalidate refresh the canonical row from the DB as a safety net
      // for cross-device sync. The optimistic row is built from the same
      // payload we just inserted so it carries the must_haves the screen
      // depends on; loose-shape fields (capsule_items / outfits) match
      // what the cache parser would have produced for an immediate
      // refetch, which is good enough until the safety-net invalidate
      // replaces it with the canonical row.
      const optimisticRow: TravelCapsuleRow = {
        id: row.id as string,
        destination: insertPayload.destination,
        start_date: insertPayload.start_date,
        end_date: insertPayload.end_date,
        trip_type: insertPayload.trip_type,
        duration_days: insertPayload.duration_days,
        occasions: insertPayload.occasions,
        luggage_type: insertPayload.luggage_type,
        companions: insertPayload.companions,
        style_preference: insertPayload.style_preference,
        capsule_items: capsuleItems,
        outfits: outfits as TravelCapsuleOutfit[],
        packing_list: packingList as TravelCapsulePackingItem[],
        packing_tips: insertPayload.packing_tips,
        total_combinations: insertPayload.total_combinations,
        reasoning: insertPayload.reasoning,
        must_haves: mustHaves,
        packed_state: {},
        result: insertPayload.result,
        created_at:
          typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
        // No `updated_at` column on `travel_capsules` (see select projection
        // above). The list-read parser already falls back to `created_at`
        // when this is missing, so mirror that here to keep the
        // optimistic-concurrency token deterministic until the safety-net
        // refetch replaces this row with the canonical one.
        updated_at:
          typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
      };
      const MAX_CAPSULES_FOR_CACHE = 10;
      queryClient.setQueryData<TravelCapsuleRow[]>(
        ['travelCapsules', user.id],
        (old) => {
          const filtered = (old ?? []).filter((r) => r.id !== optimisticRow.id);
          return [optimisticRow, ...filtered].slice(0, MAX_CAPSULES_FOR_CACHE);
        },
      );

      // Match web's MAX_CAPSULES = 10 cap (`src/hooks/useTravelCapsules.ts`).
      // After insert, trim the oldest rows so the user's saved-trips list
      // stays bounded across both platforms. Failure here is non-fatal —
      // the user's new capsule already saved, the cap repair can wait
      // until the next generate.
      try {
        const MAX_CAPSULES = 10;
        const { data: existing } = await supabase
          .from('travel_capsules')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        const overflow = (existing ?? []).slice(MAX_CAPSULES);
        if (overflow.length > 0) {
          const overflowIds = overflow
            .map((r) => r.id as string)
            .filter((id): id is string => typeof id === 'string');
          if (overflowIds.length > 0) {
            await supabase
              .from('travel_capsules')
              .delete()
              .in('id', overflowIds)
              .eq('user_id', user.id);
          }
        }
      } catch {
        // Non-fatal — capsule list cap is best-effort hygiene.
      }

      return {
        capsule_id: row.id as string,
        capsule_items: capsuleItems,
        packing_list: packingList,
        must_haves: mustHaves,
        outfits,
      };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['travelCapsules', user?.id] });
    },
    onError: (err) => {
      // Skip the expected paywall sentinel — those are gating, not failures.
      if (err.message === TRAVEL_CAPSULE_SUBSCRIPTION_SENTINEL) return;
      // Skip aborted-by-unmount errors so we don't pollute Sentry with
      // expected screen pops.
      if (err.name === 'AbortError') return;
      // captureMutationError handles the generic mutation tag; Sentry
      // call below adds a function-specific breadcrumb so dashboards can
      // segment AI failures from generic mutation noise.
      Sentry.withScope((s) => {
        s.setTag('edge_function', 'travel_capsule');
        Sentry.captureException(err);
      });
      captureMutationError('useGenerateTravelCapsule')(err);
    },
  });
}
