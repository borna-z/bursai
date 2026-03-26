import type { OutfitWithItems } from '@/hooks/useOutfits';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { cn } from '@/lib/utils';
import { BursMonogram } from './BursMonogram';
import { LazyImageSimple } from './lazy-image';

type OutfitCompositionItem = OutfitWithItems['outfit_items'][number];

interface OutfitCompositionProps {
  items?: OutfitCompositionItem[] | null;
  compact?: boolean;
  className?: string;
  monogramSize?: number;
}

export function OutfitComposition({
  items,
  compact = false,
  className,
  monogramSize,
}: OutfitCompositionProps) {
  const slots = items?.slice(0, 4) ?? [];
  const emptyMonogramSize = monogramSize ?? (compact ? 10 : 18);

  return (
    <div className={cn('grid aspect-square grid-cols-2 grid-rows-2 gap-[0.5px] bg-background', className)}>
      {Array.from({ length: 4 }, (_, index) => {
        const item = slots[index];

        if (item?.garment) {
          return (
            <div key={item.id} className="aspect-square overflow-hidden bg-background">
              <LazyImageSimple
                imagePath={getPreferredGarmentImagePath(item.garment)}
                alt={item.garment.title || item.slot}
                className="h-full w-full object-cover"
              />
            </div>
          );
        }

        return (
          <div key={item?.id ?? `empty-${index}`} className="flex aspect-square items-center justify-center bg-background">
            <BursMonogram size={emptyMonogramSize} className="opacity-10" />
          </div>
        );
      })}
    </div>
  );
}
