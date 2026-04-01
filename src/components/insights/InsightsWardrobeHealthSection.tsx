import { ArrowUpRight } from 'lucide-react';

import { InsightsSection } from '@/components/insights/InsightsSection';
import type { InsightsDashboardViewModel, InsightsSpotlightGarment } from '@/components/insights/useInsightsDashboardAdapter';
import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';

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
    <div className="rounded-[1.2rem] bg-background/62 p-4">
      <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
        {title}
      </p>
      <div className="mt-4 space-y-3">
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
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/62">
                {item.eyebrow}
              </p>
              <p className="truncate text-[0.92rem] font-medium text-foreground">
                {item.title}
              </p>
              <p className="truncate text-[0.8rem] text-muted-foreground">
                {item.detail}
              </p>
            </div>
            <span className="text-[0.78rem] text-muted-foreground/72">
              {item.meta}
            </span>
          </button>
        )) : (
          <p className="text-[0.88rem] leading-6 text-muted-foreground">
            This section will populate once more garment behavior is available.
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
      title="Coverage, pressure points, and what is quietly being ignored."
      description="This is the operational view: what gets worn, what is forgotten, and where category balance starts to limit outfit range."
      action={(
        <Button variant="outline" size="sm" className="rounded-full px-4" onClick={onOpenGapScan}>
          Open gaps tool
          <ArrowUpRight className="size-4" />
        </Button>
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="surface-secondary rounded-[1.6rem] p-5 sm:p-6">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: 'Used recently',
                  value: String(health.usedCount),
                  hint: 'Pieces active in 30d',
                },
                {
                  label: 'Dormant',
                  value: String(health.unusedCount),
                  hint: 'Pieces ready for rotation',
                },
                {
                  label: 'Pressure',
                  value: health.pressureLabel,
                  hint: health.pressureDetail,
                },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.1rem] bg-background/62 p-4">
                  <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
                    {item.label}
                  </p>
                  <p className="mt-3 text-[1.02rem] font-semibold tracking-[-0.04em] text-foreground">
                    {item.value}
                  </p>
                  <p className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
                    {item.hint}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-[1.2rem] bg-background/62 p-4" data-testid="category-balance-section">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
                Category balance
              </p>
              <div className="mt-4 space-y-3">
                {health.categoryBalance.map((category) => (
                  <div key={category.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[0.9rem] text-foreground">
                        {category.label}
                      </span>
                      <span className="text-[0.8rem] text-muted-foreground/72">
                        {category.count} · {category.percentage}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary/80">
                      <div
                        className="h-full rounded-full bg-foreground/72"
                        style={{ width: `${Math.max(category.percentage, 6)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <SpotlightRail title="Top performers" items={health.topPerformers} onOpenGarment={onOpenGarment} />
          <SpotlightRail title="Forgotten gems" items={health.forgottenGems} onOpenGarment={onOpenGarment} />
        </div>
      </div>
    </InsightsSection>
  );
}
