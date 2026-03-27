import type { Tables } from '@/integrations/supabase/types';
import type { WeatherData } from '@/hooks/useWeather';
import type { CalendarEvent } from '@/hooks/useCalendarSync';

type Garment = Tables<'garments'>;

export interface TodaySuggestion {
  id: string;
  text: string;
  route: 'chat' | 'generate';
  garmentIds?: string[];
  prefillMessage?: string;
}

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max - 1)}...` : str;
}

/**
 * Returns 3-4 personalised prompt suggestions for the Today screen.
 *
 * Priority:
 * 1. Weather - cold (< 10 C) or precipitation
 * 2. Calendar - first event today, then tomorrow
 * 3. Sleeping Beauty - a garment not worn in 21+ days
 * 4. Wardrobe palette - always included as final chip
 */
export function buildTodaySuggestions(
  weather: WeatherData | undefined,
  todayEvents: CalendarEvent[],
  tomorrowEvents: CalendarEvent[],
  garments: Garment[],
): TodaySuggestion[] {
  const chips: TodaySuggestion[] = [];

  if (weather && (weather.temperature < 10 || weather.precipitation !== 'none')) {
    const temp = Math.round(weather.temperature);
    const cond =
      weather.precipitation === 'rain' ? 'raining'
      : weather.precipitation === 'snow' ? 'snowing'
      : 'cold';
    const text = `It's ${temp}C and ${cond} - show me the strongest look for today`;
    chips.push({
      id: 'weather',
      text,
      route: 'chat',
      prefillMessage: text,
    });
  }

  const calEvent = todayEvents[0] ?? tomorrowEvents[0] ?? null;
  if (calEvent) {
    const isToday = todayEvents.length > 0;
    const timeLabel = isToday
      ? 'today'
      : calEvent.start_time
        ? `tomorrow at ${calEvent.start_time.slice(0, 5)}`
        : 'tomorrow';
    const text = `I have ${truncate(calEvent.title, 30)} ${timeLabel} - what should I wear?`;
    chips.push({
      id: `calendar-${calEvent.id}`,
      text,
      route: 'chat',
      prefillMessage: text,
    });
  }

  if (chips.length < 3) {
    const twentyOneDaysAgo = new Date();
    twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);

    const beauty = garments
      .filter((garment) => garment.category !== 'accessories' && garment.category !== 'accessory')
      .find((garment) => {
        if (garment.last_worn_at) return new Date(garment.last_worn_at) < twentyOneDaysAgo;
        if (garment.created_at) return new Date(garment.created_at) < twentyOneDaysAgo;
        return false;
      });

    if (beauty) {
      const text = `I haven't worn my ${truncate(beauty.title.toLowerCase(), 28)} in a while - build a look around it`;
      chips.push({
        id: `sleeping-beauty-${beauty.id}`,
        text,
        route: 'generate',
        garmentIds: [beauty.id],
      });
    }
  }

  const paletteOptions = [
    "What's my strongest look right now?",
    "Show me something I haven't tried before",
  ];
  const paletteText = paletteOptions[chips.length % 2];
  chips.push({
    id: `palette-${chips.length}`,
    text: paletteText,
    route: 'chat',
    prefillMessage: paletteText,
  });

  return chips.slice(0, 4);
}
