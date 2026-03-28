import { memo, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import type { OutfitWithItems } from '@/hooks/useOutfits';
import { cn } from '@/lib/utils';
import { OutfitComposition } from './OutfitComposition';

const previewCardVariants = cva(
  'group overflow-hidden transition-[transform,border-color,box-shadow] duration-300',
  {
    variants: {
      surface: {
        default: 'surface-editorial rounded-[2rem]',
        utility: 'surface-utility rounded-[1.5rem]',
  plain: 'rounded-[1.5rem] border border-border/60 bg-card/80',
      },
      tone: {
        default: '',
        premium: 'border-premium/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(232,220,202,0.82))]',
        accent: 'border-accent/15 bg-accent/5',
      },
      density: {
        compact: '',
        comfortable: '',
        airy: '',
      },
      mediaLayout: {
        portrait: '',
        square: '',
      },
      ctaPlacement: {
        stacked: '',
        inline: '',
      },
    },
    defaultVariants: {
      surface: 'default',
      tone: 'default',
      density: 'comfortable',
      mediaLayout: 'portrait',
      ctaPlacement: 'stacked',
    },
  },
);

const mediaVariants = cva('surface-media', {
  variants: {
    mediaLayout: {
      portrait: '',
      square: 'rounded-[1.25rem]',
    },
  },
  defaultVariants: {
    mediaLayout: 'portrait',
  },
});

const contentVariants = cva('px-4 pb-4 pt-4', {
  variants: {
    density: {
      compact: 'space-y-2.5 px-3.5 pb-3.5 pt-3.5',
      comfortable: 'space-y-3',
      airy: 'space-y-3.5 px-4.5 pb-4.5 pt-4.5',
    },
    ctaPlacement: {
      stacked: '',
      inline: '[&>*:last-child]:flex [&>*:last-child]:items-center [&>*:last-child]:justify-between',
    },
  },
  defaultVariants: {
    density: 'comfortable',
    ctaPlacement: 'stacked',
  },
});

interface OutfitPreviewCardProps {
  items?: OutfitWithItems['outfit_items'] | null;
  meta?: ReactNode;
  excerpt?: string | null;
  footer?: ReactNode;
  className?: string;
  compositionClassName?: string;
  contentClassName?: string;
  mediaClassName?: string;
  surface?: VariantProps<typeof previewCardVariants>['surface'];
  tone?: VariantProps<typeof previewCardVariants>['tone'];
  density?: VariantProps<typeof previewCardVariants>['density'];
  mediaLayout?: VariantProps<typeof previewCardVariants>['mediaLayout'];
  ctaPlacement?: VariantProps<typeof previewCardVariants>['ctaPlacement'];
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
  surface,
  tone,
  density,
  mediaLayout,
  ctaPlacement,
}: OutfitPreviewCardProps) {
  return (
    <div
      className={cn(
        previewCardVariants({ surface, tone, density, mediaLayout, ctaPlacement }),
        className,
      )}
    >
      <div className="p-2.5 pb-0">
        <div
          className={cn(
            mediaVariants({ mediaLayout }),
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
        <div className={cn(contentVariants({ density, ctaPlacement }), contentClassName)}>
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
