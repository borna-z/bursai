import { Flame } from 'lucide-react';

import { InsightsSection } from '@/components/insights/InsightsSection';
import { InsightsUpgradeNote } from '@/components/insights/InsightsUpgradeNote';
import type { InsightsDashboardViewModel } from '@/components/insights/useInsightsDashboardAdapter';
import { cn } from '@/lib/utils';

const HEATMAP_COLOR: Record<string, string> = {
  planned: 'bg-accent',
  improvised: 'bg-foreground/46',
  none: 'bg-secondary/80',
};

function Heatmap({ days }: { days: InsightsDashboardViewModel['behavior']['heatmapDays'] }) {
  const weeks: typeof days[] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return (
    <div className="space-y-1.5" data-testid="behavior-heatmap">
      {weeks.map((week, index) => (
        <div key={`week-${index}`} className="grid grid-cols-7 gap-1">
          {week.map((day) => (
            <div
              key={day.date}
              title={`${day.date}: ${day.status}`}
              className={cn('aspect-square rounded-[4px]', HEATMAP_COLOR[day.status])}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function barWidth(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(Math.min((value / max) * 100, 100), 6);
}

export function InsightsBehaviorSection({
  behavior,
  upgrade,
  onOpenPricing,
}: {
  behavior: InsightsDashboardViewModel['behavior'];
  upgrade: InsightsDashboardViewModel['upgrade'];
  onOpenPricing: () => void;
}) {
  const repeatMax = Math.max(...behavior.repeats.map((repeat) => repeat.wornCount), 1);
  const staleMax = Math.max(...behavior.staleOutfits.map((outfit) => outfit.daysSince), 1);

  return (
    <InsightsSection
      id="behavior"
      eyebrow="Behavior"
      title="Usage rhythm"
    >
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-end gap-5">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground/58">
                  Streak
                </p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-[2rem] font-semibold tracking-[-0.08em] text-foreground">
                    {behavior.streak}
                  </span>
                  <Flame className="mb-1 size-4 text-muted-foreground/54" />
                </div>
              </div>
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground/58">
                  Consistency
                </p>
                <p className="mt-2 text-[2rem] font-semibold tracking-[-0.08em] text-foreground">
                  {behavior.consistency}%
                </p>
              </div>
            </div>

            <p className="text-[0.78rem] text-muted-foreground/68">
              Last 90 days
            </p>
          </div>

          <div className="border-y border-border/24 py-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground/58">
                Wear heatmap
              </p>
              <div className="flex items-center gap-3 text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground/54">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-accent" />
                  Planned
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-foreground/46" />
                  Logged
                </span>
              </div>
            </div>

            <Heatmap days={behavior.heatmapDays} />
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/58">
                Outfit repeats
              </p>
              <p className="text-[0.8rem] text-muted-foreground/70">
                By wear count
              </p>
            </div>

            <div className="space-y-3">
              {behavior.repeats.length > 0 ? behavior.repeats.map((repeat) => (
                <div key={repeat.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-[0.9rem] text-foreground">
                        {repeat.occasion}
                      </p>
                      <p className="text-[0.8rem] text-muted-foreground/70">
                        {repeat.daysSince} days since last wear
                      </p>
                    </div>
                    <span className="text-[0.78rem] text-muted-foreground/68">
                      {repeat.wornCount}x
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary/75">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${barWidth(repeat.wornCount, repeatMax)}%` }}
                    />
                  </div>
                </div>
              )) : (
                <p className="text-[0.86rem] leading-6 text-muted-foreground">
                  Repeat bars appear once saved looks are worn more than once.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/58">
                Stale outfits
              </p>
              <p className="text-[0.8rem] text-muted-foreground/70">
                By days untouched
              </p>
            </div>

            <div className="space-y-3">
              {behavior.staleOutfits.length > 0 ? behavior.staleOutfits.map((outfit) => (
                <div key={outfit.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[0.9rem] text-foreground">
                      {outfit.occasion}
                    </span>
                    <span className="text-[0.78rem] text-muted-foreground/68">
                      {outfit.daysSince}d
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary/75">
                    <div
                      className="h-full rounded-full bg-foreground/36"
                      style={{ width: `${barWidth(outfit.daysSince, staleMax)}%` }}
                    />
                  </div>
                </div>
              )) : (
                <p className="text-[0.86rem] leading-6 text-muted-foreground">
                  No stale saved outfits right now.
                </p>
              )}
            </div>
          </div>

          {behavior.locked ? (
            <InsightsUpgradeNote
              title={upgrade.title}
              detail="Premium opens deeper repeat and stale-look diagnostics."
              cta={upgrade.cta}
              onOpenPricing={onOpenPricing}
            />
          ) : null}
        </div>
      </div>
    </InsightsSection>
  );
}
