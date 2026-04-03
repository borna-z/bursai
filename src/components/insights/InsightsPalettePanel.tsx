import type { InsightsDashboardViewModel } from '@/components/insights/useInsightsDashboardAdapter';
import { InsightsSection } from '@/components/insights/InsightsSection';
import { InsightsUpgradeNote } from '@/components/insights/InsightsUpgradeNote';

function ratio(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(Math.min((count / total) * 100, 100), 4);
}

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
      title="Color balance"
      description={palette.summary}
    >
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.88fr)]" data-testid="palette-section">
        <div className="space-y-5">
          <div className="space-y-3 border-y border-border/24 py-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground/58">
                  Dominant palette
                </p>
                <h3 className="mt-2 text-[1.08rem] font-medium tracking-[-0.04em] text-foreground">
                  {palette.dominantLabel}
                </h3>
              </div>
              <p className="text-[0.78rem] text-muted-foreground/68">
                {palette.totalCount} garments
              </p>
            </div>

            <div className="overflow-hidden rounded-full bg-secondary/75">
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
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground/58">
                Warm / cool / neutral
              </p>
              <p className="text-[0.78rem] text-muted-foreground/68">
                Actual garment counts
              </p>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Warm', value: palette.warmCount, barClassName: 'bg-accent' },
                { label: 'Cool', value: palette.coolCount, barClassName: 'bg-foreground/46' },
                { label: 'Neutral', value: palette.neutralCount, barClassName: 'bg-foreground/24' },
              ].map((item) => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[0.88rem] text-foreground">{item.label}</span>
                    <span className="text-[0.78rem] text-muted-foreground/68">{item.value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary/75">
                    <div
                      className={`h-full rounded-full ${item.barClassName}`}
                      style={{ width: `${ratio(item.value, palette.totalCount || 1)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground/58">
                Top colors
              </p>
              <p className="text-[0.78rem] text-muted-foreground/68">
                Ranked by share
              </p>
            </div>

            <div className="space-y-3">
              {palette.entries.map((entry) => (
                <div key={entry.color} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="size-3 rounded-full border border-black/5"
                        style={{ backgroundColor: entry.swatch }}
                        aria-hidden="true"
                      />
                      <span className="text-[0.9rem] text-foreground">{entry.label}</span>
                    </div>
                    <span className="text-[0.78rem] text-muted-foreground/68">
                      {entry.percentage}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary/75">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(entry.percentage, 6)}%`, backgroundColor: entry.swatch }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {palette.locked ? (
            <InsightsUpgradeNote
              title={upgrade.title}
              detail="Premium opens deeper palette breakdowns and richer cross-signals."
              cta={upgrade.cta}
              onOpenPricing={onOpenPricing}
            />
          ) : null}
        </div>
      </div>
    </InsightsSection>
  );
}
