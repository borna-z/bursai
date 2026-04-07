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
      <div className="flex items-center justify-between gap-3 text-[0.73rem] uppercase tracking-[0.16em] text-muted-foreground/62">
        <span>{rail.label}</span>
        <span>{rail.value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={cn(
            'h-full rounded-full',
            accent ? 'bg-white/82' : 'bg-white/52',
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
      className="surface-editorial rounded-[1.9rem] px-5 py-5 sm:px-6 sm:py-6"
      data-testid="insights-hero"
    >
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-[34rem] space-y-2.5">
            <div className="flex items-center gap-3">
              <p className="label-editorial text-white/58">{hero.eyebrow}</p>
              <p className={cn(
                'inline-flex items-center gap-1.5 text-[0.73rem] uppercase tracking-[0.16em] text-white/48',
                isRefreshing && 'text-white/62',
              )}>
                <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
                {generatedAtLabel ? `Updated ${generatedAtLabel}` : 'Latest snapshot'}
              </p>
            </div>

            <h2 className="max-w-[28rem] text-[1.72rem] font-semibold leading-[0.98] tracking-[-0.07em] text-white sm:text-[1.96rem]">
              {hero.title}
            </h2>

            <p className="max-w-[32rem] text-[0.92rem] leading-6 text-white/68">
              {hero.summary}
            </p>
          </div>

          <Button variant="outline" size="sm" className="rounded-full border-white/20 bg-white/[0.03] px-4 text-white hover:bg-white/[0.06]" onClick={onOpenWardrobe}>
            Wardrobe
            <ArrowUpRight className="size-4" />
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-end">
          <div className="space-y-3 border-b border-white/10 pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
            <p className="text-[0.73rem] uppercase tracking-[0.18em] text-white/50">
              Wardrobe score
            </p>
            <div className="flex items-end gap-2">
              <span className="text-[4rem] font-semibold leading-none tracking-[-0.11em] text-white sm:text-[4.4rem]">
                {hero.score}
              </span>
              <span className="pb-2 text-[0.74rem] uppercase tracking-[0.18em] text-white/40">
                /100
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {hero.metrics.map((metric, index) => (
              <div key={metric.label} className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-[0.73rem] uppercase tracking-[0.18em] text-white/50">
                      {metric.label}
                    </p>
                    <p className="text-[1.02rem] font-medium tracking-[-0.04em] text-white">
                      {metric.value}
                    </p>
                  </div>
                  <p className="text-[0.8rem] leading-5 text-white/52">
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
