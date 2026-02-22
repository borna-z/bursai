import { useMemo } from 'react';
import { format, addDays, isSameDay, isToday } from 'date-fns';
import { motion } from 'framer-motion';
import { SPRING_BOUNCE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDateFnsLocale } from '@/lib/dateLocale';
import type { PlannedOutfit } from '@/hooks/usePlannedOutfits';

interface WeekStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  plannedOutfits: PlannedOutfit[];
}

export function WeekStrip({ selectedDate, onSelectDate, plannedOutfits }: WeekStripProps) {
  const { locale } = useLanguage();
  const dfLocale = getDateFnsLocale(locale);
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, []);

  const getPlannedStatus = (date: Date): 'planned' | 'worn' | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const planned = plannedOutfits.find(p => p.date === dateStr);
    if (!planned || !planned.outfit_id) return null;
    return planned.status === 'worn' ? 'worn' : 'planned';
  };

  return (
    <div className="flex gap-1.5 justify-between">
      {days.map((date) => {
        const isSelected = isSameDay(date, selectedDate);
        const isTodayDate = isToday(date);
        const status = getPlannedStatus(date);

        return (
          <motion.button
            key={date.toISOString()}
            onClick={() => onSelectDate(date)}
            animate={isSelected ? { scale: 1.1 } : { scale: 1 }}
            transition={SPRING_BOUNCE}
            className={cn(
              'flex flex-col items-center flex-1 py-2.5 px-1 rounded-xl transition-all duration-200',
              'active:scale-95',
              isSelected
                ? 'bg-foreground text-background shadow-sm'
                : 'hover:bg-muted/60',
              isTodayDate && !isSelected && 'ring-1 ring-foreground/15'
            )}
          >
            <span className={cn(
              'text-[10px] uppercase font-medium tracking-wide',
              isSelected ? 'text-background/70' : 'text-muted-foreground'
            )}>
              {format(date, 'EEE', { locale: dfLocale }).slice(0, 2)}
            </span>
            <span className={cn(
              'text-base font-semibold leading-tight mt-0.5',
              isSelected ? 'text-background' : status === 'worn' ? 'text-success' : status === 'planned' ? 'text-accent' : 'text-foreground'
            )}>
              {format(date, 'd')}
            </span>
            {/* Minimal dot indicator */}
            <div className="h-1.5 mt-1 flex items-center justify-center">
              {status === 'worn' ? (
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isSelected ? 'bg-background/50' : 'bg-success'
                )} />
              ) : status === 'planned' ? (
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isSelected ? 'bg-background/50' : 'bg-accent'
                )} />
              ) : null}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
