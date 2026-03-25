import type { Tables } from '@/integrations/supabase/types';
import type { WeatherData } from '@/hooks/useWeather';
import type { CalendarEvent } from '@/hooks/useCalendarSync';

type Garment = Tables<'garments'>;

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

/**
 * Returns 3-4 personalised prompt suggestions for the Today screen.
 *
 * Priority:
 * 1. Weather — cold (< 10 °C) or precipitation
 * 2. Calendar — first event today, then tomorrow
 * 3. Sleeping Beauty — a garment not worn in 21+ days
 * 4. Wardrobe palette — always included as final chip
 */
export function buildTodaySuggestions(
  weather: WeatherData | undefined,
  todayEvents: CalendarEvent[],
  tomorrowEvents: CalendarEvent[],
  garments: Garment[],
): string[] {
  const chips: string[] = [];

  // 1. WEATHER
  if (weather && (weather.temperature < 10 || weather.precipitation !== 'none')) {
    const temp = Math.round(weather.temperature);
    const cond =
      weather.precipitation === 'rain' ? 'raining'
      : weather.precipitation === 'snow' ? 'snowing'
      : 'cold';
    chips.push(`It's ${temp}°C and ${cond} — show me the strongest look for today`);
  }

  // 2. CALENDAR
  const calEvent = todayEvents[0] ?? tomorrowEvents[0] ?? null;
  if (calEvent) {
    const isToday = todayEvents.length > 0;
    const timeLabel = isToday
      ? 'today'
      : calEvent.start_time
        ? `tomorrow at ${calEvent.start_time.slice(0, 5)}`
        : 'tomorrow';
    chips.push(`I have ${truncate(calEvent.title, 30)} ${timeLabel} — what should I wear?`);
  }

  // 3. SLEEPING BEAUTY — not worn in 21+ days
  if (chips.length < 3) {
    const twentyOneDaysAgo = new Date();
    twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);

    const beauty = garments
      .filter(g => g.category !== 'accessories')
      .find(g => {
        if (g.last_worn_at) return new Date(g.last_worn_at) < twentyOneDaysAgo;
        if (g.created_at) return new Date(g.created_at) < twentyOneDaysAgo;
        return false;
      });

    if (beauty) {
      chips.push(
        `I haven't worn my ${truncate(beauty.title.toLowerCase(), 28)} in a while — build a look around it`,
      );
    }
  }

  // 4. WARDROBE PALETTE — always present as the final chip
  const paletteOptions = [
    "What's my strongest look right now?",
    "Show me something I haven't tried before",
  ];
  chips.push(paletteOptions[chips.length % 2]);

  return chips.slice(0, 4);
}
