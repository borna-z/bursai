import { memo } from 'react';
import { Shirt } from 'lucide-react';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { cn } from '@/lib/utils';

interface MosaicItem {
  id: string;
  imagePath?: string;
  alt: string;
  slot?: string;
}

interface OutfitMosaicProps {
  items: MosaicItem[];
  className?: string;
  onItemClick?: (id: string) => void;
  /** 'thumbnail' caps at 4 with +N badge; 'full' shows editorial layout for all items */
  variant?: 'thumbnail' | 'full';
  gap?: string;
  rounded?: string;
  /** Show slot labels overlaid on each cell (full variant only) */
  showSlotLabels?: boolean;
}

/**
 * Adaptive outfit mosaic that gracefully handles 3–6 garment outfits.
 *
 * Thumbnail variant: 2×2 grid with overflow badge.
 * Full variant: editorial layout that scales with garment count —
 *   3: hero + 2 stacked  |  4: 2×2  |  5: 3 top + 2 bottom  |  6: 3×2
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
        'aspect-square overflow-hidden relative grid grid-cols-2 grid-rows-2 bg-muted/30',
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
          className={cn(
            i === 0 && 'rounded-tl-xl',
            i === 1 && 'rounded-tr-xl',
            i === 2 && 'rounded-bl-xl',
            i === 3 && 'rounded-br-xl',
          )}
        />
      ))}
      {Array.from({ length: Math.max(0, 4 - visible.length) }).map((_, i) => (
        <div key={`empty-${i}`} className="bg-muted/20" />
      ))}
      {overflow > 0 && (
        <div className="absolute bottom-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
          +{overflow}
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

  // 3 items: hero left (row-span-2) + 2 stacked right
  if (count === 3) {
    return (
      <div
        className={cn(
          'overflow-hidden grid grid-cols-2 grid-rows-2 bg-muted/30',
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
  if (count <= 4) {
    return (
      <div
        className={cn(
          'overflow-hidden grid grid-cols-2 bg-muted/30',
          rounded,
          gap,
          className,
        )}
      >
        {items.slice(0, 4).map((item, i) => (
          <MosaicCell
            key={item.id}
            item={item}
            onClick={onItemClick ? () => onItemClick(item.id) : undefined}
            className={cn(
              i === 0 && 'rounded-tl-2xl',
              i === 1 && 'rounded-tr-2xl',
              i === 2 && 'rounded-bl-2xl',
              i === 3 && 'rounded-br-2xl',
            )}
            aspectClass="aspect-square"
            showSlotLabel={showSlotLabels}
          />
        ))}
      </div>
    );
  }

  // 5 items: 3 top (narrower, taller) + 2 bottom (wider, shorter)
  // Uses 6-column grid for clean proportions
  if (count === 5) {
    return (
      <div
        className={cn(
          'overflow-hidden grid grid-cols-6 bg-muted/30',
          rounded,
          gap,
          className,
        )}
      >
        {items.slice(0, 3).map((item, i) => (
          <MosaicCell
            key={item.id}
            item={item}
            onClick={onItemClick ? () => onItemClick(item.id) : undefined}
            className={cn(
              'col-span-2',
              i === 0 && 'rounded-tl-2xl',
              i === 2 && 'rounded-tr-2xl',
            )}
            aspectClass="aspect-[3/4]"
            showSlotLabel={showSlotLabels}
          />
        ))}
        {items.slice(3, 5).map((item, i) => (
          <MosaicCell
            key={item.id}
            item={item}
            onClick={onItemClick ? () => onItemClick(item.id) : undefined}
            className={cn(
              'col-span-3',
              i === 0 && 'rounded-bl-2xl',
              i === 1 && 'rounded-br-2xl',
            )}
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
        'overflow-hidden grid grid-cols-3 bg-muted/30',
        rounded,
        gap,
        className,
      )}
    >
      {items.slice(0, 6).map((item, i) => (
        <MosaicCell
          key={item.id}
          item={item}
          onClick={onItemClick ? () => onItemClick(item.id) : undefined}
          className={cn(
            i === 0 && 'rounded-tl-2xl',
            i === 2 && 'rounded-tr-2xl',
            i === 3 && 'rounded-bl-2xl',
            i === 5 && 'rounded-br-2xl',
          )}
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
        'relative overflow-hidden bg-muted/20',
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
        fallbackIcon={<Shirt className="w-6 h-6 text-muted-foreground/20" />}
      />
      {showSlotLabel && item.slot && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent p-2 pt-6">
          <p className="text-[9px] text-white/70 uppercase tracking-[0.15em] font-medium">
            {item.slot}
          </p>
        </div>
      )}
    </div>
  );
}
