import { motion } from 'framer-motion';
import {
  ArrowRight,
  Dot,
  Sparkles,
} from 'lucide-react';

import type { HomeCommandContext } from '@/components/home/homeTypes';
import { Button } from '@/components/ui/button';
import { OutfitComposition } from '@/components/ui/OutfitComposition';
import { cn } from '@/lib/utils';

interface HomeCommandBoardProps extends HomeCommandContext {
  primaryLabel?: string;
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
      return 'Forecast';
    default:
      return 'Next';
  }
}

function getWorkspaceTitle(state: HomeCommandContext['state'], coachNudge?: boolean) {
  switch (state) {
    case 'empty_wardrobe':
      return coachNudge ? 'Start with three pieces' : 'Build your first look';
    case 'outfit_planned':
      return 'Today is ready';
    case 'weather_alert':
      return 'Forecast changed';
    default:
      return 'Choose the next look';
  }
}

function getWorkspaceSummary(
  state: HomeCommandContext['state'],
  coachNudge?: boolean,
  weatherSummary?: string | null,
) {
  switch (state) {
    case 'empty_wardrobe':
      return coachNudge
        ? 'Top, bottom, and shoes unlock styling.'
        : 'Three core pieces are enough to start.';
    case 'outfit_planned':
      return 'Open the saved look or make one more option.';
    case 'weather_alert':
      return weatherSummary ? `${weatherSummary} needs a lighter reset.` : 'Rerun styling against the live forecast.';
    default:
      return 'Use a recent look or build a new one.';
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
  const summary = getWorkspaceSummary(state, coachNudge, weatherSummary);
  const visibleRecentOutfits = recentOutfits.slice(0, 3);
  const secondaryMeta = garmentCount != null
    ? `${garmentCount} piece${garmentCount === 1 ? '' : 's'} ready`
    : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      data-testid={`home-command-board-${state}`}
      className="surface-hero relative overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(255,255,255,0.24),transparent)]"
      />

      <div className="relative space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground/58">
              Workspace
            </p>
            <h2 className="max-w-[15ch] font-['Playfair_Display'] italic text-[1.32rem] tracking-[-0.05em] text-foreground">
              {title}
            </h2>
            <p className="max-w-[32ch] text-[0.84rem] leading-5 text-muted-foreground">
              {summary}
            </p>
            {secondaryMeta ? (
              <p className="text-[0.78rem] text-muted-foreground/72">
                {secondaryMeta}
              </p>
            ) : null}
          </div>

          <div className="eyebrow-chip self-start bg-background/72 text-muted-foreground/72">
            <Dot className="size-4" />
            {getStatusLabel(state)}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            onClick={onPrimaryAction}
            className="h-12 justify-between px-5 text-[0.94rem]"
          >
            {primaryLabel ?? 'Style me'}
            <Sparkles className="size-4" />
          </Button>

          <Button
            variant="outline"
            onClick={onSecondaryAction}
            className="h-11 justify-between px-4"
          >
            {secondaryLabel}
            <ArrowRight className="size-4" />
          </Button>
        </div>

        {state === 'outfit_planned' && todayOutfit ? (
          <div
            data-testid="home-command-board-visual-planned"
            className="surface-utility p-3"
          >
            <div className="grid items-start gap-3 sm:grid-cols-[108px_minmax(0,1fr)]">
              <OutfitComposition
                items={todayOutfit.outfit_items}
                compact
                className="w-[104px] overflow-hidden rounded-[1.1rem] border border-foreground/[0.08] bg-background"
              />

              <div className="space-y-2">
                <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/68">
                  Planned look
                </p>
                <p className="text-[0.94rem] font-medium tracking-[-0.02em] text-foreground">
                  Open it, wear it, or restyle once.
                </p>
                <p className="text-[0.82rem] leading-5 text-muted-foreground">
                  {truncate(todayOutfit.explanation || 'Open the outfit for notes and final adjustments.', 88)}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {state === 'empty_wardrobe' ? (
          <div
            data-testid="home-command-board-visual-empty"
            className="surface-utility space-y-3 p-3"
          >
            <div className="grid grid-cols-3 gap-2">
              {REQUIRED_SLOTS.map((slot) => (
                <div
                  key={slot}
                  className="rounded-[1.1rem] border border-dashed border-foreground/[0.12] bg-background/45 px-3 py-3"
                >
                  <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground/68">
                    Core
                  </p>
                  <p className="mt-2 text-[0.88rem] font-medium text-foreground">{slot}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/68">
                <span>Starter set</span>
                <span>{Math.min(garmentCount ?? 0, 3)}/3</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
                <div
                  className="h-full rounded-full bg-foreground/72"
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {state !== 'outfit_planned' && state !== 'empty_wardrobe' ? (
          <div data-testid="home-command-board-visual-recent" className="space-y-2.5 border-t border-border/20 pt-3 mt-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/68">
                {state === 'weather_alert' ? 'Rebuild around weather' : 'Recent looks'}
              </p>
              {scheduleSummary ? (
                <p className="truncate text-[0.78rem] text-muted-foreground/72">
                  {scheduleSummary}
                </p>
              ) : null}
            </div>

            <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
              {Array.from({ length: 3 }, (_, index) => {
                const outfit = visibleRecentOutfits[index];

                return (
                  <div
                    key={outfit?.id ?? `recent-look-${index}`}
                    className={cn(
                      'min-w-[112px] overflow-hidden rounded-[1.1rem] border border-foreground/[0.08] bg-background/76',
                      !outfit && 'flex min-h-[116px] items-center justify-center px-3',
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
    </motion.section>
  );
}
