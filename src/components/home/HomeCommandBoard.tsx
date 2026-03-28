import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarRange,
  CloudSun,
  Dot,
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
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function getStatusLabel(state: HomeCommandContext['state']) {
  switch (state) {
    case 'empty_wardrobe':
      return 'Set up';
    case 'outfit_planned':
      return 'Ready';
    case 'weather_alert':
      return 'Forecast';
    default:
      return 'Open';
  }
}

function getWorkspaceTitle(state: HomeCommandContext['state'], coachNudge?: boolean) {
  switch (state) {
    case 'empty_wardrobe':
      return coachNudge ? 'Start with three anchors' : 'Build the first complete look';
    case 'outfit_planned':
      return 'Today is covered';
    case 'weather_alert':
      return 'Forecast changed the plan';
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
      return 'Open the saved look or make a second option.';
    case 'weather_alert':
      return 'Rerun styling against the live forecast.';
    default:
      return 'Use recent looks or one tap styling to get moving.';
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
  const visibleRecentOutfits = recentOutfits.slice(0, 3);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      data-testid={`home-command-board-${state}`}
      className="surface-editorial relative overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_right,rgba(82,99,179,0.12),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.32),transparent)]"
      />

      <div className="relative space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground/58">
              Next move
            </p>
            <h2 className="max-w-[15ch] text-[1.38rem] font-semibold tracking-[-0.05em] text-foreground">
              {title}
            </h2>
            <p className="max-w-[34ch] text-[0.84rem] leading-5 text-muted-foreground">
              {summary}
            </p>
          </div>

          <div className="eyebrow-chip self-start bg-background/80 text-muted-foreground/75">
            <Dot className="size-4" />
            {getStatusLabel(state)}
          </div>
        </div>

        <div className="surface-utility p-3.5">
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex min-w-fit items-center gap-2 rounded-full border border-foreground/[0.08] bg-background/72 px-3 py-1.5 text-[0.8rem] text-foreground/80">
              <Shirt className="size-3.5 text-muted-foreground/70" />
              {(garmentCount ?? 0)} pieces
            </div>
            {weatherSummary ? (
              <div className="inline-flex min-w-fit items-center gap-2 rounded-full border border-foreground/[0.08] bg-background/72 px-3 py-1.5 text-[0.8rem] text-foreground/80">
                <CloudSun className="size-3.5 text-muted-foreground/70" />
                {weatherSummary}
              </div>
            ) : null}
            {scheduleSummary ? (
              <div className="inline-flex min-w-fit items-center gap-2 rounded-full border border-foreground/[0.08] bg-background/72 px-3 py-1.5 text-[0.8rem] text-foreground/80">
                <CalendarRange className="size-3.5 text-muted-foreground/70" />
                {scheduleSummary}
              </div>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button
              onClick={onPrimaryAction}
              variant="editorial"
              className="h-12 justify-between px-5 text-[0.96rem]"
            >
              Style Me
              <Sparkles className="size-4" />
            </Button>

            <Button
              variant="quiet"
              onClick={onSecondaryAction}
              className="h-12 justify-between px-4"
            >
              {secondaryLabel}
              <ArrowRight className="size-4" />
            </Button>
          </div>

          <div className="mt-3">
            {state === 'outfit_planned' && todayOutfit ? (
              <div
                data-testid="home-command-board-visual-planned"
                className="surface-media p-3"
              >
                <div className="grid items-start gap-3 sm:grid-cols-[112px_minmax(0,1fr)]">
                  <OutfitComposition
                    items={todayOutfit.outfit_items}
                    compact
                    className="w-[108px] overflow-hidden rounded-[1rem] border border-foreground/[0.08] bg-background"
                  />

                  <div className="space-y-2">
                    <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
                      Planned look
                    </p>
                    <p className="text-[0.96rem] font-medium tracking-[-0.02em] text-foreground">
                      Complete and ready.
                    </p>
                    <p className="text-[0.82rem] leading-5 text-muted-foreground">
                      {truncate(todayOutfit.explanation || 'Open the outfit for notes and final adjustments.', 92)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {state === 'empty_wardrobe' ? (
              <div
                data-testid="home-command-board-visual-empty"
                className="surface-media space-y-3 p-3"
              >
                <div className="grid grid-cols-3 gap-2">
                  {REQUIRED_SLOTS.map((slot) => (
                    <div
                      key={slot}
                      className="rounded-[1rem] border border-dashed border-foreground/[0.12] bg-background/45 px-3 py-3"
                    >
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground/70">
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
                <div className="surface-media p-3">
                  <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
                    {state === 'weather_alert' ? 'Rebuild around weather' : 'Recent looks'}
                  </p>
                  <p className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
                    {state === 'weather_alert'
                      ? 'Use one of your recent bases, then rerun styling with the live forecast.'
                      : 'Reuse a recent winner or build something new.'}
                  </p>
                </div>

                <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
                  {Array.from({ length: 3 }, (_, index) => {
                    const outfit = visibleRecentOutfits[index];

                    return (
                      <div
                        key={outfit?.id ?? `recent-look-${index}`}
                        className={cn(
                          'min-w-[104px] overflow-hidden rounded-[1rem] border border-foreground/[0.08] bg-background/76',
                          !outfit && 'flex min-h-[120px] items-center justify-center px-3',
                        )}
                      >
                        {outfit ? (
                          <OutfitComposition
                            items={outfit.outfit_items}
                            compact
                            className="overflow-hidden bg-background"
                          />
                        ) : (
                            <span className="text-center text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground/60">
                            Open slot
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="surface-media mt-3 px-3.5 py-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/70">
                  Workspace
                </p>
                <p className="mt-1 text-[1.55rem] font-semibold tracking-[-0.04em] text-foreground">
                  {garmentCount ?? 0}
                </p>
              </div>
              <p className="max-w-[12rem] text-right text-[0.78rem] leading-5 text-muted-foreground">
                {state === 'empty_wardrobe'
                  ? 'Three pieces unlock styling.'
                  : 'Ready for styling, planning, and gaps.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
