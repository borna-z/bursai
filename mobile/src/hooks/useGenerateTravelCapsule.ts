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
  TravelCapsuleOutfit,
  TravelCapsulePackingItem,
  TravelCapsuleRow,
} from './useTravelCapsules';
import {
  seedMustHaves,
  TRAVEL_CAPSULE_SUBSCRIPTION_SENTINEL,
  type EdgeTravelCapsuleResponse,
  type GenerateTravelCapsuleParams,
  type GenerateTravelCapsuleResult,
} from './useGenerateTravelCapsule.helpers';

export {
  TRAVEL_CAPSULE_SUBSCRIPTION_SENTINEL,
  type GenerateTravelCapsuleParams,
  type GenerateTravelCapsuleResult,
  type TravelCapsuleWeather,
} from './useGenerateTravelCapsule.helpers';

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

      // G3 sub-issue 4 — keep-alive + observability. Drop a request-start
      // breadcrumb so post-merge dashboards can compare timings against
      // the success/failure breadcrumbs below. Captures the
      // duration-days hint so we can correlate "slow generation" reports
      // with longer trips (more outfits => more Gemini round-trips).
      const generationStartedAt = Date.now();
      Sentry.addBreadcrumb({
        category: 'travel_capsule',
        type: 'info',
        level: 'info',
        message: 'travel_capsule.generate.start',
        data: {
          destination: params.destination,
          start_date: params.dates.start,
          end_date: params.dates.end,
          must_have_count: params.mustHaveItemIds?.length ?? 0,
          occasion_count: params.occasions?.length ?? 0,
        },
      });

      let data: EdgeTravelCapsuleResponse;
      try {
        const raw = await callEdgeFunction<EdgeTravelCapsuleResponse>('travel_capsule', {
          body,
          // G3 sub-issue 4 — Gemini tool-use over the full wardrobe
          // routinely takes 25-45s, with spikes past 60s on long trips
          // or large wardrobes. The previous 60s budget would abort on
          // the long tail and surface as "generate failed" while the
          // request was still progressing server-side. Bump to 120s to
          // cover the 99th-percentile real-world latency without
          // changing the user-perceived spinner copy.
          timeoutMs: 120_000,
          retries: 1,
          signal: controller.signal,
        });
        if (!raw) {
          // 2xx with unparseable JSON body — surface as a real failure;
          // the persistence path below would fan out into broken inserts.
          throw new Error('travel_capsule_invalid_response');
        }
        data = raw;
        Sentry.addBreadcrumb({
          category: 'travel_capsule',
          type: 'info',
          level: 'info',
          message: 'travel_capsule.generate.success',
          data: {
            duration_ms: Date.now() - generationStartedAt,
            outfit_count: raw.outfits?.length ?? 0,
            packing_count: raw.packing_list?.length ?? 0,
          },
        });
      } catch (err) {
        Sentry.addBreadcrumb({
          category: 'travel_capsule',
          type: 'error',
          level: 'warning',
          message: 'travel_capsule.generate.failure',
          data: {
            duration_ms: Date.now() - generationStartedAt,
            error_name: err instanceof Error ? err.name : 'unknown',
            error_message: err instanceof Error ? err.message : String(err),
          },
        });
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
