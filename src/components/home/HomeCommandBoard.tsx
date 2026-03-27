import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarRange,
  CloudSun,
  Layers3,
  Shirt,
  Sparkles,
} from 'lucide-react';
import type { HomeCommandContext } from '@/components/home/homeTypes';
import { Button } from '@/components/ui/button';
import { OutfitComposition } from '@/components/ui/OutfitComposition';
import { cn } from '@/lib/utils';

interface HomeCommandBoardProps extends HomeCommandContext {
  secondaryLabel: string;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
}

const REQUIRED_SLOTS = ['Top', 'Bottom', 'Shoes'] as const;

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function getStatusLabel(state: HomeCommandContext['state']) {
  switch (state) {
    case 'empty_wardrobe':
      return 'Start';
    case 'outfit_planned':
      return 'Ready';
    case 'weather_alert':
      return 'Weather';
    default:
      return 'Open';
  }
}

function getWorkspaceTitle(state: HomeCommandContext['state'], coachNudge?: boolean) {
  switch (state) {
    case 'empty_wardrobe':
      return coachNudge ? 'Start with three anchors' : 'Build your first styling set';
    case 'outfit_planned':
      return "Today's look is already set";
    case 'weather_alert':
      return 'Weather changed the brief';
    default:
      return 'No look is saved yet';
  }
}

