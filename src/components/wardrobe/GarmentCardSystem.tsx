import type { MouseEvent, ReactNode } from 'react';
import { Sparkles, Shirt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { type Garment } from '@/hooks/useGarments';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { categoryLabel, colorLabel, humanize } from '@/lib/humanize';
import { cn } from '@/lib/utils';
import { GarmentProcessingBadge } from '@/components/wardrobe/GarmentProcessingBadge';
import { RenderPendingOverlay } from '@/components/wardrobe/RenderPendingOverlay';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const WARDROBE_GRID_ROW_HEIGHT = 268;
export const WARDROBE_LIST_ROW_HEIGHT = 172;

type GarmentStateTone = 'default' | 'laundry';

interface WardrobeGarmentCardModel {
  categoryText: string;
  metaText: string;
  wearText: string;
  occasionLabels: string[];
  stateLabel: string | null;
  stateTone: GarmentStateTone;
}

function isRecentlyAdded(garment: Garment) {
  if (!garment.created_at) return false;
  return Date.now() - new Date(garment.created_at).getTime() < ONE_DAY_MS;
}

function readOccasionLabels(garment: Garment): string[] {
  const raw = garment.ai_raw;
  if (!raw || typeof raw !== 'object') return [];

  const occasions = (raw as Record<string, unknown>).occasions;
  if (!Array.isArray(occasions)) return [];

  return occasions
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .slice(0, 2)
    .map((value) => humanize(value.replace(/_/g, ' ')));
}

function buildGarmentCardModel(garment: Garment, t: (key: string) => string): WardrobeGarmentCardModel {
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
    categoryText,
    metaText: colorText ? `${categoryText} / ${colorText}` : categoryText,
    wearText: garment.wear_count && garment.wear_count > 0 ? `${garment.wear_count} wears` : 'Never worn',
    occasionLabels: readOccasionLabels(garment),
    stateLabel,
    stateTone,
  };
}

function WardrobeImageStateBadge({ label, tone }: { label: string; tone: GarmentStateTone }) {
  return (
    <Badge
      className={cn(
        'border-none px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] shadow-sm',
        tone === 'laundry'
          ? 'bg-amber-100/95 text-amber-900'
          : 'bg-background/92 text-foreground/68'
      )}
    >
      {label}
    </Badge>
  );
}

function WardrobeWearBadge({ count }: { count: number | null }) {
  return (
    <span className="inline-flex min-w-[44px] items-center justify-center rounded-full bg-[#1C1917]/88 px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-[#F6F0E6] backdrop-blur">
      {count && count > 0 ? `${count}x` : '0x'}
    </span>
  );
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
            index < formality ? 'bg-foreground/65' : 'bg-foreground/12'
          )}
        />
      ))}
    </div>
  );
}

export function WardrobeOccasionPills({ occasions, className }: { occasions: string[]; className?: string }) {
  if (occasions.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {occasions.map((occasion) => (
        <span
          key={occasion}
          className="inline-flex items-center rounded-full border border-[#1C1917]/10 bg-white/62 px-2.5 py-1 text-[10px] font-medium text-[#1C1917]/62"
        >
          {occasion}
        </span>
      ))}
    </div>
  );
}

export function WardrobeStyleAroundButton({
  onClick,
  className,
  fullWidth = true,
}: {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#1C1917] px-3.5 text-[11px] font-semibold text-[#F6F0E6] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]',
        fullWidth && 'w-full',
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
      Style around this
    </button>
  );
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
    <div className={cn('relative overflow-hidden bg-[#E7DDD0]', className)}>
      <LazyImageSimple
        imagePath={getPreferredGarmentImagePath(garment)}
        alt={garment.title}
        className={cn('h-full w-full object-cover', imageClassName)}
        fallbackIcon={<Shirt className="h-7 w-7 text-muted-foreground/35" />}
      />
      <RenderPendingOverlay renderStatus={garment.render_status} />

      <div className="absolute left-2.5 top-2.5 z-[3]">
        {isSelecting ? (
          <div className="rounded-full bg-background/90 p-1 shadow-sm">
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
        <WardrobeWearBadge count={garment.wear_count ?? 0} />
      </div>

      {!showRenderOverlay && (
        <div className="absolute bottom-2.5 left-2.5 z-[3]">
          <GarmentProcessingBadge
            status={garment.image_processing_status}
            renderStatus={garment.render_status}
            className="bg-background/84"
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
        'flex h-full flex-col overflow-hidden rounded-[24px] border border-[#1C1917]/10 bg-[#F6F0E6] shadow-[0_18px_48px_rgba(28,25,23,0.08)]',
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

      <div className="flex flex-1 flex-col gap-3 px-3.5 pb-3.5 pt-3">
        <div className="space-y-1.5">
          <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-[#1C1917]">
            {garment.title}
          </p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#1C1917]/48">
            {model.metaText}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium text-[#1C1917]/55">{model.wearText}</span>
          <WardrobeFormalityDots formality={garment.formality} />
        </div>

        <WardrobeOccasionPills occasions={model.occasionLabels} />

        {!isSelecting && onStyleAround && (
          <WardrobeStyleAroundButton onClick={onStyleAround} className="mt-auto" />
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
        'overflow-hidden rounded-[26px] border border-[#1C1917]/10 bg-[#F6F0E6] p-2.5 shadow-[0_18px_48px_rgba(28,25,23,0.07)]',
        garment.in_laundry && 'opacity-72',
        isSelected && 'ring-2 ring-foreground/25 ring-offset-2 ring-offset-background',
      )}
    >
      <div className="flex gap-3">
        <WardrobeGarmentImage
          garment={garment}
          isSelecting={isSelecting}
          isSelected={isSelected}
          model={model}
          className="h-[112px] w-[92px] shrink-0 rounded-[18px]"
        />

        <div className="flex min-w-0 flex-1 flex-col py-1">
          <div className="space-y-1.5">
            <p className="line-clamp-2 text-[15px] font-semibold leading-tight text-[#1C1917]">
              {garment.title}
            </p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#1C1917]/48">
              {model.metaText}
            </p>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[10px] font-medium text-[#1C1917]/55">{model.wearText}</span>
            <WardrobeFormalityDots formality={garment.formality} />
          </div>

          <WardrobeOccasionPills occasions={model.occasionLabels} className="mt-2" />

          {!isSelecting && (onStyleAround || secondaryAction) && (
            <div className="mt-auto flex flex-wrap gap-2 pt-3">
              {onStyleAround && (
                <WardrobeStyleAroundButton
                  onClick={onStyleAround}
                  className={secondaryAction ? 'min-w-[148px] flex-1' : 'w-full'}
                  fullWidth={!secondaryAction}
                />
              )}
              {secondaryAction}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
