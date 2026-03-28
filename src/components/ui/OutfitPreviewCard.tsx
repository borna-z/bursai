import { memo, type ReactNode } from 'react';
import type { OutfitWithItems } from '@/hooks/useOutfits';
import { cn } from '@/lib/utils';
import { OutfitComposition } from './OutfitComposition';

interface OutfitPreviewCardProps {
  items?: OutfitWithItems['outfit_items'] | null;
  meta?: ReactNode;
  excerpt?: string | null;
  footer?: ReactNode;
  className?: string;
  compositionClassName?: string;
  contentClassName?: string;
  mediaClassName?: string;
}

export const OutfitPreviewCard = memo(function OutfitPreviewCard({
  items,
  meta,
  excerpt,
  footer,
  className,
  compositionClassName,
  contentClassName,
  mediaClassName,
}: OutfitPreviewCardProps) {
  return (
    <div
      className={cn(
        'group overflow-hidden rounded-[30px] border border-border/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,240,230,0.96))] shadow-[0_18px_44px_rgba(28,25,23,0.05)]',
        className,
      )}
    >
      <div className="p-2.5 pb-0">
        <div
          className={cn(
            'overflow-hidden rounded-[24px] border border-border/10 bg-background/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]',
            mediaClassName,
          )}
        >
        <OutfitComposition
          items={items}
          className={cn('w-full bg-background/80 transition-transform duration-300 group-hover:scale-[1.01]', compositionClassName)}
        />
        </div>
      </div>
      {(meta || excerpt || footer) && (
        <div className={cn('space-y-3 px-4 pb-4 pt-4', contentClassName)}>
          {meta}
          {excerpt && (
            <p className="text-[12.5px] leading-relaxed text-foreground/64 line-clamp-2">
              {excerpt}
            </p>
          )}
          {footer}
        </div>
      )}
    </div>
  );
});
