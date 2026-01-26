import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, Star, Calendar, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { useOutfits, useDeleteOutfit, type OutfitWithItems } from '@/hooks/useOutfits';
import { useStorage } from '@/hooks/useStorage';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { toast } from 'sonner';

function OutfitCard({ outfit, onDelete, showPlannedDate }: { 
  outfit: OutfitWithItems; 
  onDelete: (id: string) => void;
  showPlannedDate?: boolean;
}) {
  const navigate = useNavigate();
  const { getGarmentSignedUrl } = useStorage();
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    outfit.outfit_items.forEach((item) => {
      if (item.garment?.image_path) {
        getGarmentSignedUrl(item.garment.image_path)
          .then((url) => setImageUrls((prev) => ({ ...prev, [item.id]: url })))
          .catch(() => {});
      }
    });
  }, [outfit.outfit_items]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const plannedFor = (outfit as any).planned_for;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all overflow-hidden"
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
            {imageUrls[item.id] ? (
              <img
                src={imageUrls[item.id]}
                alt={item.garment?.title || item.slot}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <span className="text-[10px] text-muted-foreground capitalize">{item.slot}</span>
              </div>
            )}
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
            
            {/* Short explanation */}
            {outfit.explanation && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                {outfit.explanation}
              </p>
            )}

            {/* Date info */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {showPlannedDate && plannedFor && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(plannedFor).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                </span>
              )}
              {!showPlannedDate && outfit.worn_at && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Använd {new Date(outfit.worn_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Radera outfit?</AlertDialogTitle>
                <AlertDialogDescription>
                  Denna åtgärd kan inte ångras. Outfiten och dess kopplingar till plagg kommer att tas bort permanent.
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

export default function OutfitsPage() {
  const navigate = useNavigate();
  const { data: outfits, isLoading } = useOutfits(false); // Get all outfits
  const deleteOutfit = useDeleteOutfit();
  const [activeTab, setActiveTab] = useState('recent');

  const handleDeleteOutfit = (id: string) => {
    deleteOutfit.mutate(id, {
      onSuccess: () => {
        toast.success('Outfit raderad');
      },
      onError: () => {
        toast.error('Kunde inte radera outfit');
      },
    });
  };

  // Categorize outfits
  const { recentOutfits, savedOutfits, plannedOutfits } = useMemo(() => {
    if (!outfits) return { recentOutfits: [], savedOutfits: [], plannedOutfits: [] };
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Planned: has planned_for date in the future
    const planned = outfits.filter((o: any) => o.planned_for && o.planned_for >= today);
    
    // Saved: explicitly saved
    const saved = outfits.filter(o => o.saved);
    
    // Recent: last 10 outfits by generated_at
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
          <Button size="sm" onClick={() => navigate('/')}>
            <Sparkles className="w-4 h-4 mr-1.5" />
            Ny outfit
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
                  title="Inga outfits ännu"
                  description="Generera din första outfit!"
                  action={{
                    label: 'Skapa outfit',
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
                  title="Inga sparade outfits"
                  description="Spara dina favoritoutfits genom att trycka på bokmärkes-ikonen."
                />
              )}
            </TabsContent>

            <TabsContent value="planned" className="space-y-3 mt-0">
              {plannedOutfits.length > 0 ? (
                plannedOutfits.map((outfit) => (
                  <OutfitCard 
                    key={outfit.id} 
                    outfit={outfit} 
                    onDelete={handleDeleteOutfit}
                    showPlannedDate
                  />
                ))
              ) : (
                <EmptyState
                  icon={Calendar}
                  title="Inga planerade outfits"
                  description="Planera outfits för kommande dagar genom att välja ett datum."
                />
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="Inga outfits sparade ännu"
            description="Generera din första outfit och låt AI:n hjälpa dig att matcha dina plagg!"
            action={{
              label: 'Skapa outfit',
              onClick: () => navigate('/'),
              icon: Sparkles
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
