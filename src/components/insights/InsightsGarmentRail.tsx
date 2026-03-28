import { ArrowUpRight, Shirt } from 'lucide-react';

import { LazyImageSimple } from '@/components/ui/lazy-image';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

interface GarmentRailItem {
  id: string;
  title: string;
  category?: string | null;
  color_primary?: string | null;
  image_path?: string | null;
}

interface InsightsGarmentRailProps<TGarment extends GarmentRailItem> {
  title: string;
  subtitle: string;
  garments: TGarment[];
  actionLabel?: string;
  onAction?: () => void;
  onSelectGarment: (garmentId: string) => void;
  renderMeta?: (garment: TGarment) => string | null;
}

export function InsightsGarmentRail<TGarment extends GarmentRailItem>({
  title,
  subtitle,
  garments,
  actionLabel,
  onAction,
  onSelectGarment,
  renderMeta,
}: InsightsGarmentRailProps<TGarment>) {
  if (garments.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="space-y-1">
          <h3 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground">
            {title}
          </h3>
          <p className="text-[0.84rem] leading-5 text-muted-foreground">{subtitle}</p>
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="flex shrink-0 items-center gap-1 text-[0.8rem] font-medium text-foreground/75 transition-colors hover:text-foreground"
          >
            {actionLabel}
            <ArrowUpRight className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="scrollbar-hide -mx-4 overflow-x-auto px-4">
        <div className="flex snap-x snap-mandatory gap-3 pb-1 pr-1">
          {garments.map((garment) => {
            const meta = renderMeta?.(garment) || garment.category || garment.color_primary || null;

            return (
              <button
                key={garment.id}
                type="button"
                onClick={() => onSelectGarment(garment.id)}
                className="press surface-interactive flex w-[144px] shrink-0 snap-start flex-col gap-2.5 p-2.5 text-left sm:w-[116px] sm:gap-3 sm:p-3"
              >
                <LazyImageSimple
                  imagePath={getPreferredGarmentImagePath(garment)}
                  alt={garment.title}
                  className="h-36 w-full rounded-[1rem] sm:h-32"
                  fallbackIcon={<Shirt className="size-5 text-muted-foreground/45" />}
                />
                <div className="space-y-1">
                  <p className="line-clamp-2 text-[0.88rem] font-medium leading-5 text-foreground">
                    {garment.title}
                  </p>
                  {meta ? (
                    <p className="text-[0.76rem] leading-5 text-muted-foreground">{meta}</p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
