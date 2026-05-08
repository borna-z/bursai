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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
  SUBSCRIPTION_SENTINEL,
} from '../lib/edgeFunctionClient';
import { isAnchorPresent, type LockedSlots } from '../lib/outfitAnchoring';
import { validateOutfitItems } from '../lib/outfitRules';
import { Sentry } from '../lib/sentry';
import { t as tr } from '../lib/i18n';
import { awaitFreshWeather, useWeather, type WeatherData } from './useWeather';

// Fallback weather payload used while `useWeather` is loading or has errored.
// Mild 18°C, no precipitation, calm wind — same shape `useWeekGenerator` and
// `useOutfitPool` fall back to so every mobile entry-point looks identical
// to the engine's `normalizeWeather` when live weather is unavailable.
const FALLBACK_WEATHER = {
  temperature: 18,
  precipitation: 'none' as const,
  wind: 'none' as const,
};

/**
 * Sentinel `error` value the hook raises when the engine returns a complete
 * outfit that drops the requested anchor garment. Screens compare against
 * this string to render anchor-specific copy + a tryAgain CTA instead of
 * exposing "Wear today" / "Save outfit" over a result that violates the
 * lock. M13 / Codex P2 round 4.
 */
export const ANCHOR_MISSED_ERROR = 'anchor_missed';

/**
 * Sentinel `error` for an engine response that fails the M13 slot-rule
 * validator (e.g. top + shoes without a bottom, two bottoms, top + dress).
 * Web's generator rejects the same scenario; mobile mirrors the contract
 * so the screen never exposes "Wear today" over an invalid outfit.
 * Codex P2 round 6 on PR #737.
 */
export const INVALID_OUTFIT_ERROR = 'invalid_outfit';

/**
 * Translate a hook `error` value to a user-facing message. Screens that
 * branch on the sentinels (`OutfitGenerateScreen`) render their own copy;
 * screens that don't (`StyleMeScreen`) call this helper so the user
 * never sees a raw `'invalid_outfit'` / `'anchor_missed'` token. Codex
 * P2 round 9a on PR #737.
 */
