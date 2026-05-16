// useWeekGenerationLoop — extracted FIFO day-dispatch primitive.
//
// Owns: per-day call to `burs_style_engine` (sequential, never parallel,
// matches the web's intent of avoiding rate-limit bursts on a single
// user — the engine is rate-limited per-user and a 7-shot fan-out would
// burn the per-minute budget on the premium tier in a single second);
// per-day error capture so a single bad day doesn't drop the rest; abort
// propagation. Stateless — every output flows back through callbacks /
// the returned `WeekGeneratorEntry`.

import { useCallback, useMemo } from 'react';

import {
  callEdgeFunction,
  EdgeFunctionHttpError,
  EdgeFunctionSubscriptionLockedError,
} from '../lib/edgeFunctionClient';
import {
  buildDayIntelligence,
  type DayEventInput,
  type DayWeatherInput,
} from '../lib/dayIntelligence';
import { Sentry } from '../lib/sentry';
import { validateOutfitItems } from '../lib/outfitRules';
import type { ScoredOutfitDraft } from './useOutfitPool';

export interface WeekGeneratorEntry {
  date: string;
  outfit: ScoredOutfitDraft | null;
  error: string | null;
}

type EngineResponseItem = { slot?: string; garment_id?: string };
type EngineResponse = {
  items?: EngineResponseItem[];
  explanation?: string;
  family_label?: string | null;
  confidence_score?: number | null;
  confidence_level?: string | null;
  occasion?: string | null;
  error?: string;
};

function adaptItems(items: EngineResponseItem[] | undefined): { slot: string; garment_id: string }[] {
  return (items ?? [])
    .filter((it): it is { slot?: string; garment_id: string } => typeof it.garment_id === 'string')
    .map((it) => ({
      slot: typeof it.slot === 'string' && it.slot ? it.slot : 'top',
      garment_id: it.garment_id,
    }));
}

function makeDraftId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface CallOneDayParams {
  date: string;
  locale: string;
  recentlyWornIds: string[];
  weather: DayWeatherInput;
  signal: AbortSignal;
}

export function useWeekGenerationLoop(): {
  callOneDay: (params: CallOneDayParams) => Promise<WeekGeneratorEntry>;
} {
  const callOneDay = useCallback(
    async ({
      date,
      locale,
      recentlyWornIds,
      weather,
      signal,
    }: CallOneDayParams): Promise<WeekGeneratorEntry> => {
      const events: DayEventInput[] = [];
      const effectiveWeather: DayWeatherInput = weather;
      const intelligence = buildDayIntelligence(events, effectiveWeather);

      try {
        const data = await callEdgeFunction<EngineResponse>('burs_style_engine', {
          body: {
            mode: 'generate',
            generator_mode: 'standard',
            occasion: intelligence.dominant_occasion,
            style: null,
            weather: effectiveWeather,
            locale,
            day_context: intelligence,
            exclude_garment_ids: recentlyWornIds,
          },
          signal,
        });

        if (!data) {
          return { date, outfit: null, error: 'invalid_response' };
        }
        if (data.error) {
          return { date, outfit: null, error: data.error };
        }

        const items = adaptItems(data?.items);
        if (items.length === 0) {
          return { date, outfit: null, error: 'no_items' };
        }

        const validation = validateOutfitItems(
          items.map((it) => ({ slot: it.slot })),
          { requireShoes: true, allowLayeredTops: true },
        );
        const topCount = items.filter((it) => it.slot === 'top').length;
        const nonLayeredDuplicates = validation.duplicateSlots.filter(
          (slot) => slot !== 'top' || topCount > 2,
        );
        if (
          validation.missing.length > 0
          || validation.conflictingSlots.length > 0
          || nonLayeredDuplicates.length > 0
        ) {
          return { date, outfit: null, error: 'invalid_outfit' };
        }

        return {
          date,
          outfit: {
            draftId: makeDraftId(),
            items,
            explanation: data?.explanation ?? '',
            occasion: data?.occasion ?? intelligence.dominant_occasion ?? undefined,
            family_label: data?.family_label ?? null,
            confidence_score: data?.confidence_score ?? null,
            confidence_level: data?.confidence_level ?? null,
          },
          error: null,
        };
      } catch (err) {
        if (err instanceof EdgeFunctionSubscriptionLockedError) {
          throw err;
        }
        Sentry.withScope((s) => {
          s.setTag('mutation', 'useWeekGenerator.dayFailure');
          s.setExtra('date', date);
          if (err instanceof EdgeFunctionHttpError) {
            s.setExtra('status', err.status);
            s.setExtra('body', err.bodyText);
          }
          Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
        });
        const message = err instanceof Error ? err.message : 'Generation failed';
        return { date, outfit: null, error: message };
      }
    },
    [],
  );

  return useMemo(() => ({ callOneDay }), [callOneDay]);
}
