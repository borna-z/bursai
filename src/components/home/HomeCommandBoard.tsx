import { motion } from 'framer-motion';
import { ArrowRight, CalendarRange, CloudSun, Shirt, Sparkles } from 'lucide-react';

import type { HomeCommandContext } from '@/components/home/homeTypes';
import { Button } from '@/components/ui/button';
import { OutfitComposition } from '@/components/ui/OutfitComposition';
import { cn } from '@/lib/utils';

interface HomeCommandBoardProps extends HomeCommandContext {
  primaryLabel: string;
  secondaryLabel: string;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
}

const REQUIRED_SLOTS = ['Top', 'Bottom', 'Shoes'] as const;

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function getStatusLabel(state: HomeCommandContext['state']) {
  switch (state) {
    case 'empty_wardrobe':
      return 'Setup';
    case 'outfit_planned':
      return 'Ready';
    case 'weather_alert':
      return 'Update';
    default:
      return 'Today';
  }
}

function getWorkspaceTitle(state: HomeCommandContext['state'], coachNudge?: boolean) {
  switch (state) {
    case 'empty_wardrobe':
      return coachNudge ? 'Start with three anchors' : 'Build your starter wardrobe';
    case 'outfit_planned':
      return "Today's look is ready";
    case 'weather_alert':
      return 'Weather changed the plan';
    default:
      return 'Style one clear look';
  }
}

function getWorkspaceSummary(state: HomeCommandContext['state'], coachNudge?: boolean) {
  switch (state) {
    case 'empty_wardrobe':
      return coachNudge
        ? 'A top, a bottom, and shoes are enough to unlock your first complete outfit.'
        : 'Add three core pieces and BURS can start styling around what you own.';
    case 'outfit_planned':
      return 'Review the saved look or restyle once if the brief has shifted.';
    case 'weather_alert':
      return 'Use the current forecast once and rebuild the outfit around what still works.';
    default:
      return 'Pick one route: style today now, or open the plan if you already know the day.';
  }
}

function getProgressWidth(garmentCount?: number) {
  if (!garmentCount) return 0;
  return Math.min((garmentCount / 3) * 100, 100);
}

