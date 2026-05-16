// useWeekGenerator — orchestrator. Composes useWeatherAndContext
// (weather + recently-worn IDs) and useWeekGenerationLoop (per-day
// dispatch) into the 7-day generation flow consumed by PlanScreen.
//
// Sequential per-day calls preserved verbatim from the pre-split
// implementation (the engine is rate-limited per-user and a 7-shot
// fan-out would burn the per-minute budget on the premium tier in a
// single second). Per-day failures live on `entries[i].error`; a
// `subscription_required` short-circuits the loop and surfaces the
// sentinel as the top-level `error`.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import {
  EdgeFunctionSubscriptionLockedError,
  SUBSCRIPTION_SENTINEL,
} from '../lib/edgeFunctionClient';
import { localISODate } from '../lib/outfitDisplay';
import { Sentry } from '../lib/sentry';
import {
  useWeekGenerationLoop,
  type WeekGeneratorEntry,
} from './useWeekGenerationLoop';
import { useWeatherAndContext } from './useWeatherAndContext';

export type { WeekGeneratorEntry } from './useWeekGenerationLoop';

export interface UseWeekGeneratorResult {
  entries: WeekGeneratorEntry[];
  isGenerating: boolean;
  completed: number;
  error: string | null;
  regeneratingDates: Set<string>;
  generateWeek: (params?: { startDate?: Date; locale?: string }) => Promise<void>;
  regenerateDay: (date: string) => Promise<void>;
  reset: () => void;
}

function computeWeekIsos(startDate: Date): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    out.push(localISODate(d));
  }
  return out;
}

export function useWeekGenerator(): UseWeekGeneratorResult {
  const { session } = useAuth();
  const { callOneDay } = useWeekGenerationLoop();
  const { recentlyWornIds, resolveWeather } = useWeatherAndContext();

  const [entries, setEntries] = useState<WeekGeneratorEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingDates, setRegeneratingDates] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const regenAbortMapRef = useRef<Map<string, AbortController>>(new Map());
  const lastParamsRef = useRef<{ locale: string } | null>(null);
  const recentlyWornRef = useRef<string[]>(recentlyWornIds);
  recentlyWornRef.current = recentlyWornIds;

  const generateWeek = useCallback(
    async (params?: { startDate?: Date; locale?: string }) => {
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const start = params?.startDate ?? new Date();
      const locale = params?.locale ?? 'en';
      const isos = computeWeekIsos(start);
      const wornSnapshot = recentlyWornRef.current;

      lastParamsRef.current = { locale };

      setIsGenerating(true);
      setError(null);
      setEntries(isos.map((date) => ({ date, outfit: null, error: null })));

      try {
        const effectiveWeather = await resolveWeather();
        if (controller.signal.aborted) return;

        for (const date of isos) {
          if (controller.signal.aborted) return;
          try {
            const entry = await callOneDay({
              date,
              locale,
              recentlyWornIds: wornSnapshot,
              weather: effectiveWeather,
              signal: controller.signal,
            });
            if (controller.signal.aborted) return;
            setEntries((prev) => prev.map((e) => (e.date === date ? entry : e)));
          } catch (err) {
            if (err instanceof EdgeFunctionSubscriptionLockedError) {
              setError(SUBSCRIPTION_SENTINEL);
              return;
            }
            Sentry.withScope((s) => {
              s.setTag('mutation', 'useWeekGenerator');
              Sentry.captureException(err);
            });
            setError(err instanceof Error ? err.message : 'Week generation failed');
            return;
          }
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsGenerating(false);
        }
      }
    },
    [session?.access_token, callOneDay, resolveWeather],
  );

  const regenerateDay = useCallback(
    async (date: string) => {
      if (!session?.access_token) return;
      const params = lastParamsRef.current;
      if (!params) return;

      const existing = regenAbortMapRef.current.get(date);
      if (existing) {
        existing.abort();
      }
      const controller = new AbortController();
      regenAbortMapRef.current.set(date, controller);

      let previousEntry: WeekGeneratorEntry | null = null;
      setEntries((prev) => {
        const found = prev.find((e) => e.date === date);
        if (found) previousEntry = found;
        return prev.map((e) => (e.date === date ? { date, outfit: null, error: null } : e));
      });

      setRegeneratingDates((prev) => {
        const next = new Set(prev);
        next.add(date);
        return next;
      });

      const wornSnapshot = recentlyWornRef.current;

      try {
        const effectiveWeather = await resolveWeather();
        if (controller.signal.aborted) return;

        const entry = await callOneDay({
          date,
          locale: params.locale,
          recentlyWornIds: wornSnapshot,
          weather: effectiveWeather,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setEntries((prev) => prev.map((e) => (e.date === date ? entry : e)));
      } catch (err) {
        if (err instanceof EdgeFunctionSubscriptionLockedError) {
          setError(SUBSCRIPTION_SENTINEL);
          setEntries((prev) =>
            prev.map((e) => {
              if (e.date !== date) return e;
              if (previousEntry) return previousEntry;
              return { date, outfit: null, error: SUBSCRIPTION_SENTINEL };
            }),
          );
          return;
        }
        const message = err instanceof Error ? err.message : 'Generation failed';
        setEntries((prev) =>
          prev.map((e) => (e.date === date ? { date, outfit: null, error: message } : e)),
        );
      } finally {
        if (regenAbortMapRef.current.get(date) === controller) {
          regenAbortMapRef.current.delete(date);
        }
        setRegeneratingDates((prev) => {
          if (!prev.has(date)) return prev;
          const next = new Set(prev);
          next.delete(date);
          return next;
        });
      }
    },
    [session?.access_token, callOneDay, resolveWeather],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    for (const controller of regenAbortMapRef.current.values()) {
      controller.abort();
    }
    regenAbortMapRef.current.clear();
    lastParamsRef.current = null;
    setEntries([]);
    setError(null);
    setIsGenerating(false);
    setRegeneratingDates(new Set());
  }, []);

  useEffect(() => {
    const regenMap = regenAbortMapRef.current;
    return () => {
      abortRef.current?.abort();
      for (const controller of regenMap.values()) {
        controller.abort();
      }
      regenMap.clear();
    };
  }, []);

  const completed = entries.filter((e) => e.outfit !== null).length;

  return {
    entries,
    isGenerating,
    completed,
    error,
    regeneratingDates,
    generateWeek,
    regenerateDay,
    reset,
  };
}
