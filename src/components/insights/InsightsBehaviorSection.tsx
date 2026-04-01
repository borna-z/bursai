import { CalendarClock, Flame, Repeat2 } from 'lucide-react';

import { InsightsSection } from '@/components/insights/InsightsSection';
import { InsightsUpgradeNote } from '@/components/insights/InsightsUpgradeNote';
import type { InsightsDashboardViewModel } from '@/components/insights/useInsightsDashboardAdapter';
import { cn } from '@/lib/utils';

const HEATMAP_COLOR: Record<string, string> = {
  planned: 'bg-emerald-400/85',
  improvised: 'bg-foreground/72',
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

export function InsightsBehaviorSection({
  behavior,
  upgrade,
  onOpenPricing,
}: {
  behavior: InsightsDashboardViewModel['behavior'];
  upgrade: InsightsDashboardViewModel['upgrade'];
  onOpenPricing: () => void;
}) {
  return (
    <InsightsSection
      id="behavior"
      eyebrow="Behavior"
      title="How consistently the wardrobe gets used over time."
      description="This is where BURS should show rhythm, not just output. Repeats, streaks, and stale looks all point to what needs attention next."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="surface-secondary rounded-[1.6rem] p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: 'Streak',
                value: String(behavior.streak),
                hint: 'Consecutive days with a logged outfit',
                icon: Flame,
              },
              {
                label: 'Consistency',
                value: `${behavior.consistency}%`,
                hint: 'Days with an outfit in the last 90 days',
                icon: CalendarClock,
              },
              {
                label: 'Cadence',
                value: behavior.cadenceLabel,
                hint: 'Current wear rhythm',
                icon: Repeat2,
              },
            ].map((item) => (
              <div key={item.label} className="rounded-[1.1rem] bg-background/62 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
                    {item.label}
                  </p>
                  <item.icon className="size-4 text-muted-foreground/60" />
                </div>
                <p className="mt-3 text-[1.2rem] font-semibold tracking-[-0.05em] text-foreground">
                  {item.value}
                </p>
                <p className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
                  {item.hint}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[1.2rem] bg-background/62 p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
                Wear heatmap
              </p>
              <div className="flex items-center gap-3 text-[0.76rem] text-muted-foreground/72">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-400/85" />
                  Planned
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-foreground/72" />
                  Logged
                </span>
              </div>
            </div>

            <div className="mt-4">
              <Heatmap days={behavior.heatmapDays} />
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="surface-secondary rounded-[1.6rem] p-5 sm:p-6">
            <div className="space-y-5">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
                  Outfit repeats
                </p>
                <div className="mt-3 space-y-3">
                  {behavior.repeats.length > 0 ? behavior.repeats.map((repeat) => (
                    <div key={repeat.id} className="flex items-center justify-between gap-4 border-b border-border/28 pb-3 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-[0.9rem] text-foreground">
                          {repeat.occasion}
                        </p>
                        <p className="text-[0.8rem] text-muted-foreground">
                          {repeat.daysSince} days since last wear
                        </p>
                      </div>
                      <span className="text-[0.8rem] text-foreground/76">
                        {repeat.wornCount}x
                      </span>
                    </div>
                  )) : (
                    <p className="text-[0.88rem] leading-6 text-muted-foreground">
                      Repeat behavior will surface once saved looks are worn more than once.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/64">
                  Stale outfits
                </p>
                <div className="mt-3 space-y-3">
                  {behavior.staleOutfits.length > 0 ? behavior.staleOutfits.map((outfit) => (
                    <div key={outfit.id} className="flex items-center justify-between gap-4 border-b border-border/28 pb-3 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-[0.9rem] text-foreground">
                          {outfit.occasion}
                        </p>
                        <p className="text-[0.8rem] text-muted-foreground">
                          Saved but untouched
                        </p>
                      </div>
                      <span className="text-[0.8rem] text-foreground/76">
                        {outfit.daysSince}d
                      </span>
                    </div>
                  )) : (
                    <p className="text-[0.88rem] leading-6 text-muted-foreground">
                      No stale looks detected right now.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {behavior.locked ? (
            <InsightsUpgradeNote
              title={upgrade.title}
              detail="Premium opens deeper repeat tracking and stale-look diagnostics so you can see exactly where wardrobe behavior is drifting."
              cta={upgrade.cta}
              onOpenPricing={onOpenPricing}
            />
          ) : null}
        </div>
      </div>
    </InsightsSection>
  );
}
