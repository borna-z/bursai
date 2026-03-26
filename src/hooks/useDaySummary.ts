import { useQuery } from '@tanstack/react-query';
import { useCalendarEvents } from '@/hooks/useCalendarSync';
import { useForecast } from '@/hooks/useForecast';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { asPreferences } from '@/types/preferences';
import { useProfile } from '@/hooks/useProfile';
import { useLocation } from '@/contexts/LocationContext';
import { logger } from '@/lib/logger';

export interface DayPriority {
  title: string;
  occasion: string;
  formality: number;
  time: string;
}

export interface OutfitHint {
  occasion: string;
  style: string;
  note: string;
}

export interface TransitionBlock {
  time_range: string;
  occasion: string;
  formality: number;
  label: string;
  style_tip: string;
  transition_tip: string | null;
}

export interface DayTransitions {
  needs_change: boolean;
  blocks: TransitionBlock[];
  versatile_pieces: string[];
}

export interface DaySummary {
  summary: string;
  priorities: DayPriority[];
  outfit_hints: OutfitHint[];
  transitions: DayTransitions | null;
}

export function useDaySummary(date: string) {
  const { data: calendarEvents } = useCalendarEvents(date);
  const { data: profile } = useProfile();
  const { effectiveCity } = useLocation();
  const { getForecastForDate } = useForecast({ city: effectiveCity });

  const hasEvents = !!calendarEvents && calendarEvents.length > 0;
  const forecast = getForecastForDate(date);

  return useQuery<DaySummary | null>({
    queryKey: ['day-summary', date, calendarEvents?.map(e => e.id).join(',')],
    queryFn: async () => {
      if (!calendarEvents || calendarEvents.length === 0) return null;

      const events = calendarEvents.map(e => ({
        title: e.title,
        start_time: e.start_time,
        end_time: e.end_time,
      }));

      const weather = forecast
        ? {
            temperature: Math.round((forecast.temperature_max + forecast.temperature_min) / 2),
            precipitation: forecast.precipitation_probability && forecast.precipitation_probability > 50 ? 'rain' : 'none',
          }
        : null;

      const locale = (asPreferences(profile?.preferences)?.language as string) || 'sv';

      const { data, error } = await invokeEdgeFunction<DaySummary & { error?: string }>('summarize_day', {
        body: { events, weather, locale },
      });

      if (error) {
        logger.error('summarize_day error:', error);
        throw error;
      }

      if (data?.error) {
        logger.error('summarize_day returned error:', data.error);
        throw new Error(data.error);
      }

      if (!data?.summary) return null;

      return data as DaySummary;
    },
    enabled: hasEvents,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
}
