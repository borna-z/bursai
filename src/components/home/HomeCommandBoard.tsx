import { motion } from 'framer-motion';
import { ArrowRight, CalendarRange, CloudSun, Layers3, Sparkles, Wind } from 'lucide-react';
import bursLogoWhite from '@/assets/burs-logo-white.png';
import type { HomeCommandContext } from '@/components/home/homeTypes';
import { Button } from '@/components/ui/button';
import { OutfitComposition } from '@/components/ui/OutfitComposition';
import { cn } from '@/lib/utils';

interface HomeCommandBoardProps extends HomeCommandContext {
  secondaryLabel: string;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
}

function getBoardHeadline(state: HomeCommandContext['state']) {
  switch (state) {
    case 'empty_wardrobe':
      return 'Blueprint your wardrobe';
    case 'outfit_planned':
      return 'Today is already mapped out';
    case 'weather_alert':
      return 'Weather just changed the brief';
    default:
      return 'Build today from the full birdview';
  }
}

function getBoardSummary(state: HomeCommandContext['state'], stylistLine: string) {
  switch (state) {
    case 'empty_wardrobe':
      return 'You only need a top, a bottom, and shoes to unlock your first AI-styled outfit.';
    case 'outfit_planned':
      return 'Your plan is set. Review the look, then branch into styling, planning, or discovery from here.';
    case 'weather_alert':
      return 'The forecast shifted. Rebuild around the new weather before the day gets moving.';
    default:
      return stylistLine;
  }
}

function getStateLabel(state: HomeCommandContext['state']) {
  switch (state) {
    case 'empty_wardrobe':
      return 'Build Mode';
    case 'outfit_planned':
      return 'Plan Ready';
    case 'weather_alert':
      return 'Weather Alert';
    default:
      return 'Open Brief';
  }
}

function getProgressWidth(garmentCount?: number) {
  if (!garmentCount) return 0;
  return Math.min((garmentCount / 3) * 100, 100);
}

const slotLabels = ['Top', 'Bottom', 'Shoes'] as const;

