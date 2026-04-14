import { X, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { hapticLight } from '@/lib/haptics';
import { EASE_CURVE } from '@/lib/motion';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

interface RefineBannerProps {
  garments: GarmentBasic[];
  onStopRefining: () => void;
}

export function RefineBanner({ garments, onStopRefining }: RefineBannerProps) {
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ type: 'tween', ease: EASE_CURVE, duration: 0.25 }}
      className="mx-[var(--page-px)]"
    >
      <div className="flex items-center gap-2.5 rounded-[1rem] border border-accent/20 bg-accent/[0.04] px-3 py-2">
        <Sparkles className="h-3.5 w-3.5 text-accent/60 shrink-0" />
        <div className="flex items-center gap-1 overflow-x-auto">
          {garments.slice(0, 4).map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25, delay: i * 0.04 }}
              className="h-7 w-7 shrink-0 overflow-hidden rounded-[0.5rem] border border-accent/20"
            >
              <LazyImageSimple
                imagePath={getPreferredGarmentImagePath(g)}
                alt={g.title}
                className="h-full w-full object-cover"
              />
            </motion.div>
          ))}
        </div>
        <span className="text-[11px] font-body font-medium text-accent/60 whitespace-nowrap tracking-wide uppercase">
          {t('chat.refining_look')}
        </span>
        <button
          onClick={() => { hapticLight(); onStopRefining(); }}
          className="ml-auto shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-foreground/30 hover:text-foreground/60 hover:bg-foreground/5 active:scale-90 transition-all"
          aria-label={t('chat.stop_refining')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
