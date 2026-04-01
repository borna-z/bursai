import { Sparkles } from 'lucide-react';

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

const MAX_THUMBS = 3;

function OutfitThumbnailStrip({ items }: { items: OutfitWithItems['outfit_items'] }) {
  const visible = items.filter((i) => i.garment).slice(0, MAX_THUMBS);
  const overflow = Math.max(0, items.filter((i) => i.garment).length - MAX_THUMBS);

  if (visible.length === 0) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border/30 bg-secondary/40">
        <BursMonogram size={8} className="opacity-10" />
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      {visible.map((item) => (
        <div
          key={item.id}
          className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border/30 bg-background"
        >
          <LazyImageSimple
            imagePath={getPreferredGarmentImagePath(item.garment)}
            alt={item.garment?.title || item.slot}
            className="h-full w-full object-cover"
          />
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border/30 bg-secondary/40">
          <span className="text-[11px] font-medium text-muted-foreground">+{overflow}</span>
        </div>
      )}
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
          {/* Compact horizontal preview */}
          <div className="flex items-center gap-3.5">
            <OutfitThumbnailStrip items={todayOutfit.outfit_items} />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="caption-upper text-muted-foreground/55">
                {t('home.todays_look') || "Today's look"}
              </p>
              <h2 className="truncate font-display italic text-[1.1rem] leading-tight tracking-[-0.02em] text-foreground">
                {todayOutfit.occasion || t('home.todays_look') || "Today's Look"}
              </h2>
              {weatherSummary ? (
                <p className="text-[0.78rem] text-muted-foreground/60">{weatherSummary}</p>
              ) : null}
            </div>
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
