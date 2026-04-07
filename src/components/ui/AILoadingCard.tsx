import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EASE_CURVE } from '@/lib/motion';

export interface AICardPhase {
  icon: LucideIcon;
  label: string;
  duration: number;
}

interface AILoadingCardProps {
  phases: AICardPhase[];
  subtitle?: string;
  className?: string;
  /** Optional external phase override — bypasses internal cycling */
  phase?: number;
}

export function AILoadingCard({ phases, subtitle, className, phase: externalPhase }: AILoadingCardProps) {
  const [internalPhase, setInternalPhase] = useState(0);
  const prefersReduced = useReducedMotion();

  const phase = externalPhase !== undefined ? externalPhase : internalPhase;

  useEffect(() => {
    // Only auto-cycle when phase is not externally controlled
    if (externalPhase !== undefined) return;
    if (phases.length <= 1) return;
    const current = phases[internalPhase];
    if (!current || current.duration === 0) return;

    const timer = setTimeout(() => {
      setInternalPhase(p => (p + 1) % phases.length);
    }, current.duration);

    return () => clearTimeout(timer);
  }, [internalPhase, phases, externalPhase]);

  const CurrentIcon = phases[phase]?.icon ?? Sparkles;
  const currentLabel = phases[phase]?.label ?? '';
  const currentDuration = phases[phase]?.duration ?? 0;

  return (
    <div className={cn('rounded-xl surface-secondary p-4', className)}>
      <div className="flex flex-col items-center gap-3">

        {/* 48×48 animated icon card */}
        <div className="relative w-12 h-12 flex items-center justify-center rounded-xl overflow-hidden">
          {/* Pulsing background */}
          {prefersReduced ? (
            <div className="absolute inset-0 rounded-xl bg-foreground/[0.06]" />
          ) : (
            <motion.div
              className="absolute inset-0 bg-foreground"
              animate={{ opacity: [0.06, 0.12, 0.06] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          {/* Icon — scale pulse loop, fades in on phase change */}
          <motion.div
            key={phase}
            initial={prefersReduced ? undefined : { scale: 0.85, opacity: 0 }}
            animate={
              prefersReduced
                ? { scale: 1, opacity: 1 }
                : { scale: [1.0, 1.08, 1.0], opacity: 1 }
            }
            transition={
              prefersReduced
                ? { duration: 0.2, ease: EASE_CURVE }
                : {
                    scale: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
                    opacity: { duration: 0.25, ease: EASE_CURVE },
                  }
            }
            className="relative z-10"
          >
            <CurrentIcon className="w-5 h-5 text-foreground/70" />
          </motion.div>
        </div>

        {/* Phase label + subtitle */}
        <div className="text-center w-full space-y-0.5">
          <div className="h-[20px] relative">
            <AnimatePresence mode="wait">
              <motion.p
                key={phase}
                initial={prefersReduced ? undefined : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: EASE_CURVE }}
                className="text-[14px] font-body text-foreground/80 text-center absolute inset-x-0"
              >
                {currentLabel}
              </motion.p>
            </AnimatePresence>
          </div>
          {subtitle && (
            <p className="text-[13px] font-body text-muted-foreground/60 text-center mt-1">
              {subtitle}
            </p>
          )}
        </div>

        {/* Segmented progress bar — N segments, one per phase */}
        {phases.length > 1 && (
          <div className="flex w-full gap-1.5">
            {phases.map((_, i) => (
              <div key={i} className="relative flex-1 h-1 rounded-full bg-foreground/10 overflow-hidden">
                {/* Completed segment */}
                {i < phase && (
                  <div className="absolute inset-0 bg-foreground/40 rounded-full" />
                )}
                {/* Active segment — fills left→right over phase duration */}
                {i === phase && (
                  prefersReduced ? (
                    <div className="absolute inset-0 bg-foreground/40 rounded-full" />
                  ) : (
                    <motion.div
                      key={`seg-${phase}`}
                      className="absolute inset-y-0 left-0 bg-foreground/80 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: currentDuration > 0 ? '100%' : '80%' }}
                      transition={{
                        duration: currentDuration > 0 ? currentDuration / 1000 : 0.3,
                        ease: 'linear',
                      }}
                    />
                  )
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
