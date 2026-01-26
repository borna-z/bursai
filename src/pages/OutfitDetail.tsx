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
  Calendar,
  Thermometer,
  ThermometerSnowflake,
  Shirt,
  Briefcase,
  PartyPopper,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Chip } from '@/components/ui/chip';
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
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useOutfit, useUpdateOutfit, useMarkOutfitWorn, useUndoMarkWorn, type OutfitWithItems } from '@/hooks/useOutfits';
import { useStorage } from '@/hooks/useStorage';
import { useSwapGarment, type SwapCandidate } from '@/hooks/useSwapGarment';
import { AppLayout } from '@/components/layout/AppLayout';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

const slotLabels: Record<string, string> = {
  top: 'Överdel',
  bottom: 'Underdel',
  shoes: 'Skor',
  outerwear: 'Ytterkläder',
  accessory: 'Accessoar',
};

const feedbackOptions = [
  { id: 'too_warm', label: 'För varmt', icon: Thermometer },
  { id: 'too_cold', label: 'För kallt', icon: ThermometerSnowflake },
  { id: 'too_formal', label: 'För formellt', icon: Briefcase },
  { id: 'too_casual', label: 'För casual', icon: Shirt },
];

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
  const undoMarkWorn = useUndoMarkWorn();
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
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<string[]>([]);
  const outfitRef = useRef<HTMLDivElement>(null);
  
  const justGenerated = (location.state as { justGenerated?: boolean })?.justGenerated;
  const shareUrl = outfit ? `${window.location.origin}/share/${outfit.id}` : '';

  useEffect(() => {
    if (outfit?.rating) {
      setRating(outfit.rating);
    }
    // Load existing feedback
    if ((outfit as any)?.feedback) {
      setSelectedFeedback((outfit as any).feedback);
    }
  }, [outfit?.rating, (outfit as any)?.feedback]);

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

  const handleToggleSave = async () => {
    if (!outfit) return;
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
    if (!outfit) return;
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

  const handleFeedbackToggle = async (feedbackId: string) => {
    if (!outfit) return;
    const newFeedback = selectedFeedback.includes(feedbackId)
      ? selectedFeedback.filter(f => f !== feedbackId)
      : [...selectedFeedback, feedbackId];
    
    setSelectedFeedback(newFeedback);
    
    try {
      await updateOutfit.mutateAsync({
        id: outfit.id,
        updates: { feedback: newFeedback } as any,
      });
    } catch {
      // Revert on error
      setSelectedFeedback(selectedFeedback);
    }
  };

  const handleMarkWorn = async () => {
    if (!outfit) return;
    try {
      const garmentIds = outfit.outfit_items.map((item) => item.garment_id);
      const result = await markWorn.mutateAsync({ 
        outfitId: outfit.id, 
        garmentIds,
        occasion: outfit.occasion 
      });
      
      toast.success('Markerat som använd ✅', {
        action: {
          label: 'Ångra',
          onClick: async () => {
            try {
              await undoMarkWorn.mutateAsync(result);
              toast.success('Ångrade markeringen');
            } catch {
              toast.error('Kunde inte ångra');
            }
          },
        },
        duration: 10000,
      });
    } catch {
      toast.error('Något gick fel');
    }
  };

  const handlePlanOutfit = async () => {
    if (!outfit || !selectedDate) return;
    try {
      await updateOutfit.mutateAsync({
        id: outfit.id,
        updates: { planned_for: selectedDate.toISOString().split('T')[0] } as any,
      });
      toast.success(`Planerad för ${format(selectedDate, 'd MMMM', { locale: sv })}`);
      setPlannerOpen(false);
      refetch();
    } catch {
      toast.error('Kunde inte planera outfit');
    }
  };

  const handleCreateSimilar = () => {
    // Navigate to home with similar vibe params
    navigate('/', { 
      state: { 
        prefillOccasion: outfit?.occasion,
        prefillStyle: outfit?.style_vibe,
      }
    });
  };

  const handleToggleShareEnabled = async () => {
    if (!outfit) return;
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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!outfit) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
          <p className="text-lg font-medium">Outfiten hittades inte</p>
          <Button variant="link" onClick={() => navigate('/outfits')}>
            Tillbaka till outfits
          </Button>
        </div>
      </AppLayout>
    );
  }

  const plannedFor = (outfit as any).planned_for;

  return (
    <AppLayout hideNav>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="p-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={handleToggleSave}>
              {outfit.saved ? (
                <BookmarkCheck className="w-5 h-5 text-primary" />
              ) : (
                <Bookmark className="w-5 h-5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShareSheetOpen(true)}>
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-32">
        {/* Title */}
        <div>
          {justGenerated && (
            <div className="flex items-center gap-2 text-primary mb-3">
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">Ny outfit skapad!</span>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge variant="secondary" className="capitalize">
              {outfit.occasion}
            </Badge>
            {outfit.style_vibe && (
              <Badge variant="outline" className="capitalize">
                {outfit.style_vibe}
              </Badge>
            )}
            {plannedFor && (
              <Badge variant="default" className="bg-primary/10 text-primary hover:bg-primary/20">
                <Calendar className="w-3 h-3 mr-1" />
                {format(new Date(plannedFor), 'd MMM', { locale: sv })}
              </Badge>
            )}
          </div>
          <h1 className="text-xl font-bold">Din outfit</h1>
        </div>

        {/* Outfit Content for Screenshot */}
        <div ref={outfitRef} className="space-y-3 bg-background">
          {/* Items Grid - Consistent height */}
          {outfit.outfit_items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-0 flex">
                <div 
                  className="w-24 h-24 bg-secondary overflow-hidden flex-shrink-0 cursor-pointer"
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
                      <Shirt className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                  <div 
                    className="cursor-pointer"
                    onClick={() => navigate(`/wardrobe/${item.garment_id}`)}
                  >
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {slotLabels[item.slot] || item.slot}
                    </p>
                    <p className="font-medium truncate">{item.garment?.title || 'Okänt plagg'}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {item.garment?.color_primary}
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="self-start mt-1 h-7 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenSwap(item.slot, item.id, item.garment_id);
                    }}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Byt ut
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Explanation */}
        {outfit.explanation && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Varför detta funkar
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm">{outfit.explanation}</p>
            </CardContent>
          </Card>
        )}

        {/* Rating */}
        <div className="space-y-2">
          <p className="font-medium text-sm">Betygsätt outfiten</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => handleRating(value)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <Star
                  className={cn(
                    'w-7 h-7 transition-colors',
                    (rating || 0) >= value
                      ? 'fill-primary text-primary'
                      : 'text-muted-foreground/40'
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Feedback chips */}
        <div className="space-y-2">
          <p className="font-medium text-sm">Hur passade outfiten?</p>
          <div className="flex flex-wrap gap-2">
            {feedbackOptions.map(({ id, label, icon: Icon }) => (
              <Chip
                key={id}
                selected={selectedFeedback.includes(id)}
                onClick={() => handleFeedbackToggle(id)}
              >
                <Icon className="w-3.5 h-3.5 mr-1" />
                {label}
              </Chip>
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

          <div className="grid grid-cols-2 gap-3">
            <Popover open={plannerOpen} onOpenChange={setPlannerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Calendar className="w-4 h-4 mr-2" />
                  Planera
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
                <div className="p-3 border-t">
                  <Button 
                    className="w-full" 
                    size="sm"
                    disabled={!selectedDate}
                    onClick={handlePlanOutfit}
                  >
                    Bekräfta
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="outline" onClick={handleCreateSimilar}>
              <PartyPopper className="w-4 h-4 mr-2" />
              Skapa liknande
            </Button>
          </div>
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
    </AppLayout>
  );
}
