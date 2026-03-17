import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sparkles, Eye, Palette } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { EASE_CURVE } from '@/lib/motion';

interface GarmentAnalysisStateProps {
  imageUrl?: string | null;
  className?: string;
}

/**
 * Premium garment analysis loading state.
 * Shows image with progress rail + editorial phase labels below.
 */
export function GarmentAnalysisState({ imageUrl, className }: GarmentAnalysisStateProps) {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  const [phase, setPhase] = useState(0);

  const phases = [
    { icon: Eye, label: t('ai.detecting_garment') },
    { icon: Palette, label: t('ai.extracting_details') },
    { icon: Sparkles, label: t('ai.refining_details') },
  ];

  useEffect(() => {
    if (prefersReduced) return;
    const durations = [1200, 1800, 0];
    if (phase >= phases.length - 1) return;
    const timer = setTimeout(() => setPhase(p => p + 1), durations[phase]);
    return () => clearTimeout(timer);
  }, [phase, prefersReduced]);

  const CurrentIcon = phases[phase]?.icon ?? Sparkles;

  return (
    <div className={cn('flex flex-col items-center gap-5 w-full max-w-xs', className)}>
      {/* Image with progress rail */}
      {imageUrl && (
        <div className="relative aspect-square w-48 rounded-xl overflow-hidden bg-secondary/60">
          <img
            src={imageUrl}
            alt="Garment preview"
            className="w-full h-full object-cover"
          />
          {/* Progress rail at bottom */}
          {!prefersReduced && (
            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-border/20 overflow-hidden">
              <motion.div
                className="h-full bg-accent/60"
                initial={{ width: '0%' }}
                animate={{ width: phase === 0 ? '33%' : phase === 1 ? '66%' : '95%' }}
                transition={{ duration: 1.2, ease: EASE_CURVE }}
              />
            </div>
          )}
        </div>
      )}

      {/* Phase label below image */}
      <div className="flex items-center gap-2.5">
        <motion.div
          key={phase}
          initial={prefersReduced ? undefined : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25, ease: EASE_CURVE }}
          className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center"
        >
          <CurrentIcon className="w-3.5 h-3.5 text-primary" />
        </motion.div>
        <AnimatePresence mode="wait">
          <motion.p
            key={phase}
            initial={prefersReduced ? undefined : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: -3 }}
            transition={{ duration: 0.2, ease: EASE_CURVE }}
            className="text-sm text-muted-foreground font-medium"
          >
            {phases[phase]?.label}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
