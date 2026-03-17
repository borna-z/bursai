import { format, isToday, isTomorrow } from 'date-fns';
import { Calendar, Briefcase, PartyPopper, Heart, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { WeatherForecastBadge } from '@/components/outfit/WeatherForecastBadge';
import { useLanguage } from '@/contexts/LanguageContext';
import { getBCP47 } from '@/lib/dateLocale';
import type { PlannedOutfit } from '@/hooks/usePlannedOutfits';

const occasionIcons: Record<string, React.ElementType> = {
  jobb: Briefcase,
  fest: PartyPopper,
  dejt: Heart,
};

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

  const OccasionIcon = outfit?.occasion ? occasionIcons[outfit.occasion] || Calendar : null;

  return (
    <Card
      onClick={onClick}
      className={cn(
        'glass-card cursor-pointer transition-all duration-200 p-3 hover:shadow-md hover:border-accent/30',
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

      {/* Outfit thumbnails or empty state */}
      {hasOutfit ? (
        <div className="flex items-center gap-2">
          <div className="flex h-10 flex-1 rounded-md overflow-hidden bg-muted/30">
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
          {OccasionIcon && (
            <Badge variant="outline" className="text-[10px] capitalize shrink-0">
              <OccasionIcon className="w-3 h-3 mr-0.5" />
              {t(`occasion.${outfit.occasion}`)}
            </Badge>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-10 flex-1 rounded-md border border-dashed flex items-center justify-center">
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span className="text-xs">{t('plan.no_outfit_label')}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
