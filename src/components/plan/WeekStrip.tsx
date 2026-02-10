import { useMemo } from 'react';
import { format, addDays, isSameDay, isToday } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Check, CalendarDays, Briefcase, PartyPopper, Heart, Dumbbell } from 'lucide-react';
import type { PlannedOutfit } from '@/hooks/usePlannedOutfits';
import { useCalendarEventsRange, inferOccasionFromEvent, type CalendarEvent } from '@/hooks/useCalendarSync';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

const occasionIcons: Record<string, React.ElementType> = {
  jobb: Briefcase,
  fest: PartyPopper,
  dejt: Heart,
  traning: Dumbbell,
};

const occasionDotColors: Record<string, string> = {
  jobb: 'bg-blue-500',
  fest: 'bg-purple-500',
  dejt: 'bg-pink-500',
  traning: 'bg-green-500',
};

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

  const startDate = format(days[0], 'yyyy-MM-dd');
  const endDate = format(days[6], 'yyyy-MM-dd');
  const { data: calendarEvents = [] } = useCalendarEventsRange(startDate, endDate);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of calendarEvents) {
      if (!map[event.date]) map[event.date] = [];
      map[event.date].push(event);
    }
    return map;
  }, [calendarEvents]);

  const getPlannedStatus = (date: Date): 'planned' | 'worn' | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const planned = plannedOutfits.find(p => p.date === dateStr);
    if (!planned || !planned.outfit_id) return null;
    return planned.status === 'worn' ? 'worn' : 'planned';
  };

  // Get the top occasion from events for a date
  const getTopOccasion = (date: Date): { occasion: string; title: string } | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const events = eventsByDate[dateStr];
    if (!events?.length) return null;

    let best: { occasion: string; formality: number; title: string } | null = null;
    for (const event of events) {
      const inferred = inferOccasionFromEvent(event.title);
      if (inferred && (!best || inferred.formality > best.formality)) {
        best = { occasion: inferred.occasion, formality: inferred.formality, title: event.title };
      }
    }
    return best ? { occasion: best.occasion, title: best.title } : null;
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {days.map((date) => {
          const isSelected = isSameDay(date, selectedDate);
          const isTodayDate = isToday(date);
          const status = getPlannedStatus(date);
          const topOccasion = getTopOccasion(date);
          const dateStr = format(date, 'yyyy-MM-dd');
          const eventCount = eventsByDate[dateStr]?.length || 0;

          const button = (
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
              <div className="h-4 flex items-center justify-center mt-0.5 gap-0.5">
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
                ) : topOccasion ? (
                  (() => {
                    const Icon = occasionIcons[topOccasion.occasion];
                    return Icon ? (
                      <Icon className={cn(
                        'w-3.5 h-3.5',
                        isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      )} />
                    ) : (
                      <div className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        isSelected ? 'bg-primary-foreground/50' : occasionDotColors[topOccasion.occasion] || 'bg-accent'
                      )} />
                    );
                  })()
                ) : eventCount > 0 ? (
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    isSelected ? 'bg-primary-foreground/50' : 'bg-accent-foreground/40'
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

          // Wrap in tooltip if there are calendar events
          if (eventCount > 0) {
            const events = eventsByDate[dateStr];
            return (
              <Tooltip key={date.toISOString()}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  {events.slice(0, 3).map(e => (
                    <div key={e.id} className="truncate">{e.start_time?.slice(0, 5)} {e.title}</div>
                  ))}
                  {events.length > 3 && <div className="text-muted-foreground">+{events.length - 3} till</div>}
                </TooltipContent>
              </Tooltip>
            );
          }

          return button;
        })}
      </div>
    </TooltipProvider>
  );
}
