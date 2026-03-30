import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

import type { OutfitWithItems } from '@/hooks/useOutfits';
import type { HomeState } from '@/components/home/homeTypes';
import { OutfitComposition } from '@/components/ui/OutfitComposition';
import { CardPill } from '@/components/ui/card-language';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';


interface HomeTodayLookCardProps {
  state: Exclude<HomeState, 'loading'>;
  todayOutfit: OutfitWithItems | null;
  garmentCount: number;
  weatherSummary: string | null;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
  primaryLabel: string;
  secondaryLabel: string;
}

export function HomeTodayLookCard({
  state,
  todayOutfit,
  garmentCount,
  weatherSummary,
  onPrimaryAction,
  onSecondaryAction,
  primaryLabel,
  secondaryLabel,
}: HomeTodayLookCardProps) {
  const { t } = useLanguage();

  if (state === 'empty_wardrobe') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="surface-hero relative overflow-hidden rounded-[1.25rem] p-6"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="caption-upper text-muted-foreground/50">{t('home.command_status_setup') || 'Getting started'}</p>
            <h2 className="font-display italic text-[1.35rem] leading-tight tracking-[-0.02em]">
              {t('home.setup_title') || 'Build your wardrobe'}
            </h2>
            <p className="text-[0.92rem] leading-relaxed text-muted-foreground">
              {t('home.setup_desc') || 'Add at least 3 pieces to unlock your first outfit.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/60">
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, ((garmentCount ?? 0) / 3) * 100)}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="text-[12px] font-medium text-muted-foreground/60">
              {garmentCount}/3
            </span>
          </div>

          <Button
            onClick={onPrimaryAction}
            className="h-12 w-full rounded-full text-[14px] font-semibold"
          >
            {primaryLabel}
          </Button>
        </div>
      </motion.div>
    );
  }

  if (state === 'outfit_planned' && todayOutfit) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="surface-hero relative overflow-hidden rounded-[1.25rem]"
      >
        {/* Outfit composition grid */}
        <div className="p-4">
          <OutfitComposition items={todayOutfit.outfit_items} className="rounded-[1rem]" />
        </div>

        {/* Info overlay */}
        <div className="space-y-3 px-5 pb-5">
          <div className="flex items-center gap-2">
            {weatherSummary && (
              <CardPill label={weatherSummary} tone="muted" size="sm" />
            )}
          </div>

          <h2 className="font-display italic text-[1.35rem] leading-tight tracking-[-0.02em]">
            {todayOutfit.occasion || t('home.todays_look') || "Today's Look"}
          </h2>

          <div className="flex items-center gap-2 text-[0.84rem] text-muted-foreground">
            {todayOutfit.occasion && <span>{todayOutfit.occasion}</span>}
            {todayOutfit.occasion && weatherSummary && <span>·</span>}
            {weatherSummary && <span>{weatherSummary}</span>}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={onSecondaryAction}
              className="h-11 flex-1 rounded-full text-[13px] font-semibold"
            >
              {secondaryLabel}
            </Button>
            <Button
              onClick={onPrimaryAction}
              variant="outline"
              className="h-11 rounded-full px-4 text-[13px]"
            >
              {primaryLabel}
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // no_outfit or weather_alert
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="surface-hero relative overflow-hidden rounded-[1.25rem] p-6"
    >
      <div className="space-y-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-[1.1rem] bg-secondary/50">
          <Sparkles className="h-6 w-6 text-accent" />
        </div>

        <div className="space-y-2">
          <p className="caption-upper text-muted-foreground/50">
            {state === 'weather_alert' ? t('home.command_status_weather') || 'Weather alert' : t('home.command_status_open') || 'Open day'}
          </p>
          <h2 className="font-display italic text-[1.35rem] leading-tight tracking-[-0.02em]">
            {state === 'weather_alert'
              ? t('home.weather_title') || 'Dress for the weather'
              : t('home.no_outfit_title') || 'Find your fit'}
          </h2>
          <p className="text-[0.92rem] leading-relaxed text-muted-foreground">
            {state === 'weather_alert'
              ? t('home.weather_desc') || 'Let AI pick an outfit for the conditions.'
              : t('home.no_outfit_desc') || 'Generate a look for today in seconds.'}
          </p>
        </div>

        <Button
          onClick={onPrimaryAction}
          className="h-12 w-full rounded-full text-[14px] font-semibold"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {primaryLabel}
        </Button>
      </div>
    </motion.div>
  );
}
