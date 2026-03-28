import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { EASE_CURVE } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PlannedOutfit } from '@/hooks/usePlannedOutfits';

interface WeekPlanningNudgeProps {
  plannedOutfits: PlannedOutfit[];
  className?: string;
}

/**
 * Nudge shown when fewer than 3 of the next 7 days have planned outfits.
 */
export function WeekPlanningNudge({ plannedOutfits, className }: WeekPlanningNudgeProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const { planned } = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => format(addDays(today, i), 'yyyy-MM-dd'));
    const plannedDates = new Set(
      plannedOutfits.filter(p => p.outfit_id).map(p => p.date),
    );
    return {
      planned: days.filter(d => plannedDates.has(d)).length,
      total: 7,
    };
  }, [plannedOutfits]);

  // Only show when less than 3 days planned
  if (planned >= 3) return null;

  const message = planned === 0
    ? t('home.week_unplanned')
    : t('home.week_partial').replace('{count}', String(planned));

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: EASE_CURVE }}
      onClick={() => { hapticLight(); navigate('/plan'); }}
      className={cn(
        'w-full flex items-center gap-3.5 p-3 rounded-xl',
        'surface-interactive text-left',
        'active:scale-[0.98] transition-transform',
        className,
      )}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/8 shrink-0">
        <CalendarDays className="w-5 h-5 text-primary/60" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-foreground/80 leading-snug">{message}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
    </motion.button>
  );
}
