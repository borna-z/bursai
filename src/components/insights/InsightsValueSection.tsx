import { InsightsSection } from '@/components/insights/InsightsSection';
import { InsightsUpgradeNote } from '@/components/insights/InsightsUpgradeNote';
import type { InsightsDashboardViewModel } from '@/components/insights/useInsightsDashboardAdapter';
import { LazyImageSimple } from '@/components/ui/lazy-image';

function widthFor(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(Math.min((value / max) * 100, 100), 6);
}

function CostPerWearRow({
  label,
  item,
  maxValue,
  onOpenGarment,
}: {
  label: string;
  item: InsightsDashboardViewModel['value']['bestCostPerWear'];
  maxValue: number;
  onOpenGarment: (id: string) => void;
}) {
  if (!item) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[0.9rem] text-foreground">{label}</span>
          <span className="text-[0.8rem] text-muted-foreground/70">Unavailable</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary/80" />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="w-full space-y-2 text-left"
      onClick={() => onOpenGarment(item.id)}
    >
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 overflow-hidden rounded-[0.9rem] bg-secondary/75">
          <LazyImageSimple imagePath={item.imagePath} alt={item.title} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[0.9rem] text-foreground">{label}</span>
            <span className="text-[0.8rem] text-muted-foreground/70">{item.cpwLabel}</span>
          </div>
          <p className="truncate text-[0.82rem] text-muted-foreground/72">
            {item.title} / {item.detail}
          </p>
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-secondary/80">
        <div
          className="h-full rounded-full bg-foreground/68"
          style={{ width: `${widthFor(item.cpwValue, maxValue)}%` }}
        />
      </div>
    </button>
  );
}

export function InsightsValueSection({
  value,
  upgrade,
  onOpenGarment,
  onOpenPricing,
}: {
  value: InsightsDashboardViewModel['value'];
  upgrade: InsightsDashboardViewModel['upgrade'];
  onOpenGarment: (id: string) => void;
  onOpenPricing: () => void;
}) {
  const cpwMax = Math.max(
    value.bestCostPerWear?.cpwValue ?? 0,
    value.worstCostPerWear?.cpwValue ?? 0,
    1,
  );

  return (
    <InsightsSection
      id="value"
      eyebrow="Value"
      title="Cost and utilization"
    >
      <div className="grid gap-7 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" data-testid="value-section">
        <div className="space-y-5">
          <div className="space-y-1">
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/58">
              Total wardrobe value
            </p>
            <h3 className="text-[2.2rem] font-semibold tracking-[-0.1em] text-foreground">
              {value.totalValue}
            </h3>
          </div>

          {value.hasSpendData ? (
            <>
              <div className="space-y-3 rounded-[1.2rem] bg-background/55 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/58">
                      Average cost per wear
                    </p>
                    <p className="mt-2 text-[1.05rem] font-medium tracking-[-0.04em] text-foreground">
                      {value.avgCostPerWear}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/54">
                      Sustainability
                    </p>
                    <p className="mt-2 text-[0.96rem] text-foreground/82">
                      {value.sustainabilityScore != null ? `${value.sustainabilityScore}/100` : 'Need wear data'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[0.8rem] text-muted-foreground/72">Utilization</span>
                      <span className="text-[0.8rem] text-muted-foreground/72">{value.utilizationLabel}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary/80">
                      <div
                        className="h-full rounded-full bg-foreground/70"
                        style={{ width: `${widthFor(value.utilizationRate ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[0.8rem] text-muted-foreground/72">Efficiency</span>
                      <span className="text-[0.8rem] text-muted-foreground/72">{value.efficiencyLabel}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary/80">
                      <div
                        className="h-full rounded-full bg-foreground/48"
                        style={{ width: `${widthFor((value.avgWearCount ?? 0) * 10, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <CostPerWearRow label="Best CPW" item={value.bestCostPerWear} maxValue={cpwMax} onOpenGarment={onOpenGarment} />
                <CostPerWearRow label="Worst CPW" item={value.worstCostPerWear} maxValue={cpwMax} onOpenGarment={onOpenGarment} />
              </div>
            </>
          ) : (
            <div className="rounded-[1.2rem] bg-background/55 px-4 py-4">
              <p className="text-[0.86rem] leading-6 text-muted-foreground">
                No price history yet. Add purchase values to unlock cost-per-wear and utilization comparisons.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-5">
          {value.locked ? (
            <InsightsUpgradeNote
              title={upgrade.title}
              detail="Premium reveals deeper cost-per-wear comparisons and richer value context."
              cta={upgrade.cta}
              onOpenPricing={onOpenPricing}
            />
          ) : null}
        </div>
      </div>
    </InsightsSection>
  );
}
