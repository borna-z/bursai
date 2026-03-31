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
  tertiaryLabel?: string;
  onTertiaryAction?: () => void;
}

function ActionRow({
  primaryLabel,
  secondaryLabel,
  tertiaryLabel,
  onPrimaryAction,
  onSecondaryAction,
  onTertiaryAction,
}: Pick<HomeTodayLookCardProps, 'primaryLabel' | 'secondaryLabel' | 'tertiaryLabel' | 'onPrimaryAction' | 'onSecondaryAction' | 'onTertiaryAction'>) {
  return (
    <div className="premium-action-row pt-1">
      <Button
        onClick={onPrimaryAction}
        className="h-12 min-w-[9.75rem] flex-1 rounded-full text-[14px] font-semibold"
      >
        {primaryLabel}
      </Button>
      <Button
        onClick={onSecondaryAction}
        variant="outline"
        className="h-12 rounded-full px-5 text-[13px]"
      >
        {secondaryLabel}
      </Button>
      {tertiaryLabel && onTertiaryAction ? (
        <Button
          onClick={onTertiaryAction}
          variant="quiet"
          className="h-12 rounded-full px-4 text-[13px]"
        >
          {tertiaryLabel}
        </Button>
      ) : null}
    </div>
  );
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
  tertiaryLabel,
  onTertiaryAction,
}: HomeTodayLookCardProps) {
  const { t } = useLanguage();

  if (state === 'empty_wardrobe') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="surface-hero premium-highlight relative overflow-hidden rounded-[1.5rem] p-6"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="caption-upper text-muted-foreground/55">
              {t('home.command_status_setup') || 'Getting started'}
            </p>
            <h2 className="font-display italic text-[1.45rem] leading-tight tracking-[-0.02em] text-foreground">
              {t('home.setup_title') || 'Build your wardrobe'}
            </h2>
            <p className="max-w-[34ch] text-[0.95rem] leading-7 text-muted-foreground">
              {t('home.setup_desc') || 'Add at least 3 pieces to unlock your first outfit.'}
            </p>
          </div>

          <div className="premium-inline-stat flex items-center gap-3">
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

          <ActionRow
            primaryLabel={primaryLabel}
            secondaryLabel={secondaryLabel}
            tertiaryLabel={tertiaryLabel}
            onPrimaryAction={onPrimaryAction}
            onSecondaryAction={onSecondaryAction}
            onTertiaryAction={onTertiaryAction}
          />
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
        className="surface-hero premium-highlight relative overflow-hidden rounded-[1.5rem]"
      >
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2 px-1 pt-1">
            <span className="eyebrow-chip">{t('plan.today')}</span>
            {weatherSummary ? <CardPill label={weatherSummary} tone="muted" size="sm" /> : null}
          </div>

          <OutfitComposition items={todayOutfit.outfit_items} className="rounded-[1rem]" />
        </div>

        <div className="space-y-4 px-5 pb-5">
          <div className="space-y-2">
            <p className="caption-upper text-muted-foreground/55">
              {t('home.todays_look') || "Today's look"}
            </p>
            <h2 className="font-display italic text-[1.5rem] leading-tight tracking-[-0.02em] text-foreground">
              {todayOutfit.occasion || t('home.todays_look') || "Today's Look"}
            </h2>
            {todayOutfit.explanation ? (
              <p className="max-w-[34ch] text-[0.95rem] leading-7 text-muted-foreground">
                {todayOutfit.explanation}
              </p>
            ) : null}
          </div>

          {weatherSummary || todayOutfit.occasion ? (
            <div className="premium-inline-stat flex flex-wrap items-center gap-2 text-[0.82rem] text-muted-foreground">
              {todayOutfit.occasion ? <span>{todayOutfit.occasion}</span> : null}
              {todayOutfit.occasion && weatherSummary ? <span>·</span> : null}
              {weatherSummary ? <span>{weatherSummary}</span> : null}
            </div>
          ) : null}

          <ActionRow
            primaryLabel={primaryLabel}
            secondaryLabel={secondaryLabel}
            tertiaryLabel={tertiaryLabel}
            onPrimaryAction={onPrimaryAction}
            onSecondaryAction={onSecondaryAction}
            onTertiaryAction={onTertiaryAction}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="surface-hero premium-highlight relative overflow-hidden rounded-[1.5rem] p-6"
    >
      <div className="space-y-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-[1.1rem] bg-secondary/70">
          <Sparkles className="h-6 w-6 text-accent" />
        </div>

        <div className="space-y-2">
          <p className="caption-upper text-muted-foreground/55">
            {state === 'weather_alert'
              ? t('home.command_status_weather') || 'Weather alert'
              : t('home.command_status_open') || 'Open day'}
          </p>
          <h2 className="font-display italic text-[1.45rem] leading-tight tracking-[-0.02em] text-foreground">
            {state === 'weather_alert'
              ? t('home.weather_title') || 'Dress for the weather'
              : t('home.no_outfit_title') || 'Find your fit'}
          </h2>
          <p className="max-w-[34ch] text-[0.95rem] leading-7 text-muted-foreground">
            {state === 'weather_alert'
              ? t('home.weather_desc') || 'Let AI pick an outfit for the conditions.'
              : t('home.no_outfit_desc') || 'Generate a look for today in seconds.'}
          </p>
        </div>

        <div className="premium-action-row">
          <Button
            onClick={onPrimaryAction}
            className="h-12 min-w-[9.75rem] flex-1 rounded-full text-[14px] font-semibold"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {primaryLabel}
          </Button>
          {tertiaryLabel && onTertiaryAction ? (
            <Button
              onClick={onTertiaryAction}
              variant="outline"
              className="h-12 rounded-full px-5 text-[13px]"
            >
              {tertiaryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
