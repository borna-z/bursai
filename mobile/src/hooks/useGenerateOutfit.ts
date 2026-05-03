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
import { supabaseUrl } from '../lib/supabase';
import { getEdgeFunctionUrl } from '../lib/sse';

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

type EngineResponse = {
  items?: { slot?: string; garment_id?: string }[];
  explanation?: string;
  outfit?: { name?: string; description?: string };
  outfits?: GeneratedOutfit[];
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
      abortRef.current = new AbortController();

      try {
        const response = await fetch(
          getEdgeFunctionUrl(supabaseUrl, 'burs_style_engine'),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              mode: 'generate',
              generator_mode: 'standard',
              occasion: params.occasion ?? 'Everyday',
              style: params.mood ?? null,
              // Default weather satisfies normalizeWeather in the engine —
              // the screens don't yet collect a weather signal in W4. W9+
              // wires weather context via useWeather().
              weather: { precipitation: 'none', wind: 'none' },
              locale: 'en',
              prefer_garment_ids: params.garmentId ? [params.garmentId] : [],
            }),
            signal: abortRef.current.signal,
          },
        );

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          const errorMsg = body.error ?? `HTTP ${response.status}`;
          if (response.status === 402 || errorMsg === 'subscription_required') {
            setError('subscription_required');
          } else {
            setError(errorMsg);
          }
          setIsLoading(false);
          return;
        }

        const data = (await response.json()) as EngineResponse;

        if (data.error) {
          setError(data.error);
          setIsLoading(false);
          return;
        }

        // Engine returns items[] + explanation; we synthesize the
        // screen-friendly outfit name from the user's selections.
        if (data.outfit) {
          setResult({
            outfit_name: data.outfit.name ?? defaultName(params),
            description: data.outfit.description ?? data.explanation ?? '',
            occasion: params.occasion,
            formality: params.formality,
            items: (data.items ?? []).map((it) => ({
              garment_id: it.garment_id,
              slot: it.slot ?? 'top',
              title: '',
            })),
          });
        } else if (data.outfits && data.outfits[0]) {
          setResult(data.outfits[0]);
        } else if (data.items?.length || data.explanation) {
          setResult({
            outfit_name: defaultName(params),
            description: data.explanation ?? '',
            occasion: params.occasion,
            formality: params.formality,
            items: (data.items ?? []).map((it) => ({
              garment_id: it.garment_id,
              slot: it.slot ?? 'top',
              title: '',
            })),
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
        if (abortRef.current?.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Generation failed');
      } finally {
        // Skip the trailing setState if the request was aborted (e.g. screen
        // unmount mid-flight) — the hook's reset()/cancel callers already
        // settled isLoading and we'd otherwise fire setState on a torn-down
        // tree. setIsLoading(false) is otherwise idempotent.
        if (!abortRef.current?.signal.aborted) {
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