export function formatGenerateOutfitError(error: string | null): string | null {
  if (!error) return null;
  if (error === ANCHOR_MISSED_ERROR) return tr('anchor.missed.errorBodyFallback');
  if (error === INVALID_OUTFIT_ERROR) return tr('outfit.invalid.errorBody');
  return error;
}

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
  /**
   * Preferred-anchor garment id. Passed to the engine as
   * `prefer_garment_ids: [anchorGarmentId]`. M13 renamed from `garmentId`;
   * the legacy field is still accepted for backwards compat with existing
   * callers (StyleMeScreen, OutfitGenerateScreen) until they migrate.
   */
  anchorGarmentId?: string;
  /** @deprecated Use anchorGarmentId. */
  garmentId?: string;
  /**
   * Optional client-side slot constraints derived from the anchor's
   * inferred slot — surfaced to the engine via the same prefer/exclude
   * envelope. Today only used for telemetry (Sentry breadcrumb on drift);
   * server-side enforcement lands when burs_style_engine grows a
   * `locked_slots` field. M13.
   */
  lockedSlots?: LockedSlots;
  /**
   * Optional N-piece seed for variation/clone entry points (M17 Codex
   * P1.4). When present, the entire array is sent as `prefer_garment_ids`
   * so the engine builds an outfit around the source's full piece roster
   * — the previous one-piece anchor lost N-1 garments on a variation tap.
   * If both `anchorGarmentId` and `preferGarmentIds` are set, the union
   * is sent (anchor first to preserve lock-intent), de-duplicated.
   */
  preferGarmentIds?: string[];
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
  // Subscribe to weather here so the hook re-renders when it lands. The
  // request itself is awaited inside `generate` via React Query's
  // `ensureQueryData` against the same cache entry, so a screen that
  // auto-generates from a mount effect (OutfitGenerateScreen does) doesn't
  // race the cold-start fetch and silently send `FALLBACK_WEATHER`.
  // (Codex P2 round 1 on PR #775.)
  const { weather: liveWeather } = useWeather();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<GeneratedOutfit | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // M13: signals the screen that the anchor garment was requested but the
  // engine returned an outfit without it (prefer_garment_ids is a soft hint
  // server-side). Screens use this to render a "Anchor not honoured —
  // regenerate?" affordance.
  const [anchorMissed, setAnchorMissed] = useState(false);
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
      setAnchorMissed(false);

      abortRef.current?.abort();
      // Capture a local handle so finally/catch can read the right signal
      // even if reset() nulls abortRef mid-flight (Codex audit P0-3).
      const controller = new AbortController();
      abortRef.current = controller;

      // Trim whitespace from anchor garment id — a non-empty whitespace
      // string would otherwise pass through and the engine's id-validation
      // would treat it as a garbage id. Codex audit P1-6.
      // M13 preferred field is `anchorGarmentId`; fall back to the legacy
      // `garmentId` until callers migrate.
      const anchorId = (params.anchorGarmentId ?? params.garmentId)?.trim();

      // M17 Codex P1.4 — variation/clone entry points seed the engine with
      // the source outfit's full garment roster so the engine builds in
      // style, not around a single anchor. Union the anchor (if present)
      // with the seed list, de-duplicating while preserving order
      // (anchor first to keep lock semantics readable).
      const seedIds = (params.preferGarmentIds ?? [])
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter((id) => id.length > 0);
      const preferList: string[] = [];
      const seenPrefer = new Set<string>();
      const pushUnique = (id: string | undefined) => {
        if (!id) return;
        if (seenPrefer.has(id)) return;
        seenPrefer.add(id);
        preferList.push(id);
      };
      pushUnique(anchorId);
      for (const id of seedIds) pushUnique(id);

      // Resolve weather BEFORE issuing the engine call. `liveWeather` is
      // null on the first render after a cold cache, so a screen that fires
      // generate() from a mount effect would otherwise always send
      // FALLBACK_WEATHER on first launch. `awaitFreshWeather` reads the
      // same React Query cache `useWeather` populates, joins the in-flight
      // fetch when one's running, kicks a fresh fetch when nothing's been
      // requested, AND races the wait against a 1.5 s timeout so a slow /
      // captive / offline network can't strand the engine call —
      // `FALLBACK_WEATHER` is the safety net on null. (Codex P2 round 2
      // on PR #775.)
      const weatherForCall: WeatherData | null = await awaitFreshWeather(queryClient);
      const effectiveWeather = weatherForCall
        ? {
            temperature: weatherForCall.temperature,
            precipitation: weatherForCall.precipitation,
            wind: weatherForCall.wind,
          }
        : FALLBACK_WEATHER;

      try {
        let data: EngineResponse;
        try {
          data = await callEdgeFunction<EngineResponse>('burs_style_engine', {
            body: {
              mode: 'generate',
              generator_mode: 'standard',
              occasion: params.occasion ?? 'Everyday',
              style: params.mood ?? null,
              weather: effectiveWeather,
              locale: 'en',
              prefer_garment_ids: preferList,
            },
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

        if (data.error) {
          setError(data.error);
          return;
        }

        // Suggest-mode `outfits[0]` arrives pre-shaped; defensively re-adapt
        // items so a slot omission can't crash downstream `.toUpperCase()`.
        // Codex audit P1-1 + P0-2 (audit 3).
        let nextResult: GeneratedOutfit;
        if (data.outfits?.[0]?.items) {
          const first = data.outfits[0];
          nextResult = {
            outfit_name: first.outfit_name ?? defaultName(params),
            description: first.description ?? data.explanation ?? '',
            occasion: params.occasion,
            formality: params.formality,
            items: adaptItems(first.items),
          };
        } else if (data.items?.length || data.explanation) {
          nextResult = {
            outfit_name: defaultName(params),
            description: data.explanation ?? '',
            occasion: params.occasion,
            formality: params.formality,
            items: adaptItems(data.items),
          };
        } else {
          nextResult = {
            outfit_name: defaultName(params),
            description: 'Generated for you',
            occasion: params.occasion,
            formality: params.formality,
            items: [],
          };
        }

        // Treat an empty composition as a generation failure rather than a
        // success — the screen would otherwise expose Save / Wear today CTAs
        // over an outfit with zero items. Reuse the INVALID_OUTFIT_ERROR
        // sentinel so screens already branching on it (formatGenerateOutfitError +
        // OutfitGenerateScreen) render the existing "we couldn't build a
        // complete outfit" copy. Codex P2 round on PR #738.
        if (nextResult.items.length === 0) {
          setError(INVALID_OUTFIT_ERROR);
          Sentry.withScope((s) => {
            s.setTag('mutation', 'useGenerateOutfit.emptyItems');
            s.setExtra('engine_response', data);
            Sentry.captureMessage('engine_returned_empty_items', 'warning');
          });
          return;
        }

        // M13: post-response anchor enforcement. The engine treats
        // prefer_garment_ids as a soft hint, so a returned outfit may not
        // include the anchor. Web's generator rejects this scenario rather
        // than offering "Wear today" / "Save outfit" CTAs over an outfit
        // that violates the user's locked piece (Codex P2 round 4 on PR
        // #737). Mobile mirrors web: skip publishing the result, raise the
        // `anchor_missed` sentinel error, flip `anchorMissed` for screen
        // copy. The "Try again" path on the screen calls generate() again
        // with the same anchor; auto-retry inside the hook would loop on a
        // wardrobe with no viable composition.
        if (anchorId && nextResult.items.length > 0) {
          const ids = nextResult.items.map((it) => it.garment_id);
          if (!isAnchorPresent(ids, anchorId)) {
            setAnchorMissed(true);
            setError(ANCHOR_MISSED_ERROR);
            Sentry.withScope((s) => {
              s.setTag('mutation', 'useGenerateOutfit.anchorDrift');
              s.setExtra('anchor_garment_id', anchorId);
              s.setExtra('returned_garment_ids', ids);
              Sentry.captureMessage('anchor_garment_dropped_by_engine', 'warning');
            });
            return;
          }
        }

        // M13: post-response slot-rule validation. Engine items carry an
        // explicit `slot` field — feed those to validateCompleteOutfit
        // (the OutfitValidationItem path that consults `normalizeOutfitRuleSlot`
        // when no garment is attached) so an invalid outfit (top + shoes
        // with no bottom, top + dress conflict) is rejected with the same
        // error-path treatment as anchor_missed. Codex P2 round 6 + 7 on
        // PR #737.
        //
        // Reject criterion is `missing` OR `conflictingSlots`, NOT
        // `!isValid`, because the engine may legitimately return a layered
        // top (base + cardigan/overshirt) — both items arrive as
        // `slot: 'top'` and `validateOutfitItems` flags duplicate-slot +
        // unknown-layer-role for them since the response doesn't carry
        // garment data we can use to infer `layering_role`. Hydrating the
        // garments would require an extra DB hit; gating only on missing
        // essentials + real conflicts (dress+top, dress+bottom) catches
        // the broken cases the wave intends to block while letting valid
        // layered outfits through. Codex round 7 — preserve layer roles.
        if (nextResult.items.length > 0) {
          // Use `validateOutfitItems` directly (same gates as
          // `validateCompleteOutfit` — `requireShoes: true,
          // allowLayeredTops: true`) so we can read `conflictingSlots`,
          // which the wrapper doesn't surface.
          const validation = validateOutfitItems(
            nextResult.items.map((it) => ({ slot: it.slot })),
            { requireShoes: true, allowLayeredTops: true },
          );
          // Reject on missing essentials, real slot conflicts, or any
          // non-top duplicate (e.g. two bottoms / two pairs of shoes).
          // `'top'` is excluded from the duplicate gate ONLY for the
          // 2-top case (the legitimate base + cardigan/overshirt layered
          // outfit) because we can't disambiguate `layering_role` from
          // the engine response without an extra garment hydration query.
          // 3+ tops never count as valid layering, so they stay rejected
          // — Codex round 7 (allow layered) + round 8 (block other dups)
          // + round 9b (cap the top exception at 2).
          const topCount = nextResult.items.filter((it) => it.slot === 'top').length;
          const nonLayeredDuplicates = validation.duplicateSlots.filter(
            (slot) => slot !== 'top' || topCount > 2,
          );
          if (
            validation.missing.length > 0
            || validation.conflictingSlots.length > 0
            || nonLayeredDuplicates.length > 0
          ) {
            setError(INVALID_OUTFIT_ERROR);
            Sentry.withScope((s) => {
              s.setTag('mutation', 'useGenerateOutfit.invalidOutfit');
              s.setExtra('returned_items', nextResult.items);
              s.setExtra('missing', validation.missing);
              s.setExtra('conflicting_slots', validation.conflictingSlots);
              s.setExtra('duplicate_slots', validation.duplicateSlots);
              s.setExtra('present_slots', validation.presentSlots);
              s.setExtra('top_count', topCount);
              Sentry.captureMessage('engine_returned_invalid_outfit', 'warning');
            });
            return;
          }
        }

        setResult(nextResult);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Generation failed';
        // Skip the expected paywall sentinel — those are gating, not failures.
        if (message !== SUBSCRIPTION_SENTINEL) {
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
    [session?.access_token, liveWeather, queryClient],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setResult(null);
    setIsLoading(false);
    setError(null);
    setAnchorMissed(false);
  }, []);

  // Cancel any in-flight generation when the consumer screen unmounts so
  // the trailing setState calls don't fire against a torn-down tree.
  // Codex P2 round on PR #738.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { result, isLoading, error, anchorMissed, generate, reset };
}
