import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  Bookmark,
  BookmarkCheck,
  Check,
  RefreshCw,
  Share2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useOutfit, useUpdateOutfit, useMarkOutfitWorn } from '@/hooks/useOutfits';
import { useStorage } from '@/hooks/useStorage';

const slotLabels: Record<string, string> = {
  top: 'Överdel',
  bottom: 'Underdel',
  shoes: 'Skor',
  outerwear: 'Ytterkläder',
  accessory: 'Accessoar',
};

export default function OutfitDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { data: outfit, isLoading } = useOutfit(id);
  const updateOutfit = useUpdateOutfit();
  const markWorn = useMarkOutfitWorn();
  const { getGarmentSignedUrl } = useStorage();
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [rating, setRating] = useState<number | null>(null);
  
  const justGenerated = (location.state as { justGenerated?: boolean })?.justGenerated;

  useEffect(() => {
    if (outfit?.rating) {
      setRating(outfit.rating);
    }
  }, [outfit?.rating]);

  useEffect(() => {
    outfit?.outfit_items.forEach((item) => {
      if (item.garment?.image_path) {
        getGarmentSignedUrl(item.garment.image_path)
          .then((url) => setImageUrls((prev) => ({ ...prev, [item.id]: url })))
          .catch(() => {});
      }
    });
  }, [outfit?.outfit_items]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!outfit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-lg font-medium">Outfiten hittades inte</p>
        <Button variant="link" onClick={() => navigate('/outfits')}>
          Tillbaka till outfits
        </Button>
      </div>
    );
  }

  const handleToggleSave = async () => {
    try {
      await updateOutfit.mutateAsync({
        id: outfit.id,
        updates: { saved: !outfit.saved },
      });
      toast.success(outfit.saved ? 'Borttagen från sparade' : 'Sparad!');
    } catch {
      toast.error('Något gick fel');
    }
  };

  const handleRating = async (value: number) => {
    setRating(value);
    try {
      await updateOutfit.mutateAsync({
        id: outfit.id,
        updates: { rating: value },
      });
      toast.success('Betyg sparat');
    } catch {
      toast.error('Något gick fel');
    }
  };

  const handleMarkWorn = async () => {
    try {
      const garmentIds = outfit.outfit_items.map((item) => item.garment_id);
      await markWorn.mutateAsync({ outfitId: outfit.id, garmentIds });
      toast.success('Markerat som använd idag ✓');
    } catch {
      toast.error('Något gick fel');
    }
  };

  const handleShare = async () => {
    const items = outfit.outfit_items
      .map((item) => `${slotLabels[item.slot] || item.slot}: ${item.garment?.title || 'Okänt'}`)
      .join('\n');
    
    const text = `Min outfit för ${outfit.occasion}:\n\n${items}\n\n${outfit.explanation || ''}`;

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Kopierat till urklipp');
    } catch {
      toast.error('Kunde inte kopiera');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="p-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={handleToggleSave}>
              {outfit.saved ? (
                <BookmarkCheck className="w-5 h-5 text-primary" />
              ) : (
                <Bookmark className="w-5 h-5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleShare}>
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Title */}
        <div>
          {justGenerated && (
            <div className="flex items-center gap-2 text-primary mb-3">
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">Ny outfit skapad!</span>
            </div>
          )}
          <Badge variant="secondary" className="mb-2 capitalize">
            {outfit.occasion}
          </Badge>
          <h1 className="text-xl font-bold">Din outfit</h1>
          {outfit.style_vibe && (
            <p className="text-muted-foreground capitalize">Stil: {outfit.style_vibe}</p>
          )}
        </div>

        {/* Items */}
        <div className="space-y-3">
          {outfit.outfit_items.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/wardrobe/${item.garment_id}`)}
            >
              <CardContent className="p-3 flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                  {imageUrls[item.id] ? (
                    <img
                      src={imageUrls[item.id]}
                      alt={item.garment?.title || item.slot}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-muted" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">
                    {slotLabels[item.slot] || item.slot}
                  </p>
                  <p className="font-medium truncate">{item.garment?.title || 'Okänt plagg'}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {item.garment?.color_primary}
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Explanation */}
        {outfit.explanation && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Varför detta funkar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{outfit.explanation}</p>
            </CardContent>
          </Card>
        )}

        {/* Rating */}
        <div className="space-y-2">
          <p className="font-medium">Betygsätt outfiten</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => handleRating(value)}
                className="p-2"
              >
                <Star
                  className={cn(
                    'w-8 h-8 transition-colors',
                    (rating || 0) >= value
                      ? 'fill-primary text-primary'
                      : 'text-muted-foreground'
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            className="w-full"
            onClick={handleMarkWorn}
            disabled={markWorn.isPending || !!outfit.worn_at}
          >
            {markWorn.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            {outfit.worn_at
              ? `Använd ${new Date(outfit.worn_at).toLocaleDateString('sv-SE')}`
              : 'Markera som använd'}
          </Button>
        </div>
      </div>
    </div>
  );
}
