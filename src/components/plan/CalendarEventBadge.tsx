import { Calendar, Briefcase, PartyPopper, Heart, Dumbbell, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { inferOccasionFromEvent, type CalendarEvent } from '@/hooks/useCalendarSync';

function MiniGoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335"/>
    </svg>
  );
}

export function ProviderIcon({ provider, className }: { provider: string | null; className?: string }) {
  if (provider === 'google') return <MiniGoogleIcon className={cn('w-3 h-3 flex-shrink-0', className)} />;
  return <Link2 className={cn('w-3 h-3 flex-shrink-0 text-muted-foreground', className)} />;
}

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

  const timeDisplay = event.start_time 
    ? event.start_time.slice(0, 5)
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
      <ProviderIcon provider={event.provider} className="w-2.5 h-2.5 opacity-50" />
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
