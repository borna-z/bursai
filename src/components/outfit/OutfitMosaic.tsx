import { memo } from 'react';
import { Shirt } from 'lucide-react';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { cn } from '@/lib/utils';

export interface MosaicItem {
  id: string;
  imagePath?: string;
  alt: string;
  slot?: string;
}

interface OutfitMosaicProps {
  items: MosaicItem[];
  className?: string;
  onItemClick?: (id: string) => void;
  /**
   * thumbnail — 2×2 grid with +N count, for card grids and previews
   * full     — adaptive editorial layout showing all items
   * strip    — horizontal row for inline contexts (planner, etc.)
   */
  variant?: 'thumbnail' | 'full' | 'strip';
  gap?: string;
  rounded?: string;
  showSlotLabels?: boolean;
}

/**
 * Unified outfit mosaic — the single presentation component for outfit
 * garment images across the app. Handles 1–6 items gracefully.
 *
 * Light-theme first. No dark overlays on slot labels — uses frosted glass
 * treatment that works in both light and dark modes.
 */
export const OutfitMosaic = memo(function OutfitMosaic({
  items,
  className,
  onItemClick,
  variant = 'thumbnail',
  gap = 'gap-[1px]',
  rounded = 'rounded-xl',
  showSlotLabels = false,
}: OutfitMosaicProps) {
  if (items.length === 0) return null;

  if (variant === 'strip') {
    return (
      <StripMosaic
        items={items}
        className={className}
        onItemClick={onItemClick}
      />
    );
  }

  if (variant === 'thumbnail') {
    return (
      <ThumbnailMosaic
        items={items}
        className={className}
        gap={gap}
        rounded={rounded}
        onItemClick={onItemClick}
      />
    );
  }

  return (
    <FullMosaic
      items={items}
      className={className}
      gap={gap}
      rounded={rounded}
      onItemClick={onItemClick}
      showSlotLabels={showSlotLabels}
    />
  );
});

/* ── Thumbnail: 2×2 with +N overflow ────────────────── */

function ThumbnailMosaic({
  items,
  className,
  gap,
  rounded,
  onItemClick,
}: {
  items: MosaicItem[];
  className?: string;
  gap: string;
  rounded: string;
  onItemClick?: (id: string) => void;
}) {
  const visible = items.slice(0, 4);
  const overflow = items.length - 4;

  return (
    <div
      className={cn(
        'aspect-square overflow-hidden relative grid grid-cols-2 grid-rows-2 bg-muted/20',
        rounded,
        gap,
        className,
      )}
    >
      {visible.map((item, i) => (
        <MosaicCell
          key={item.id}
          item={item}
          onClick={onItemClick ? () => onItemClick(item.id) : undefined}
        />
      ))}
      {Array.from({ length: Math.max(0, 4 - visible.length) }).map((_, i) => (
        <div key={`empty-${i}`} className="bg-muted/10" />
      ))}
      {overflow > 0 && (
        <div className="absolute bottom-1.5 right-1.5 bg-background/80 backdrop-blur-sm text-foreground/60 text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none ring-1 ring-border/10">
          +{overflow}
        </div>
      )}
    </div>
  );
}

/* ── Strip: horizontal row for inline contexts ──────── */

function StripMosaic({
  items,
  className,
  onItemClick,
}: {
  items: MosaicItem[];
  className?: string;
  onItemClick?: (id: string) => void;
}) {
  const visible = items.slice(0, 4);
  const overflow = items.length - 4;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {visible.map((item, i) => (
        <div
          key={item.id}
          className={cn(
            'flex-1 overflow-hidden',
            i < visible.length - 1 && 'border-r border-background',
          )}
          onClick={onItemClick ? () => onItemClick(item.id) : undefined}
        >
          <LazyImageSimple
            imagePath={item.imagePath}
            alt={item.alt}
            className="w-full h-full object-cover"
            fallbackIcon={<Shirt className="w-4 h-4 text-muted-foreground/20" />}
          />
        </div>
      ))}
      {overflow > 0 && (
        <div className="w-8 flex items-center justify-center bg-muted/30 shrink-0 self-stretch">
          <span className="text-[10px] font-medium text-muted-foreground">+{overflow}</span>
        </div>
      )}
    </div>
  );
}

/* ── Full: adaptive editorial layouts ───────────────── */

