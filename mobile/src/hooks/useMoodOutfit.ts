// useMoodOutfit — drives MoodFlowScreen via the streaming `mood_outfit`
// edge function.
//
// The function emits a single SSE chunk that's the entire result object,
// followed by `data: [DONE]`. Verified shape (supabase/functions/mood_outfit
// /index.ts ~line 341 + return at 380):
//
//   { items: { slot, garment_id }[], explanation: string,
//     mood_match_score: number, limitation_note: string | null }
//
// or, on insufficient wardrobe:
//
//   { error: string, missing_slots: string[] }
//
// We adapt that into the screen-friendly `MoodOutfitResult` (outfit_name +
// description + items[]). Names aren't part of the response — the screen
// folds the user's mood/time selections into a generated label, which is
// what MoodFlowScreen already does for its mock copy.
//
// Subscription-locked → onError fires with sentinel 'subscription_required'.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { fetchSSE } from '../lib/sse';
import { Sentry } from '../lib/sentry';

export type MoodOutfitItem = {
  garment_id?: string;
  slot: string;
  title: string;
  color?: string;
};

export type MoodOutfitResult = {
  outfit_id?: string;
  outfit_name: string;
  description: string;
  limitation_note?: string | null;
  items: MoodOutfitItem[];
};

type EdgeMoodResponse = {
  items?: { slot?: string; garment_id?: string }[];
  explanation?: string;
  mood_match_score?: number;
  limitation_note?: string | null;
  error?: string;
};

function adaptResponse(
  edge: EdgeMoodResponse,
  mood: string,
  timeOfDay: string,
): MoodOutfitResult {
  const items: MoodOutfitItem[] = (edge.items ?? [])
    .filter((it) => typeof it.garment_id === 'string')
    .map((it) => ({
      garment_id: it.garment_id,
      slot: it.slot ?? 'top',
      // Real titles require a follow-up garments query (Wave 9 photo wiring
      // does this). For W4 the screen renders gradient placeholders keyed
      // off slot, so an empty title is fine.
      title: '',
    }));

  return {
    outfit_name: `${mood} · ${timeOfDay.toLowerCase()}`,
    description: edge.explanation?.trim() ?? '',
    limitation_note: edge.limitation_note ?? null,
    items,
  };
}

export function useMoodOutfit() {
  const { session } = useAuth();
  const [result, setResult] = useState<MoodOutfitResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(
    async (mood: string, timeOfDay: string) => {
      if (!session?.access_token) return;
      setIsLoading(true);
      setError(null);
      setResult(null);

      abortRef.current?.abort();
      // Capture a local handle so onDone/onError honor the right signal
      // even if reset() nulls abortRef mid-flight. Codex audit P0-3.
      const controller = new AbortController();
      abortRef.current = controller;

      // The edge function emits the full payload as a single JSON chunk.
      // We accept either: a parseable JSON chunk OR concatenated text we
      // try to JSON.parse on done.
      let captured: EdgeMoodResponse | null = null;
      let textBuffer = '';
      // Track whether a chunk-level error has already been raised. Without
      // this guard, `onDone`'s text-buffer fallback can call `setResult`
      // even after `onData` fired `setError(parsed.error)` — overwriting
      // the surfaced error with a stray result and breaking the screen's
      // error-state branch. Codex P2 round on PR #738.
      let errored = false;

      await fetchSSE(
        'mood_outfit',
        // NOTE: `time_of_day` is passed for forward-compat — the current
        // edge function destructures only { mood, weather, locale }
        // (supabase/functions/mood_outfit/index.ts:192) and ignores the
        // field. Mood Flow's "morning/day/evening" pill is decorative for
        // now; W4.5+ may thread it into the weather context. Codex audit
        // P1-4 (audit 1).
        { mood, time_of_day: timeOfDay, locale: 'en' },
        {
          onData: (raw) => {
            try {
              const parsed = JSON.parse(raw) as EdgeMoodResponse;
              if (parsed && typeof parsed === 'object') {
                if (parsed.error) {
                  errored = true;
                  setError(parsed.error);
                  return;
                }
                if (parsed.items) {
                  captured = parsed;
                  setResult(adaptResponse(parsed, mood, timeOfDay));
                }
              }
            } catch {
              // Plain-text fragment — buffer for end-of-stream parse.
              textBuffer += raw;
            }
          },
          onDone: () => {
            if (controller.signal.aborted) return;
            // Skip the text-buffer fallback when a chunk-level error was
            // raised — otherwise a buffered text payload trailing the
            // error chunk would call setResult and clobber the error
            // state.
            if (!errored && !captured && textBuffer) {
              try {
                const parsed = JSON.parse(textBuffer) as EdgeMoodResponse;
                if (parsed.error) {
                  setError(parsed.error);
                } else if (parsed.items) {
                  setResult(adaptResponse(parsed, mood, timeOfDay));
                }
              } catch {
                // Couldn't parse — fall back to a description-only result so
                // the screen has something to render.
                setResult({
                  outfit_name: `${mood} · ${timeOfDay.toLowerCase()}`,
                  description: textBuffer.trim(),
                  items: [],
                });
              }
            }
            setIsLoading(false);
          },
          onError: (err) => {
            if (controller.signal.aborted) return;
            // Skip the expected paywall sentinel — those are gating, not failures.
            if (err.message !== 'subscription_required') {
              Sentry.withScope((s) => {
                s.setTag('mutation', 'useMoodOutfit');
                Sentry.captureException(err);
              });
            }
            setError(err.message);
            setIsLoading(false);
          },
        },
        controller.signal,
      );
    },
    [session?.access_token],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setResult(null);
    setIsLoading(false);
    setError(null);
  }, []);

  // Cancel any in-flight stream when the consumer screen unmounts so RN
  // doesn't log "setState on an unmounted component" warnings from the
  // SSE callbacks landing post-teardown. Codex P2 round on PR #738.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { result, isLoading, error, generate, reset };
}
