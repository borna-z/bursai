import type { MouseEvent, ReactNode } from 'react';
import { Clock3, Palette, Sparkles, Shirt, WashingMachine } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { type Garment } from '@/hooks/useGarments';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { categoryLabel, colorLabel, humanize } from '@/lib/humanize';
import { cn } from '@/lib/utils';
import { GarmentProcessingBadge } from '@/components/wardrobe/GarmentProcessingBadge';
import { RenderPendingOverlay } from '@/components/wardrobe/RenderPendingOverlay';
import { CardEyebrow, CardMetaRail, CardPill } from '@/components/ui/card-language';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const WARDROBE_GRID_ROW_HEIGHT = 286;
export const WARDROBE_LIST_ROW_HEIGHT = 188;

type GarmentStateTone = 'default' | 'laundry';

interface WardrobeGarmentCardModel {
  titleText: string;
  categoryText: string;
  colorText: string | null;
  wearText: string;
  wearBadgeText: string;
  occasionLabels: string[];
  stateLabel: string | null;
  stateTone: GarmentStateTone;
}

function translateOrFallback(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated && translated !== key ? translated : fallback;
}

function isRecentlyAdded(garment: Garment) {
  if (!garment.created_at) return false;
  return Date.now() - new Date(garment.created_at).getTime() < ONE_DAY_MS;
}

function readOccasionLabels(garment: Garment, t: (key: string) => string): string[] {
  const raw = garment.ai_raw;
  if (!raw || typeof raw !== 'object') return [];

  const occasions = (raw as Record<string, unknown>).occasions;
  if (!Array.isArray(occasions)) return [];

  return occasions
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .slice(0, 2)
    .map((value) => {
      const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
      return translateOrFallback(t, `occasion.${normalized}`, humanize(value.replace(/_/g, ' ')));
    });
}

function buildGarmentCardModel(garment: Garment, t: (key: string) => string): WardrobeGarmentCardModel {
  const titleText = garment.title?.trim() || translateOrFallback(t, 'common.garment', 'Garment');
  const categoryText = categoryLabel(t, garment.category);
  const colorText = garment.color_primary ? colorLabel(t, garment.color_primary) : null;

  let stateLabel: string | null = null;
  let stateTone: GarmentStateTone = 'default';

  if (garment.in_laundry) {
    stateLabel = t('wardrobe.laundry');
    stateTone = 'laundry';
  } else if (isRecentlyAdded(garment)) {
    stateLabel = t('wardrobe.new_badge') || 'New';
  }

  return {
    titleText,
    categoryText,
    colorText,
    wearText: garment.wear_count && garment.wear_count > 0
      ? translateOrFallback(t, 'wardrobe.wears_count', `${garment.wear_count} wears`).replace('{count}', String(garment.wear_count))
      : translateOrFallback(t, 'garment.never_worn', 'Never worn'),
    wearBadgeText: garment.wear_count && garment.wear_count > 0 ? `${garment.wear_count}x` : '0x',
    occasionLabels: readOccasionLabels(garment, t),
    stateLabel,
    stateTone,
  };
}

function WardrobeImageStateBadge({ label, tone }: { label: string; tone: GarmentStateTone }) {
  const Icon = tone === 'laundry' ? WashingMachine : Sparkles;

  return (
    <CardPill
      icon={Icon}
      label={label}
      tone={tone === 'laundry' ? 'warning' : 'muted'}
      className={cn(
        'max-w-[120px] shadow-none',
        tone !== 'laundry' && 'bg-background/86',
      )}
    />
  );
}

function WardrobeWearBadge({ label }: { label: string }) {
  return <CardPill label={label} tone="muted" className="shadow-none bg-background/86 text-foreground/56" />;
}

export function WardrobeFormalityDots({ formality }: { formality?: number | null }) {
  if (formality == null) return null;

  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={cn(
            'h-[5px] w-[14px] rounded-full transition-colors',
            index < formality ? 'bg-foreground/65' : 'bg-foreground/12',
          )}
        />
      ))}
    </div>
  );
}

export function WardrobeOccasionPills({ occasions, className }: { occasions: string[]; className?: string }) {
  if (occasions.length === 0) return null;

  return (
    <CardMetaRail className={className}>
      {occasions.map((occasion) => (
        <CardPill key={occasion} label={occasion} tone="default" />
      ))}
    </CardMetaRail>
  );
}

export function WardrobeStyleAroundButton({
  onClick,
  className,
  fullWidth = true,
  t,
}: {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  fullWidth?: boolean;
  t: (key: string) => string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-[16px] bg-foreground px-3 text-[11px] font-semibold text-background transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(28,25,23,0.12)] active:translate-y-0 active:scale-[0.99]',
        fullWidth && 'w-full',
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {translateOrFallback(t, 'wardrobe.style_around_this', 'Style this')}
    </button>
  );
}

