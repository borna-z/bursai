import { useState, useEffect, useRef } from 'react';
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
  Copy,
  Download,
  Link,
  Link2Off,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useOutfit, useUpdateOutfit, useMarkOutfitWorn, type OutfitWithItems } from '@/hooks/useOutfits';
import { useStorage } from '@/hooks/useStorage';
import { useSwapGarment, type SwapCandidate } from '@/hooks/useSwapGarment';

const slotLabels: Record<string, string> = {
  top: 'Överdel',
  bottom: 'Underdel',
  shoes: 'Skor',
  outerwear: 'Ytterkläder',
  accessory: 'Accessoar',
};

interface SwapSheetProps {
  isOpen: boolean;
  onClose: () => void;
  slot: string;
  outfitItemId: string;
  candidates: SwapCandidate[];
  isLoading: boolean;
  onSelect: (garmentId: string) => void;
  isSwapping: boolean;
}

function SwapSheet({ 
  isOpen, 
  onClose, 
  slot, 
  candidates, 
  isLoading, 
  onSelect,
  isSwapping 
}: SwapSheetProps) {
  const { getGarmentSignedUrl } = useStorage();
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    candidates.forEach((candidate) => {
      if (candidate.garment.image_path && !imageUrls[candidate.garment.id]) {
        getGarmentSignedUrl(candidate.garment.image_path)
          .then((url) => setImageUrls((prev) => ({ ...prev, [candidate.garment.id]: url })))
          .catch(() => {});
      }
    });
  }, [candidates]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[70vh]">
        <SheetHeader>
          <SheetTitle>Byt {slotLabels[slot] || slot}</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-full mt-4 pb-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Inga alternativ tillgängliga</p>
              <p className="text-sm mt-1">Lägg till fler plagg i denna kategori</p>
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map((candidate) => (
                <button
                  key={candidate.garment.id}
                  onClick={() => onSelect(candidate.garment.id)}
                  disabled={isSwapping}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                    "hover:bg-secondary/80 bg-secondary",
                    isSwapping && "opacity-50"
                  )}
                >
                  <div className="w-16 h-16 rounded-lg bg-background overflow-hidden flex-shrink-0">
                    {imageUrls[candidate.garment.id] ? (
                      <img
                        src={imageUrls[candidate.garment.id]}
                        alt={candidate.garment.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-muted" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate">{candidate.garment.title}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {candidate.garment.color_primary}
                    </p>
                  </div>
                  {candidate.score >= 7 && (
                    <Badge variant="secondary" className="flex-shrink-0">Bra match</Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default function OutfitDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { data: outfit, isLoading, refetch } = useOutfit(id);
  const updateOutfit = useUpdateOutfit();
  const markWorn = useMarkOutfitWorn();
  const { getGarmentSignedUrl } = useStorage();
  const { 
    candidates, 
    isLoadingCandidates, 
    fetchCandidates, 
    swapGarment, 
    isSwapping,
    clearCandidates 
  } = useSwapGarment();
  
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [rating, setRating] = useState<number | null>(null);
  const [swapSheet, setSwapSheet] = useState<{ 
    isOpen: boolean; 
    slot: string; 
    outfitItemId: string;
  }>({ isOpen: false, slot: '', outfitItemId: '' });
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const outfitRef = useRef<HTMLDivElement>(null);
  
  const justGenerated = (location.state as { justGenerated?: boolean })?.justGenerated;
  const shareUrl = outfit ? `${window.location.origin}/share/${outfit.id}` : '';

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

  const handleOpenSwap = async (slot: string, outfitItemId: string, currentGarmentId: string) => {
    // Get colors of other garments in the outfit
    const otherColors = outfit?.outfit_items
      .filter(item => item.id !== outfitItemId && item.garment?.color_primary)
      .map(item => item.garment!.color_primary.toLowerCase()) || [];
    
    setSwapSheet({ isOpen: true, slot, outfitItemId });
    await fetchCandidates(slot, currentGarmentId, otherColors);
  };

  const handleSwap = async (newGarmentId: string) => {
    try {
      await swapGarment({ 
        outfitItemId: swapSheet.outfitItemId, 
        newGarmentId 
      });
      toast.success('Plagg bytt!');
      setSwapSheet({ isOpen: false, slot: '', outfitItemId: '' });
      refetch();
    } catch {
      toast.error('Kunde inte byta plagg');
    }
  };

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
      await markWorn.mutateAsync({ 
        outfitId: outfit.id, 
        garmentIds,
        occasion: outfit.occasion 
      });
      toast.success('Markerat som använd idag ✓');
    } catch {
      toast.error('Något gick fel');
    }
  };

  const handleOpenShareSheet = () => {
    setShareSheetOpen(true);
  };

  const handleToggleShareEnabled = async () => {
    try {
      await updateOutfit.mutateAsync({
        id: outfit.id,
        updates: { share_enabled: !outfit.share_enabled },
      });
      toast.success(outfit.share_enabled ? 'Delning avstängd' : 'Delning aktiverad');
      refetch();
    } catch {
      toast.error('Något gick fel');
    }
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
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
            <Button variant="ghost" size="icon" onClick={handleOpenShareSheet}>
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

        {/* Outfit Content for Screenshot */}
        <div ref={outfitRef} className="space-y-3 bg-background">
          {/* Items */}
          {outfit.outfit_items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-3 flex items-center gap-4">
                <div 
                  className="w-20 h-20 rounded-lg bg-secondary overflow-hidden flex-shrink-0 cursor-pointer"
                  onClick={() => navigate(`/wardrobe/${item.garment_id}`)}
                >
                  {imageUrls[item.id] ? (
                    <img
                      src={imageUrls[item.id]}
                      alt={item.garment?.title || item.slot}
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-muted" />
                    </div>
                  )}
                </div>
                <div 
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => navigate(`/wardrobe/${item.garment_id}`)}
                >
                  <p className="text-sm text-muted-foreground">
                    {slotLabels[item.slot] || item.slot}
                  </p>
                  <p className="font-medium truncate">{item.garment?.title || 'Okänt plagg'}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {item.garment?.color_primary}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenSwap(item.slot, item.id, item.garment_id);
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Byt
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
              : 'Markera som använd idag'}
          </Button>
        </div>
      </div>

      {/* Swap Sheet */}
      <SwapSheet
        isOpen={swapSheet.isOpen}
        onClose={() => {
          setSwapSheet({ isOpen: false, slot: '', outfitItemId: '' });
          clearCandidates();
        }}
        slot={swapSheet.slot}
        outfitItemId={swapSheet.outfitItemId}
        candidates={candidates}
        isLoading={isLoadingCandidates}
        onSelect={handleSwap}
        isSwapping={isSwapping}
      />

      {/* Share Sheet */}
      <Sheet open={shareSheetOpen} onOpenChange={setShareSheetOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>Dela outfit</SheetTitle>
            <SheetDescription>
              Aktivera delning för att skapa en publik länk
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-6 py-6">
            {/* Share Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="share-toggle" className="text-base font-medium">
                  Delning aktiverad
                </Label>
                <p className="text-sm text-muted-foreground">
                  {outfit.share_enabled 
                    ? 'Vem som helst med länken kan se outfiten'
                    : 'Outfiten är privat'}
                </p>
              </div>
              <Switch
                id="share-toggle"
                checked={outfit.share_enabled ?? false}
                onCheckedChange={handleToggleShareEnabled}
              />
            </div>

            {outfit.share_enabled && (
              <>
                {/* Share Link */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Delningslänk</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 p-3 bg-secondary rounded-lg text-sm truncate">
                      {shareUrl}
                    </div>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={handleCopyShareLink}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={handleCopyShareLink}
                  >
                    <Link className="w-4 h-4 mr-2" />
                    {copied ? 'Kopierad!' : 'Kopiera länk'}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={handleDownloadImage}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Ladda ner bild
                  </Button>
                </div>
              </>
            )}

            {!outfit.share_enabled && (
              <div className="text-center py-4 text-muted-foreground">
                <Link2Off className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aktivera delning för att få en länk</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
