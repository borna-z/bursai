import { motion } from 'framer-motion';
import { ArrowUpRight, RefreshCw } from 'lucide-react';

import type { InsightsDashboardViewModel } from '@/components/insights/useInsightsDashboardAdapter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
      className="surface-editorial rounded-[1.75rem] px-5 py-5 sm:px-6 sm:py-6"
      data-testid="insights-hero"
    >
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-[34rem] space-y-2">
            <p className="label-editorial text-muted-foreground/62">{hero.eyebrow}</p>
            <h2 className="max-w-[28rem] text-[1.55rem] font-semibold leading-[1.02] tracking-[-0.06em] text-foreground sm:text-[1.78rem]">
              {hero.title}
            </h2>
            <p className="max-w-[34rem] text-[0.92rem] leading-6 text-muted-foreground">
              {hero.summary}
            </p>
          </div>

          <Button variant="outline" size="sm" className="rounded-full px-4" onClick={onOpenWardrobe}>
            Wardrobe
            <ArrowUpRight className="size-4" />
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.7fr)] lg:items-end">
          <div className="rounded-[1.4rem] border border-border/60 bg-background/62 px-4 py-4 sm:px-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/72">
                  Wardrobe score
                </p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-[3.25rem] font-semibold leading-none tracking-[-0.09em] text-foreground">
                    {hero.score}
                  </span>
                  <span className="pb-2 text-[0.76rem] uppercase tracking-[0.18em] text-muted-foreground/60">
                    /100
                  </span>
                </div>
              </div>

              <div className="pb-1 text-right">
                <p className="text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground/62">
                  Freshness
                </p>
                <p className="mt-1 text-[0.86rem] text-foreground/78">
                  {generatedAtLabel ? `Updated ${generatedAtLabel}` : 'Latest snapshot'}
                </p>
                <p className={cn(
                  'mt-1 inline-flex items-center gap-1 text-[0.76rem] text-muted-foreground/62',
                  isRefreshing && 'text-foreground/70',
                )}>
                  <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
                  {isRefreshing ? 'Refreshing' : 'Stable'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            {hero.metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-[1.2rem] border border-border/50 bg-background/58 px-4 py-4"
              >
                <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
                  {metric.label}
                </p>
                <p className="mt-3 text-[1.28rem] font-semibold tracking-[-0.05em] text-foreground">
                  {metric.value}
                </p>
                <p className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
                  {metric.hint}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
