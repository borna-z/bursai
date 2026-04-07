import { ChevronRight, Sparkles } from 'lucide-react';

import type { OutfitWithItems } from '@/hooks/useOutfits';
import type { HomeState } from '@/components/home/homeTypes';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { BursMonogram } from '@/components/ui/BursMonogram';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface HomeTodayLookCardProps {
  state: Exclude<HomeState, 'loading'>;
  todayOutfit: OutfitWithItems | null;
  garmentCount: number;
  weatherSummary: string | null;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
  onOutfitTap?: () => void;
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
    <div className="premium-action-row pt-0.5">
      <Button
        onClick={onPrimaryAction}
        size="sm"
        className="min-w-[8rem] flex-1 rounded-full text-[13px] font-semibold"
      >
        {primaryLabel}
      </Button>
      <Button
        onClick={onSecondaryAction}
        variant="outline"
        size="sm"
        className="rounded-full px-4 text-[12px]"
      >
        {secondaryLabel}
      </Button>
    </div>
  );
}

function OutfitThumbnailRow({
  items,
  onTap,
}: {
  items: OutfitWithItems['outfit_items'];
  onTap?: () => void;
}) {
  const visible = items.filter((i) => i.garment).slice(0, 4);

  if (visible.length === 0) {
    return (
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-border/30 bg-secondary/40">
        <BursMonogram size={10} className="opacity-10" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onTap}
      className="grid w-full grid-cols-4 gap-2 cursor-pointer"
    >
      {visible.map((item) => (
        <div
          key={item.id}
          className="aspect-square overflow-hidden rounded-xl border border-border/30 bg-background"
        >
          <LazyImageSimple
            imagePath={getPreferredGarmentImagePath(item.garment)}
            alt={item.garment?.title || item.slot}
            className="h-full w-full object-cover"
          />
        </div>
      ))}
      {/* Fill remaining slots so grid stays 4-col */}
      {Array.from({ length: Math.max(0, 4 - visible.length) }, (_, i) => (
        <div
          key={`empty-${i}`}
          className="flex aspect-square items-center justify-center rounded-xl border border-border/30 bg-secondary/30"
        >
          <BursMonogram size={8} className="opacity-8" />
        </div>
      ))}
    </button>
  );
}

export function HomeTodayLookCard({
  state,
  todayOutfit,
  garmentCount,
  weatherSummary,
  onPrimaryAction,
  onSecondaryAction,
  onOutfitTap,
  primaryLabel,
  secondaryLabel,
}: HomeTodayLookCardProps) {
  const { t } = useLanguage();

  if (state === 'empty_wardrobe') {
    return (
      <div className="relative overflow-hidden pb-1">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="caption-upper text-muted-foreground/55">
              {t('home.command_status_setup') || 'Getting started'}
            </p>
            <h2 className="font-display italic text-[1.2rem] leading-tight tracking-[-0.02em] text-foreground">
              {t('home.setup_title') || 'Build your wardrobe'}
            </h2>
            <p className="max-w-[30ch] text-[0.85rem] leading-5 text-muted-foreground">
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
      <div className="relative overflow-hidden pb-1">
        <div className="space-y-3">
          {/* Header row with tap-to-open */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="caption-upper text-muted-foreground/55">
                {t('home.todays_look') || "Today's look"}
              </p>
              <h2 className="font-display italic text-[1.15rem] leading-tight tracking-[-0.02em] text-foreground">
                {todayOutfit.occasion || t('home.todays_look') || "Today's Look"}
              </h2>
            </div>
            {onOutfitTap && (
              <button
                type="button"
                onClick={onOutfitTap}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.75rem] font-medium text-accent transition-colors active:bg-secondary/50 cursor-pointer"
              >
                {t('common.view') || 'View'}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 4-across garment thumbnails — tappable */}
          <OutfitThumbnailRow items={todayOutfit.outfit_items} onTap={onOutfitTap} />

          {/* Weather meta */}
          {weatherSummary ? (
            <p className="text-[0.78rem] text-muted-foreground/60">{weatherSummary}</p>
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
    <div className="relative overflow-hidden pb-1">
      <div className="space-y-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[0.85rem] bg-secondary/70">
          <Sparkles className="h-5 w-5 text-accent" />
        </div>

        <div className="space-y-1">
          <p className="caption-upper text-muted-foreground/55">
            {state === 'weather_alert'
              ? t('home.command_status_weather') || 'Weather alert'
              : t('home.command_status_open') || 'Open day'}
          </p>
          <h2 className="font-display italic text-[1.2rem] leading-tight tracking-[-0.02em] text-foreground">
            {state === 'weather_alert'
              ? t('home.weather_title') || 'Dress for the weather'
              : t('home.no_outfit_title') || 'Find your fit'}
          </h2>
          <p className="max-w-[30ch] text-[0.85rem] leading-5 text-muted-foreground">
            {state === 'weather_alert'
              ? t('home.weather_desc') || 'Let AI pick an outfit for the conditions.'
              : t('home.no_outfit_desc') || 'Generate a look for today in seconds.'}
          </p>
        </div>

        <div className="premium-action-row">
          <Button
            onClick={onPrimaryAction}
            size="sm"
            className="min-w-[8rem] flex-1 rounded-full text-[13px] font-semibold"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {primaryLabel}
          </Button>
          <Button
            onClick={onSecondaryAction}
            variant="outline"
            size="sm"
            className="rounded-full px-4 text-[12px]"
          >
            {secondaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
