import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shirt, Sparkles, CalendarDays, Camera, Upload, BarChart3, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EASE_CURVE } from '@/lib/motion';
import { useGarmentCount } from '@/hooks/useGarments';
import { useOutfits } from '@/hooks/useOutfits';

const MIN_GARMENTS = 3;

interface StepItem {
  label: string;
  description: string;
  icon: React.ElementType;
  done: boolean;
  action?: () => void;
}

function ProgressStep({ step, index, isLast }: { step: StepItem; index: number; isLast: boolean }) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.1, duration: 0.4, ease: EASE_CURVE }}
      onClick={step.action}
      disabled={step.done || !step.action}
      className={cn(
        'w-full flex items-center gap-3.5 text-left transition-colors',
        step.action && !step.done && 'cursor-pointer active:scale-[0.98]',
        step.done && 'opacity-50',
      )}
    >
      {/* Step indicator */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
            step.done
              ? 'bg-primary/15 text-primary'
              : 'bg-muted/40 text-muted-foreground/60',
          )}
        >
          {step.done ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <step.icon className="w-4 h-4" />
          )}
        </div>
        {!isLast && (
          <div className={cn('w-px h-6', step.done ? 'bg-primary/20' : 'bg-border/20')} />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0', !isLast && 'pb-6')}>
        <p className={cn(
          'text-[13px] font-medium',
          step.done ? 'line-through text-muted-foreground/50' : 'text-foreground',
        )}>
          {step.label}
        </p>
        <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-relaxed">
          {step.description}
        </p>
      </div>

      {/* Arrow for actionable steps */}
      {step.action && !step.done && (
        <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
      )}
    </motion.button>
  );
}

