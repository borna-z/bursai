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

function buildWeatherSuggestion(weather: WeatherData | undefined, _locale: string): string {
  if (!weather) {
    return 'What should I wear today?';
  }
  const temp = Math.round(weather.temperature);
  const condKey = weather.condition;
  const cond = condKey.includes('rain') || condKey.includes('drizzle') ? 'rainy'
    : condKey.includes('snow') ? 'snowy'
    : condKey.includes('cloud') ? 'cloudy'
    : 'sunny';
  return `It's ${temp}°C and ${cond} — what works?`;
}

function buildCalendarSuggestion(_locale: string): string {
  return 'I have a meeting today';
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function buildLeastWornSuggestion(garment: Garment | null, _locale: string): string {
  if (!garment) return 'Style my least worn item';
  return truncate(`Style my ${garment.title.toLowerCase()}`, 32);
}

function buildMostWornSuggestion(garment: Garment | null, _locale: string): string {
  if (!garment) return 'New ways to wear my favorite';
  return truncate(`New ways to wear my ${garment.title.toLowerCase()}`, 36);
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
    const weatherChip = buildWeatherSuggestion(weather ?? undefined, locale);
    const calendarChip = buildCalendarSuggestion(locale);

    // Row 2: wardrobe-aware
    const leastWorn = findLeastWorn(allGarments);
    const mostWorn = findMostWorn(allGarments);
    const leastWornChip = buildLeastWornSuggestion(leastWorn, locale);
    const mostWornChip = buildMostWornSuggestion(mostWorn, locale);

    // Row 3: discovery (static)
    const discoveryChips = ['What\'s missing in my wardrobe?', 'Find me a date night outfit'];

    return [
      [weatherChip, calendarChip],
      [leastWornChip, mostWornChip],
      discoveryChips,
    ];
  }, [weather, garmentList, locale]);

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
          {t('chat.greeting_prefix') || 'Hey'}, {name}
        </motion.p>
      )}
      
      <motion.h2
        variants={itemVariants}
        className="font-['Playfair_Display'] italic text-[1.2rem] text-foreground mb-0.5 leading-tight"
      >
        {t('chat.welcome_title') || 'Your personal stylist'}
      </motion.h2>
      
      <motion.p
        variants={itemVariants}
        className="text-[13px] text-muted-foreground/50 max-w-[220px] leading-relaxed"
      >
        {t('chat.welcome_subtitle') || 'Ask me anything about your wardrobe, outfits, or style'}
      </motion.p>

      {/* Suggestion chips — single column for clean alignment */}
      <motion.div variants={itemVariants} className="w-full mt-8 flex flex-col items-stretch gap-2 max-w-xs mx-auto">
        {suggestions.flat().map((chip) => (
          <motion.button
            key={chip}
            variants={itemVariants}
            onClick={() => onSuggestion(chip)}
            className="w-full rounded-[1.25rem] px-5 py-2.5 text-[13px] leading-snug border border-border/20 bg-secondary/20 hover:bg-secondary/50 text-foreground/70 hover:text-foreground transition-colors whitespace-normal text-left active:scale-[0.97]"
            whileTap={{ scale: 0.97 }}
          >
            {chip}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}
