import { useNavigate } from 'react-router-dom';
import { hapticLight, hapticSuccess, hapticHeavy } from '@/lib/haptics';
import { format, isToday, isTomorrow } from 'date-fns';
import { Calendar, Repeat, Info, Check, Trash2, Plus, Sparkles, Briefcase, PartyPopper, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { WeatherForecastBadge } from '@/components/outfit/WeatherForecastBadge';
import { DaySummaryCard } from '@/components/plan/DaySummaryCard';
import { useDaySummary } from '@/hooks/useDaySummary';
import { useCalendarEvents } from '@/hooks/useCalendarSync';
import { useLanguage } from '@/contexts/LanguageContext';
import { getBCP47 } from '@/lib/dateLocale';
import type { PlannedOutfit } from '@/hooks/usePlannedOutfits';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

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
  work: Briefcase, jobb: Briefcase,
  party: PartyPopper, fest: PartyPopper,
  date: Heart, dejt: Heart,
};

const OCCASION_I18N: Record<string, string> = {
  work: 'occasion.work', jobb: 'occasion.jobb',
  casual: 'occasion.casual', vardag: 'occasion.vardag',
  party: 'occasion.party', fest: 'occasion.fest',
  travel: 'occasion.travel', resa: 'occasion.resa',
  workout: 'occasion.workout', traning: 'occasion.traning',
  date: 'occasion.date', dejt: 'occasion.dejt',
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
  const { t, locale } = useLanguage();
  const dateStr = format(date, 'yyyy-MM-dd');
  const outfit = plannedOutfit?.outfit;
  const hasOutfit = !!outfit;
  const isWorn = plannedOutfit?.status === 'worn';

  const { data: daySummary, isLoading: isSummaryLoading } = useDaySummary(dateStr);
  const { data: calendarEvents = [] } = useCalendarEvents(dateStr);

  let dateLabel = date.toLocaleDateString(getBCP47(locale), { weekday: 'long', day: 'numeric', month: 'long' });
  if (isToday(date)) {
    dateLabel = t('plan.today');
  } else if (isTomorrow(date)) {
    dateLabel = t('plan.tomorrow');
  }

  const OccasionIcon = outfit?.occasion ? occasionIcons[outfit.occasion] || Calendar : Calendar;

  return (
    <Card className={cn(
      'glass-card transition-all animate-drape-in opacity-0 [animation-fill-mode:both]',
      isWorn && 'opacity-60',
      !hasOutfit && 'border-dashed'
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className={cn('w-4 h-4', isToday(date) ? 'text-primary' : 'text-muted-foreground')} />
            <h3 className={cn('font-bold text-[0.8125rem] tracking-[-0.01em] capitalize', isToday(date) && 'text-primary')}>
              {dateLabel}
            </h3>
            {isWorn && (
              <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                {t('plan.worn')}
              </Badge>
            )}
          </div>
          <WeatherForecastBadge date={dateStr} compact />
        </div>

        <DaySummaryCard summary={daySummary} isLoading={isSummaryLoading} onGenerateFromHint={() => onQuickGenerate()} compact className="mb-3" eventCount={calendarEvents.length} />

        {hasOutfit ? (
          <>
            {/* Garment thumbnail row */}
            <div
              className="flex gap-1 mb-3 cursor-pointer active:scale-[0.99] transition-transform"
              onClick={() => navigate(`/outfits/${outfit.id}`)}
            >
              {[0, 1, 2].map((index) => {
                const item = outfit.outfit_items[index];
                return (
                  <div
                    key={index}
                    style={{
                      width: 44, height: 44,
                      backgroundColor: '#EDE8DF',
                      borderRadius: 0,
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {item?.garment && (
                      <LazyImageSimple
                        imagePath={getPreferredGarmentImagePath(item.garment)}
                        alt={item.garment.title || item.slot}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant="secondary" className="capitalize text-xs">
                <OccasionIcon className="w-3 h-3 mr-1" />{t(OCCASION_I18N[outfit.occasion?.toLowerCase()] || `occasion.${outfit.occasion}`)}
              </Badge>
              {outfit.style_vibe && (<Badge variant="outline" className="text-xs">{outfit.style_vibe}</Badge>)}
            </div>

            {outfit.explanation && (<p className="text-[0.75rem] text-muted-foreground/70 line-clamp-1 mb-3 leading-relaxed">{outfit.explanation}</p>)}

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { hapticLight(); onSwap(); }} className="flex-1">
                <Repeat className="w-3.5 h-3.5 mr-1.5" />{t('plan.swap')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/outfits/${outfit.id}`)}>
                <Info className="w-3.5 h-3.5 mr-1.5" />{t('plan.details')}
              </Button>
            </div>

            <div className="flex items-center gap-3 mt-2 pt-2 border-t">
              {!isWorn && (
                <button onClick={() => { hapticSuccess(); onMarkWorn(); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  <Check className="w-3 h-3" />{t('plan.mark_worn')}
                </button>
              )}
              <button onClick={() => { hapticHeavy(); onRemove(); }} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors ml-auto">
                <Trash2 className="w-3 h-3" />{t('plan.remove')}
              </button>
            </div>
          </>
        ) : (
          <>
            {!daySummary && (<p className="text-sm text-muted-foreground mb-4">{t('plan.no_outfit')}</p>)}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => { hapticLight(); onPlan(); }} disabled={isLoading} className="flex-1">
                <Plus className="w-3.5 h-3.5 mr-1.5" />{t('plan.plan')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { hapticLight(); onQuickGenerate(); }} disabled={isLoading} className="flex-1">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />{t('plan.generate')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
