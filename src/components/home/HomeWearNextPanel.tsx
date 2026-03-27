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
  const companion = unusedGarments[1] ?? null;

  return (
    <section
      data-testid="home-wear-next"
      className="rounded-[1.6rem] border border-foreground/[0.08] bg-card p-5 shadow-[0_14px_28px_rgba(22,18,15,0.04)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-editorial text-muted-foreground/60">
            {sleepingBeautiesCount >= 3 ? 'Sleeping beauties' : 'Wear next'}
          </p>
          <h2 className="mt-1 text-[1.25rem] font-semibold tracking-[-0.03em] text-foreground">
            Bring a dormant piece back
          </h2>
        </div>
        <p className="text-[0.74rem] uppercase tracking-[0.18em] text-muted-foreground/60">
          {unusedGarments.length} waiting
        </p>
      </div>

      <div className="mt-4 grid gap-4 rounded-[1.2rem] bg-secondary/45 p-4 sm:grid-cols-[136px_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
          <LazyImageSimple
            imagePath={getPreferredGarmentImagePath(spotlight)}
            alt={spotlight.title || spotlight.category || 'Garment'}
            className="aspect-[4/5] rounded-[1rem] bg-background"
          />
          {companion ? (
            <LazyImageSimple
              imagePath={getPreferredGarmentImagePath(companion)}
              alt={companion.title || companion.category || 'Garment'}
              className="aspect-[4/5] rounded-[1rem] bg-background opacity-80"
            />
          ) : null}
        </div>

        <div className="flex flex-col justify-between gap-4">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
              Spotlight
            </p>
            <h3 className="mt-2 text-[1.05rem] font-semibold tracking-[-0.025em] text-foreground">
              {spotlight.title || `${spotlight.color_primary || ''} ${spotlight.category || 'Garment'}`.trim()}
            </h3>
            <p className="mt-2 text-[0.94rem] leading-6 text-foreground">
              Style around one neglected favorite, or open the full unworn rotation and rescue more.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => onStyleAroundGem(spotlight.id)}
              className="rounded-full px-4"
            >
              <Sparkles className="size-4" />
              Style this
            </Button>
            <Button onClick={onOpenUnused} variant="outline" className="rounded-full px-4">
              See all unworn
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
