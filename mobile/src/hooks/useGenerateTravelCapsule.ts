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
} from '../lib/edgeFunctionClient';
import { captureMutationError, Sentry } from '../lib/sentry';
import type {
  TravelCapsuleMustHave,
  TravelCapsuleOutfit,
  TravelCapsulePackingItem,
} from './useTravelCapsules';

export const TRAVEL_CAPSULE_SUBSCRIPTION_SENTINEL = 'subscription_required';

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
  mustHaveItemIds?: string[];
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

type EdgeTravelCapsuleResponse = {
  capsule_items?: EdgeCapsuleItem[];
  outfits?: TravelCapsuleOutfit[];
  packing_list?: TravelCapsulePackingItem[];
  packing_tips?: string[];
  coverage_gaps?: unknown[];
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

/** Build the seed must-haves list from the user-selected garment IDs.
 *  Each id becomes a synthetic must-have row tagged 'have' so the next
 *  step can read them straight out of the saved row. The label / category
 *  are filled from the edge function's hydrated capsule_items where
 *  possible. */
function seedMustHaves(
  selectedIds: string[],
  capsuleItems: EdgeCapsuleItem[],
): TravelCapsuleMustHave[] {
  const byId = new Map(capsuleItems.map((it) => [it.id, it]));
  return selectedIds.map((id) => {
    const hit = byId.get(id);
    return {
      id,
      label: hit?.title ?? '',
      category: hit?.category ?? null,
      garment_id: id,
      status: 'have' as const,
    };
  });
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
        data = await callEdgeFunction<EdgeTravelCapsuleResponse>('travel_capsule', {
          body,
          // travel_capsule is slow — Gemini tool-use over the user's full
          // wardrobe routinely takes 25-45s. Bump the wrapper's timeout
          // to 60s and retry once on transient failure.
          timeoutMs: 60_000,
          retries: 1,
          signal: controller.signal,
        });
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

      // Seed must_haves from the IDs the user picked in Step 2 — Step 3
      // (PackingList) reads `must_haves` out of the saved row, so the
      // wizard hand-off has to actually carry those signals through.
      const mustHaves = seedMustHaves(params.mustHaveItemIds ?? [], capsuleItems);

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

      const { data: row, error: insertErr } = await supabase
        .from('travel_capsules')
        .insert(insertPayload)
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      if (!row?.id) throw new Error('travel_capsule: insert returned no id');

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
