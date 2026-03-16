import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gem, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EASE_CURVE } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import type { Garment } from '@/hooks/useInsights';

interface UnusedGemBannerProps {
  unusedGarments: Garment[];
  className?: string;
}

/**
 * Resurfaces a forgotten garment on the home screen.
 * Picks one based on day-of-year for daily consistency.
 */
export function UnusedGemBanner({ unusedGarments, className }: UnusedGemBannerProps) {
  const navigate = useNavigate();

  const gem = useMemo(() => {
    if (!unusedGarments.length) return null;
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
    );
    return unusedGarments[dayOfYear % unusedGarments.length];
  }, [unusedGarments]);

  if (!gem) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_CURVE }}
      onClick={() => { hapticLight(); navigate(`/wardrobe/${gem.id}`); }}
      className={cn(
        'w-full flex items-center gap-3.5 p-3 rounded-xl',
        'surface-interactive text-left',
        'active:scale-[0.98] transition-transform',
        className,
      )}
    >
      <div className="w-11 h-11 rounded-lg overflow-hidden bg-muted shrink-0">
        <LazyImageSimple imagePath={gem.image_path} alt={gem.title} className="w-full h-full" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Gem className="w-3 h-3 text-primary/60" />
          <span className="text-[10px] text-primary/60 font-medium uppercase tracking-wider">Forgotten gem</span>
        </div>
        <p className="text-[12px] text-foreground/80 truncate">
          Your <span className="font-medium">{gem.title}</span> hasn't been worn lately — worth revisiting?
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
    </motion.button>
  );
}
