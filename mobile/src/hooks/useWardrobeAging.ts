// useWardrobeAging — M22. Surfaces the `wardrobe_aging` edge function as
// three usable buckets for InsightsScreen:
//
//   - retire_candidates health_pct <= 30 OR months_remaining <= 0
//   - aged              (after retire excluded)
//                       30 < health_pct <= 70 OR 0 < months_remaining <= 6
//   - unworn            wear_count === 0 AND created > 30 days ago,
//                       AND not already classified as aged/retire by the AI
//
// **Wire contract (verified against
// `supabase/functions/wardrobe_aging/index.ts`):**
//   Request:  POST { locale: string }     — server reads auth from Bearer token
//   Response: { predictions: [{
//       garment_id: string,
//       months_remaining: number,
//       health_pct: number,
//       tip: string,
//       replacement_reason: string,
//   }] }
//   Empty corpus (<3 garments): server returns `{ predictions: [] }`.
//   Subscription-locked: 402 → EdgeFunctionSubscriptionLockedError.
//
// The function only emits predictions for items "closest to needing
// replacement" (5 max) — it does NOT emit an `unworn` bucket. We derive
// `unworn` directly from the user's garments (wear_count === 0, created
// >= 30d ago) so the panel can still surface the third row even when the
// AI focuses on aging signals.
//
// React Query: cache key `['wardrobeAging', user.id]`, staleTime 1h to
// match the function's own 3600s server-side cache TTL — repeat tab
// visits hit local memory before they hit the rate-limited endpoint
// (15/hr free, 0.5x multiplier). `enabled: !!user` so unauth state
// doesn't fire the call.
//
// Subscription_required surfaces as a typed Error subclass so the
// consuming screen can pivot to the paywall via the standard sticky-ref
// pattern (see InsightsScreen). All other failures pass through with a
// best-effort message.

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
  SUBSCRIPTION_SENTINEL,
} from '../lib/edgeFunctionClient';

const ONE_HOUR_MS = 60 * 60 * 1000;
const UNWORN_AGE_CUTOFF_MS = 30 * 24 * 60 * 60 * 1000;

export type WardrobeAgingBucketId = 'aged' | 'unworn' | 'retire_candidates';

export interface WardrobeAgingBucket {
  id: WardrobeAgingBucketId;
  /** User-facing label. Resolved by the consumer via i18n, but we ship a
   * sensible English fallback so the hook is renderable on its own. */
  label: string;
  count: number;
  garmentIds: string[];
  /** One-line rationale derived from the strongest prediction in the
   * bucket, or null when nothing landed there. */
  rationale: string | null;
}

export interface WardrobeAgingResult {
  buckets: WardrobeAgingBucket[];
  /** ISO timestamp of the moment the buckets were assembled. Server
   * doesn't return this today; we stamp it on the client so the UI can
   * say "analyzed just now" without lying about server-side freshness. */
  analyzedAt: string | null;
}

export class WardrobeAgingSubscriptionError extends Error {
  constructor() {
    super(SUBSCRIPTION_SENTINEL);
    this.name = 'WardrobeAgingSubscriptionError';
  }
}

export class WardrobeAgingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WardrobeAgingError';
  }
}

interface RawPrediction {
  garment_id?: unknown;
  months_remaining?: unknown;
  health_pct?: unknown;
  tip?: unknown;
  replacement_reason?: unknown;
}

interface RawAgingResponse {
  predictions?: unknown;
  error?: unknown;
}

