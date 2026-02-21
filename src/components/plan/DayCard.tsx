import { useNavigate } from 'react-router-dom';
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
import { useLanguage } from '@/contexts/LanguageContext';
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

const OCCASION_I18N: Record<string, string> = {
  jobb: 'occasion.jobb',
  vardag: 'occasion.vardag',
  fest: 'occasion.fest',
  resa: 'occasion.resa',
  traning: 'occasion.traning',
  dejt: 'occasion.dejt',
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
  const { t } = useLanguage();
  const dateStr = format(date, 'yyyy-MM-dd');
  const outfit = plannedOutfit?.outfit;
  const hasOutfit = !!outfit;
  const isWorn = plannedOutfit?.status === 'worn';

  const { data: daySummary, isLoading: isSummaryLoading } = useDaySummary(dateStr);

  let dateLabel = date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
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
            <h3 className={cn('font-semibold text-sm capitalize', isToday(date) && 'text-primary')}>
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

        <DaySummaryCard summary={daySummary} isLoading={isSummaryLoading} onGenerateFromHint={() => onQuickGenerate()} compact className="mb-3" />

        {hasOutfit ? (
          <>
            <div 
              className="flex h-16 rounded-lg overflow-hidden bg-muted/30 cursor-pointer mb-3 active:scale-[0.99] transition-transform"
              onClick={() => navigate(`/outfits/${outfit.id}`)}
            >
              {outfit.outfit_items.slice(0, 4).map((item, index) => (
                <div key={item.id} className={cn("flex-1 overflow-hidden", index < outfit.outfit_items.slice(0, 4).length - 1 && "border-r border-background")}>
                  <LazyImageSimple imagePath={item.garment?.image_path} alt={item.garment?.title || item.slot} className="w-full h-full" />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant="secondary" className="capitalize text-xs">
                <OccasionIcon className="w-3 h-3 mr-1" />{t(OCCASION_I18N[outfit.occasion?.toLowerCase()] || `occasion.${outfit.occasion}`)}
              </Badge>
              {outfit.style_vibe && (<Badge variant="outline" className="text-xs">{outfit.style_vibe}</Badge>)}
            </div>

            {outfit.explanation && (<p className="text-xs text-muted-foreground line-clamp-1 mb-3">{outfit.explanation}</p>)}

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onSwap} className="flex-1">
                <Repeat className="w-3.5 h-3.5 mr-1.5" />{t('plan.swap')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/outfits/${outfit.id}`)}>
                <Info className="w-3.5 h-3.5 mr-1.5" />{t('plan.details')}
              </Button>
            </div>

            <div className="flex items-center gap-3 mt-2 pt-2 border-t">
              {!isWorn && (
                <button onClick={onMarkWorn} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  <Check className="w-3 h-3" />{t('plan.mark_worn')}
                </button>
              )}
              <button onClick={onRemove} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors ml-auto">
                <Trash2 className="w-3 h-3" />{t('plan.remove')}
              </button>
            </div>
          </>
        ) : (
          <>
            {!daySummary && (<p className="text-sm text-muted-foreground mb-4">{t('plan.no_outfit')}</p>)}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={onPlan} disabled={isLoading} className="flex-1">
                <Plus className="w-3.5 h-3.5 mr-1.5" />{t('plan.plan')}
              </Button>
              <Button variant="outline" size="sm" onClick={onQuickGenerate} disabled={isLoading} className="flex-1">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />{t('plan.generate')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
