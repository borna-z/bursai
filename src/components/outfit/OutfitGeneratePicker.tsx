import {
  Sparkles, Crown, Zap, Check, Shirt,
  Coffee, Briefcase, Wine, Heart, Dumbbell, Plane, X,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { PaywallModal } from '@/components/PaywallModal';
import { CoachMark } from '@/components/coach/CoachMark';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useFirstRunCoach } from '@/hooks/useFirstRunCoach';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/lib/haptics';
import { EASE_CURVE, DURATION_MEDIUM } from '@/lib/motion';

/* ── Occasions ── */
const OCCASION_ICONS: Record<string, React.ElementType> = {
  casual: Coffee,
  work: Briefcase,
  party: Wine,
  date: Heart,
  workout: Dumbbell,
  travel: Plane,
};

export const OCCASIONS = [
  { key: 'casual', label: 'Casual' },
  { key: 'work', label: 'Work' },
  { key: 'party', label: 'Evening' },
  { key: 'date', label: 'Date' },
  { key: 'workout', label: 'Workout' },
  { key: 'travel', label: 'Travel' },
] as const;

/* ── Curated styles (single flat list) ── */
export const STYLES = [
  'Minimal', 'Smart Casual', 'Street', 'Scandinavian',
  'Edgy', 'Bohemian', 'Preppy', 'Relaxed',
] as const;

export type GenerationMode = 'standard' | 'stylist';

interface OutfitGeneratePickerProps {
  selectedOccasion: string;
  onOccasionChange: (key: string) => void;
  selectedStyles: string[];
  onStylesChange: (styles: string[]) => void;
  generationMode: GenerationMode;
  onModeChange: (mode: GenerationMode) => void;
  weather: { temperature?: number; condition?: string; location?: string } | null;
  weatherAdvice: string;
  preferredGarmentSummary: string | null;
  onClearPreferred: () => void;
  contextSubtitle: string;
  isGenerating: boolean;
  onGenerate: () => void;
  showPaywall: boolean;
  onShowPaywall: (show: boolean) => void;
}

