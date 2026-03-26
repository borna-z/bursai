import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, CloudSun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/lib/haptics';
import { EASE_CURVE } from '@/lib/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { OutfitComposition } from '@/components/ui/OutfitComposition';
import type { OutfitWithItems } from '@/hooks/useOutfits';


interface TodayOutfitHeroProps {
  weather?: { temperature?: number; precipitation?: string; condition?: string };
  garmentCount?: number;
  recentOutfits?: OutfitWithItems[];
  className?: string;
}

/**
 * Premium "What should I wear?" hero card.
 * The emotional core of BURS's daily flow.
 */
export function TodayOutfitHero({ weather, garmentCount, recentOutfits, className }: TodayOutfitHeroProps) {
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
  const hasRecentOutfits = recentOutfits && recentOutfits.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE_CURVE }}
      className={cn(
        'relative overflow-hidden bg-foreground px-5 py-6',
        className,
      )}
    >
      {/* ── Header row: headline + weather badges ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: EASE_CURVE }}
        className="flex items-start justify-between gap-3 mb-1.5"
      >
        <h2 className="font-['Playfair_Display'] italic text-[17px] leading-snug text-background/90 flex-1">
          {headline}
        </h2>

        {/* Inline weather badges */}
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          {weather?.temperature != null && (
            <Badge variant="secondary" className="text-[10px] font-normal gap-1 bg-background/10 text-background/70 border-none">
              <CloudSun className="w-3 h-3" />
              {Math.round(weather.temperature)}°
            </Badge>
          )}
          {isRain && (
            <Badge variant="secondary" className="text-[10px] font-normal bg-background/10 text-background/70 border-none">
              {weather?.precipitation === 'snow' ? '❄️' : '🌧'}
            </Badge>
          )}
        </div>
      </motion.div>

      {/* ── Subtitle ── */}
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25, ease: EASE_CURVE }}
        className="font-['DM_Sans'] text-[12px] text-background/40 leading-relaxed mb-5 max-w-[320px]"
      >
        {subtitle}
      </motion.p>

      {/* ── Recent outfit thumbnails ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3, ease: EASE_CURVE }}
        className="mb-5"
      >
        {hasRecentOutfits ? (
          <div className="flex items-center gap-3">
            {recentOutfits.slice(0, 3).map((outfit) => (
              <button
                key={outfit.id}
                onClick={() => {
                  hapticLight();
                  navigate(`/outfits/${outfit.id}`);
                }}
                className="w-16 h-16 rounded-lg overflow-hidden bg-background/5 border border-background/10 cursor-pointer shrink-0"
              >
                <OutfitComposition
                  items={outfit.outfit_items}
                  compact
                  className="w-full h-full"
                />
              </button>
            ))}
            <p className="font-['DM_Sans'] text-[11px] text-background/30 ml-1 leading-tight">
              Recent<br />looks
            </p>
          </div>
        ) : (
          <p className="font-['Playfair_Display'] italic text-[13px] text-background/25">
            Your first AI outfit awaits
          </p>
        )}
      </motion.div>

      {/* ── Stats line + CTA ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4, ease: EASE_CURVE }}
        className="flex items-center justify-between gap-4"
      >
        {garmentCount != null && garmentCount > 0 && (
          <p className="font-['DM_Sans'] text-[11px] text-background/30 tracking-wide">
            {garmentCount} items in your wardrobe
          </p>
        )}

        <Button
          onClick={() => {
            hapticLight();
            navigate('/outfits/generate');
          }}
          className="bg-background text-foreground h-10 rounded-full px-6 text-[13px] font-medium font-['DM_Sans'] shrink-0 ml-auto hover:bg-background/90"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          {ctaLabel}
        </Button>
      </motion.div>
    </motion.div>
  );
}
