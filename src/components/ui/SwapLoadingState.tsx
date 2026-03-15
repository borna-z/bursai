import { motion, useReducedMotion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';

interface SwapLoadingStateProps {
  className?: string;
}

/**
 * Refined loading state for the swap candidate sheet.
 * Shows 3 skeleton garment rows matching the candidate layout.
 */
export function SwapLoadingState({ className }: SwapLoadingStateProps) {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();

  return (
    <div className={cn('space-y-3 py-6', className)}>
      <p className="text-xs text-muted-foreground text-center">
        {t('ai.finding_swap')}
      </p>
      <div className="space-y-2">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            initial={prefersReduced ? undefined : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * STAGGER_DELAY * 3, duration: 0.3, ease: EASE_CURVE }}
            className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40"
          >
            <Skeleton className="w-16 h-16 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
