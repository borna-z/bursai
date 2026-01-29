import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, Star, Calendar, Trash2, Clock, Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useOutfits, useDeleteOutfit, useUpdateOutfit, type OutfitWithItems } from '@/hooks/useOutfits';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { toast } from 'sonner';
import { format, isToday, isTomorrow, addDays, startOfDay } from 'date-fns';
import { sv } from 'date-fns/locale';

function OutfitCard({ outfit, onDelete, showPlannedDate }: { 
  outfit: OutfitWithItems; 
  onDelete: (id: string) => void;
  showPlannedDate?: boolean;
}) {
  const navigate = useNavigate();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const plannedFor = (outfit as any).planned_for;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all overflow-hidden active:scale-[0.99] animate-fade-in"
      onClick={() => navigate(`/outfits/${outfit.id}`)}
    >
      {/* Preview images row */}
      <div className="flex h-24 bg-muted/30">
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
          <div className="w-12 flex items-center justify-center bg-muted/50 text-xs text-muted-foreground">
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
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                {outfit.explanation}
              </p>
            )}

            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {showPlannedDate && plannedFor && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(plannedFor), 'd MMM', { locale: sv })}
                </span>
              )}
              {!showPlannedDate && outfit.worn_at && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(outfit.worn_at), 'd MMM', { locale: sv })}
                </span>
              )}
            </div>
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

// Group planned outfits by date
interface PlannedGroup {
  label: string;
  date: string;
  outfits: OutfitWithItems[];
}

function PlannedOutfitsList({ outfits, onDelete }: { 
  outfits: OutfitWithItems[]; 
  onDelete: (id: string) => void;
}) {
  const updateOutfit = useUpdateOutfit();
  
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

  const handleToggleReminder = async (outfit: OutfitWithItems) => {
    const hasReminder = (outfit as any).planned_reminder;
    try {
      await updateOutfit.mutateAsync({
        id: outfit.id,
        updates: { planned_reminder: !hasReminder } as any,
      });
      toast.success(hasReminder ? 'Påminnelse av' : 'Påminnelse på');
    } catch {
      toast.error('Kunde inte uppdatera');
    }
  };

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
      {groupedByDate.map((group) => (
        <div key={group.date} className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm capitalize">{group.label}</h3>
          </div>
          <div className="space-y-3 pl-6">
            {group.outfits.map((outfit) => (
              <div key={outfit.id} className="relative">
                <OutfitCard outfit={outfit} onDelete={onDelete} />
                {/* Reminder toggle - Coming soon */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-14 right-2 h-6 w-6 opacity-60 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.info('Påminnelser kommer snart!');
                  }}
                >
                  <Bell className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OutfitsPage() {
  const navigate = useNavigate();
  const { data: outfits, isLoading } = useOutfits(false);
  const deleteOutfit = useDeleteOutfit();
  const [activeTab, setActiveTab] = useState('recent');

  const handleDeleteOutfit = (id: string) => {
    deleteOutfit.mutate(id, {
      onSuccess: () => {
        toast.success('Raderad');
      },
      onError: () => {
        toast.error('Kunde inte radera');
      },
    });
  };

  const { recentOutfits, savedOutfits, plannedOutfits } = useMemo(() => {
    if (!outfits) return { recentOutfits: [], savedOutfits: [], plannedOutfits: [] };
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    const planned = outfits.filter((o: any) => o.planned_for && o.planned_for >= today);
    const saved = outfits.filter(o => o.saved);
    const recent = [...outfits]
      .sort((a, b) => new Date(b.generated_at || 0).getTime() - new Date(a.generated_at || 0).getTime())
      .slice(0, 10);
    
    return { 
      recentOutfits: recent, 
      savedOutfits: saved, 
      plannedOutfits: planned 
    };
  }, [outfits]);

  return (
    <AppLayout>
      <PageHeader 
        title="Outfits"
        actions={
          <Button size="sm" onClick={() => navigate('/')} className="active:animate-press">
            <Sparkles className="w-4 h-4 mr-1.5" />
            Ny
          </Button>
        }
      />
      
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : outfits && outfits.length > 0 ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="recent" className="text-sm">
                Senaste
              </TabsTrigger>
              <TabsTrigger value="saved" className="text-sm">
                Sparade ({savedOutfits.length})
              </TabsTrigger>
              <TabsTrigger value="planned" className="text-sm">
                Planerade ({plannedOutfits.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="recent" className="space-y-3 mt-0">
              {recentOutfits.length > 0 ? (
                recentOutfits.map((outfit) => (
                  <OutfitCard key={outfit.id} outfit={outfit} onDelete={handleDeleteOutfit} />
                ))
              ) : (
                <EmptyState
                  icon={Sparkles}
                  title="Inga outfits"
                  description="Skapa din första!"
                  action={{
                    label: 'Skapa',
                    onClick: () => navigate('/'),
                    icon: Sparkles
                  }}
                />
              )}
            </TabsContent>

            <TabsContent value="saved" className="space-y-3 mt-0">
              {savedOutfits.length > 0 ? (
                savedOutfits.map((outfit) => (
                  <OutfitCard key={outfit.id} outfit={outfit} onDelete={handleDeleteOutfit} />
                ))
              ) : (
                <EmptyState
                  icon={Star}
                  title="Inga sparade"
                  description="Spara favoriter med bokmärket."
                />
              )}
            </TabsContent>

            <TabsContent value="planned" className="mt-0">
              <PlannedOutfitsList 
                outfits={plannedOutfits} 
                onDelete={handleDeleteOutfit} 
              />
            </TabsContent>
          </Tabs>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="Inga outfits"
            description="Låt AI:n matcha dina plagg!"
            action={{
              label: 'Skapa',
              onClick: () => navigate('/'),
              icon: Sparkles
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
