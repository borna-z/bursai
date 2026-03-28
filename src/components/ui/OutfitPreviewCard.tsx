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
        'overflow-hidden rounded-[28px] border border-border/15 bg-card/80 shadow-[0_18px_40px_rgba(28,25,23,0.04)]',
        className,
      )}
    >
      <div className={cn('overflow-hidden border-b border-border/10 bg-background/80', mediaClassName)}>
        <OutfitComposition
          items={items}
          className={cn('w-full bg-background/80', compositionClassName)}
        />
      </div>
      {(meta || excerpt || footer) && (
        <div className={cn('space-y-2.5 px-4 pb-4 pt-3.5', contentClassName)}>
          {meta}
          {excerpt && (
            <p className="font-['Playfair_Display'] italic text-[13px] leading-snug text-foreground/70 line-clamp-2">
              {excerpt}
            </p>
          )}
          {footer}
        </div>
      )}
    </div>
  );
});
