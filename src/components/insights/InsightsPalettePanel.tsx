import type { InsightsDashboardViewModel } from '@/components/insights/useInsightsDashboardAdapter';
import { InsightsSection } from '@/components/insights/InsightsSection';
import { InsightsUpgradeNote } from '@/components/insights/InsightsUpgradeNote';

export function InsightsPalettePanel({
  palette,
  upgrade,
  onOpenPricing,
}: {
  palette: InsightsDashboardViewModel['palette'];
  upgrade: InsightsDashboardViewModel['upgrade'];
  onOpenPricing: () => void;
}) {
  return (
    <InsightsSection
      id="palette"
      eyebrow="Palette"
      title="Color temperature and palette pressure at a glance."
      description="The goal is not to count colors for the sake of it, but to show whether your wardrobe is coherent, narrow, or ready for contrast."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]">
        <div className="surface-secondary rounded-[1.6rem] p-5 sm:p-6" data-testid="palette-section">
          <div className="space-y-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="label-editorial text-muted-foreground/62">Dominant palette</p>
                <h3 className="mt-1 text-[1.2rem] font-semibold tracking-[-0.05em] text-foreground">
                  {palette.dominantLabel}
                </h3>
              </div>
              <p className="max-w-[15rem] text-right text-[0.84rem] leading-5 text-muted-foreground">
                {palette.summary}
              </p>
            </div>

            <div className="overflow-hidden rounded-full bg-secondary/70">
              <div className="flex h-4">
                {palette.bars.map((entry) => (
                  <div
                    key={entry.color}
                    title={`${entry.label} ${entry.percentage}%`}
                    style={{ width: `${Math.max(entry.percentage, 8)}%`, backgroundColor: entry.swatch }}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              {[
                { label: 'Warm', value: palette.warmCount },
                { label: 'Cool', value: palette.coolCount },
                { label: 'Neutral', value: palette.neutralCount },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.1rem] bg-background/62 px-4 py-4 text-center">
                  <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
                    {item.label}
                  </p>
                  <p className="mt-2 text-[1.22rem] font-semibold tracking-[-0.05em] text-foreground">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="surface-secondary rounded-[1.6rem] p-5 sm:p-6">
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
              Top colors
            </p>
            <div className="mt-4 space-y-3">
              {palette.entries.map((entry) => (
                <div key={entry.color} className="flex items-center justify-between gap-4 border-b border-border/28 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <span
                      className="size-3 rounded-full border border-black/5"
                      style={{ backgroundColor: entry.swatch }}
                      aria-hidden="true"
                    />
                    <span className="text-[0.9rem] text-foreground">{entry.label}</span>
                  </div>
                  <span className="text-[0.82rem] text-muted-foreground/72">
                    {entry.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {palette.locked ? (
            <InsightsUpgradeNote
              title={upgrade.title}
              detail="Premium reveals deeper palette breakdowns and richer cross-signals between palette, repeats, and value."
              cta={upgrade.cta}
              onOpenPricing={onOpenPricing}
            />
          ) : null}
        </div>
      </div>
    </InsightsSection>
  );
}
