import { useMemo } from 'react';
import { format, addDays, isSameDay, isToday } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Check, CalendarDays } from 'lucide-react';
import type { PlannedOutfit } from '@/hooks/usePlannedOutfits';

interface WeekStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  plannedOutfits: PlannedOutfit[];
}

export function WeekStrip({ selectedDate, onSelectDate, plannedOutfits }: WeekStripProps) {
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
    <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
      {days.map((date) => {
        const isSelected = isSameDay(date, selectedDate);
        const isTodayDate = isToday(date);
        const status = getPlannedStatus(date);
        
        return (
          <button
            key={date.toISOString()}
            onClick={() => onSelectDate(date)}
            className={cn(
              'flex flex-col items-center min-w-[52px] py-2 px-2.5 rounded-xl transition-all active:scale-95',
              isSelected 
                ? 'bg-primary text-primary-foreground shadow-md' 
                : 'bg-muted/50 hover:bg-muted',
              isTodayDate && !isSelected && 'ring-2 ring-primary/30'
            )}
          >
            <span className={cn(
              'text-[10px] uppercase font-medium',
              isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
            )}>
              {format(date, 'EEE', { locale: sv })}
            </span>
            <span className={cn(
              'text-lg font-semibold leading-tight mt-0.5',
              isSelected ? 'text-primary-foreground' : 'text-foreground'
            )}>
              {format(date, 'd')}
            </span>
            <div className="h-4 flex items-center justify-center mt-0.5">
              {status === 'worn' ? (
                <Check className={cn(
                  'w-3.5 h-3.5',
                  isSelected ? 'text-primary-foreground' : 'text-green-500'
                )} />
              ) : status === 'planned' ? (
                <CalendarDays className={cn(
                  'w-3.5 h-3.5',
                  isSelected ? 'text-primary-foreground/80' : 'text-primary'
                )} />
              ) : (
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isSelected ? 'bg-primary-foreground/30' : 'bg-muted-foreground/20'
                )} />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