export function HomeCommandBoard({
  state,
  garmentCount,
  todayOutfit,
  recentOutfits,
  weatherSummary,
  scheduleSummary,
  coachNudge = false,
  primaryLabel,
  secondaryLabel,
  onPrimaryAction,
  onSecondaryAction,
}: HomeCommandBoardProps) {
  const progressWidth = getProgressWidth(garmentCount);
  const title = getWorkspaceTitle(state, coachNudge);
  const summary = getWorkspaceSummary(state, coachNudge);
  const visibleRecentOutfits = recentOutfits.slice(0, 2);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      data-testid={`home-command-board-${state}`}
      className="surface-editorial relative overflow-hidden rounded-[1.8rem]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_right,rgba(82,99,179,0.09),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.24),transparent)]"
      />

      <div className="relative space-y-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground/58">
              Today
            </p>
            <h2 className="max-w-[16ch] text-[1.42rem] font-semibold tracking-[-0.045em] text-foreground">
              {title}
            </h2>
            <p className="max-w-[34ch] text-[0.88rem] leading-6 text-muted-foreground">
              {summary}
            </p>
          </div>

          <div className="eyebrow-chip self-start bg-background/80 text-muted-foreground/75">
            {getStatusLabel(state)}
          </div>
        </div>

        <div className="app-chip-row">
          <div className="inline-flex items-center gap-2 rounded-full border border-foreground/[0.08] bg-background/72 px-3 py-1.5 text-[0.8rem] text-foreground/80">
            <Shirt className="size-3.5 text-muted-foreground/70" />
            {(garmentCount ?? 0)} pieces
          </div>
          {weatherSummary ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-foreground/[0.08] bg-background/72 px-3 py-1.5 text-[0.8rem] text-foreground/80">
              <CloudSun className="size-3.5 text-muted-foreground/70" />
              {weatherSummary}
            </div>
          ) : null}
          {scheduleSummary ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-foreground/[0.08] bg-background/72 px-3 py-1.5 text-[0.8rem] text-foreground/80">
              <CalendarRange className="size-3.5 text-muted-foreground/70" />
              {scheduleSummary}
            </div>
          ) : null}
        </div>

        <div className="app-card-grid">
          <Button
            onClick={onPrimaryAction}
            variant="editorial"
            className="h-12 justify-between px-5 text-[0.96rem]"
          >
            {primaryLabel}
            <Sparkles className="size-4" />
          </Button>

          <Button
            variant="quiet"
            onClick={onSecondaryAction}
            className="h-12 justify-between rounded-full border border-border/55 bg-background/70 px-4 text-foreground hover:bg-background"
          >
            {secondaryLabel}
            <ArrowRight className="size-4" />
          </Button>
        </div>

        {state === 'outfit_planned' && todayOutfit ? (
          <div
            data-testid="home-command-board-visual-planned"
            className="surface-media p-4"
          >
            <div className="grid items-start gap-4 sm:grid-cols-[118px_minmax(0,1fr)]">
              <OutfitComposition
                items={todayOutfit.outfit_items}
                compact
                className="w-[112px] overflow-hidden rounded-[1rem] border border-foreground/[0.08] bg-background"
              />

              <div className="space-y-2">
                <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
                  Planned today
                </p>
                <p className="text-[0.98rem] font-medium tracking-[-0.02em] text-foreground">
                  Complete, saved, and ready to wear.
                </p>
                <p className="text-[0.84rem] leading-6 text-muted-foreground">
                  {truncate(todayOutfit.explanation || 'Open the outfit for final notes and small adjustments.', 104)}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {state === 'empty_wardrobe' ? (
          <div
            data-testid="home-command-board-visual-empty"
            className="surface-media space-y-4 p-4"
          >
            <div className="grid grid-cols-3 gap-2">
              {REQUIRED_SLOTS.map((slot) => (
                <div
                  key={slot}
                  className="rounded-[1rem] border border-dashed border-foreground/[0.12] bg-background/45 px-3 py-3"
                >
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground/70">
                    Core
                  </p>
                  <p className="mt-2 text-[0.9rem] font-medium text-foreground">{slot}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
                <span>Starter set</span>
                <span>{Math.min(garmentCount ?? 0, 3)}/3</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
                <div
                  className="h-full rounded-full bg-accent/65"
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {state !== 'outfit_planned' && state !== 'empty_wardrobe' ? (
          <div data-testid="home-command-board-visual-recent" className="space-y-3">
            <div className="surface-media p-4">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
                {state === 'weather_alert' ? 'Forecast' : 'Rotation'}
              </p>
              <p className="mt-1 text-[0.96rem] font-medium tracking-[-0.02em] text-foreground">
                {state === 'weather_alert' ? 'Refresh around the live forecast.' : 'Start from what already works.'}
              </p>
              <p className="mt-1 text-[0.84rem] leading-6 text-muted-foreground">
                {state === 'weather_alert'
                  ? 'Keep one useful base, then rerun styling once against the weather that is actually coming.'
                  : 'Reuse a recent winner or generate one fresh look for today.'}
              </p>
            </div>

            <div className={cn('grid gap-3', visibleRecentOutfits.length > 0 && 'sm:grid-cols-2')}>
              {visibleRecentOutfits.length > 0 ? (
                visibleRecentOutfits.map((outfit, index) => (
                  <div
                    key={outfit.id ?? `recent-look-${index}`}
                    className="surface-media p-3"
                  >
                    <p className="mb-2 text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground/60">
                      Recent look {index + 1}
                    </p>
                    <OutfitComposition
                      items={outfit.outfit_items}
                      compact
                      className="overflow-hidden rounded-[1rem] bg-background"
                    />
                  </div>
                ))
              ) : (
                <div className="surface-media px-4 py-4 text-[0.84rem] leading-6 text-muted-foreground">
                  No saved looks yet. Style one clear outfit first, then BURS will keep the strongest formulas close.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}
