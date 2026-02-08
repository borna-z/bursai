import { useNavigate } from 'react-router-dom';
import { format, isToday, isTomorrow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Calendar, Repeat, Info, Check, Trash2, Plus, Sparkles, Briefcase, PartyPopper, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { WeatherForecastBadge } from '@/components/outfit/WeatherForecastBadge';
import { CalendarEventsList } from '@/components/plan/CalendarEventBadge';
import { useCalendarEvents } from '@/hooks/useCalendarSync';
import type { PlannedOutfit } from '@/hooks/usePlannedOutfits';

interface DayCardProps {
  date: Date;
  plannedOutfit: PlannedOutfit | null;
  onPlan: () => void;
  onQuickGenerate: () => void;
  onSwap: () => void;
  onMarkWorn: () => void;
  onRemove: () => void;
  isLoading?: boolean;
}

const occasionIcons: Record<string, React.ElementType> = {
  jobb: Briefcase,
  fest: PartyPopper,
  dejt: Heart,
};

export function DayCard({
  date,
  plannedOutfit,
  onPlan,
  onQuickGenerate,
  onSwap,
  onMarkWorn,
  onRemove,
  isLoading,
}: DayCardProps) {
  const navigate = useNavigate();
  const dateStr = format(date, 'yyyy-MM-dd');
  const outfit = plannedOutfit?.outfit;
  const hasOutfit = !!outfit;
  const isWorn = plannedOutfit?.status === 'worn';

  // Fetch calendar events for this date
  const { data: calendarEvents } = useCalendarEvents(dateStr);

  // Format date label
  let dateLabel = format(date, 'EEEE d MMMM', { locale: sv });
  if (isToday(date)) {
    dateLabel = 'Idag';
  } else if (isTomorrow(date)) {
    dateLabel = 'Imorgon';
  }

  const OccasionIcon = outfit?.occasion ? occasionIcons[outfit.occasion] || Calendar : Calendar;

  return (
    <Card className={cn(
      'transition-all animate-fade-in',
      isWorn && 'opacity-60',
      !hasOutfit && 'border-dashed'
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className={cn(
              'w-4 h-4',
              isToday(date) ? 'text-primary' : 'text-muted-foreground'
            )} />
            <h3 className={cn(
              'font-semibold text-sm capitalize',
              isToday(date) && 'text-primary'
            )}>
              {dateLabel}
            </h3>
            {isWorn && (
              <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                Använd
              </Badge>
            )}
          </div>
          <WeatherForecastBadge date={dateStr} compact />
        </div>

        {/* Calendar Events */}
        {calendarEvents && calendarEvents.length > 0 && (
          <CalendarEventsList events={calendarEvents} className="mb-3" />
        )}

        {hasOutfit ? (
          <>
            {/* Outfit preview */}
            <div 
              className="flex h-16 rounded-lg overflow-hidden bg-muted/30 cursor-pointer mb-3 active:scale-[0.99] transition-transform"
              onClick={() => navigate(`/outfits/${outfit.id}`)}
            >
              {outfit.outfit_items.slice(0, 4).map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex-1 overflow-hidden",
                    index < outfit.outfit_items.slice(0, 4).length - 1 && "border-r border-background"
                  )}
                >
                  <LazyImageSimple
                    imagePath={item.garment?.image_path}
                    alt={item.garment?.title || item.slot}
                    className="w-full h-full"
                  />
                </div>
              ))}
            </div>

            {/* Tags row */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant="secondary" className="capitalize text-xs">
                <OccasionIcon className="w-3 h-3 mr-1" />
                {outfit.occasion}
              </Badge>
              {outfit.style_vibe && (
                <Badge variant="outline" className="text-xs">
                  {outfit.style_vibe}
                </Badge>
              )}
            </div>

            {/* Explanation */}
            {outfit.explanation && (
              <p className="text-xs text-muted-foreground line-clamp-1 mb-3">
                {outfit.explanation}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onSwap}
                className="flex-1 active:animate-press"
              >
                <Repeat className="w-3.5 h-3.5 mr-1.5" />
                Byt
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate(`/outfits/${outfit.id}`)}
                className="active:animate-press"
              >
                <Info className="w-3.5 h-3.5 mr-1.5" />
                Detaljer
              </Button>
            </div>

            {/* Secondary actions */}
            <div className="flex items-center gap-3 mt-2 pt-2 border-t">
              {!isWorn && (
                <button 
                  onClick={onMarkWorn}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <Check className="w-3 h-3" />
                  Markera som använd
                </button>
              )}
              <button 
                onClick={onRemove}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors ml-auto"
              >
                <Trash2 className="w-3 h-3" />
                Ta bort
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Empty state */}
            <p className="text-sm text-muted-foreground mb-4">
              Ingen outfit planerad.
            </p>

            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                onClick={onPlan}
                disabled={isLoading}
                className="flex-1 active:animate-press"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Planera
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onQuickGenerate}
                disabled={isLoading}
                className="flex-1 active:animate-press"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Skapa åt mig
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
