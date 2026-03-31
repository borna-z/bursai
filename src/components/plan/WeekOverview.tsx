import { useMemo } from 'react';
import { addDays, format, isSameDay, isToday } from 'date-fns';

import { useLanguage } from '@/contexts/LanguageContext';
import type { PlannedOutfit } from '@/hooks/usePlannedOutfits';
import { hapticLight } from '@/lib/haptics';
import { formatLocalizedDate } from '@/lib/dateLocale';
import { cn } from '@/lib/utils';

interface WeekOverviewProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  plannedOutfits: PlannedOutfit[];
  className?: string;
}

export function WeekOverview({ selectedDate, onSelectDate, plannedOutfits, className }: WeekOverviewProps) {
  const { locale } = useLanguage();

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, []);

  return (
    <div className={cn('grid grid-cols-7 gap-1.5', className)}>
      {days.map((date, idx) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const isSelected = isSameDay(date, selectedDate);
        const isTodayDate = isToday(date);
        const hasOutfit = plannedOutfits.some((planned) => planned.date === dateStr && planned.outfit_id);

        return (
          <button
            key={dateStr}
            type="button"
            onClick={() => {
              hapticLight();
              onSelectDate(date);
            }}
            className={cn(
              'flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[0.95rem] border transition-colors cursor-pointer',
              isSelected
                ? 'border-accent bg-accent text-accent-foreground'
                : isTodayDate
                  ? 'border-accent/35 bg-card text-foreground'
                  : 'border-border/65 bg-background/78 text-foreground',
            )}
          >
            <span className={cn(
              'text-[8px] font-semibold uppercase tracking-[0.14em]',
              isSelected ? 'text-background/65' : 'text-muted-foreground/55',
            )}>
              {formatLocalizedDate(date, locale, { weekday: 'short' }).charAt(0)}
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
          </button>
        );
      })}
    </div>
  );
}
