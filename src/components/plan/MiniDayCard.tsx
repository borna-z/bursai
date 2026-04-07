import { format, isToday, isTomorrow } from 'date-fns';
import { Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { WeatherForecastBadge } from '@/components/outfit/WeatherForecastBadge';
import { useLanguage } from '@/contexts/LanguageContext';
import { getBCP47 } from '@/lib/dateLocale';
import type { PlannedOutfit } from '@/hooks/usePlannedOutfits';

interface MiniDayCardProps {
  date: Date;
  plannedOutfit: PlannedOutfit | null;
  isSelected: boolean;
  onClick: () => void;
}

export function MiniDayCard({ date, plannedOutfit, isSelected, onClick }: MiniDayCardProps) {
  const { t, locale } = useLanguage();
  const dateStr = format(date, 'yyyy-MM-dd');
  const outfit = plannedOutfit?.outfit;
  const hasOutfit = !!outfit;
  const isWorn = plannedOutfit?.status === 'worn';

  let dateLabel = date.toLocaleDateString(getBCP47(locale), { weekday: 'long', day: 'numeric', month: 'short' });
  if (isToday(date)) dateLabel = t('plan.today');
  else if (isTomorrow(date)) dateLabel = t('plan.tomorrow');

  return (
    <Card
      onClick={onClick}
      className={cn(
        'surface-secondary rounded-[1.25rem] cursor-pointer transition-all duration-200 p-3 hover:shadow-md hover:border-accent/30',
        isSelected && 'ring-2 ring-accent shadow-md bg-accent/5',
        !hasOutfit && 'border-dashed',
        isWorn && 'opacity-60'
      )}
    >
      {/* Top row: date + weather */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Calendar className={cn(
            'w-3.5 h-3.5',
            isToday(date) ? 'text-accent' : 'text-muted-foreground'
          )} />
          <span className={cn(
            'text-sm font-medium capitalize',
            isToday(date) && 'text-accent',
            isSelected && 'font-semibold'
          )}>
            {dateLabel}
          </span>
          {isWorn && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-accent/10 text-accent">
              {t('plan.used_badge')}
            </Badge>
          )}
        </div>
        <WeatherForecastBadge date={dateStr} compact />
      </div>

      {/* Color swatch dots when outfit is planned */}
      {hasOutfit && (
        <div className="flex items-center gap-1.5 mt-1">
          {outfit.outfit_items.slice(0, 2).map((item, i) => (
            <div
              key={i}
              style={{
                width: 8, height: 8,
                borderRadius: '50%',
                backgroundColor: item.garment?.color_primary || '#EDE8DF',
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
