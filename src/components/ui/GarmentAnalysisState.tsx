import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { EASE_CURVE } from '@/lib/motion';

interface GarmentAnalysisStateProps {
  imageUrl?: string | null;
  className?: string;
}

const PHASE_LABELS = [
  'Reading material',
  'Detecting colour',
  'Matching occasion',
] as const;

const PHASE_DELAYS = [0, 1200, 2400] as const;

/**
 * Premium garment analysis loading state.
 * Three sequential phase lines appear one by one; previous lines dim.
 */
export function GarmentAnalysisState({ imageUrl, className }: GarmentAnalysisStateProps) {
  const prefersReduced = useReducedMotion();
  const [visibleCount, setVisibleCount] = useState(prefersReduced ? PHASE_LABELS.length : 1);

  useEffect(() => {
    if (prefersReduced) {
      setVisibleCount(PHASE_LABELS.length);
      return;
    }

    setVisibleCount(1);

    const timers = PHASE_DELAYS.slice(1).map((delay, i) => {
      return setTimeout(() => {
        setVisibleCount(i + 2);
      }, delay);
    });

    return () => timers.forEach(clearTimeout);
  }, [prefersReduced]);

  return (
    <div className={cn('flex flex-col items-center gap-5 w-full max-w-xs', className)}>
      {/* Garment image preview */}
      {imageUrl && (
        <div className="relative aspect-square w-48 rounded-xl overflow-hidden bg-secondary/60">
          <img
            src={imageUrl}
            alt="Garment preview"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Sequential phase lines */}
      <div className="flex flex-col items-center gap-2 max-w-[240px] w-full">
        {PHASE_LABELS.map((label, i) => {
          const isVisible = i < visibleCount;
          const isActive = i === visibleCount - 1;

          if (!isVisible) return null;

          return (
            <motion.p
              key={label}
              initial={prefersReduced ? undefined : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: EASE_CURVE }}
              className={cn(
                'text-[13px] font-body text-center transition-colors duration-300',
                isActive
                  ? 'text-muted-foreground'
                  : 'text-muted-foreground/40',
              )}
            >
              {label}
            </motion.p>
          );
        })}
      </div>
    </div>
  );
}
