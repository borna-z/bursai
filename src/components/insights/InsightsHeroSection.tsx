import { motion } from 'framer-motion';
import { ArrowUpRight, RefreshCw } from 'lucide-react';

import type { InsightsDashboardViewModel, InsightsMetricRail } from '@/components/insights/useInsightsDashboardAdapter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function railWidth(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(Math.min((value / max) * 100, 100), 4);
}

function MetricRail({
  rail,
  accent,
}: {
  rail: InsightsMetricRail;
  accent?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground/58">
        <span>{rail.label}</span>
        <span>{rail.value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary/75">
        <div
          className={cn(
            'h-full rounded-full',
            accent ? 'bg-accent' : 'bg-foreground/32',
          )}
          style={{ width: `${railWidth(rail.value, rail.max)}%` }}
        />
      </div>
    </div>
  );
}

export function InsightsHeroSection({
  hero,
  generatedAtLabel,
  isRefreshing,
  onOpenWardrobe,
}: Pick<InsightsDashboardViewModel, 'hero' | 'generatedAtLabel' | 'isRefreshing'> & {
  onOpenWardrobe: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-5 border-b border-border/26 pb-6"
      data-testid="insights-hero"
    >
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-[34rem] space-y-2">
            <div className="flex items-center gap-3">
              <p className="label-editorial text-foreground/56">{hero.eyebrow}</p>
              <p className={cn(
                'inline-flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground/55',
                isRefreshing && 'text-foreground/68',
              )}>
                <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
                {generatedAtLabel ? `Updated ${generatedAtLabel}` : 'Latest snapshot'}
              </p>
            </div>

            <h2 className="max-w-[24rem] text-[1.34rem] font-semibold leading-[1.02] tracking-[-0.05em] text-foreground sm:text-[1.48rem]">
              {hero.title}
            </h2>

            <p className="max-w-[28rem] text-[0.84rem] leading-5 text-muted-foreground/76">
              {hero.summary}
            </p>
          </div>

          <Button variant="outline" size="sm" className="rounded-full border-border/35 bg-background/20 px-4 text-foreground/82 hover:bg-secondary/45" onClick={onOpenWardrobe}>
            Wardrobe
            <ArrowUpRight className="size-4" />
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:items-start">
          <div className="space-y-3 border-b border-border/24 pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
            <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground/56">
              Wardrobe score
            </p>
            <div className="flex items-end gap-2">
              <span className="text-[3.65rem] font-semibold leading-none tracking-[-0.11em] text-foreground sm:text-[4rem]">
                {hero.score}
              </span>
              <span className="pb-2 text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground/46">
                /100
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {hero.metrics.map((metric, index) => (
              <div key={metric.label} className="space-y-2.5">
                <div className="space-y-1">
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground/56">
                      {metric.label}
                    </p>
                    <p className="text-[0.98rem] font-medium tracking-[-0.04em] text-foreground">
                      {metric.value}
                    </p>
                  </div>
                  <p className="text-[0.76rem] leading-5 text-muted-foreground/68">
                    {metric.hint}
                  </p>
                </div>

                <div className="space-y-2.5" data-testid={`hero-metric-${metric.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                  {(metric.rails ?? []).map((rail, railIndex) => (
                    <MetricRail
                      key={`${metric.label}-${rail.label}`}
                      rail={rail}
                      accent={index === 0 || railIndex === 0}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
