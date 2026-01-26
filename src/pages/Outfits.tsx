import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Loader2, Star, Calendar, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { useOutfits, useDeleteOutfit, type OutfitWithItems } from '@/hooks/useOutfits';
import { useStorage } from '@/hooks/useStorage';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { toast } from 'sonner';

function OutfitCard({ outfit, onDelete }: { outfit: OutfitWithItems; onDelete: (id: string) => void }) {
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

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all"
      onClick={() => navigate(`/outfits/${outfit.id}`)}
    >
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="capitalize text-xs">
            {outfit.occasion}
          </Badge>
          <div className="flex items-center gap-1">
            {outfit.rating && (
              <div className="flex items-center gap-0.5 text-sm text-muted-foreground">
                <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                {outfit.rating}
              </div>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar -mx-1 px-1">
          {outfit.outfit_items.map((item) => (
            <div
              key={item.id}
              className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0"
            >
              {imageUrls[item.id] ? (
                <img
                  src={imageUrls[item.id]}
                  alt={item.garment?.title || item.slot}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground capitalize">
                  {item.slot}
                </div>
              )}
            </div>
          ))}
        </div>
        {outfit.worn_at && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
            <Calendar className="w-3 h-3" />
            {new Date(outfit.worn_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OutfitsPage() {
  const navigate = useNavigate();
  const { data: outfits, isLoading } = useOutfits();
  const deleteOutfit = useDeleteOutfit();

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
      
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : outfits && outfits.length > 0 ? (
          <div className="space-y-3">
            {outfits.map((outfit) => (
              <OutfitCard key={outfit.id} outfit={outfit} onDelete={handleDeleteOutfit} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="Inga outfits sparade ännu"
            description="Generera din första outfit och låt AI:n hjälpa dig att matcha dina plagg!"
            action={{
              label: 'Skapa outfit',
              onClick: () => navigate('/'),
              icon: Plus
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