export function HomeCommandBoard({
  state,
  garmentCount,
  todayOutfit,
  recentOutfits,
  weatherSummary,
  scheduleSummary,
  stylistLine,
  secondaryLabel,
  onPrimaryAction,
  onSecondaryAction,
}: HomeCommandBoardProps) {
  const boardHeadline = getBoardHeadline(state);
  const boardSummary = getBoardSummary(state, stylistLine);
  const progressWidth = getProgressWidth(garmentCount);

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      data-testid={`home-command-board-${state}`}
      className="relative overflow-hidden rounded-[2rem] border border-[#111111]/10 bg-[#171412] text-[#f6f0e8] shadow-[0_24px_60px_rgba(20,17,14,0.18)]"
      style={{
        backgroundImage: `
          linear-gradient(rgba(98,116,190,0.12) 1px, transparent 1px),
          linear-gradient(90deg, rgba(98,116,190,0.12) 1px, transparent 1px),
          radial-gradient(circle at top left, rgba(109,128,214,0.2), transparent 38%),
          linear-gradient(160deg, rgba(255,255,255,0.03), rgba(255,255,255,0))
        `,
        backgroundSize: '34px 34px, 34px 34px, auto, auto',
      }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[2rem] border border-white/5" />
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.3fr)_290px] lg:gap-8">
        <div className="relative space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.32em] text-[#c3c8e8]/72">
                  BURS Command Center
                </p>
                <h2 className="max-w-[15ch] text-[1.95rem] font-semibold leading-[0.96] tracking-[-0.045em] text-[#f6f0e8] sm:text-[2.35rem]">
                  {boardHeadline}
                </h2>
              </div>
              <p className="max-w-[42ch] text-[0.96rem] leading-7 text-[#efe7dd]/74">
                {boardSummary}
              </p>
            </div>
            <img
              src={bursLogoWhite}
              alt="BURS"
              className="mt-0.5 hidden h-10 w-auto object-contain opacity-90 sm:block"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[0.72rem] uppercase tracking-[0.18em] text-[#f2ecdf]/68">
              <Layers3 className="size-3.5" />
              {getStateLabel(state)}
            </div>
            {weatherSummary ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-[#8b98d1]/18 bg-[#8b98d1]/8 px-3 py-1.5 text-[0.8rem] text-[#ebe5d9]/80">
                <CloudSun className="size-3.5" />
                {weatherSummary}
              </div>
            ) : null}
            {scheduleSummary ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[0.8rem] text-[#ebe5d9]/78">
                <CalendarRange className="size-3.5" />
                {scheduleSummary}
              </div>
            ) : null}
          </div>

          {state === 'outfit_planned' && todayOutfit ? (
            <div
              data-testid="home-command-board-visual-planned"
              className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 sm:grid-cols-[140px_minmax(0,1fr)]"
            >
              <OutfitComposition
                items={todayOutfit.outfit_items}
                compact
                className="w-[132px] rounded-[1.2rem] overflow-hidden border border-white/10 bg-[#f7f2ea]"
              />
              <div className="space-y-3">
                <div>
                  <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[#c3c8e8]/72">
                    Saved for today
                  </p>
                  <p className="mt-2 text-[0.98rem] leading-7 text-[#f1ebde]/80">
                    {todayOutfit.explanation || 'This outfit is locked in and ready to wear.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[0.8rem] text-[#d2d7ef]/70">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#8b98d1]/10 px-3 py-1.5">
                    <Sparkles className="size-3.5" />
                    Review fit and notes
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {state === 'empty_wardrobe' ? (
            <div
              data-testid="home-command-board-visual-empty"
              className="rounded-[1.5rem] border border-dashed border-[#8b98d1]/28 bg-white/4 p-4 sm:p-5"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {slotLabels.map((slot) => (
                  <div
                    key={slot}
                    className="rounded-[1.1rem] border border-white/10 bg-[#f7f2ea]/5 px-4 py-5 text-left"
                  >
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-[#bfc6eb]/60">
                      Required
                    </p>
                    <p className="mt-3 text-[1rem] font-medium text-[#f7f1e6]">{slot}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-[0.78rem] uppercase tracking-[0.18em] text-[#d9deef]/62">
                  <span>Starter set</span>
                  <span>{Math.min(garmentCount ?? 0, 3)}/3</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#d6defc]"
                    style={{ width: `${progressWidth}%` }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {state !== 'empty_wardrobe' && state !== 'outfit_planned' ? (
            <div
              data-testid="home-command-board-visual-recent"
              className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 sm:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.2fr)]"
            >
              {Array.from({ length: 3 }, (_, index) => {
                const outfit = recentOutfits[index];

                return (
                  <div
                    key={outfit?.id ?? `recent-placeholder-${index}`}
                    className={cn(
                      'rounded-[1.15rem] border border-white/10 bg-[#f7f2ea]/5 p-2.5',
                      !outfit && 'flex min-h-[120px] items-center justify-center'
                    )}
                  >
                    {outfit ? (
                      <OutfitComposition
                        items={outfit.outfit_items}
                        compact
                        className="overflow-hidden rounded-[0.95rem] border border-white/10 bg-[#f7f2ea]"
                      />
                    ) : (
                      <span className="text-[0.72rem] uppercase tracking-[0.2em] text-[#d9deef]/48">
                        Open slot
                      </span>
                    )}
                  </div>
                );
              })}
              <div className="flex flex-col justify-between rounded-[1.15rem] border border-dashed border-[#8b98d1]/22 bg-white/3 px-4 py-4">
                <div>
                  <p className="text-[0.72rem] uppercase tracking-[0.22em] text-[#bbc2e5]/62">
                    Rotation note
                  </p>
                  <p className="mt-2 text-[1rem] leading-7 text-[#efe7dc]/80">
                    Keep the day sharp by pulling from recent winners, then adjust for weather, mood, and plan.
                  </p>
                </div>
                <div className="mt-4 inline-flex items-center gap-2 text-[0.82rem] text-[#e9e3d8]/70">
                  <Wind className="size-3.5" />
                  Live styling context stays on
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 rounded-[1.6rem] border border-white/10 bg-white/6 p-4 sm:p-5">
          <div className="space-y-2">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[#bcc4e7]/65">
              Primary action
            </p>
            <Button
              onClick={onPrimaryAction}
              className="h-12 w-full justify-between rounded-full bg-[#f7f1e7] px-5 text-[0.96rem] font-medium text-[#171412] hover:bg-[#f3eadc]"
            >
              Style Me
              <Sparkles className="size-4" />
            </Button>
            <Button
              variant="outline"
              onClick={onSecondaryAction}
              className="h-11 w-full justify-between rounded-full border-white/10 bg-white/4 px-4 text-[#f6f0e8] hover:bg-white/10 hover:text-[#f6f0e8]"
            >
              {secondaryLabel}
              <ArrowRight className="size-4" />
            </Button>
          </div>

          <div className="rounded-[1.2rem] border border-white/10 bg-[#f7f2ea]/6 p-4">
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-[#bcc4e7]/65">
              Wardrobe status
            </p>
            <p className="mt-3 text-[1.95rem] font-semibold tracking-[-0.04em] text-[#f6f0e8]">
              {garmentCount ?? 0}
            </p>
            <p className="mt-1 text-[0.92rem] leading-6 text-[#ede4d8]/70">
              {state === 'empty_wardrobe'
                ? 'pieces catalogued so far. Add a few anchors to unlock AI styling.'
                : 'pieces ready to work across styling, planning, and discovery.'}
            </p>
          </div>

          <div className="mt-auto rounded-[1.2rem] border border-dashed border-[#8b98d1]/25 bg-[#8b98d1]/7 p-4">
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-[#bcc4e7]/68">
              Stylist cue
            </p>
            <p className="mt-2 text-[0.92rem] leading-7 text-[#f0e8dc]/76">
              {stylistLine}
            </p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
