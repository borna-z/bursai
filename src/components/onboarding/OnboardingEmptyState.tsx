import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shirt, Sparkles, CalendarDays, Camera, Upload, BarChart3, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EASE_CURVE } from '@/lib/motion';
import { useGarmentCount } from '@/hooks/useGarments';
import { useOutfits } from '@/hooks/useOutfits';
import { useLanguage } from '@/contexts/LanguageContext';

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

      <div className={cn('flex-1 min-w-0', !isLast && 'pb-6')}>
        <p className={cn(
          'text-[13px] font-medium',
          step.done ? 'line-through text-muted-foreground/50' : 'text-foreground',
        )}>
          {step.label}
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-relaxed">
          {step.description}
        </p>
      </div>

      {step.action && !step.done && (
        <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
      )}
    </motion.button>
  );
}

export function WardrobeOnboardingEmpty() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: garmentCount = 0 } = useGarmentCount();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_CURVE }}
      className="px-1 pt-1"
    >
      <div className="mb-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1.1rem] bg-primary/[0.08]"
        >
          <Shirt className="w-7 h-7 text-primary/60" />
          <div className="absolute -inset-3 rounded-[1.25rem] bg-primary/5 blur-xl pointer-events-none" />
        </motion.div>
        <motion.h3
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-1.5 font-display italic text-lg font-bold tracking-[-0.02em]"
        >
          {t('wardrobe.empty_title')}
        </motion.h3>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mx-auto max-w-[270px] text-[13px] leading-5 text-muted-foreground/70"
        >
          {t('wardrobe.empty_desc')}
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, scaleX: 0.8 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.35, duration: 0.4, ease: EASE_CURVE }}
        className="mx-auto mb-6 max-w-[280px]"
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
            {t('wardrobe.onboarding_progress')}
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

      <div className="mx-auto max-w-[320px] space-y-2.5">
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/wardrobe/scan')}
          className="flex w-full items-center gap-3 rounded-[1.15rem] bg-foreground p-3.5 text-left text-background"
        >
          <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-[1rem] bg-background/15">
            <Camera className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium">{t('wardrobe.onboarding_scan_title')}</p>
            <p className="mt-0.5 text-[11px] opacity-60">{t('wardrobe.onboarding_scan_desc')}</p>
          </div>
          <ChevronRight className="w-4 h-4 opacity-40 shrink-0" />
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/wardrobe/add')}
          className="flex w-full items-center gap-3 rounded-[1.15rem] border border-border/20 bg-card p-3.5 text-left"
        >
          <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-[1rem] bg-muted/40">
            <Upload className="w-5 h-5 text-foreground/60" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium text-foreground">{t('wardrobe.onboarding_upload_title')}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{t('wardrobe.onboarding_upload_desc')}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
        </motion.button>
      </div>
    </motion.div>
  );
}

export function OutfitsOnboardingEmpty() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: garmentCount = 0 } = useGarmentCount();
  const hasEnoughGarments = garmentCount >= MIN_GARMENTS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_CURVE }}
      className="rounded-[1.2rem] border border-border/10 bg-gradient-to-b from-primary/[0.04] to-transparent px-5 py-10 text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1.1rem] bg-primary/[0.08]"
      >
        <Sparkles className="w-7 h-7 text-primary/60" />
        <div className="absolute -inset-3 rounded-[1.25rem] bg-primary/5 blur-xl pointer-events-none" />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-1.5 font-display italic text-lg font-bold tracking-[-0.02em]"
      >
        {hasEnoughGarments ? t('outfits.empty_ready_title') : t('outfits.empty_locked_title')}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mx-auto mb-5 max-w-[248px] text-[13px] leading-5 text-muted-foreground/70"
      >
        {hasEnoughGarments ? t('outfits.empty_ready_desc') : t('outfits.empty_locked_desc')}
      </motion.p>

      {!hasEnoughGarments && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mx-auto mb-5 w-full max-w-[180px]"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
              {t('outfits.progress_label')}
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
              {t('outfits.empty_cta_ready')}
            </>
          ) : (
            <>
              <Shirt className="w-4 h-4 mr-2" />
              {t('outfits.empty_cta_locked')}
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}

export function PlanOnboardingEmpty() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: garmentCount = 0 } = useGarmentCount();
  const { data: outfits = [] } = useOutfits(true);
  const hasEnoughGarments = garmentCount >= MIN_GARMENTS;
  const hasOutfits = outfits.length > 0;

  const steps: StepItem[] = [
    {
      label: t('plan.empty_step_add_title'),
      description: t('plan.empty_step_add_desc'),
      icon: Shirt,
      done: hasEnoughGarments,
      action: !hasEnoughGarments ? () => navigate('/wardrobe/add') : undefined,
    },
    {
      label: t('plan.empty_step_generate_title'),
      description: t('plan.empty_step_generate_desc'),
      icon: Sparkles,
      done: hasOutfits,
      action: hasEnoughGarments && !hasOutfits ? () => navigate('/ai/generate') : undefined,
    },
    {
      label: t('plan.empty_step_plan_title'),
      description: t('plan.empty_step_plan_desc'),
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
      className="rounded-[1.2rem] border border-border/10 bg-gradient-to-b from-primary/[0.04] to-transparent px-5 py-7"
    >
      <div className="mb-6 text-center">
        <motion.h3
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mb-1.5 font-display italic text-lg font-bold tracking-[-0.02em]"
        >
          {t('plan.empty_title')}
        </motion.h3>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="mx-auto max-w-[248px] text-[13px] leading-5 text-muted-foreground/70"
        >
          {t('plan.empty_desc')}
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

export function InsightsOnboardingEmpty() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: garmentCount = 0 } = useGarmentCount();
  const hasEnoughGarments = garmentCount >= MIN_GARMENTS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_CURVE }}
      className="flex flex-col items-center justify-center px-5 py-12 text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-[1.1rem] bg-muted/30"
      >
        <BarChart3 className="w-7 h-7 text-muted-foreground/50" />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-1.5 font-display italic text-lg font-bold tracking-[-0.02em]"
      >
        {t('insights.empty_title')}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mb-2 max-w-[270px] text-[13px] leading-5 text-muted-foreground/70"
      >
        {hasEnoughGarments ? t('insights.empty_desc_ready') : t('insights.empty_desc_locked')}
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="mb-6 max-w-[220px] text-[11px] leading-5 text-muted-foreground/60"
      >
        {t('insights.empty_meta')}
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
              {t('insights.empty_cta_ready')}
            </>
          ) : (
            <>
              <Shirt className="w-4 h-4 mr-2" />
              {t('insights.empty_cta_locked')}
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}
