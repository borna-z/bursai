import { motion, LayoutGroup, type Transition } from 'framer-motion';
import { Sparkles, Bookmark, CalendarDays, Shirt, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import type { GeneratedOutfit } from '@/hooks/useOutfitGenerator';
import { hapticLight } from '@/lib/haptics';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { EASE_CURVE, STAGGER_DELAY, DURATION_MEDIUM, DURATION_SLOW } from '@/lib/motion';

const SPRING_LAYOUT: Transition = { type: 'spring', stiffness: 350, damping: 30 };

const OCCASIONS_LABELS: Record<string, string> = {
  casual: 'Casual', work: 'Work', party: 'Evening',
  date: 'Date', workout: 'Workout', travel: 'Travel',
};

interface AlternateOutfit extends GeneratedOutfit {
  /** Index of this outfit in the full generatedResults array */
  originalIndex: number;
}

interface OutfitGenerateResultProps {
  primary: GeneratedOutfit;
  alternateResults: AlternateOutfit[];
  generatedResultsLength: number;
  primaryIndex: number;
  onPrimaryIndexChange: (index: number) => void;
  reasoningText: string;
  effectiveMissing: string[];
  contextSubtitle: string;
  weather?: { temperature?: number; precipitation?: string; condition?: string } | null;
  prefersReduced: boolean | null;
  isMarkingWorn: boolean;
  isGenerating: boolean;
  t: (key: string) => string;
  onWearToday: () => void;
  onSave: (outfit: GeneratedOutfit) => void;
  onPlan: (outfit: GeneratedOutfit) => void;
  onRefineInChat: () => void;
  onRegenerate: () => void;
  onGarmentClick: (garmentId: string) => void;
  onMissingSlotClick: (slot: string) => void;
}

export function OutfitGenerateResult({
  primary,
  alternateResults,
  generatedResultsLength,
  primaryIndex,
  onPrimaryIndexChange,
  reasoningText,
  effectiveMissing,
  contextSubtitle,
  weather,
  prefersReduced,
  isMarkingWorn,
  isGenerating,
  t,
  onWearToday,
  onSave,
  onPlan,
  onRefineInChat,
  onRegenerate,
  onGarmentClick,
  onMissingSlotClick,
}: OutfitGenerateResultProps) {
  return (
    <LayoutGroup>
      {/* ── V4 Editorial Result Header ── */}
      <motion.div
        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION_SLOW, ease: EASE_CURVE }}
        className="mb-6"
      >
        <p className="label-editorial text-muted-foreground/60 mb-1">YOUR LOOK</p>
        <h1 className="font-display italic text-[1.6rem] leading-tight text-foreground tracking-tight">
          The Daily Edit
        </h1>
        {contextSubtitle && (
          <p className="text-[12px] font-body text-muted-foreground/60 mt-1.5">{contextSubtitle}</p>
        )}
      </motion.div>

      {/* ── Primary Outfit — Vertical garment list ── */}
      <motion.div
        key={`primary-${primary.id}`}
        layout={!prefersReduced}
        transition={prefersReduced ? { duration: 0 } : SPRING_LAYOUT}
        className="w-full space-y-3"
      >
        {primary.items.map((item, i) => (
          <motion.div
            key={item.garment.id}
            initial={prefersReduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * STAGGER_DELAY * 2, duration: DURATION_MEDIUM, ease: EASE_CURVE }}
            onClick={() => { hapticLight(); onGarmentClick(item.garment.id); }}
            className="rounded-[1.25rem] p-3 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform border border-border/40"
          >
            <div className="w-16 h-20 rounded-[1rem] overflow-hidden flex-shrink-0 bg-muted/20">
              <LazyImageSimple
                imagePath={getPreferredGarmentImagePath(item.garment)}
                alt={item.garment.title || item.slot}
                className="w-full h-full object-cover"
                fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/15" />}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-body uppercase tracking-[0.12em] text-muted-foreground/60 mb-0.5">
                {item.slot}
              </p>
              <p className="text-[14px] font-medium text-foreground truncate">
                {item.garment.title || item.slot}
              </p>
              {item.garment.colors?.[0] && (
                <p className="text-[11px] font-body text-muted-foreground/60 mt-0.5 truncate">
                  {item.garment.colors[0]}{item.garment.material ? ` · ${item.garment.material}` : ''}
                </p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/25 flex-shrink-0" />
          </motion.div>
        ))}

        {/* Missing slot placeholders */}
        {effectiveMissing.map((slot) => (
          <div
            key={`missing-${slot}`}
            onClick={() => { hapticLight(); onMissingSlotClick(slot); }}
            className="rounded-[1.25rem] p-3 flex items-center gap-4 cursor-pointer border border-dashed border-foreground/10"
          >
            <div className="w-16 h-20 rounded-[1rem] flex items-center justify-center bg-muted/10">
              <Shirt className="w-5 h-5 text-muted-foreground/20" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] text-foreground/40">Add {slot} to complete</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Reasoning ── */}
      {reasoningText && (
        <motion.div
          initial={prefersReduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: DURATION_SLOW, ease: EASE_CURVE }}
          className="mt-5 px-1"
        >
          <p className="font-display italic text-[13px] text-foreground/60 leading-relaxed">
            "{reasoningText}"
          </p>
        </motion.div>
      )}

      {/* ── Weather context ── */}
      {weather && (
        <div className="mt-3 px-1">
          <p className="text-[10px] font-body uppercase tracking-[0.1em] text-muted-foreground/60">
            Styled for {weather.temperature}°C{weather.precipitation && weather.precipitation !== 'none' ? ` · ${weather.precipitation}` : ''}
          </p>
        </div>
      )}

      {/* ── CTA row — Save is dominant, Plan + Wear today secondary, Refine ghost ── */}
      <motion.div
        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: DURATION_MEDIUM, ease: EASE_CURVE }}
        className="mt-8 space-y-3"
      >
        {/* Primary: Save */}
        <Button
          onClick={() => { hapticLight(); onSave(primary); }}
          variant="editorial"
          className="h-12 w-full rounded-full text-[15px] font-medium font-body"
          size="lg"
        >
          <Bookmark className="w-4 h-4 mr-2" />
          {t('generate.result_save')}
        </Button>

        {/* Secondary: Plan + Wear today */}
        <div className="flex gap-2">
          <Button
            onClick={() => { hapticLight(); onPlan(primary); }}
            variant="outline"
            className="flex-1 h-11 rounded-full text-[13px] font-body border-border/40"
          >
            <CalendarDays className="w-4 h-4 mr-1.5" />
            {t('generate.result_plan')}
          </Button>
          <Button
            onClick={() => { hapticLight(); onWearToday(); }}
            disabled={isMarkingWorn}
            variant="outline"
            className="flex-1 h-11 rounded-full text-[13px] font-body border-border/40"
          >
            {isMarkingWorn ? '…' : t('generate.result_wear_today')}
          </Button>
        </div>

        {/* Tertiary: Refine */}
        <Button
          onClick={() => { hapticLight(); onRefineInChat(); }}
          variant="ghost"
          className="h-10 w-full text-[13px] font-body text-muted-foreground/60"
        >
          {t('generate.result_refine')}
        </Button>
      </motion.div>

      {/* ── Try another ── */}
      <div className="mt-4">
        <Button
          onClick={() => { hapticLight(); onRegenerate(); }}
          disabled={isGenerating}
          variant="outline"
          className="h-11 w-full rounded-full border-border/40 bg-background/80 text-[13px] font-medium text-foreground"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {t('generate.result_try_another')}
        </Button>
      </div>

      {/* ── Alternate stylist options ── */}
      {alternateResults.length > 0 && (
        <motion.div
          initial={prefersReduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: DURATION_MEDIUM, ease: EASE_CURVE }}
          layout={!prefersReduced}
          className="mt-8"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="label-editorial text-muted-foreground/60">
              STYLIST OPTIONS
            </p>
            <p className="text-[11px] text-muted-foreground/60 font-body">
              {primaryIndex + 1} of {generatedResultsLength}
            </p>
          </div>

          <div className="space-y-3">
            {alternateResults.map((option) => {
              return (
                <motion.button
                  key={option.id}
                  whileTap={prefersReduced ? undefined : { scale: 0.98 }}
                  onClick={() => { hapticLight(); onPrimaryIndexChange(option.originalIndex); }}
                  className="w-full rounded-[1.25rem] p-3 text-left border border-border/40"
                >
                  <div className="flex gap-2">
                    {option.items.slice(0, 4).map((item) => (
                      <div
                        key={item.garment.id}
                        className="w-14 h-[4.5rem] rounded-[1rem] overflow-hidden flex-shrink-0 bg-muted/20"
                      >
                        <LazyImageSimple
                          imagePath={getPreferredGarmentImagePath(item.garment)}
                          alt={item.garment.title || item.slot}
                          className="w-full h-full object-cover"
                          fallbackIcon={<Shirt className="w-4 h-4 text-muted-foreground/15" />}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-medium text-foreground">
                        Option {option.originalIndex + 1}
                      </p>
                      <p className="text-[11px] font-body text-muted-foreground/60 mt-0.5">
                        {option.family_label ? `${option.family_label} · ` : ''}
                        {OCCASIONS_LABELS[option.occasion] ?? option.occasion}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/25" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </LayoutGroup>
  );
}
