import type { ReactNode } from 'react';
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
}

export function OutfitPreviewCard({
  items,
  meta,
  excerpt,
  footer,
  className,
  compositionClassName,
}: OutfitPreviewCardProps) {
  return (
    <div className={cn('overflow-hidden bg-card', className)}>
      <OutfitComposition items={items} className={cn('w-full', compositionClassName)} />
      {(meta || excerpt || footer) && (
        <div className="space-y-1 px-3 pb-3 pt-2.5">
          {meta}
          {excerpt && (
            <p className="font-['Playfair_Display'] italic text-[13px] leading-snug text-foreground/70 line-clamp-1">
              {excerpt}
            </p>
          )}
          {footer}
        </div>
      )}
    </div>
  );
}
