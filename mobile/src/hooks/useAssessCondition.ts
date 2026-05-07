// useAssessCondition — M21 Discover-distributed helper.
//
// Wraps the deployed `assess_garment_condition` edge function. Body shape
// is `{ garment_id }`. Response shape (per
// supabase/functions/assess_garment_condition/index.ts) is:
//   { condition_score: number /* 1.0-10.0, 10 = like new */,
//     notes: string,
//     should_replace: boolean }
//
// Schema reality (per supabase/migrations/00000000000000_initial_schema.sql
// and src/integrations/supabase/types.ts):
//   garments.condition_score numeric(3,1) — 1.0-10.0
//   garments.condition_notes text
// The wave spec mentioned a `condition_assessment_jsonb` column, but no such
// column exists on the `garments` table. The edge function persists the two
// scalar columns above. The hook adapts to reality: it normalises the score
// to a 0-100 range (× 10) so the UI can render a familiar percentage, and
// keeps the AI's free-form note as the human-readable summary.
//
// `wear_signals` and `repair_recommendations` are reserved on the public
// `ConditionAssessment` shape for forward compatibility — the current server
// payload doesn't populate them, so they always come back as empty arrays.
// The badge + sheet degrade gracefully when those are empty (they fall back
// to the summary line).
//
// Pattern parity: matches `useGenerateOutfit` / `useSuggestAccessories`
// shape — AbortController + unmount cleanup, EdgeFunctionSubscriptionLockedError
// surfaced via the `'subscription_required'` sentinel string on `error`.
//
// On success the hook invalidates `['garment', user.id, garmentId]` so the
// detail screen's `useGarment` query refetches the persisted columns and
// the badge appears without a manual reload.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
} from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';

const SUBSCRIPTION_SENTINEL = 'subscription_required';

/** Public assessment shape exposed to consumers.
 *  - `condition_score`: 0-100 (the server's 1-10 multiplied by 10).
 *  - `wear_signals`: reserved — empty until the server returns structured tags.
 *  - `repair_recommendations`: reserved — empty until structured.
 *  - `summary`: the AI's free-form notes. Used for the badge sub-line and
 *    the bottom-sheet body when no recommendation list is available.
 *  - `assessed_at`: ISO timestamp of the call. Reserved for future surfaces;
 *    the schema doesn't persist this yet.
 */
export interface ConditionAssessment {
  condition_score: number;
  wear_signals: string[];
  repair_recommendations: string[];
  summary?: string | null;
  assessed_at?: string | null;
}

export interface UseAssessConditionResult {
  assessment: ConditionAssessment | null;
  isAssessing: boolean;
  error: string | null;
  assess: (garmentId: string) => Promise<void>;
  reset: () => void;
}

type AssessConditionResponse = {
  condition_score?: number;
  notes?: string;
  should_replace?: boolean;
  // Forward-compat slots — not populated today, but accepted defensively
  // so a later server-side enrichment doesn't require a hook bump.
  wear_signals?: unknown;
  repair_recommendations?: unknown;
  summary?: string;
  error?: string;
};

/** Coerces an arbitrary `unknown` into `string[]`, dropping anything that
 *  isn't a non-empty string after trimming. Used so a future server
 *  enrichment can hand the hook structured arrays without breaking
 *  consumers when those arrays are missing today. */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (trimmed.length > 0) out.push(trimmed);
  }
  return out;
}

/** Server score is a 1.0-10.0 scale. The UI tiers (good/fair/poor) match
 *  web's ConditionBadge breakpoints in 0-100 space (80 / 50), so we
 *  multiply by 10 once at the seam. Defensive clamp + non-finite guard
 *  keeps a malformed payload from poisoning the percentage. */
function normaliseScore(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const scaled = raw * 10;
  if (scaled < 0) return 0;
  if (scaled > 100) return 100;
  return Math.round(scaled);
}

export function useAssessCondition(): UseAssessConditionResult {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [assessment, setAssessment] = useState<ConditionAssessment | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const assess = useCallback(
    async (garmentId: string) => {
      if (!session?.access_token || !user) {
        setError('Not authenticated');
        return;
      }
      const trimmed = garmentId?.trim();
      if (!trimmed) {
        setError('Missing garment_id');
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsAssessing(true);
      setError(null);

      try {
        let data: AssessConditionResponse;
        try {
          data = await callEdgeFunction<AssessConditionResponse>('assess_garment_condition', {
            body: { garment_id: trimmed },
            signal: controller.signal,
          });
        } catch (callErr) {
          if (callErr instanceof EdgeFunctionSubscriptionLockedError) {
            setError(SUBSCRIPTION_SENTINEL);
            return;
          }
          if (callErr instanceof EdgeFunctionHttpError) {
            const parsed = (() => {
              try {
                return JSON.parse(callErr.bodyText) as { error?: string };
              } catch {
                return null;
              }
            })();
            setError(parsed?.error ?? `HTTP ${callErr.status}`);
            return;
          }
          throw callErr;
        }

        if (data?.error) {
          setError(data.error);
          return;
        }

        const score = normaliseScore(data?.condition_score);
        if (score === null) {
          // The function's tool_choice forces `condition_score` into the
          // response, so a missing/non-numeric value here is a genuine
          // protocol failure rather than an empty-result case. Surface it
          // as an error string the screen can render — matches the
          // `'subscription_required'` / `'invalid_outfit'` sentinel pattern
          // shared with sibling AI hooks.
          setError('invalid_response');
          Sentry.withScope((s) => {
            s.setTag('mutation', 'useAssessCondition.invalidScore');
            s.setExtra('payload', data);
            Sentry.captureMessage('assess_condition_invalid_score', 'warning');
          });
          return;
        }

        const notes = typeof data?.notes === 'string' ? data.notes.trim() : '';
        const summaryRaw = typeof data?.summary === 'string' ? data.summary.trim() : '';
        const summary = summaryRaw.length > 0
          ? summaryRaw
          : notes.length > 0
            ? notes
            : null;

        const next: ConditionAssessment = {
          condition_score: score,
          wear_signals: toStringArray(data?.wear_signals),
          repair_recommendations: toStringArray(data?.repair_recommendations),
          summary,
          assessed_at: new Date().toISOString(),
        };

        setAssessment(next);

        // The edge function persists `condition_score` (raw 1-10) and
        // `condition_notes` server-side. Invalidate the single-garment
        // cache so `useGarment` refetches and the GarmentDetail header
        // can light up the persisted badge on next render. Scoped by
        // user.id to match the cache key shape `useGarment` writes.
        queryClient.invalidateQueries({ queryKey: ['garment', user.id, trimmed] });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Condition check failed';
        if (message !== SUBSCRIPTION_SENTINEL) {
          Sentry.withScope((s) => {
            s.setTag('mutation', 'useAssessCondition');
            Sentry.captureException(err);
          });
        }
        setError(message);
      } finally {
        // Skip trailing setState if the request was aborted (screen
        // unmount mid-flight) so we don't fire setState on a torn-down
        // tree. Mirrors useGenerateOutfit's pattern.
        if (!controller.signal.aborted) {
          setIsAssessing(false);
        }
      }
    },
    [session?.access_token, user, queryClient],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAssessment(null);
    setIsAssessing(false);
    setError(null);
  }, []);

  // Cancel any in-flight assessment when the consumer unmounts so the
  // trailing setState calls don't fire against a torn-down tree.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { assessment, isAssessing, error, assess, reset };
}
