// usePrefetchSuggestions — fire-and-forget warm-up for the daily outfit
// suggestion cache (Wave T-A).
//
// Why: `prefetch_suggestions` populates `ai_response_cache` so the
// generate-outfit / SmartDayBanner path returns a warm result instead of
// blocking on a cold Gemini call. Mounting this on HomeScreen means the
// cache is filled while the user is still looking at Today, before they
// navigate into outfit generation.
//
// Constraints:
//   • Never throws into the React tree — every error is swallowed and
//     reported to Sentry at level 'info' (background/best-effort).
//   • Never blocks UI: zero state surface, no spinner, no error toast.
//   • Single in-flight call: `prefetch()` is safe to call repeatedly
//     (each call kicks a fresh request — the server itself dedupes via
//     `ai_response_cache`).
//   • No retries (`retries: 0`): a cold-start prefetch shouldn't burn
//     extra Gemini cost when the network's flapping.
//   • 15 s timeout — long enough for a normal flash-lite generation,
//     short enough that a stuck request doesn't sit in flight all day.
//
// AppState foreground-resume is intentionally NOT wired here — wave T-A
// is mount-only; the resume hook lands as a follow-up.

import { useCallback } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { callEdgeFunction } from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';

export function usePrefetchSuggestions(): { prefetch: () => Promise<void> } {
  const { session } = useAuth();

  const prefetch = useCallback(async (): Promise<void> => {
    if (!session?.access_token) return;
    try {
      await callEdgeFunction('prefetch_suggestions', {
        body: {},
        retries: 0,
        timeoutMs: 15_000,
      });
    } catch (err) {
      // Best-effort cache warm — never surface to the UI. Report at
      // level 'info' so the dashboard distinguishes background prefetch
      // failures from real user-visible errors. `Sentry.captureException`
      // on the React Native SDK doesn't take a level option directly, so
      // we set it on a temporary scope via `withScope`.
      Sentry.withScope((scope) => {
        scope.setLevel('info');
        scope.setTag('mutation', 'usePrefetchSuggestions');
        Sentry.captureException(err);
      });
    }
  }, [session?.access_token]);

  return { prefetch };
}
