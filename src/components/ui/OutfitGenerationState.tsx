import { motion, useReducedMotion } from 'framer-motion';
import { Shirt, Palette, Wand2, type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AILoadingCard } from '@/components/ui/AILoadingCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';

interface OutfitGenerationStateProps {
  subtitle?: string;
  className?: string;
  /** compact: 2x2 mini grid for cards. full: larger centered layout */
  variant?: 'compact' | 'full';
  /** Tonal warmth passed to loading card */
  tone?: 'neutral' | 'warm' | 'expressive';
}

const SLOT_LABELS = ['top', 'bottom', 'shoes', 'layer'] as const;

export function OutfitGenerationState({
  subtitle,
  className,
  variant = 'full',
  tone = 'neutral',
}: OutfitGenerationStateProps) {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();

  const phases = [
    { icon: Shirt, label: t('ai.selecting_pieces'), duration: 1200 },
    { icon: Palette, label: t('ai.balancing_look'), duration: 1500 },
    { icon: Wand2, label: t('ai.refining_outfit'), duration: 0 },
  ];

  const isCompact = variant === 'compact';
  const slotSize = isCompact ? 'w-12 h-14' : 'w-full aspect-[3/4]';
  const gridCols = isCompact ? 'grid-cols-4 gap-1.5' : 'grid-cols-2 gap-2';

  return (
    <div className={cn(
      'rounded-2xl bg-foreground/[0.02] border border-border/30 p-4 space-y-3',
      className,
    )}>
      {/* Slot skeleton grid */}
      <div className={cn('grid', gridCols)}>
        {SLOT_LABELS.map((slot, i) => (
          <motion.div
            key={slot}
            initial={prefersReduced ? undefined : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * STAGGER_DELAY * 2, duration: 0.3, ease: EASE_CURVE }}
          >
            <Skeleton className={cn(slotSize, 'rounded-lg')} />
          </motion.div>
        ))}
      </div>

      {/* Loading card */}
      <AILoadingCard
        phases={phases}
        subtitle={subtitle}
        className="border-0 bg-transparent p-0"
      />
    </div>
  );
}
