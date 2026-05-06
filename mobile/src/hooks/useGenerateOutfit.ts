// useGenerateOutfit — drives StyleMeScreen / OutfitGenerateScreen via the
// `burs_style_engine` edge function in single-outfit mode.
//
// Unlike style_chat / mood_outfit, burs_style_engine returns a plain JSON
// response (not SSE). Mobile W4 only consumes (does not persist): the web's
// `useOutfitGenerator` does the outfits + outfit_items insert dance, but
// per the W4 plan that's deferred to W9 alongside real outfit photos. So
// `outfit_id` is undefined here — screens fall back to an "Alert saved"
// path until the persistence layer lands.
//
// Engine response shape (per supabase/functions/_shared/outfit-combination.ts
// and the web type EngineGenerateResponse):
//   { items: { slot, garment_id }[], explanation: string,
//     wardrobe_insights?: string[], confidence_*?, error? }

import { useCallback, useRef, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
} from '../lib/edgeFunctionClient';
import { Sentry } from '../lib/sentry';

export type GeneratedOutfitItem = {
  garment_id?: string;
  slot: string;
  title: string;
  color?: string;
  image_path?: string;
};

export type GeneratedOutfit = {
  outfit_id?: string;
  outfit_name: string;
  description: string;
  occasion?: string;
  formality?: string;
  weather_appropriate?: boolean;
  items: GeneratedOutfitItem[];
};

export type GenerateOutfitParams = {
  occasion?: string;
  formality?: string;
  garmentId?: string;
  mood?: string;
};

// burs_style_engine returns items[] + explanation at the top level — there
// is NO nested `outfit: {name, description}` key. Earlier versions of this
// type advertised that field but it never fired. Codex audit P1-5.
type EngineResponseItem = {
  slot?: string;
  garment_id?: string;
  title?: string;
};

type EngineResponse = {
  items?: EngineResponseItem[];
  explanation?: string;
  // Some engine modes (e.g. `mode: 'suggest'`) expose `outfits[]` already
  // shaped to match the screen contract — defensive read.
  outfits?: { items?: EngineResponseItem[]; outfit_name?: string; description?: string }[];
  error?: string;
};

function defaultName(params: GenerateOutfitParams): string {
  if (params.occasion && params.formality) {
    return `${params.occasion} · ${params.formality.toLowerCase()}`;
  }
  if (params.occasion) return params.occasion;
  if (params.mood) return `${params.mood} look`;
  return 'Your look';
}

function adaptItems(items: EngineResponseItem[] | undefined): GeneratedOutfitItem[] {
  return (items ?? [])
    .filter((it) => typeof it.garment_id === 'string')
    .map((it) => ({
      garment_id: it.garment_id,
      slot: typeof it.slot === 'string' && it.slot ? it.slot : 'top',
      title: typeof it.title === 'string' ? it.title : '',
    }));
}

export function useGenerateOutfit() {
  const { session } = useAuth();
  const [result, setResult] = useState<GeneratedOutfit | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(
    async (params: GenerateOutfitParams = {}) => {
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }
      setIsLoading(true);
      setError(null);
      setResult(null);

      abortRef.current?.abort();
      // Capture a local handle so finally/catch can read the right signal
      // even if reset() nulls abortRef mid-flight (Codex audit P0-3).
      const controller = new AbortController();
      abortRef.current = controller;

      // Trim whitespace from anchor garment id — a non-empty whitespace
      // string would otherwise pass through and the engine's id-validation
      // would treat it as a garbage id. Codex audit P1-6.
      const anchorId = params.garmentId?.trim();

      try {
        let data: EngineResponse;
        try {
          data = await callEdgeFunction<EngineResponse>('burs_style_engine', {
            body: {
              mode: 'generate',
              generator_mode: 'standard',
              occasion: params.occasion ?? 'Everyday',
              style: params.mood ?? null,
              // Default weather satisfies normalizeWeather in the engine —
              // the screens don't yet collect a weather signal in W4. W9+
              // wires weather context via useWeather().
              weather: { precipitation: 'none', wind: 'none' },
              locale: 'en',
              prefer_garment_ids: anchorId ? [anchorId] : [],
            },
            signal: controller.signal,
          });
        } catch (callErr) {
          if (callErr instanceof EdgeFunctionSubscriptionLockedError) {
            setError('subscription_required');
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

        if (data.error) {
          setError(data.error);
          return;
        }

        // Suggest-mode `outfits[0]` arrives pre-shaped; defensively re-adapt
        // items so a slot omission can't crash downstream `.toUpperCase()`.
        // Codex audit P1-1 + P0-2 (audit 3).
        if (data.outfits?.[0]?.items) {
          const first = data.outfits[0];
          setResult({
            outfit_name: first.outfit_name ?? defaultName(params),
            description: first.description ?? data.explanation ?? '',
            occasion: params.occasion,
            formality: params.formality,
            items: adaptItems(first.items),
          });
        } else if (data.items?.length || data.explanation) {
          setResult({
            outfit_name: defaultName(params),
            description: data.explanation ?? '',
            occasion: params.occasion,
            formality: params.formality,
            items: adaptItems(data.items),
          });
        } else {
          setResult({
            outfit_name: defaultName(params),
            description: 'Generated for you',
            occasion: params.occasion,
            formality: params.formality,
            items: [],
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Generation failed';
        // Skip the expected paywall sentinel — those are gating, not failures.
        if (message !== 'subscription_required') {
          Sentry.withScope((s) => {
            s.setTag('mutation', 'useGenerateOutfit');
            Sentry.captureException(err);
          });
        }
        setError(message);
      } finally {
        // Skip the trailing setState if the request was aborted (e.g. screen
        // unmount mid-flight) — the hook's reset()/cancel callers already
        // settled isLoading and we'd otherwise fire setState on a torn-down
        // tree. The local `controller` reference survives `reset()` nulling
        // abortRef. Codex audit P0-3 (audit 2).
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
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

  return { result, isLoading, error, generate, reset };
}
