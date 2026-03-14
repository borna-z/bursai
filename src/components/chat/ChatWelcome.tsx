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

function buildWeatherSuggestion(weather: WeatherData | undefined, locale: string): string {
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

function buildCalendarSuggestion(locale: string): string {
  return 'I have a meeting today';
}

function buildLeastWornSuggestion(garment: Garment | null, locale: string): string {
  if (!garment) {
    return 'Style my least worn item';
  }
  const name = garment.title.toLowerCase();
  return `Style my ${name}`;
}

function buildMostWornSuggestion(garment: Garment | null, locale: string): string {
  if (!garment) {
    return 'New ways to wear my favorite';
  }
  const name = garment.title.toLowerCase();
  return `New ways to wear my ${name}`;
}

export function ChatWelcome({ onSuggestion, displayName, garmentCount }: ChatWelcomeProps) {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
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
    const discoveryChips = locale === 'sv'
      ? ['Vad saknas i min garderob?', 'Hitta en dejt-outfit']
      : ['What\'s missing in my wardrobe?', 'Find me a date night outfit'];

    return [
      [weatherChip, calendarChip],
      [leastWornChip, mostWornChip],
      discoveryChips,
    ];
  }, [weather, garmentList, locale]);

  const baseWelcome = t('chat.welcome');
  const personalizedWelcome = displayName
    ? baseWelcome.replace(/^/, `${displayName}, `)
    : baseWelcome;
  const welcomeText = garmentCount && garmentCount > 0
    ? `${personalizedWelcome}\n${garmentCount} ${t('chat.garments_in_wardrobe')}`
    : personalizedWelcome;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center"
    >
      <motion.div
        variants={itemVariants}
        className="w-24 h-24 rounded-[28px] bg-accent/[0.05] flex items-center justify-center mb-8"
      >
        <Sparkles className="w-9 h-9 text-accent/80" />
      </motion.div>
      <motion.p
        variants={itemVariants}
        className="text-lg leading-relaxed text-muted-foreground font-light max-w-xs whitespace-pre-wrap"
      >
        {welcomeText}
      </motion.p>

      {/* Suggestion rows */}
      <motion.div variants={itemVariants} className="w-full mt-8 space-y-2.5 max-w-sm mx-auto">
        {suggestions.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className="flex gap-2 overflow-x-auto scrollbar-hide px-1 snap-x snap-mandatory"
          >
            {row.map((chip) => (
              <motion.button
                key={chip}
                variants={itemVariants}
                onClick={() => onSuggestion(chip)}
                className="shrink-0 snap-start px-4 py-2.5 text-[13px] leading-snug rounded-2xl border border-border/30 bg-foreground/[0.02] hover:bg-foreground/[0.06] text-foreground transition-colors whitespace-nowrap"
                whileTap={{ scale: 0.96 }}
              >
                {chip}
              </motion.button>
            ))}
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