function getWorkspaceSummary(state: HomeCommandContext['state'], coachNudge?: boolean) {
  switch (state) {
    case 'empty_wardrobe':
      return coachNudge
        ? 'Top, bottom, and shoes unlock the first complete outfit.'
        : 'Three core pieces are enough to turn styling on.';
    case 'outfit_planned':
      return 'Review the saved look or spin up another option.';
    case 'weather_alert':
      return 'Refresh the outfit once against the live forecast.';
    default:
      return 'Use recent looks, today’s context, or one tap styling to get moving.';
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
  secondaryLabel,
  onPrimaryAction,
  onSecondaryAction,
}: HomeCommandBoardProps) {
  const progressWidth = getProgressWidth(garmentCount);
  const title = getWorkspaceTitle(state, coachNudge);
  const summary = getWorkspaceSummary(state, coachNudge);
  const recentLookCount = recentOutfits.slice(0, 3).length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      data-testid={`home-command-board-${state}`}
      className="relative overflow-hidden rounded-[1.9rem] border border-foreground/[0.08] bg-card/95 shadow-[0_18px_40px_rgba(22,18,15,0.06)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_right,rgba(82,99,179,0.16),transparent_46%),linear-gradient(180deg,rgba(255,255,255,0.32),transparent)]"
      />

      <div className="relative space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="label-editorial text-muted-foreground/60">Today</p>
            <h2 className="max-w-[16ch] text-[1.55rem] font-semibold tracking-[-0.045em] text-foreground sm:text-[1.75rem]">
              {title}
            </h2>
            <p className="max-w-[40ch] text-[0.93rem] leading-6 text-muted-foreground">
              {summary}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-full border border-foreground/[0.08] bg-background/65 px-3 py-1.5 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-muted-foreground/75">
            <Layers3 className="size-3.5" />
            {getStatusLabel(state)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-foreground/[0.08] bg-background/70 px-3 py-1.5 text-[0.82rem] text-foreground/80">
            <Shirt className="size-3.5 text-muted-foreground/70" />
            {(garmentCount ?? 0)} pieces
          </div>
          {weatherSummary ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-foreground/[0.08] bg-background/70 px-3 py-1.5 text-[0.82rem] text-foreground/80">
              <CloudSun className="size-3.5 text-muted-foreground/70" />
              {weatherSummary}
            </div>
          ) : null}
          {scheduleSummary ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-foreground/[0.08] bg-background/70 px-3 py-1.5 text-[0.82rem] text-foreground/80">
              <CalendarRange className="size-3.5 text-muted-foreground/70" />
              {scheduleSummary}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_228px]">
          <div className="rounded-[1.45rem] border border-foreground/[0.07] bg-secondary/55 p-4">
            {state === 'outfit_planned' && todayOutfit ? (
              <div
                data-testid="home-command-board-visual-planned"
                className="grid items-start gap-4 sm:grid-cols-[120px_minmax(0,1fr)]"
              >
                <OutfitComposition
                  items={todayOutfit.outfit_items}
                  compact
                  className="w-[116px] overflow-hidden rounded-[1.1rem] border border-foreground/[0.08] bg-background"
                />

                <div className="space-y-2">
                  <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
                    Saved outfit
                  </p>
                  <p className="text-[1rem] font-medium tracking-[-0.02em] text-foreground">
                    Complete, saved, and ready to wear.
                  </p>
                  <p className="text-[0.9rem] leading-6 text-muted-foreground">
                    {truncate(todayOutfit.explanation || 'Open the look for details, notes, and any final swap.', 104)}
                  </p>
                </div>
              </div>
            ) : null}

            {state === 'empty_wardrobe' ? (
              <div data-testid="home-command-board-visual-empty" className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {REQUIRED_SLOTS.map((slot) => (
                    <div
                      key={slot}
                      className="rounded-[1.1rem] border border-dashed border-foreground/[0.12] bg-background/45 px-4 py-4"
                    >
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground/70">
                        Required
                      </p>
                      <p className="mt-2 text-[0.98rem] font-medium text-foreground">{slot}</p>
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
              <div
                data-testid="home-command-board-visual-recent"
                className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]"
              >
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }, (_, index) => {
                    const outfit = recentOutfits[index];

                    return (
                      <div
                        key={outfit?.id ?? `recent-look-${index}`}
                        className={cn(
                          'overflow-hidden rounded-[1rem] border border-foreground/[0.08] bg-background/65',
                          !outfit && 'flex min-h-[108px] items-center justify-center'
                        )}
                      >
                        {outfit ? (
                          <OutfitComposition
                            items={outfit.outfit_items}
                            compact
                            className="overflow-hidden bg-background"
                          />
                        ) : (
                          <span className="px-3 text-center text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground/60">
                            Open slot
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col justify-between rounded-[1rem] border border-foreground/[0.08] bg-background/55 p-4">
                  <div>
                    <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
                      {state === 'weather_alert' ? 'Forecast' : 'Rotation'}
                    </p>
                    <p className="mt-2 text-[0.98rem] font-medium tracking-[-0.02em] text-foreground">
                      {state === 'weather_alert' ? 'Rebuild with live weather.' : 'Start from recent winners.'}
                    </p>
                  </div>
                  <p className="mt-3 text-[0.88rem] leading-6 text-muted-foreground">
                    {recentLookCount > 0
                      ? 'Use a recent base and refine once.'
                      : 'No saved looks yet. Generate a clean first option.'}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2.5">
            <Button
              onClick={onPrimaryAction}
              className="h-12 justify-between rounded-full px-5 text-[0.96rem] font-medium"
            >
              Style Me
              <Sparkles className="size-4" />
            </Button>

            <Button
              variant="outline"
              onClick={onSecondaryAction}
              className="h-11 justify-between rounded-full px-4"
            >
              {secondaryLabel}
              <ArrowRight className="size-4" />
            </Button>

            <div className="rounded-[1.2rem] border border-foreground/[0.08] bg-background/72 p-4">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
                Workspace
              </p>
              <p className="mt-2 text-[1.55rem] font-semibold tracking-[-0.04em] text-foreground">
                {(garmentCount ?? 0)}
              </p>
              <p className="mt-1 text-[0.88rem] leading-6 text-muted-foreground">
                {state === 'empty_wardrobe'
                  ? 'Three pieces unlock full styling.'
                  : 'Ready across styling, planning, and discover.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