function FullMosaic({
  items,
  className,
  gap,
  rounded,
  onItemClick,
  showSlotLabels,
}: {
  items: MosaicItem[];
  className?: string;
  gap: string;
  rounded: string;
  onItemClick?: (id: string) => void;
  showSlotLabels: boolean;
}) {
  const count = items.length;

  // 1–2 items: side by side
  if (count <= 2) {
    return (
      <div
        className={cn(
          'overflow-hidden grid grid-cols-2 bg-muted/10',
          rounded,
          gap,
          className,
        )}
      >
        {items.map((item) => (
          <MosaicCell
            key={item.id}
            item={item}
            onClick={onItemClick ? () => onItemClick(item.id) : undefined}
            aspectClass="aspect-[3/4]"
            showSlotLabel={showSlotLabels}
          />
        ))}
      </div>
    );
  }

  // 3 items: hero left (row-span-2) + 2 stacked right
  if (count === 3) {
    return (
      <div
        className={cn(
          'overflow-hidden grid grid-cols-2 grid-rows-2 bg-muted/10',
          rounded,
          gap,
          className,
        )}
      >
        <MosaicCell
          item={items[0]}
          onClick={onItemClick ? () => onItemClick(items[0].id) : undefined}
          className="row-span-2"
          showSlotLabel={showSlotLabels}
        />
        <MosaicCell
          item={items[1]}
          onClick={onItemClick ? () => onItemClick(items[1].id) : undefined}
          showSlotLabel={showSlotLabels}
        />
        <MosaicCell
          item={items[2]}
          onClick={onItemClick ? () => onItemClick(items[2].id) : undefined}
          showSlotLabel={showSlotLabels}
        />
      </div>
    );
  }

  // 4 items: classic 2×2
  if (count === 4) {
    return (
      <div
        className={cn(
          'overflow-hidden grid grid-cols-2 bg-muted/10',
          rounded,
          gap,
          className,
        )}
      >
        {items.map((item) => (
          <MosaicCell
            key={item.id}
            item={item}
            onClick={onItemClick ? () => onItemClick(item.id) : undefined}
            aspectClass="aspect-square"
            showSlotLabel={showSlotLabels}
          />
        ))}
      </div>
    );
  }

  // 5 items: 3 top (taller) + 2 bottom (wider)
  if (count === 5) {
    return (
      <div
        className={cn(
          'overflow-hidden grid grid-cols-6 bg-muted/10',
          rounded,
          gap,
          className,
        )}
      >
        {items.slice(0, 3).map((item) => (
          <MosaicCell
            key={item.id}
            item={item}
            onClick={onItemClick ? () => onItemClick(item.id) : undefined}
            className="col-span-2"
            aspectClass="aspect-[3/4]"
            showSlotLabel={showSlotLabels}
          />
        ))}
        {items.slice(3, 5).map((item) => (
          <MosaicCell
            key={item.id}
            item={item}
            onClick={onItemClick ? () => onItemClick(item.id) : undefined}
            className="col-span-3"
            aspectClass="aspect-[4/3]"
            showSlotLabel={showSlotLabels}
          />
        ))}
      </div>
    );
  }

  // 6+ items: clean 3×2 grid
  return (
    <div
      className={cn(
        'overflow-hidden grid grid-cols-3 bg-muted/10',
        rounded,
        gap,
        className,
      )}
    >
      {items.slice(0, 6).map((item) => (
        <MosaicCell
          key={item.id}
          item={item}
          onClick={onItemClick ? () => onItemClick(item.id) : undefined}
          aspectClass="aspect-square"
          showSlotLabel={showSlotLabels}
        />
      ))}
    </div>
  );
}

/* ── Individual cell ────────────────────────────────── */

function MosaicCell({
  item,
  onClick,
  className,
  aspectClass = '',
  showSlotLabel = false,
}: {
  item: MosaicItem;
  onClick?: () => void;
  className?: string;
  aspectClass?: string;
  showSlotLabel?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted/10',
        aspectClass,
        onClick && 'cursor-pointer active:scale-[0.98] transition-transform',
        className,
      )}
      onClick={onClick}
    >
      <LazyImageSimple
        imagePath={item.imagePath}
        alt={item.alt}
        className="w-full h-full object-cover"
        fallbackIcon={<Shirt className="w-6 h-6 text-muted-foreground/15" />}
      />
      {showSlotLabel && item.slot && (
        <div className="absolute bottom-0 left-0 right-0 p-2 pt-5 bg-gradient-to-t from-foreground/40 to-transparent">
          <p className="text-[9px] text-background/80 uppercase tracking-[0.15em] font-medium">
            {item.slot}
          </p>
        </div>
      )}
    </div>
  );
}
