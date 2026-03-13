import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { type OutfitWithItems } from '@/hooks/useOutfits';
import { useForecast } from '@/hooks/useForecast';
import { useLocation } from '@/contexts/LocationContext';
import { EmptyState } from '@/components/layout/EmptyState';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { WeatherForecastBadge } from '@/components/outfit/WeatherForecastBadge';
import { useLanguage } from '@/contexts/LanguageContext';
import { getBCP47 } from '@/lib/dateLocale';
import { isToday, isTomorrow } from 'date-fns';
import { getOccasionLabel } from '@/lib/occasionLabel';

interface PlannedGroup {
  label: string;
  date: string;
  outfits: OutfitWithItems[];
}

interface PlannedOutfitCardProps {
  outfit: OutfitWithItems;
  onDelete: (id: string) => void;
}

function PlannedOutfitCard({ outfit, onDelete }: PlannedOutfitCardProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const plannedFor = (outfit as any).planned_for;
  const weather = (outfit as any).weather as { temp?: number } | null;

  const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all overflow-hidden active:scale-[0.99] animate-drape-in opacity-0 [animation-fill-mode:both]"
      onClick={() => navigate(`/outfits/${outfit.id}`)}
    >
      <div className="flex h-20 bg-muted/30">
        {outfit.outfit_items.slice(0, 4).map((item, index) => (
          <div key={item.id} className={cn("flex-1 overflow-hidden", index < outfit.outfit_items.slice(0, 4).length - 1 && "border-r border-background")}>
            <LazyImageSimple imagePath={item.garment?.image_path} alt={item.garment?.title || item.slot} className="w-full h-full" />
          </div>
        ))}
        {outfit.outfit_items.length > 4 && (
          <div className="w-10 flex items-center justify-center bg-muted/50 text-xs text-muted-foreground">+{outfit.outfit_items.length - 4}</div>
        )}
      </div>

      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="capitalize text-xs">{getOccasionLabel(outfit.occasion, t)}</Badge>
              {outfit.rating && (
                <div className="flex items-center gap-0.5 text-sm text-muted-foreground">
                  <Star className="w-3 h-3 fill-primary text-primary" />{outfit.rating}
                </div>
              )}
            </div>
            {outfit.explanation && (<p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{outfit.explanation}</p>)}
            {plannedFor && (
              <div className="mt-2"><WeatherForecastBadge date={plannedFor} compact originalTemp={weather?.temp} /></div>
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('outfits.delete_confirm')}</AlertDialogTitle>
                <AlertDialogDescription>{t('outfits.delete_warning')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onDelete(outfit.id)}>
                  {t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

interface PlannedOutfitsListProps {
  outfits: OutfitWithItems[];
  onDelete: (id: string) => void;
}

export function PlannedOutfitsList({ outfits, onDelete }: PlannedOutfitsListProps) {
  const { effectiveCity } = useLocation();
  const { t, locale } = useLanguage();
  const { getForecastForDate } = useForecast({ city: effectiveCity });
  
  const groupedByDate = useMemo(() => {
    const groups: PlannedGroup[] = [];
    const sorted = [...outfits].sort((a, b) => {
      const dateA = (a as any).planned_for;
      const dateB = (b as any).planned_for;
      return dateA.localeCompare(dateB);
    });
    
    sorted.forEach((outfit) => {
      const dateStr = (outfit as any).planned_for;
      const date = new Date(dateStr);
      
      let label = date.toLocaleDateString(getBCP47(locale), { weekday: 'long', day: 'numeric', month: 'long' });
      if (isToday(date)) { label = t('plan.today'); }
      else if (isTomorrow(date)) { label = t('plan.tomorrow'); }
      
      const existing = groups.find(g => g.date === dateStr);
      if (existing) { existing.outfits.push(outfit); }
      else { groups.push({ label, date: dateStr, outfits: [outfit] }); }
    });
    
    return groups;
  }, [outfits, t]);

  if (outfits.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title={t('plan.no_planned')}
        description={t('plan.plan_via_calendar')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {groupedByDate.map((group) => (
        <div key={group.date} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm capitalize">{group.label}</h3>
            </div>
            <WeatherForecastBadge date={group.date} compact />
          </div>
          <div className="space-y-3 pl-6 stagger-drape">
            {group.outfits.map((outfit) => (
              <PlannedOutfitCard key={outfit.id} outfit={outfit} onDelete={onDelete} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