interface NormalisedPrediction {
  garmentId: string;
  monthsRemaining: number;
  healthPct: number;
  tip: string;
  replacementReason: string;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalisePrediction(p: RawPrediction): NormalisedPrediction | null {
  const garmentId = asString(p?.garment_id).trim();
  if (!garmentId) return null;
  const months = asFiniteNumber(p?.months_remaining);
  const health = asFiniteNumber(p?.health_pct);
  if (months === null || health === null) return null;
  return {
    garmentId,
    monthsRemaining: months,
    // Defensive clamp — prompt asks for 0-100 but a malformed payload
    // shouldn't poison the bucketing logic downstream.
    healthPct: Math.max(0, Math.min(100, health)),
    tip: asString(p?.tip).trim(),
    replacementReason: asString(p?.replacement_reason).trim(),
  };
}

interface UnwornGarment {
  id: string;
}

async function fetchUnwornGarmentIds(userId: string): Promise<string[]> {
  const cutoffIso = new Date(Date.now() - UNWORN_AGE_CUTOFF_MS).toISOString();
  // wear_count = 0 AND created_at <= 30d ago. The garments table defaults
  // wear_count to 0 server-side, so NULLs shouldn't appear in practice;
  // we keep the dual `wear_count.is.null,wear_count.eq.0` predicate to
  // remain defensive for any legacy rows that pre-date the default
  // (drift repair territory). RLS already enforces user_id; we filter
  // explicitly too — defense in depth, same pattern as useGarments.
  const { data, error } = await supabase
    .from('garments')
    .select('id')
    .eq('user_id', userId)
    .or('wear_count.is.null,wear_count.eq.0')
    .lte('created_at', cutoffIso);
  if (error) throw new WardrobeAgingError(error.message);
  return (data ?? []).map((row: UnwornGarment) => row.id);
}

function bucketLabelFallback(id: WardrobeAgingBucketId): string {
  if (id === 'aged') return 'Showing wear';
  if (id === 'unworn') return 'Never worn';
  return 'Retire candidates';
}

function buildBuckets(
  predictions: NormalisedPrediction[],
  unwornIds: string[],
): WardrobeAgingBucket[] {
  const retire = predictions.filter(
    (p) => p.healthPct <= 30 || p.monthsRemaining <= 0,
  );
  const aged = predictions.filter(
    (p) =>
      !(p.healthPct <= 30 || p.monthsRemaining <= 0) &&
      (p.healthPct <= 70 || p.monthsRemaining <= 6),
  );

  // De-dupe unworn against any garment the AI already routed into
  // aged/retire — without this, a 0-wear garment that the AI flagged
  // as `retire_candidate` would surface in BOTH buckets, double-counting
  // it across the panel. Each garment now appears in exactly one bucket;
  // the AI bucket wins because it's the more specific signal.
  const predictionIds = new Set<string>(predictions.map((p) => p.garmentId));
  const dedupedUnwornIds = unwornIds.filter((id) => !predictionIds.has(id));

  // Strongest rationale wins — for retire/aged that's the lowest health
  // (closest to replacement). The AI's `replacement_reason` is more
  // user-facing than `tip`; fall back to `tip` if the reason is empty.
  const strongestRationale = (rows: NormalisedPrediction[]): string | null => {
    if (rows.length === 0) return null;
    const sorted = [...rows].sort((a, b) => a.healthPct - b.healthPct);
    const top = sorted[0];
    const reason = top.replacementReason || top.tip;
    return reason.length > 0 ? reason : null;
  };

  return [
    {
      id: 'aged',
      label: bucketLabelFallback('aged'),
      count: aged.length,
      garmentIds: aged.map((p) => p.garmentId),
      rationale: strongestRationale(aged),
    },
    {
      id: 'unworn',
      label: bucketLabelFallback('unworn'),
      count: dedupedUnwornIds.length,
      garmentIds: dedupedUnwornIds,
      // No AI rationale for unworn — derived locally. The screen
      // composes a static caption from i18n.
      rationale: null,
    },
    {
      id: 'retire_candidates',
      label: bucketLabelFallback('retire_candidates'),
      count: retire.length,
      garmentIds: retire.map((p) => p.garmentId),
      rationale: strongestRationale(retire),
    },
  ];
}

async function runAgingAnalysis(userId: string): Promise<WardrobeAgingResult> {
  // Run both round-trips in parallel — the unworn-garment query is a
  // simple PostgREST select and shouldn't gate the AI call's progress.
  const [response, unwornIds] = await Promise.all([
    (async (): Promise<RawAgingResponse> => {
      try {
        return await callEdgeFunction<RawAgingResponse>('wardrobe_aging', {
          body: { locale: 'en' },
        });
      } catch (err) {
        if (err instanceof EdgeFunctionSubscriptionLockedError) {
          throw new WardrobeAgingSubscriptionError();
        }
        if (err instanceof EdgeFunctionHttpError) {
          const parsed = (() => {
            try {
              return JSON.parse(err.bodyText) as { error?: string };
            } catch {
              return null;
            }
          })();
          throw new WardrobeAgingError(parsed?.error ?? `HTTP ${err.status}`);
        }
        throw new WardrobeAgingError(err instanceof Error ? err.message : String(err));
      }
    })(),
    fetchUnwornGarmentIds(userId),
  ]);

  if (response && typeof response === 'object' && typeof response.error === 'string') {
    if (response.error === SUBSCRIPTION_SENTINEL) {
      throw new WardrobeAgingSubscriptionError();
    }
    throw new WardrobeAgingError(response.error);
  }

  const rawPredictions = Array.isArray(response?.predictions) ? response.predictions : [];
  const normalised: NormalisedPrediction[] = [];
  for (const raw of rawPredictions) {
    if (!raw || typeof raw !== 'object') continue;
    const next = normalisePrediction(raw as RawPrediction);
    if (next) normalised.push(next);
  }

  return {
    buckets: buildBuckets(normalised, unwornIds),
    analyzedAt: new Date().toISOString(),
  };
}

export function useWardrobeAging(): UseQueryResult<WardrobeAgingResult, Error> {
  const { user } = useAuth();
  return useQuery<WardrobeAgingResult, Error>({
    queryKey: ['wardrobeAging', user?.id],
    queryFn: async () => {
      if (!user) throw new WardrobeAgingError('Not authenticated');
      return runAgingAnalysis(user.id);
    },
    enabled: !!user,
    // 1h staleTime mirrors the server-side `cacheTtlSeconds: 3600` in
    // wardrobe_aging — repeat Insights tab visits within the hour stay
    // local. gcTime double the staleTime so background re-fetches don't
    // evict the cached buckets while a user is mid-session.
    staleTime: ONE_HOUR_MS,
    gcTime: 2 * ONE_HOUR_MS,
    // Don't burn the (already rate-limited 15/hr-base) endpoint on a
    // transient retry loop — the user can pull-to-refresh on the
    // Insights screen if the first call fails.
    retry: false,
  });
}
