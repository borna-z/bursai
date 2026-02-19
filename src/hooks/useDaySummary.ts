import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCalendarEvents } from '@/hooks/useCalendarSync';
import { useForecast } from '@/hooks/useForecast';
import { useProfile } from '@/hooks/useProfile';

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

export interface DaySummary {
  summary: string;
  priorities: DayPriority[];
  outfit_hints: OutfitHint[];
}

export function useDaySummary(date: string) {
  const { data: calendarEvents } = useCalendarEvents(date);
  const { data: profile } = useProfile();
  const { getForecastForDate } = useForecast({ homeCity: profile?.home_city });

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

      const locale = (profile?.preferences as Record<string, string> | null)?.locale || 'sv';

      const { data, error } = await supabase.functions.invoke('summarize_day', {
        body: { events, weather, locale },
      });

      if (error) {
        console.error('summarize_day error:', error);
        throw error;
      }

      if (data?.error) {
        console.error('summarize_day returned error:', data.error);
        throw new Error(data.error);
      }

      if (!data?.summary) return null;

      return data as DaySummary;
    },
    enabled: hasEvents,
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });
}
