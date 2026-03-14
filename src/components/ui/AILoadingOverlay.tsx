import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, type LucideIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { EASE_CURVE } from '@/lib/motion';

export interface AIPhase {
  icon: LucideIcon;
  label: string;
  duration: number;
}

interface AILoadingOverlayProps {
  variant?: 'fullscreen' | 'inline' | 'card';
  phases: AIPhase[];
  subtitle?: string;
  progress?: number;
  showSkeletons?: number;
  className?: string;
}

function BouncingDots() {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary/40"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function PulseRings() {
  return (
    <>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border border-primary/30"
          animate={{ scale: [1, 1.8 + i * 0.4], opacity: [0.5, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }}
        />
      ))}
    </>
  );
}

export function AILoadingOverlay({
  variant = 'inline',
  phases,
  subtitle,
  progress,
  showSkeletons,
  className,
}: AILoadingOverlayProps) {
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

  const isFullscreen = variant === 'fullscreen';
  const isCard = variant === 'card';

  return (
    <div
      className={cn(
        'flex flex-col items-center',
        isFullscreen && 'min-h-[60vh] justify-center p-4',
        isCard && 'rounded-xl border border-border/10 bg-card/60 p-6',
        variant === 'inline' && 'py-8',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Radar pulse icon */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <PulseRings />
          <motion.div
            key={phase}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, ease: EASE_CURVE }}
            className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center z-10"
          >
            <CurrentIcon className="w-5 h-5 text-primary" />
          </motion.div>
        </div>

        {/* Phase text */}
        <div className="h-5 relative">
          <AnimatePresence mode="wait">
            <motion.p
              key={phase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: EASE_CURVE }}
              className="text-sm font-medium text-foreground whitespace-nowrap"
            >
              {currentLabel}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-xs text-muted-foreground/60">{subtitle}</p>
        )}

        {/* Bouncing dots */}
        <BouncingDots />
      </div>

      {/* Progress bar */}
      {progress !== undefined && (
        <div className="w-full max-w-xs mt-5 space-y-1.5">
          <Progress value={progress} className="h-1.5" />
          <p className="text-[10px] text-center text-muted-foreground">{Math.round(progress)}%</p>
        </div>
      )}

      {/* Optional skeleton cards */}
      {showSkeletons && showSkeletons > 0 && (
        <div className="w-full mt-5 space-y-2.5">
          {Array.from({ length: showSkeletons }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.15, duration: 0.4, ease: EASE_CURVE }}
            >
              <Skeleton className="h-16 w-full rounded-lg" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
