import { useMemo } from 'react';
import { format, addDays, isSameDay, isToday } from 'date-fns';
import { motion } from 'framer-motion';
import { SPRING_SUBTLE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatLocalizedDate } from '@/lib/dateLocale';
import type { PlannedOutfit } from '@/hooks/usePlannedOutfits';

interface WeekStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  plannedOutfits: PlannedOutfit[];
}

export function WeekStrip({ selectedDate, onSelectDate, plannedOutfits }: WeekStripProps) {
  const { locale } = useLanguage();
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, []);

  const getPlannedCount = (date: Date): { count: number; hasWorn: boolean } => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const planned = plannedOutfits.filter(p => p.date === dateStr && p.outfit_id);
    return {
      count: planned.length,
      hasWorn: planned.some(p => p.status === 'worn'),
    };
  };

  return (
    <div className="flex gap-2 justify-between">
      {days.map((date) => {
        const isSelected = isSameDay(date, selectedDate);
        const isTodayDate = isToday(date);
        const { count, hasWorn } = getPlannedCount(date);

        return (
          <motion.button
            key={date.toISOString()}
            onClick={() => onSelectDate(date)}
            animate={isSelected ? { scale: 1.08 } : { scale: 1 }}
            transition={SPRING_SUBTLE}
            className={cn(
              'flex flex-col items-center justify-center flex-1 min-h-[64px] py-3 px-1 rounded-[1.25rem] transition-all duration-200 active:scale-[0.96]',
              isSelected
                ? 'bg-foreground text-background shadow-[0_4px_12px_rgba(28,25,23,0.18)]'
                : 'hover:bg-muted/50',
              isTodayDate && !isSelected && 'ring-1 ring-foreground/20'
            )}
          >
            <span className={cn(
              'text-[10px] uppercase font-medium tracking-[0.08em]',
              isSelected ? 'text-background/70' : 'text-muted-foreground/60'
            )}>
              {formatLocalizedDate(date, locale, { weekday: 'short' }).slice(0, 2)}
            </span>
            <span className={cn(
              'text-[1rem] font-semibold tabular-nums leading-tight mt-0.5',
              isSelected ? 'text-background' : 'text-foreground'
            )}>
              {format(date, 'd')}
            </span>
            {count > 0 ? (
              <span className={cn(
                'mt-1 h-1.5 w-1.5 rounded-full',
                isSelected ? 'bg-background/60' : 'bg-foreground/40'
              )} />
            ) : (
              <span className="mt-1 h-1.5 w-1.5" />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
