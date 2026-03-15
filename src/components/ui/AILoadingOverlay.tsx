import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
  /** Tonal warmth: neutral (default), warm (amber-tinted), expressive (accent-tinted) */
  tone?: 'neutral' | 'warm' | 'expressive';
}

/** Subtle horizontal shimmer line */
function ShimmerLine({ reduced }: { reduced: boolean }) {
  if (reduced) return <div className="h-px w-16 bg-muted-foreground/20 mx-auto" />;
  return (
    <div className="relative h-px w-24 mx-auto overflow-hidden">
      <div className="absolute inset-0 bg-border/40" />
      <motion.div
        className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-muted-foreground/30 to-transparent"
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

/** Breathing glow behind icon */
function BreathingGlow({ tone, reduced }: { tone: string; reduced: boolean }) {
  const toneClass =
    tone === 'warm' ? 'bg-warning/15' :
    tone === 'expressive' ? 'bg-accent/15' :
    'bg-primary/10';

  if (reduced) return <div className={cn('absolute inset-0 rounded-full', toneClass)} />;

  return (
    <motion.div
      className={cn('absolute inset-0 rounded-full blur-sm', toneClass)}
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

export function AILoadingOverlay({
  variant = 'inline',
  phases,
  subtitle,
  progress,
  showSkeletons,
  className,
  tone = 'neutral',
}: AILoadingOverlayProps) {
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
        {/* Icon with breathing glow */}
        <div className="relative w-14 h-14 flex items-center justify-center">
          <BreathingGlow tone={tone} reduced={!!prefersReduced} />
          <motion.div
            key={phase}
            initial={prefersReduced ? undefined : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: EASE_CURVE }}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center z-10',
              tone === 'warm' ? 'bg-warning/10' :
              tone === 'expressive' ? 'bg-accent/10' :
              'bg-primary/10'
            )}
          >
            <CurrentIcon className={cn(
              'w-5 h-5',
              tone === 'warm' ? 'text-warning' :
              tone === 'expressive' ? 'text-accent' :
              'text-primary'
            )} />
          </motion.div>
        </div>

        {/* Phase text */}
        <div className="h-5 relative">
          <AnimatePresence mode="wait">
            <motion.p
              key={phase}
              initial={prefersReduced ? undefined : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReduced ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: EASE_CURVE }}
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

        {/* Shimmer line instead of bouncing dots */}
        <ShimmerLine reduced={!!prefersReduced} />
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
              initial={prefersReduced ? undefined : { opacity: 0, scale: 0.95 }}
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
