import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Shirt, ArrowDownUp, Footprints, Layers } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { EASE_CURVE } from '@/lib/motion';

interface OutfitGenerationStateProps {
  subtitle?: string;
  className?: string;
  /** compact: 4-column icon row. full: 2x2 larger grid */
  variant?: 'compact' | 'full';
  /** Tonal warmth passed to loading card */
  tone?: 'neutral' | 'warm' | 'expressive';
}

const SLOT_ICONS = [Shirt, ArrowDownUp, Footprints, Layers] as const;
const SLOT_KEYS = ['top', 'bottom', 'shoes', 'layer'] as const;

export function OutfitGenerationState({
  subtitle,
  className,
  variant = 'full',
}: OutfitGenerationStateProps) {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  const [phaseIndex, setPhaseIndex] = useState(0);

  const phaseLabels = [
    t('ai.selecting_pieces'),
    t('ai.balancing_look'),
    t('ai.refining_outfit'),
  ];

  useEffect(() => {
    if (prefersReduced) return;
    const timer = setInterval(() => {
      setPhaseIndex(p => (p + 1) % phaseLabels.length);
    }, 1800);
    return () => clearInterval(timer);
  }, [prefersReduced, phaseLabels.length]);

  const isCompact = variant === 'compact';
  const slotSizeClass = isCompact ? 'w-12 h-14' : 'w-full aspect-[3/4]';
  const gridClass = isCompact ? 'grid-cols-4 gap-1.5' : 'grid-cols-2 gap-2';

  return (
    <div className={cn(
      'rounded-2xl bg-foreground/[0.02] border border-border/30 p-4 space-y-3',
      className,
    )}>
      {/* Phase text — cycles every 1.8s */}
      <div className="h-5 relative flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={phaseIndex}
            initial={prefersReduced ? undefined : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: EASE_CURVE }}
            className="text-[15px] font-body text-muted-foreground text-center absolute inset-x-0"
          >
            {phaseLabels[phaseIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Slot cards — stagger 120ms each */}
      <div className={cn('grid', gridClass)}>
        {SLOT_ICONS.map((SlotIcon, i) => (
          <motion.div
            key={SLOT_KEYS[i]}
            initial={prefersReduced ? undefined : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.12, duration: 0.3, ease: EASE_CURVE }}
            className={cn(
              'rounded-xl bg-foreground/[0.03] border border-border/10 flex items-center justify-center',
              slotSizeClass,
            )}
          >
            {prefersReduced ? (
              <SlotIcon className="w-5 h-5 text-foreground/20" />
            ) : (
              <motion.div
                animate={{ opacity: [0.15, 0.4, 0.15] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <SlotIcon className="w-5 h-5 text-foreground" />
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Three-dot cycling indicator — CSS animation only */}
      <div className="flex items-center justify-center gap-2 pt-1">
        <span className={cn('w-1.5 h-1.5 rounded-full bg-foreground', !prefersReduced ? 'dot-cycle-1' : 'opacity-20')} />
        <span className={cn('w-1.5 h-1.5 rounded-full bg-foreground', !prefersReduced ? 'dot-cycle-2' : 'opacity-20')} />
        <span className={cn('w-1.5 h-1.5 rounded-full bg-foreground', !prefersReduced ? 'dot-cycle-3' : 'opacity-20')} />
      </div>
      <p
        data-testid="ai-loading-card"
        className="text-center text-sm text-muted-foreground/70 font-['DM_Sans'] px-4"
      >
        {subtitle}
      </p>
    </div>
  );
}
