import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Copy, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const slotLabels: Record<string, string> = {
  top: 'Överdel',
  bottom: 'Underdel',
  shoes: 'Skor',
  outerwear: 'Ytterkläder',
  accessory: 'Accessoar',
};

interface OutfitItem {
  id: string;
  slot: string;
  garment: {
    id: string;
    title: string;
    color_primary: string;
    image_path: string;
  } | null;
}

interface SharedOutfit {
  id: string;
  occasion: string;
  style_vibe: string | null;
  explanation: string | null;
  share_enabled: boolean;
  outfit_items: OutfitItem[];
}

export default function ShareOutfitPage() {
  const { id } = useParams<{ id: string }>();
  const [outfit, setOutfit] = useState<SharedOutfit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const outfitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOutfit = async () => {
      if (!id) return;

      const { data, error } = await supabase
        .from('outfits')
        .select(`
          id,
          occasion,
          style_vibe,
          explanation,
          share_enabled,
          outfit_items (
            id,
            slot,
            garment:garments (
              id,
              title,
              color_primary,
              image_path
            )
          )
        `)
        .eq('id', id)
        .eq('share_enabled', true)
        .single();

      if (error || !data) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      // Transform the data to match our interface
      const transformedOutfit: SharedOutfit = {
        id: data.id,
        occasion: data.occasion,
        style_vibe: data.style_vibe,
        explanation: data.explanation,
        share_enabled: data.share_enabled ?? false,
        outfit_items: (data.outfit_items || []).map((item: any) => ({
          id: item.id,
          slot: item.slot,
          garment: item.garment,
        })),
      };

      setOutfit(transformedOutfit);
      setIsLoading(false);

      // Fetch signed URLs for images
      for (const item of transformedOutfit.outfit_items) {
        if (item.garment?.image_path) {
          const { data: urlData } = await supabase.storage
            .from('garments')
            .createSignedUrl(item.garment.image_path, 3600);
          
          if (urlData) {
            setImageUrls(prev => ({ ...prev, [item.id]: urlData.signedUrl }));
          }
        }
      }
    };

    fetchOutfit();
  }, [id]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success('Länk kopierad!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kunde inte kopiera länken');
    }
  };

  const handleDownloadImage = async () => {
    if (!outfitRef.current || !outfit) return;
    
    setIsDownloading(true);
    
    try {
      // Dynamic import of html-to-image
      const { toPng } = await import('html-to-image');
      
      const dataUrl = await toPng(outfitRef.current, {
        quality: 1.0,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      
      const link = document.createElement('a');
      link.download = `outfit-${outfit.occasion}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success('Bild nedladdad!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Kunde inte ladda ner bilden');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !outfit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <h1 className="text-2xl font-bold mb-2">Outfiten hittades inte</h1>
        <p className="text-muted-foreground text-center">
          Denna outfit finns inte eller är inte delad.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-lg mx-auto p-4 flex items-center justify-between">
          <h1 className="font-semibold">Delad outfit</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              {copied ? (
                <Check className="w-4 h-4 mr-1" />
              ) : (
                <Copy className="w-4 h-4 mr-1" />
              )}
              {copied ? 'Kopierad!' : 'Kopiera länk'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDownloadImage}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-1" />
              )}
              Ladda ner
            </Button>
          </div>
        </div>
      </div>

      {/* Outfit Content */}
      <div className="max-w-lg mx-auto p-4">
        <div ref={outfitRef} className="bg-background p-4 rounded-lg">
          {/* Title */}
          <div className="mb-6 text-center">
            <Badge variant="secondary" className="mb-2 capitalize">
              {outfit.occasion}
            </Badge>
            {outfit.style_vibe && (
              <p className="text-sm text-muted-foreground capitalize">
                Stil: {outfit.style_vibe}
              </p>
            )}
          </div>

          {/* Items Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {outfit.outfit_items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-square bg-secondary overflow-hidden">
                    {imageUrls[item.id] ? (
                      <img
                        src={imageUrls[item.id]}
                        alt={item.garment?.title || item.slot}
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-muted" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-muted-foreground">
                      {slotLabels[item.slot] || item.slot}
                    </p>
                    <p className="text-sm font-medium truncate">
                      {item.garment?.title || 'Okänt plagg'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Explanation */}
          {outfit.explanation && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-3">
                <p className="text-sm">{outfit.explanation}</p>
              </CardContent>
            </Card>
          )}

          {/* Watermark */}
          <div className="mt-6 text-center text-xs text-muted-foreground">
            Skapad med Wardrobe AI
          </div>
        </div>
      </div>
    </div>
  );
}