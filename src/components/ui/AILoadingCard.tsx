import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
    <div className={cn('rounded-xl border border-border/10 bg-card/60 p-4', className)}>
      <div className="flex items-center gap-3">
        {/* Mini pulse icon */}
        <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
          {[0, 1].map(i => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border border-primary/25"
              animate={{ scale: [1, 1.6 + i * 0.3], opacity: [0.4, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
            />
          ))}
          <motion.div
            key={phase}
            initial={{ scale: 0.7, opacity: 0 }}
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
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: EASE_CURVE }}
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

        {/* Bouncing dots */}
        <div className="flex gap-1 shrink-0">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              className="w-1 h-1 rounded-full bg-primary/40"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
