// useFeedbackFetch — edge function dispatch for outfit_photo_feedback.
//
// Wraps the M9 callEdgeFunction call and classifies its errors into the
// `FeedbackFetchResult` discriminated union so the orchestrator hook can
// surface the right UX without parsing HTTP details itself.

import { useCallback } from 'react';

import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
  SUBSCRIPTION_SENTINEL,
} from '../lib/edgeFunctionClient';
import type { DeployedOutfitFeedbackRow } from '../lib/feedbackNormalizer';

export type FeedbackFetchResult =
  | { kind: 'ok'; row: DeployedOutfitFeedbackRow }
  | { kind: 'paywall' }
  | { kind: 'aborted' }
  | { kind: 'error'; message: string };

export function useFeedbackFetch(): {
  fetchFeedback: (params: {
    outfitId: string;
    selfiePath: string;
    signal: AbortSignal;
  }) => Promise<FeedbackFetchResult>;
} {
  const fetchFeedback = useCallback(
    async ({
      outfitId,
      selfiePath,
      signal,
    }: {
      outfitId: string;
      selfiePath: string;
      signal: AbortSignal;
    }): Promise<FeedbackFetchResult> => {
      try {
        const raw = await callEdgeFunction<DeployedOutfitFeedbackRow>(
          'outfit_photo_feedback',
          {
            body: { outfit_id: outfitId, selfie_path: selfiePath },
            signal,
          },
        );
        if (signal.aborted) return { kind: 'aborted' };
        if (!raw) return { kind: 'error', message: 'Photo feedback failed' };
        if (raw.error) return { kind: 'error', message: raw.error };
        return { kind: 'ok', row: raw };
      } catch (callErr) {
        if (signal.aborted) return { kind: 'aborted' };
        if (callErr instanceof EdgeFunctionSubscriptionLockedError) {
          return { kind: 'paywall' };
        }
        if (callErr instanceof EdgeFunctionHttpError) {
          const parsed = (() => {
            try {
              return JSON.parse(callErr.bodyText) as { error?: string };
            } catch {
              return null;
            }
          })();
          return { kind: 'error', message: parsed?.error ?? `HTTP ${callErr.status}` };
        }
        const message =
          callErr instanceof Error ? callErr.message : 'Photo feedback failed';
        if (message === SUBSCRIPTION_SENTINEL) return { kind: 'paywall' };
        return { kind: 'error', message };
      }
    },
    [],
  );
  return { fetchFeedback };
}
