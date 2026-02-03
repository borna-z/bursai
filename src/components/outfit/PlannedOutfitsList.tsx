import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Trash2, Star, Clock, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useUpdateOutfit, type OutfitWithItems } from '@/hooks/useOutfits';
import { useProfile } from '@/hooks/useProfile';
import { useForecast } from '@/hooks/useForecast';
import { EmptyState } from '@/components/layout/EmptyState';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { WeatherForecastBadge } from '@/components/outfit/WeatherForecastBadge';
import { toast } from 'sonner';
import { format, isToday, isTomorrow } from 'date-fns';
import { sv } from 'date-fns/locale';

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
  const plannedFor = (outfit as any).planned_for;
  const weather = (outfit as any).weather as { temp?: number } | null;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all overflow-hidden active:scale-[0.99] animate-fade-in"
      onClick={() => navigate(`/outfits/${outfit.id}`)}
    >
      {/* Preview images row */}
      <div className="flex h-20 bg-muted/30">
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
        {outfit.outfit_items.length > 4 && (
          <div className="w-10 flex items-center justify-center bg-muted/50 text-xs text-muted-foreground">
            +{outfit.outfit_items.length - 4}
          </div>
        )}
      </div>

      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="capitalize text-xs">
                {outfit.occasion}
              </Badge>
              {outfit.rating && (
                <div className="flex items-center gap-0.5 text-sm text-muted-foreground">
                  <Star className="w-3 h-3 fill-primary text-primary" />
                  {outfit.rating}
                </div>
              )}
            </div>
            
            {outfit.explanation && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">
                {outfit.explanation}
              </p>
            )}

            {/* Weather forecast for planned date */}
            {plannedFor && (
              <div className="mt-2">
                <WeatherForecastBadge 
                  date={plannedFor} 
                  compact 
                  originalTemp={weather?.temp}
                />
              </div>
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0 active:animate-press"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Radera?</AlertDialogTitle>
                <AlertDialogDescription>
                  Kan inte ångras.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => onDelete(outfit.id)}
                >
                  Radera
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
  const { data: profile } = useProfile();
  const { getForecastForDate } = useForecast({ homeCity: profile?.home_city });
  
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
      
      let label = format(date, 'EEEE d MMMM', { locale: sv });
      if (isToday(date)) {
        label = 'Idag';
      } else if (isTomorrow(date)) {
        label = 'Imorgon';
      }
      
      const existing = groups.find(g => g.date === dateStr);
      if (existing) {
        existing.outfits.push(outfit);
      } else {
        groups.push({ label, date: dateStr, outfits: [outfit] });
      }
    });
    
    return groups;
  }, [outfits]);

  if (outfits.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="Inga planerade"
        description="Planera outfits via datumväljaren."
      />
    );
  }

  return (
    <div className="space-y-6">
      {groupedByDate.map((group) => {
        const forecast = getForecastForDate(group.date);
        
        return (
          <div key={group.date} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm capitalize">{group.label}</h3>
              </div>
              {/* Weather in group header */}
              <WeatherForecastBadge date={group.date} compact />
            </div>
            <div className="space-y-3 pl-6">
              {group.outfits.map((outfit) => (
                <PlannedOutfitCard 
                  key={outfit.id} 
                  outfit={outfit} 
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
