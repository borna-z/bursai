import { Calendar, Briefcase, PartyPopper, Heart, Dumbbell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { inferOccasionFromEvent, type CalendarEvent } from '@/hooks/useCalendarSync';

interface CalendarEventBadgeProps {
  event: CalendarEvent;
  className?: string;
}

const occasionIcons: Record<string, React.ElementType> = {
  jobb: Briefcase,
  fest: PartyPopper,
  dejt: Heart,
  traning: Dumbbell,
};

const occasionColors: Record<string, string> = {
  jobb: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  fest: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  dejt: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20',
  traning: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20',
};

export function CalendarEventBadge({ event, className }: CalendarEventBadgeProps) {
  const inferred = inferOccasionFromEvent(event.title);
  const Icon = inferred ? occasionIcons[inferred.occasion] || Calendar : Calendar;
  const colorClass = inferred ? occasionColors[inferred.occasion] : '';

  // Format time display
  const timeDisplay = event.start_time 
    ? event.start_time.slice(0, 5) // HH:mm
    : null;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'text-xs font-normal gap-1.5 py-1',
        colorClass,
        className
      )}
    >
      <Icon className="w-3 h-3 flex-shrink-0" />
      {timeDisplay && (
        <span className="text-muted-foreground">{timeDisplay}</span>
      )}
      <span className="truncate max-w-[150px]">{event.title}</span>
    </Badge>
  );
}

interface CalendarEventsListProps {
  events: CalendarEvent[];
  maxDisplay?: number;
  className?: string;
}

export function CalendarEventsList({ events, maxDisplay = 3, className }: CalendarEventsListProps) {
  if (!events || events.length === 0) return null;

  const displayEvents = events.slice(0, maxDisplay);
  const remaining = events.length - maxDisplay;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {displayEvents.map((event) => (
        <CalendarEventBadge key={event.id} event={event} />
      ))}
      {remaining > 0 && (
        <Badge variant="secondary" className="text-xs">
          +{remaining} till
        </Badge>
      )}
    </div>
  );
}