function WardrobeActionSlot({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-auto flex flex-wrap gap-2', className)}>{children}</div>;
}

function WardrobeGarmentImage({
  garment,
  isSelecting,
  isSelected,
  model,
  className,
  imageClassName,
}: {
  garment: Garment;
  isSelecting?: boolean;
  isSelected?: boolean;
  model: WardrobeGarmentCardModel;
  className?: string;
  imageClassName?: string;
}) {
  const showRenderOverlay = garment.render_status === 'pending' || garment.render_status === 'rendering';

  return (
    <div className={cn('relative overflow-hidden rounded-[20px] border border-border/35 bg-muted/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.32)]', className)}>
      <LazyImageSimple
        imagePath={getPreferredGarmentImagePath(garment)}
        alt={model.titleText}
        className={cn('h-full w-full object-cover', imageClassName)}
        fallbackIcon={<Shirt className="h-7 w-7 text-muted-foreground/35" />}
      />
      <RenderPendingOverlay renderStatus={garment.render_status} />

      <div className="absolute left-2.5 top-2.5 z-[3]">
        {isSelecting ? (
          <div className="rounded-full bg-background/90 p-1">
            <Checkbox
              checked={isSelected}
              className="border-foreground/20 bg-background/80 data-[state=checked]:border-transparent data-[state=checked]:bg-foreground data-[state=checked]:text-background"
            />
          </div>
        ) : model.stateLabel ? (
          <WardrobeImageStateBadge label={model.stateLabel} tone={model.stateTone} />
        ) : null}
      </div>

      <div className="absolute right-2.5 top-2.5 z-[3]">
        <WardrobeWearBadge label={model.wearBadgeText} />
      </div>

      {!showRenderOverlay && (
        <div className="absolute bottom-2.5 left-2.5 z-[3]">
          <GarmentProcessingBadge
            status={garment.image_processing_status}
            renderStatus={garment.render_status}
            className="bg-background/78"
          />
        </div>
      )}
    </div>
  );
}

export function WardrobeGarmentGridLayout({
  garment,
  t,
  isSelecting = false,
  isSelected = false,
  onStyleAround,
}: {
  garment: Garment;
  t: (key: string) => string;
  isSelecting?: boolean;
  isSelected?: boolean;
  onStyleAround?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const model = buildGarmentCardModel(garment, t);

  return (
    <div
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-[26px] border border-border/35 bg-card/92 p-2 shadow-[0_14px_32px_rgba(28,25,23,0.04)] transition-shadow duration-200 hover:shadow-[0_18px_36px_rgba(28,25,23,0.07)]',
        garment.in_laundry && 'opacity-72',
        isSelected && 'ring-2 ring-foreground/25 ring-offset-2 ring-offset-background',
      )}
    >
      <WardrobeGarmentImage
        garment={garment}
        isSelecting={isSelecting}
        isSelected={isSelected}
        model={model}
        className="aspect-[3/4] w-full"
      />

      <div className="flex flex-1 flex-col gap-3 px-2.5 pb-2.5 pt-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <CardEyebrow>{model.categoryText}</CardEyebrow>
            <WardrobeFormalityDots formality={garment.formality} />
          </div>

          <p className="line-clamp-2 text-[14px] font-medium leading-tight tracking-[-0.02em] text-foreground">
            {model.titleText}
          </p>
        </div>

        <CardMetaRail>
          {model.colorText ? <CardPill icon={Palette} label={model.colorText} tone="default" /> : null}
          <CardPill icon={Clock3} label={model.wearText} tone="muted" />
        </CardMetaRail>

        <WardrobeOccasionPills occasions={model.occasionLabels} />

        {!isSelecting && onStyleAround && (
          <WardrobeActionSlot>
            <WardrobeStyleAroundButton onClick={onStyleAround} className="flex-1" t={t} />
          </WardrobeActionSlot>
        )}
      </div>
    </div>
  );
}

export function WardrobeGarmentListLayout({
  garment,
  t,
  isSelecting = false,
  isSelected = false,
  onStyleAround,
  secondaryAction,
}: {
  garment: Garment;
  t: (key: string) => string;
  isSelecting?: boolean;
  isSelected?: boolean;
  onStyleAround?: (event: MouseEvent<HTMLButtonElement>) => void;
  secondaryAction?: ReactNode;
}) {
  const model = buildGarmentCardModel(garment, t);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[28px] border border-border/35 bg-card/92 p-2.5 shadow-[0_14px_32px_rgba(28,25,23,0.04)]',
        garment.in_laundry && 'opacity-72',
        isSelected && 'ring-2 ring-foreground/25 ring-offset-2 ring-offset-background',
      )}
    >
      <div className="flex gap-3.5">
        <WardrobeGarmentImage
          garment={garment}
          isSelecting={isSelecting}
          isSelected={isSelected}
          model={model}
          className="h-[120px] w-[96px] shrink-0"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-3 py-1">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <CardEyebrow>{model.categoryText}</CardEyebrow>
              <WardrobeFormalityDots formality={garment.formality} />
            </div>

            <p className="line-clamp-2 text-[16px] font-medium leading-tight tracking-[-0.025em] text-foreground">
              {model.titleText}
            </p>

            <CardMetaRail>
              {model.colorText ? <CardPill icon={Palette} label={model.colorText} tone="default" /> : null}
              <CardPill icon={Clock3} label={model.wearText} tone="muted" />
            </CardMetaRail>
          </div>

          <WardrobeOccasionPills occasions={model.occasionLabels} />

          {!isSelecting && (onStyleAround || secondaryAction) && (
            <WardrobeActionSlot className="mt-auto">
              {onStyleAround && (
                <WardrobeStyleAroundButton
                  onClick={onStyleAround}
                  className={secondaryAction ? 'min-w-[132px] flex-1' : 'w-full'}
                  fullWidth={!secondaryAction}
                  t={t}
                />
              )}
              {secondaryAction}
            </WardrobeActionSlot>
          )}
        </div>
      </div>
    </div>
  );
}