export function OutfitGeneratePicker({
  selectedOccasion,
  onOccasionChange,
  selectedStyles,
  onStylesChange,
  generationMode,
  onModeChange,
  weather,
  weatherAdvice,
  preferredGarmentSummary,
  onClearPreferred,
  contextSubtitle,
  isGenerating,
  onGenerate,
  showPaywall,
  onShowPaywall,
}: OutfitGeneratePickerProps) {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  const { isPremium, remainingOutfits } = useSubscription();
  const coach = useFirstRunCoach();
  const navigate = useNavigate();

  return (
    <>
      <div className="page-shell pb-36">

        {/* ── Header ── */}
        <PageHeader
          title={t('outfit.generate_title') || 'Generate Outfit'}
          showBack
          titleClassName="font-display italic"
        />

        {/* ── Weather pill + style anchor ── */}
        <motion.section
          initial={prefersReduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE }}
          className="space-y-2.5 pb-6"
        >
          {weather && (
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 px-3 py-1.5 text-[11px] font-body text-foreground/55">
                {weather.temperature}°C · {t(weather.condition) || weather.location}
              </span>
              {weatherAdvice && (
                <p className="pt-1.5 text-[11px] text-muted-foreground/60 font-body">
                  {weatherAdvice}
                </p>
              )}
            </div>
          )}
          {preferredGarmentSummary && (
            <div className="pt-1.5">
              <div className="inline-flex max-w-full items-center gap-3 rounded-[1.25rem] border border-border/40 px-3 py-2.5 text-left">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-primary">
                  <Shirt className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-body font-medium uppercase tracking-[0.18em] text-primary/60">Style anchor</p>
                  <p className="truncate text-[13px] font-medium text-foreground">{preferredGarmentSummary}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { hapticLight(); onClearPreferred(); }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/40 transition-colors hover:bg-background"
                  aria-label="Clear style anchor" // i18n-ignore
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </motion.section>

        {/* ── Occasion selector — horizontal pills ── */}
        <motion.section
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: DURATION_MEDIUM, ease: EASE_CURVE }}
          className="space-y-3 pb-8"
        >
          <p className="label-editorial text-muted-foreground/60">SELECT OCCASION</p>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map(({ key, label }) => {
              const isSelected = selectedOccasion === key;
              const OccIcon = OCCASION_ICONS[key] || Sparkles;
              return (
                <motion.button
                  key={key}
                  whileTap={prefersReduced ? undefined : { scale: 0.96 }}
                  onClick={() => { hapticLight(); onOccasionChange(key); }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-body transition-all',
                    isSelected
                      ? 'bg-foreground text-background'
                      : 'border border-border/40 text-foreground/55 hover:border-foreground/20'
                  )}
                >
                  <OccIcon className="w-4 h-4" strokeWidth={1.8} />
                  {label}
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        {/* ── Mood & Aesthetic — pill chips ── */}
        <motion.section
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: DURATION_MEDIUM, ease: EASE_CURVE }}
          className="pb-8 space-y-3"
        >
          <p className="label-editorial text-muted-foreground/60">MOOD & AESTHETIC</p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((style) => {
              const isSelected = selectedStyles.includes(style);
              return (
                <motion.button
                  key={style}
                  whileTap={prefersReduced ? undefined : { scale: 0.96 }}
                  onClick={() => {
                    hapticLight();
                    if (isSelected) {
                      onStylesChange(selectedStyles.filter(s => s !== style));
                    } else if (selectedStyles.length >= 2) {
                      toast.error('Pick up to 2 styles');
                    } else {
                      onStylesChange([...selectedStyles, style]);
                    }
                  }}
                  className={cn(
                    'rounded-full px-4 py-2.5 text-[13px] font-body transition-all',
                    isSelected
                      ? 'bg-foreground text-background'
                      : 'border border-border/40 text-foreground/55 hover:border-foreground/20'
                  )}
                >
                  {style}
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        {/* ── Mode toggle — editorial cards ── */}
        <motion.section
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: DURATION_MEDIUM, ease: EASE_CURVE }}
          className="pb-6 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileTap={prefersReduced ? undefined : { scale: 0.97 }}
              onClick={() => { hapticLight(); onModeChange('standard'); }}
              className={cn(
                'rounded-[1.25rem] relative p-4 text-left transition-all border border-border/40',
                generationMode === 'standard' && 'ring-1 ring-foreground/10'
              )}
            >
              <Sparkles className={cn(
                'w-5 h-5 mb-3',
                generationMode === 'standard' ? 'text-foreground' : 'text-muted-foreground/30'
              )} />
              <p className="text-[13px] font-semibold text-foreground">Quick Look</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-snug font-body">
                Fast, balanced, everyday
              </p>
              {generationMode === 'standard' && (
                <motion.div
                  layoutId="mode-check"
                  className="absolute top-3 right-3 w-5 h-5 rounded-full bg-foreground flex items-center justify-center"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <Check className="w-3 h-3 text-background" />
                </motion.div>
              )}
            </motion.button>

            <motion.button
              whileTap={prefersReduced ? undefined : { scale: 0.97 }}
              onClick={() => {
                hapticLight();
                if (!isPremium) { onShowPaywall(true); return; }
                onModeChange('stylist');
              }}
              className={cn(
                'rounded-[1.25rem] relative p-4 text-left transition-all border border-border/40',
                generationMode === 'stylist' && 'ring-1 ring-premium/14'
              )}
            >
              <Crown className={cn(
                'w-5 h-5 mb-3',
                generationMode === 'stylist' ? 'text-premium' : 'text-muted-foreground/30'
              )} />
              <p className="text-[13px] font-semibold text-foreground">Stylist Mode</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-snug font-body">
                Deeper curation, editorial
              </p>
              {!isPremium && (
                <span className="absolute top-3 right-3 text-[9px] font-semibold text-premium uppercase tracking-wider">
                  Premium
                </span>
              )}
              {generationMode === 'stylist' && isPremium && (
                <motion.div
                  layoutId="mode-check"
                  className="absolute top-3 right-3 w-5 h-5 rounded-full bg-premium flex items-center justify-center"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <Check className="w-3 h-3 text-premium-foreground" />
                </motion.div>
              )}
            </motion.button>
          </div>
        </motion.section>
      </div>

      {/* ── Sticky CTA ── */}
      <div className="action-bar-floating bottom-safe-nav fixed left-0 right-0 z-20">
        <div className="px-4 pt-3 pb-4">
          <div className="max-w-md mx-auto space-y-2">
            {contextSubtitle && (
              <p className="text-[11px] text-muted-foreground/60 text-center tracking-wide font-body">
                {contextSubtitle}
              </p>
            )}
            <CoachMark
              step={3}
              currentStep={coach.currentStep}
              isCoachActive={coach.isStepActive(3)}
              title="Generate outfits in seconds" // i18n-ignore
              body="Pick the occasion, add a style if you want, and BURS will build a look from your wardrobe." // i18n-ignore
              ctaLabel="Plan next" // i18n-ignore
              onCta={() => {
                coach.advanceStep();
                navigate('/plan');
              }}
              onSkip={() => coach.completeTour()}
              position="top"
            >
              <Button
                onClick={() => { hapticLight(); onGenerate(); }}
                disabled={isGenerating}
                variant="editorial"
                className="h-12 w-full rounded-full text-[15px] font-medium font-body"
                size="lg"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate
              </Button>
            </CoachMark>
            {!isPremium && remainingOutfits() < Infinity && (
              <p className="text-[11px] text-muted-foreground/60 text-center font-body">
                <Zap className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                {remainingOutfits()} outfits remaining
              </p>
            )}
          </div>
        </div>
      </div>

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => onShowPaywall(false)}
        reason="outfits"
      />
    </>
  );
}
