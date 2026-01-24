import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Loader2, Star, Calendar, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useOutfits, type OutfitWithItems } from '@/hooks/useOutfits';
import { useStorage } from '@/hooks/useStorage';
import { AppLayout } from '@/components/layout/AppLayout';

function OutfitCard({ outfit }: { outfit: OutfitWithItems }) {
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

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/outfits/${outfit.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="capitalize">
            {outfit.occasion}
          </Badge>
          {outfit.rating && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="w-4 h-4 fill-primary text-primary" />
              {outfit.rating}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {outfit.outfit_items.map((item) => (
            <div
              key={item.id}
              className="w-16 h-16 rounded-lg bg-secondary overflow-hidden flex-shrink-0"
            >
              {imageUrls[item.id] ? (
                <img
                  src={imageUrls[item.id]}
                  alt={item.garment?.title || item.slot}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground capitalize">
                  {item.slot}
                </div>
              )}
            </div>
          ))}
        </div>
        {outfit.worn_at && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
            <Calendar className="w-3 h-3" />
            Använd {new Date(outfit.worn_at).toLocaleDateString('sv-SE')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OutfitsPage() {
  const navigate = useNavigate();
  const { data: outfits, isLoading } = useOutfits();

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Outfits</h1>
          <Button onClick={() => navigate('/')}>
            <Sparkles className="w-4 h-4 mr-2" />
            Generera ny
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : outfits && outfits.length > 0 ? (
          <div className="space-y-3">
            {outfits.map((outfit) => (
              <OutfitCard key={outfit.id} outfit={outfit} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">Inga outfits sparade ännu</p>
            <p className="text-muted-foreground mt-1">
              Generera din första outfit!
            </p>
            <Button className="mt-4" onClick={() => navigate('/')}>
              <Plus className="w-4 h-4 mr-2" />
              Skapa outfit
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
