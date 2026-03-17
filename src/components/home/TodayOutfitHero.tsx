import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, CloudSun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/lib/haptics';
import { EASE_CURVE } from '@/lib/motion';
import { useLanguage } from '@/contexts/LanguageContext';


interface TodayOutfitHeroProps {
  weather?: { temperature?: number; precipitation?: string; condition?: string };
  garmentCount?: number;
  className?: string;
}

/**
 * Premium "What should I wear?" hero card.
 * The emotional core of BURS's daily flow.
 */
export function TodayOutfitHero({ weather, className }: TodayOutfitHeroProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const hour = new Date().getHours();
  const isRain = weather?.precipitation === 'rain' || weather?.precipitation === 'snow';

  // Context-aware headline
  let headline = 'What are you wearing today?';
  if (hour < 10) headline = 'Good morning — let me style your day.';
  else if (hour < 14) headline = 'What should you wear right now?';
  else if (hour < 18) headline = 'Need an outfit for tonight?';
  else headline = 'Plan tomorrow\'s look before bed.';

  // Context-aware subtitle
  let subtitle = 'I\'ll match it to the weather, your schedule, and what you haven\'t worn lately.';
  if (isRain) subtitle = 'Rain in the forecast — I\'ll pick something weather-appropriate.';
  else if (weather?.temperature != null && weather.temperature < 5)
    subtitle = 'It\'s cold out — I\'ll layer you up properly.';
  else if (weather?.temperature != null && weather.temperature > 28)
    subtitle = 'Hot day ahead — light fabrics and breathable fits.';

  const ctaLabel = 'Style me';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE_CURVE }}
      className={cn(
        'relative overflow-hidden rounded-2xl p-6 space-y-4',
        'bg-gradient-to-br from-primary/8 via-card to-background',
        'border border-primary/10',
        className,
      )}
    >
      {/* Ambient glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      {/* Headline */}
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: EASE_CURVE }}
        className="text-lg font-semibold tracking-[-0.02em] leading-snug text-foreground pr-8"
      >
        {headline}
      </motion.h2>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25, ease: EASE_CURVE }}
        className="text-[12px] text-muted-foreground/70 leading-relaxed max-w-[300px]"
      >
        {subtitle}
      </motion.p>

      {/* Context badges */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.35 }}
        className="flex items-center gap-2 flex-wrap"
      >
        {weather?.temperature != null && (
          <Badge variant="secondary" className="text-[10px] font-normal gap-1">
            <CloudSun className="w-3 h-3" />
            {Math.round(weather.temperature)}°
          </Badge>
        )}
        {isRain && (
          <Badge variant="secondary" className="text-[10px] font-normal bg-primary/10 text-primary">
            {weather?.precipitation === 'snow' ? '❄️ Snow' : '🌧 Rain'}
          </Badge>
        )}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4, ease: EASE_CURVE }}
      >
        <Button
          onClick={() => {
            hapticLight();
            navigate('/outfits/generate');
          }}
          className="bg-foreground text-background h-12 rounded-full w-full text-[15px] font-medium font-['DM_Sans']"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {ctaLabel}
        </Button>
      </motion.div>
    </motion.div>
  );
}
