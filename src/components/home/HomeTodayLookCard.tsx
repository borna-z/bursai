import { Sparkles } from 'lucide-react';

import type { OutfitWithItems } from '@/hooks/useOutfits';
import type { HomeState } from '@/components/home/homeTypes';
import { OutfitComposition } from '@/components/ui/OutfitComposition';
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

function ActionRow({
  primaryLabel,
  secondaryLabel,
  onPrimaryAction,
  onSecondaryAction,
}: Pick<HomeTodayLookCardProps, 'primaryLabel' | 'secondaryLabel' | 'onPrimaryAction' | 'onSecondaryAction'>) {
  return (
    <div className="premium-action-row pt-1">
      <Button
        onClick={onPrimaryAction}
        className="h-11 min-w-[9.25rem] flex-1 rounded-full text-[14px] font-semibold"
      >
        {primaryLabel}
      </Button>
      <Button
        onClick={onSecondaryAction}
        variant="outline"
        className="h-11 rounded-full px-4.5 text-[13px]"
      >
        {secondaryLabel}
      </Button>
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
}: HomeTodayLookCardProps) {
  const { t } = useLanguage();

  if (state === 'empty_wardrobe') {
    return (
      <div className="relative overflow-hidden pb-2">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="caption-upper text-muted-foreground/55">
              {t('home.command_status_setup') || 'Getting started'}
            </p>
            <h2 className="font-display italic text-[1.45rem] leading-tight tracking-[-0.02em] text-foreground">
              {t('home.setup_title') || 'Build your wardrobe'}
            </h2>
            <p className="max-w-[30ch] text-[0.92rem] leading-6 text-muted-foreground">
              {t('home.setup_desc') || 'Add at least 3 pieces to unlock your first outfit.'}
            </p>
          </div>

          <div className="premium-inline-stat flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/60">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.min(100, ((garmentCount ?? 0) / 3) * 100)}%` }}
              />
            </div>
            <span className="text-[12px] font-medium text-muted-foreground/60">
              {garmentCount}/3
            </span>
          </div>

          <ActionRow
            primaryLabel={primaryLabel}
            secondaryLabel={secondaryLabel}
            onPrimaryAction={onPrimaryAction}
            onSecondaryAction={onSecondaryAction}
          />
        </div>
      </div>
    );
  }

  if (state === 'outfit_planned' && todayOutfit) {
    return (
      <div className="relative overflow-hidden">
        <div className="space-y-3.5 pb-1">
          <div className="flex flex-wrap items-center gap-2 px-1 pt-1">
            <span className="eyebrow-chip">{t('plan.today')}</span>
          </div>

          <OutfitComposition items={todayOutfit.outfit_items} className="rounded-[1rem]" />
        </div>

        <div className="space-y-3.5 pb-2">
          <div className="space-y-1.5">
            <p className="caption-upper text-muted-foreground/55">
              {t('home.todays_look') || "Today's look"}
            </p>
            <h2 className="font-display italic text-[1.5rem] leading-tight tracking-[-0.02em] text-foreground">
              {todayOutfit.occasion || t('home.todays_look') || "Today's Look"}
            </h2>
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
            onPrimaryAction={onPrimaryAction}
            onSecondaryAction={onSecondaryAction}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden pb-2">
      <div className="space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-secondary/70">
          <Sparkles className="h-6 w-6 text-accent" />
        </div>

        <div className="space-y-1.5">
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
          <p className="max-w-[30ch] text-[0.92rem] leading-6 text-muted-foreground">
            {state === 'weather_alert'
              ? t('home.weather_desc') || 'Let AI pick an outfit for the conditions.'
              : t('home.no_outfit_desc') || 'Generate a look for today in seconds.'}
          </p>
        </div>

        <div className="premium-action-row">
          <Button
            onClick={onPrimaryAction}
            className="h-11 min-w-[9.25rem] flex-1 rounded-full text-[14px] font-semibold"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {primaryLabel}
          </Button>
          <Button
            onClick={onSecondaryAction}
            variant="outline"
            className="h-11 rounded-full px-4.5 text-[13px]"
          >
            {secondaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
