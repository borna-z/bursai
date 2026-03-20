import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGarmentProcessingPhases } from '@/lib/garmentImage';

interface GarmentProcessingPreviewProps {
  status?: string | null;
  error?: string | null;
  variant?: 'card' | 'hero';
  className?: string;
}

const phases = getGarmentProcessingPhases();

export function GarmentProcessingPreview({
  status,
  error,
  variant = 'card',
  className,
}: GarmentProcessingPreviewProps) {
  const isActive = status === 'pending' || status === 'processing';
  const isFailed = status === 'failed';
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setPhaseIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setPhaseIndex((current) => (current + 1) % phases.length);
    }, 1800);

    return () => window.clearInterval(interval);
  }, [isActive]);

  const completedPhases = useMemo(() => {
    if (!isActive) return 0;
    return Math.min(phases.length - 1, phaseIndex);
  }, [isActive, phaseIndex]);

  return (
    <AnimatePresence initial={false} mode="wait">
      {isActive ? (
        <motion.div
          key="processing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className={cn(
            'absolute inset-0 z-10 overflow-hidden rounded-[inherit] bg-gradient-to-b from-background/12 via-background/38 to-background/70 text-white backdrop-blur-[2px]',
            variant === 'hero' ? 'flex items-end p-5 sm:p-6' : 'flex items-end p-3',
            className,
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.26),transparent_42%)]" />
          <motion.div
            aria-hidden="true"
            className="absolute inset-y-0 -left-1/3 w-1/2 bg-gradient-to-r from-transparent via-white/18 to-transparent"
            animate={{ x: ['0%', '220%'] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          />

          <div className="relative w-full rounded-2xl border border-white/12 bg-black/20 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/12">
                <Sparkles className="h-4 w-4 animate-pulse" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/65">
                  Add Photo processing
                </p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={phases[phaseIndex]}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.28 }}
                    className={cn('font-medium text-white', variant === 'hero' ? 'text-base' : 'text-sm')}
                  >
                    {phases[phaseIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {phases.map((phase, index) => {
                const complete = index <= completedPhases;
                const active = index === phaseIndex;

                return (
                  <div key={phase} className="space-y-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/12">
                      <motion.div
                        className={cn(
                          'h-full rounded-full',
                          complete ? 'bg-white/90' : 'bg-white/20',
                          active && 'shadow-[0_0_18px_rgba(255,255,255,0.48)]',
                        )}
                        animate={{ scaleX: complete ? 1 : 0.35, opacity: active ? [0.7, 1, 0.7] : 0.7 }}
                        transition={{ duration: 1.2, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
                        style={{ transformOrigin: 'left center' }}
                      />
                    </div>
                    <p className="line-clamp-2 text-[10px] leading-tight text-white/70">{phase}</p>
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-xs text-white/72">
              We’ll keep your original photo visible until the clean cutout is safely ready.
            </p>
          </div>
        </motion.div>
      ) : null}

      {isFailed ? (
        <motion.div
          key="failed"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className={cn(
            'absolute inset-x-3 bottom-3 z-10 rounded-2xl border border-white/14 bg-background/80 p-3 text-left shadow-lg backdrop-blur-xl',
            variant === 'hero' && 'inset-x-5 bottom-5 sm:inset-x-6 sm:bottom-6',
            className,
          )}
        >
          <p className="text-xs font-medium text-foreground/88">Original photo kept</p>
          <p className="mt-1 text-xs text-muted-foreground">
            We kept your original image so nothing breaks while background removal finishes improving.
          </p>
          {error ? (
            <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground/80">{error}</p>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