/** Context-specific onboarding empty state for the Wardrobe page */
export function WardrobeOnboardingEmpty() {
  const navigate = useNavigate();
  const { data: garmentCount = 0 } = useGarmentCount();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_CURVE }}
      className="px-2 pt-4"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="w-16 h-16 rounded-[1.25rem] bg-primary/[0.08] flex items-center justify-center mx-auto mb-5 relative"
        >
          <Shirt className="w-7 h-7 text-primary/60" />
          <div className="absolute -inset-3 rounded-[1.25rem] bg-primary/5 blur-xl pointer-events-none" />
        </motion.div>
        <motion.h3
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="font-['Playfair_Display'] italic text-lg font-bold tracking-[-0.02em] mb-2"
        >
          Build your wardrobe
        </motion.h3>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-[13px] text-muted-foreground/70 max-w-[280px] mx-auto leading-relaxed"
        >
          Add at least {MIN_GARMENTS} pieces so BURS can start styling you.
          A top, a bottom, and shoes is all you need.
        </motion.p>
      </div>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0.8 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.35, duration: 0.4, ease: EASE_CURVE }}
        className="max-w-[280px] mx-auto mb-8"
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">
            Garments added
          </span>
          <span className="text-[10px] text-muted-foreground/60 tabular-nums font-medium">
            {garmentCount}/{MIN_GARMENTS}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((garmentCount / MIN_GARMENTS) * 100, 100)}%` }}
            transition={{ delay: 0.5, duration: 0.6, ease: EASE_CURVE }}
            className="h-full rounded-full bg-primary/60"
          />
        </div>
      </motion.div>

      {/* Action cards */}
      <div className="space-y-2.5 max-w-[320px] mx-auto">
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/wardrobe/scan')}
          className="w-full rounded-[1.25rem] bg-foreground text-background p-4 flex items-center gap-3.5 text-left"
        >
          <div className="w-10 h-10 rounded-[1.1rem] bg-background/15 flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium">Scan a garment</p>
            <p className="text-[11px] opacity-60 mt-0.5">Point your camera — AI handles the rest</p>
          </div>
          <ChevronRight className="w-4 h-4 opacity-40 shrink-0" />
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/wardrobe/add')}
          className="w-full rounded-[1.25rem] bg-card border border-border/20 p-4 flex items-center gap-3.5 text-left"
        >
          <div className="w-10 h-10 rounded-[1.1rem] bg-muted/40 flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5 text-foreground/60" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium text-foreground">Upload a photo</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">From your camera roll or gallery</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
        </motion.button>
      </div>
    </motion.div>
  );
}

/** Context-specific onboarding empty state for the Outfits page */
export function OutfitsOnboardingEmpty() {
  const navigate = useNavigate();
  const { data: garmentCount = 0 } = useGarmentCount();
  const hasEnoughGarments = garmentCount >= MIN_GARMENTS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_CURVE }}
      className="rounded-[1.25rem] bg-gradient-to-b from-primary/[0.04] to-transparent border border-border/10 py-16 px-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="w-16 h-16 rounded-[1.25rem] bg-primary/[0.08] flex items-center justify-center mx-auto mb-5 relative"
      >
        <Sparkles className="w-7 h-7 text-primary/60" />
        <div className="absolute -inset-3 rounded-[1.25rem] bg-primary/5 blur-xl pointer-events-none" />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="font-['Playfair_Display'] italic text-lg font-bold tracking-[-0.02em] mb-2"
      >
        {hasEnoughGarments ? 'Ready for your first look' : 'No looks yet'}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-[13px] text-muted-foreground/70 max-w-[260px] mx-auto leading-relaxed mb-6"
      >
        {hasEnoughGarments
          ? 'Your wardrobe has enough pieces. Let AI create a styled outfit from what you own.'
          : `Add at least ${MIN_GARMENTS} garments to your wardrobe, then BURS will style them into looks.`}
      </motion.p>

      {!hasEnoughGarments && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="w-full max-w-[180px] mx-auto mb-6"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">
              Garments
            </span>
            <span className="text-[10px] text-muted-foreground/60 tabular-nums font-medium">
              {garmentCount}/{MIN_GARMENTS}
            </span>
          </div>
          <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((garmentCount / MIN_GARMENTS) * 100, 100)}%` }}
              transition={{ delay: 0.5, duration: 0.6, ease: EASE_CURVE }}
              className="h-full rounded-full bg-primary/60"
            />
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Button
          onClick={() => navigate(hasEnoughGarments ? '/ai/generate' : '/wardrobe/add')}
          size="lg"
        >
          {hasEnoughGarments ? (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Create a look
            </>
          ) : (
            <>
              <Shirt className="w-4 h-4 mr-2" />
              Add garments
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}

/** Context-specific onboarding empty state for the Plan page (no garments) */
export function PlanOnboardingEmpty() {
  const navigate = useNavigate();
  const { data: garmentCount = 0 } = useGarmentCount();
  const { data: outfits = [] } = useOutfits(true);
  const hasEnoughGarments = garmentCount >= MIN_GARMENTS;
  const hasOutfits = outfits.length > 0;

  const steps: StepItem[] = [
    {
      label: `Add ${MIN_GARMENTS}+ garments`,
      description: 'A top, bottom, and shoes to get started',
      icon: Shirt,
      done: hasEnoughGarments,
      action: !hasEnoughGarments ? () => navigate('/wardrobe/add') : undefined,
    },
    {
      label: 'Generate an outfit',
      description: 'Let AI style what you own into a look',
      icon: Sparkles,
      done: hasOutfits,
      action: hasEnoughGarments && !hasOutfits ? () => navigate('/ai/generate') : undefined,
    },
    {
      label: 'Plan your week',
      description: 'Assign looks to days and never repeat',
      icon: CalendarDays,
      done: false,
      action: hasOutfits ? () => navigate('/plan') : undefined,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_CURVE }}
      className="rounded-[1.25rem] bg-gradient-to-b from-primary/[0.04] to-transparent border border-border/10 py-10 px-6"
    >
      <div className="text-center mb-8">
        <motion.h3
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="font-['Playfair_Display'] italic text-lg font-bold tracking-[-0.02em] mb-2"
        >
          Get ready to plan
        </motion.h3>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-[13px] text-muted-foreground/70 max-w-[260px] mx-auto leading-relaxed"
        >
          Complete these steps and you'll have a styled week in minutes.
        </motion.p>
      </div>

      <div className="max-w-[280px] mx-auto">
        {steps.map((step, i) => (
          <ProgressStep key={step.label} step={step} index={i} isLast={i === steps.length - 1} />
        ))}
      </div>
    </motion.div>
  );
}

/** Context-specific onboarding empty state for the Insights page */
export function InsightsOnboardingEmpty() {
  const navigate = useNavigate();
  const { data: garmentCount = 0 } = useGarmentCount();
  const hasEnoughGarments = garmentCount >= MIN_GARMENTS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_CURVE }}
      className="flex flex-col items-center justify-center py-20 px-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="w-16 h-16 rounded-[1.25rem] bg-muted/30 flex items-center justify-center mb-5"
      >
        <BarChart3 className="w-7 h-7 text-muted-foreground/50" />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="font-['Playfair_Display'] italic text-lg font-bold tracking-[-0.02em] mb-2"
      >
        Insights unlock with wear data
      </motion.h3>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-[13px] text-muted-foreground/70 max-w-[280px] leading-relaxed mb-2"
      >
        {hasEnoughGarments
          ? 'Mark outfits as worn and BURS will track your style DNA, color palette, and wardrobe health.'
          : 'Add garments and start wearing them. BURS will reveal your style DNA, color balance, and wardrobe gaps.'}
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="text-[11px] text-muted-foreground/40 max-w-[240px] leading-relaxed mb-8"
      >
        Style DNA · Color palette · Usage heatmap · Wardrobe gaps
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Button
          onClick={() => navigate(hasEnoughGarments ? '/ai/generate' : '/wardrobe/add')}
          size="lg"
        >
          {hasEnoughGarments ? (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate & wear an outfit
            </>
          ) : (
            <>
              <Shirt className="w-4 h-4 mr-2" />
              Add garments first
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}
