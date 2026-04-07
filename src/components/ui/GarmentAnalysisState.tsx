import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GarmentAnalysisStateProps {
  imageUrl?: string | null;
  className?: string;
}

const PHASE_MESSAGES = [
  'Identifying category',
  'Reading colour',
  'Detecting fabric',
  'Checking fit',
  'Finalising details',
] as const;

/**
 * Premium garment analysis loading state.
 * Full-bleed image with overlay phase messages.
 */
export function GarmentAnalysisState({ imageUrl, className }: GarmentAnalysisStateProps) {
  const prefersReduced = useReducedMotion();
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (prefersReduced) return;
    const timer = setInterval(() => {
      setMsgIndex((i) => (i + 1) % PHASE_MESSAGES.length);
    }, 1400);
    return () => clearInterval(timer);
  }, [prefersReduced]);

  return (
    <div className={cn('relative w-full aspect-square bg-secondary overflow-hidden', className)}>
      {/* Full-bleed garment image */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Garment preview"
          className="w-full h-full object-contain"
        />
      )}

      {/* Bottom overlay bar */}
      <div className="absolute bottom-0 inset-x-0 h-12 bg-foreground/85 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIndex}
            initial={prefersReduced ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="text-[12px] font-body text-white/60"
          >
            {PHASE_MESSAGES[msgIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
