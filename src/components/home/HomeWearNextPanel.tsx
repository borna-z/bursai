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
  if (unusedGarments.length === 0) return null;

  const spotlight = unusedGarments[0];
  const companion = unusedGarments[1] ?? null;

  return (
    <section
      data-testid="home-wear-next"
      className="overflow-hidden rounded-[1.55rem] border border-foreground/[0.08] bg-card shadow-[0_14px_28px_rgba(22,18,15,0.04)]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-foreground/[0.06] px-4 py-4">
        <div className="min-w-0">
          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">
            {sleepingBeautiesCount >= 3 ? 'Sleeping beauties' : 'Wear next'}
          </p>
          <h2 className="mt-1 text-[1.08rem] font-semibold tracking-[-0.03em] text-foreground">
            Bring a quiet piece back
          </h2>
        </div>
        <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/55">
          {unusedGarments.length} waiting
        </p>
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 rounded-[1.1rem] bg-secondary/40 p-3.5">
          <div className="grid grid-cols-2 gap-2">
            <LazyImageSimple
              imagePath={getPreferredGarmentImagePath(spotlight)}
              alt={spotlight.title || spotlight.category || 'Garment'}
              className="aspect-[4/5] rounded-[0.9rem] bg-background"
            />
            {companion ? (
              <LazyImageSimple
                imagePath={getPreferredGarmentImagePath(companion)}
                alt={companion.title || companion.category || 'Garment'}
                className="aspect-[4/5] rounded-[0.9rem] bg-background opacity-80"
              />
            ) : null}
          </div>

          <div className="min-w-0 space-y-2">
            <p className="text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground/70">
              Spotlight
            </p>
            <h3 className="text-[0.98rem] font-semibold tracking-[-0.025em] text-foreground">
              {spotlight.title || `${spotlight.color_primary || ''} ${spotlight.category || 'Garment'}`.trim()}
            </h3>
            <p className="text-[0.82rem] leading-5 text-muted-foreground">
              Style around one neglected favorite or open the full unworn rotation.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => onStyleAroundGem(spotlight.id)}
            className="h-11 justify-between rounded-full px-4"
          >
            Style around it
            <Sparkles className="size-4" />
          </Button>
          <Button onClick={onOpenUnused} variant="outline" className="h-11 justify-between rounded-full px-4">
            See all unworn
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
