import { ArrowUpRight } from 'lucide-react';

import { InsightsSection } from '@/components/insights/InsightsSection';
import type { InsightsDashboardViewModel, InsightsSpotlightGarment } from '@/components/insights/useInsightsDashboardAdapter';
import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';

function widthFor(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(Math.min((value / max) * 100, 100), 6);
}

function SpotlightRail({
  title,
  items,
  onOpenGarment,
}: {
  title: string;
  items: InsightsSpotlightGarment[];
  onOpenGarment: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/58">
          {title}
        </p>
        <p className="text-[0.8rem] text-muted-foreground/70">
          Tap to open
        </p>
      </div>

      <div className="space-y-3">
        {items.length > 0 ? items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="flex w-full items-center gap-3 text-left"
            onClick={() => onOpenGarment(item.id)}
          >
            <div className="h-14 w-14 overflow-hidden rounded-[0.95rem] bg-secondary/75">
              <LazyImageSimple imagePath={item.imagePath} alt={item.title} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground/54">
                {item.eyebrow}
              </p>
              <p className="truncate text-[0.92rem] font-medium text-foreground">
                {item.title}
              </p>
              <p className="truncate text-[0.8rem] text-muted-foreground/72">
                {item.detail}
              </p>
            </div>
            <span className="text-[0.78rem] text-muted-foreground/66">
              {item.meta}
            </span>
          </button>
        )) : (
          <p className="text-[0.86rem] leading-6 text-muted-foreground">
            This list fills in once garment behavior is available.
          </p>
        )}
      </div>
    </div>
  );
}

export function InsightsWardrobeHealthSection({
  health,
  onOpenGarment,
  onOpenGapScan,
}: {
  health: InsightsDashboardViewModel['health'];
  onOpenGarment: (id: string) => void;
  onOpenGapScan: () => void;
}) {
  return (
    <InsightsSection
      id="wardrobe-health"
      eyebrow="Wardrobe health"
      title="Coverage and pressure"
      action={(
        <Button variant="outline" size="sm" className="rounded-full px-4" onClick={onOpenGapScan}>
          Open gaps tool
          <ArrowUpRight className="size-4" />
        </Button>
      )}
    >
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
        <div className="space-y-5">
          <div className="space-y-3 border-y border-border/24 py-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground/58">
                  Used vs dormant
                </p>
                <p className="mt-2 text-[1rem] font-medium tracking-[-0.04em] text-foreground">
                  {health.usedCount} active / {health.unusedCount} dormant
                </p>
              </div>
              <div className="text-right">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground/54">
                  Pressure
                </p>
                <p className="mt-2 text-[0.86rem] text-foreground/82">
                  {health.pressureLabel}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-full bg-secondary/75">
              <div className="flex h-3">
                <div
                  className="bg-accent"
                  style={{ width: `${widthFor(health.usedCount, Math.max(health.totalCount, 1))}%` }}
                />
                <div
                  className="bg-foreground/18"
                  style={{ width: `${widthFor(health.unusedCount, Math.max(health.totalCount, 1))}%` }}
                />
              </div>
            </div>

            <p className="text-[0.82rem] leading-5 text-muted-foreground">
              {health.pressureDetail}
            </p>
          </div>

          <div className="space-y-3" data-testid="category-balance-section">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/58">
                Category balance
              </p>
              <p className="text-[0.8rem] text-muted-foreground/70">
                Share of wardrobe
              </p>
            </div>

            <div className="space-y-3">
              {health.categoryBalance.map((category) => (
                <div key={category.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[0.9rem] text-foreground">
                      {category.label}
                    </span>
                    <span className="text-[0.8rem] text-muted-foreground/70">
                      {category.count} / {category.percentage}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary/80">
                    <div
                      className="h-full rounded-full bg-foreground/68"
                      style={{ width: `${Math.max(category.percentage, 6)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <SpotlightRail title="Top performers" items={health.topPerformers} onOpenGarment={onOpenGarment} />
          <SpotlightRail title="Forgotten gems" items={health.forgottenGems} onOpenGarment={onOpenGarment} />
        </div>
      </div>
    </InsightsSection>
  );
}
