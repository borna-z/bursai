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
}

export function AILoadingCard({ phases, subtitle, className }: AILoadingCardProps) {
  const [phase, setPhase] = useState(0);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (phases.length <= 1) return;
    const current = phases[phase];
    if (!current || current.duration === 0) return;

    const timer = setTimeout(() => {
      setPhase(p => (p + 1) % phases.length);
    }, current.duration);

    return () => clearTimeout(timer);
  }, [phase, phases]);

  const CurrentIcon = phases[phase]?.icon ?? Sparkles;
  const currentLabel = phases[phase]?.label ?? '';

  return (
    <div className={cn('rounded-xl surface-secondary p-4', className)}>
      <div className="flex items-center gap-3">
        {/* Breathing glow icon */}
        <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
          {!prefersReduced && (
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/10 blur-sm"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <motion.div
            key={phase}
            initial={prefersReduced ? undefined : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: EASE_CURVE }}
            className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center z-10"
          >
            <CurrentIcon className="w-4 h-4 text-primary" />
          </motion.div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="h-4 relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={phase}
                initial={prefersReduced ? undefined : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: EASE_CURVE }}
                className="text-sm font-medium text-foreground truncate"
              >
                {currentLabel}
              </motion.p>
            </AnimatePresence>
          </div>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Shimmer line instead of bouncing dots */}
        <div className="relative w-8 h-px shrink-0 overflow-hidden">
          <div className="absolute inset-0 bg-border/30" />
          {!prefersReduced && (
            <motion.div
              className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-muted-foreground/40 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
