import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWeather, type WeatherData } from '@/hooks/useWeather';
import { useProfile } from '@/hooks/useProfile';
import { useFlatGarments } from '@/hooks/useGarments';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

interface ChatWelcomeProps {
  onSuggestion: (text: string) => void;
  displayName?: string;
  garmentCount?: number;
}

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'tween' as const, ease: EASE_CURVE, duration: 0.5 },
  },
};

type Garment = Tables<'garments'>;

function findLeastWorn(garments: Garment[]): Garment | null {
  if (!garments.length) return null;
  const eligible = garments.filter(g => g.category !== 'accessories');
  if (!eligible.length) return null;
  return eligible.reduce((best, g) => {
    const bCount = best.wear_count ?? 0;
    const gCount = g.wear_count ?? 0;
    return gCount < bCount ? g : best;
  }, eligible[0]);
}

function findMostWorn(garments: Garment[]): Garment | null {
  if (!garments.length) return null;
  const eligible = garments.filter(g => (g.wear_count ?? 0) > 0);
  if (!eligible.length) return null;
  return eligible.reduce((best, g) => {
    const bCount = best.wear_count ?? 0;
    const gCount = g.wear_count ?? 0;
    return gCount > bCount ? g : best;
  }, eligible[0]);
}

function buildWeatherSuggestion(weather: WeatherData | undefined, _locale: string, t: (key: string) => string): string {
  if (!weather) {
    return t('chat.chip_wear_today');
  }
  const temp = Math.round(weather.temperature);
  const condKey = weather.condition;
  const cond = condKey.includes('rain') || condKey.includes('drizzle') ? t('chat.weather_rainy')
    : condKey.includes('snow') ? t('chat.weather_snowy')
    : condKey.includes('cloud') ? t('chat.weather_cloudy')
    : t('chat.weather_sunny');
  return t('chat.chip_weather_template').replace('{temp}', String(temp)).replace('{cond}', cond);
}

function buildCalendarSuggestion(_locale: string, t: (key: string) => string): string {
  return t('chat.chip_meeting');
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function buildLeastWornSuggestion(garment: Garment | null, _locale: string, t: (key: string) => string): string {
  if (!garment) return t('chat.chip_least_worn');
  return truncate(t('chat.chip_style_item').replace('{item}', garment.title.toLowerCase()), 32);
}

function buildMostWornSuggestion(garment: Garment | null, _locale: string, t: (key: string) => string): string {
  if (!garment) return t('chat.chip_most_worn');
  return truncate(t('chat.chip_new_ways_item').replace('{item}', garment.title.toLowerCase()), 36);
}

export function ChatWelcome({ onSuggestion, displayName }: ChatWelcomeProps) {
  const { t, locale } = useLanguage();
  useAuth();
  const { data: profile } = useProfile();
  const city = profile?.home_city || 'Stockholm';
  const { weather } = useWeather({ city });
  const { data: garmentList } = useFlatGarments();

  const suggestions = useMemo(() => {
    const allGarments = garmentList ?? [];

    // Row 1: contextual (weather + calendar)
    const weatherChip = buildWeatherSuggestion(weather ?? undefined, locale, t);
    const calendarChip = buildCalendarSuggestion(locale, t);

    // Row 2: wardrobe-aware
    const leastWorn = findLeastWorn(allGarments);
    const mostWorn = findMostWorn(allGarments);
    const leastWornChip = buildLeastWornSuggestion(leastWorn, locale, t);
    const mostWornChip = buildMostWornSuggestion(mostWorn, locale, t);

    // Row 3: discovery (static)
    const discoveryChips = [t('chat.chip_wardrobe_missing'), t('chat.chip_date_night')];

    return [
      [weatherChip, calendarChip],
      [leastWornChip, mostWornChip],
      discoveryChips,
    ];
  }, [weather, garmentList, locale, t]);

  const name = displayName || profile?.display_name || '';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center"
    >
      <motion.div
        variants={itemVariants}
        className="w-16 h-16 rounded-[1.25rem] border border-border/30 flex items-center justify-center mb-5"
      >
        <Sparkles className="w-6 h-6 text-primary/60" />
      </motion.div>
      
      {name && (
        <motion.p variants={itemVariants} className="text-[13px] text-muted-foreground/40 mb-0.5 tracking-wide">
          {t('chat.greeting_prefix')}, {name}
        </motion.p>
      )}
      
      <motion.h2
        variants={itemVariants}
        className="font-['Playfair_Display'] italic text-[1.4rem] text-foreground mb-0.5 leading-tight"
      >
        {t('chat.welcome_title')}
      </motion.h2>
      
      <motion.p
        variants={itemVariants}
        className="text-[14px] text-muted-foreground/50 max-w-[220px] leading-relaxed"
      >
        {t('chat.welcome_subtitle')}
      </motion.p>

      {/* Suggestion chips — single column for clean alignment */}
      <motion.div variants={itemVariants} className="w-full mt-8 flex flex-col items-stretch gap-2 max-w-xs mx-auto">
        {suggestions.flat().map((chip) => (
          <motion.button
            key={chip}
            variants={itemVariants}
            onClick={() => onSuggestion(chip)}
            className="w-full rounded-[1.25rem] px-5 py-2.5 text-[13px] leading-snug border border-border/20 surface-editorial hover:bg-secondary/50 text-foreground/70 hover:text-foreground transition-colors whitespace-normal text-left active:scale-[0.97] min-h-[52px]"
            whileTap={{ scale: 0.97 }}
          >
            {chip}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}
