import { ArrowRight, Sparkles } from 'lucide-react';
import type { Garment } from '@/hooks/useGarments';
import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

interface HomeWearNextPanelProps {
  unusedGarments: Garment[];
  sleepingBeautiesCount: number;
  onOpenUnused: () => void;
  onStyleAroundGem: (garmentId: string) => void;
}

export function HomeWearNextPanel({
  unusedGarments,
  sleepingBeautiesCount,
  onOpenUnused,
  onStyleAroundGem,
}: HomeWearNextPanelProps) {
  if (unusedGarments.length === 0) {
    return null;
  }

  const spotlight = unusedGarments[0];
  const title = sleepingBeautiesCount >= 3 ? 'Sleeping beauties' : 'Wear next';

  return (
    <section
      data-testid="home-wear-next"
      className="rounded-[1.75rem] border border-foreground/[0.08] bg-card p-5 shadow-[0_14px_30px_rgba(22,18,15,0.05)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-editorial text-muted-foreground/60">{title}</p>
          <h2 className="mt-1 text-[1.3rem] font-semibold tracking-[-0.03em] text-foreground">
            Bring dormant pieces back into play
          </h2>
        </div>
        <p className="text-right text-[0.82rem] uppercase tracking-[0.18em] text-muted-foreground/70">
          {unusedGarments.length} waiting
        </p>
      </div>

      <div className="mt-5 grid gap-4 rounded-[1.35rem] bg-secondary/45 p-4 sm:grid-cols-[112px_minmax(0,1fr)]">
        <LazyImageSimple
          imagePath={getPreferredGarmentImagePath(spotlight)}
          alt={spotlight.title || spotlight.category || 'Garment'}
          className="aspect-[4/5] rounded-[1rem] bg-background"
        />
        <div className="flex flex-col justify-between gap-4">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
              Spotlight piece
            </p>
            <h3 className="mt-2 text-[1.08rem] font-semibold tracking-[-0.025em] text-foreground">
              {spotlight.title || `${spotlight.color_primary || ''} ${spotlight.category || 'Garment'}`.trim()}
            </h3>
            <p className="mt-2 text-[0.96rem] leading-7 text-foreground">
              BURS flagged this as a strong piece to revive. Style around it directly, or review the full unworn rotation and rescue more overlooked items.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onOpenUnused} className="rounded-full px-4">
              Review unworn pieces
              <ArrowRight className="size-4" />
            </Button>
            <Button
              onClick={() => onStyleAroundGem(spotlight.id)}
              variant="outline"
              className="rounded-full px-4"
            >
              <Sparkles className="size-4" />
              Style around this
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
