import { useMemo } from 'react';
import { addDays, format, isSameDay, isToday } from 'date-fns';
import { motion, useReducedMotion } from 'framer-motion';

import { useLanguage } from '@/contexts/LanguageContext';
import type { PlannedOutfit } from '@/hooks/usePlannedOutfits';
import { hapticLight } from '@/lib/haptics';
import { getDateFnsLocale } from '@/lib/dateLocale';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface WeekOverviewProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  plannedOutfits: PlannedOutfit[];
  className?: string;
}

export function WeekOverview({ selectedDate, onSelectDate, plannedOutfits, className }: WeekOverviewProps) {
  const { locale } = useLanguage();
  const prefersReduced = useReducedMotion();
  const dateLocale = getDateFnsLocale(locale);

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, []);

  return (
    <div className={cn('grid grid-cols-7 gap-2', className)}>
      {days.map((date, idx) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const isSelected = isSameDay(date, selectedDate);
        const isTodayDate = isToday(date);
        const hasOutfit = plannedOutfits.some((planned) => planned.date === dateStr && planned.outfit_id);

        return (
          <motion.button
            key={dateStr}
            type="button"
            onClick={() => {
              hapticLight();
              onSelectDate(date);
            }}
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: idx * STAGGER_DELAY, ease: EASE_CURVE }}
            className={cn(
              'flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-[1.1rem] border transition-colors cursor-pointer',
              isSelected
                ? 'border-foreground bg-foreground text-background shadow-[0_4px_12px_rgba(28,25,23,0.18)]'
                : isTodayDate
                  ? 'border-accent/40 bg-card text-foreground'
                  : 'border-border/40 bg-background/60 text-foreground',
            )}
          >
            <span className={cn(
              'text-[9px] font-semibold uppercase tracking-[0.16em]',
              isSelected ? 'text-background/65' : 'text-muted-foreground/55',
            )}>
              {format(date, 'EEE', { locale: dateLocale }).charAt(0)}
            </span>
            <span className="text-[1rem] font-semibold tracking-[-0.03em]">
              {format(date, 'd')}
            </span>
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                hasOutfit
                  ? isSelected
                    ? 'bg-background/70'
                    : 'bg-accent'
                  : 'bg-transparent',
              )}
            />
          </motion.button>
        );
      })}
    </div>
  );
}
