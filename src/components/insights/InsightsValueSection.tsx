import { ArrowUpRight, Coins, Leaf } from 'lucide-react';

import { InsightsSection } from '@/components/insights/InsightsSection';
import { InsightsUpgradeNote } from '@/components/insights/InsightsUpgradeNote';
import type { InsightsDashboardViewModel } from '@/components/insights/useInsightsDashboardAdapter';
import { LazyImageSimple } from '@/components/ui/lazy-image';

function CostPerWearSpotlight({
  label,
  item,
  onOpenGarment,
}: {
  label: string;
  item: InsightsDashboardViewModel['value']['bestCostPerWear'];
  onOpenGarment: (id: string) => void;
}) {
  if (!item) {
    return (
      <div className="rounded-[1.2rem] bg-background/62 p-4">
        <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
          {label}
        </p>
        <p className="mt-3 text-[0.88rem] leading-6 text-muted-foreground">
          Cost-per-wear needs both price history and repeat use before it can say anything honest.
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="rounded-[1.2rem] bg-background/62 p-4 text-left"
      onClick={() => onOpenGarment(item.id)}
    >
      <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
        {label}
      </p>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-14 w-14 overflow-hidden rounded-[0.95rem] bg-secondary/75">
          <LazyImageSimple imagePath={item.imagePath} alt={item.title} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.92rem] font-medium text-foreground">
            {item.title}
          </p>
          <p className="text-[0.8rem] text-muted-foreground">
            {item.detail}
          </p>
          <p className="text-[0.8rem] text-muted-foreground/76">
            {item.meta}
          </p>
        </div>
        <span className="text-[0.86rem] font-medium text-foreground/82">
          {item.cpwLabel}
        </span>
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
  return (
    <InsightsSection
      id="value"
      eyebrow="Value"
      title="The return your wardrobe is generating from what you already own."
      description="Price only matters when it meets real use. This section turns wardrobe value into something operational and visible."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="surface-secondary rounded-[1.6rem] p-5 sm:p-6" data-testid="value-section">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label: 'Total wardrobe value',
                value: value.totalValue,
                hint: 'Recorded purchase value',
                icon: Coins,
              },
              {
                label: 'Average cost per wear',
                value: value.avgCostPerWear,
                hint: 'Across priced garments with wear history',
                icon: ArrowUpRight,
              },
              {
                label: 'Sustainability score',
                value: value.sustainabilityScore != null ? `${value.sustainabilityScore}/100` : 'Need more wear data',
                hint: value.utilizationLabel,
                icon: Leaf,
              },
              {
                label: 'Utilization efficiency',
                value: value.efficiencyLabel,
                hint: 'Average wears per garment',
                icon: Coins,
              },
            ].map((item) => (
              <div key={item.label} className="rounded-[1.1rem] bg-background/62 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
                    {item.label}
                  </p>
                  <item.icon className="size-4 text-muted-foreground/60" />
                </div>
                <p className="mt-3 text-[1.06rem] font-semibold tracking-[-0.04em] text-foreground">
                  {item.value}
                </p>
                <p className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
                  {item.hint}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <CostPerWearSpotlight label="Best CPW" item={value.bestCostPerWear} onOpenGarment={onOpenGarment} />
          <CostPerWearSpotlight label="Needs more wears" item={value.worstCostPerWear} onOpenGarment={onOpenGarment} />

          {value.locked ? (
            <InsightsUpgradeNote
              title={upgrade.title}
              detail="Premium keeps the useful summary visible here, then unlocks deeper cost-per-wear diagnostics and broader comparison context."
              cta={upgrade.cta}
              onOpenPricing={onOpenPricing}
            />
          ) : null}
        </div>
      </div>
    </InsightsSection>
  );
}
