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
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ForecastPreview } from '@/components/outfit/WeatherForecastBadge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useOutfit, useUpdateOutfit, useMarkOutfitWorn, useUndoMarkWorn } from '@/hooks/useOutfits';
import { useSwapGarment, type SwapCandidate } from '@/hooks/useSwapGarment';
import { AppLayout } from '@/components/layout/AppLayout';
import { StylistSummary } from '@/components/outfit/StylistSummary';
import { OutfitSlotCard, OutfitSlotCardSkeleton } from '@/components/outfit/OutfitSlotCard';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

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
  candidates: SwapCandidate[];
  isLoading: boolean;
  onSelect: (garmentId: string) => void;
  isSwapping: boolean;
}

const slotLabels: Record<string, string> = {
  top: 'Överdel',
  bottom: 'Underdel',
  shoes: 'Skor',
  outerwear: 'Ytterkläder',
  accessory: 'Accessoar',
};

function SwapSheet({ 
  isOpen, 
  onClose, 
  slot, 
  candidates, 
  isLoading, 
  onSelect,
  isSwapping 
}: SwapSheetProps) {
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
              <p>Inga alternativ</p>
              <p className="text-sm mt-1">Lägg till fler plagg</p>
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map((candidate) => (
                <button
                  key={candidate.garment.id}
                  onClick={() => onSelect(candidate.garment.id)}
                  disabled={isSwapping}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg transition-all",
                    "hover:bg-secondary/80 bg-secondary active:scale-[0.99]",
                    isSwapping && "opacity-50"
                  )}
                >
                  <LazyImageSimple
                    imagePath={candidate.garment.image_path}
                    alt={candidate.garment.title}
                    className="w-16 h-16 rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate">{candidate.garment.title}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {candidate.garment.color_primary}
                    </p>
                  </div>
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
  const { 
    candidates, 
    isLoadingCandidates, 
    fetchCandidates, 
    swapGarment, 
    isSwapping,
    clearCandidates 
  } = useSwapGarment();
  
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
    if ((outfit as any)?.feedback) {
      setSelectedFeedback((outfit as any).feedback);
    }
  }, [outfit?.rating, (outfit as any)?.feedback]);

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
      toast.error('Kunde inte byta');
    }
  };

  const handleToggleSave = async () => {
    if (!outfit) return;
    try {
      await updateOutfit.mutateAsync({
        id: outfit.id,
        updates: { saved: !outfit.saved },
      });
      toast.success(outfit.saved ? 'Borttagen' : 'Sparad!');
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
              toast.success('Ångrade');
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
      toast.success(`Planerad för ${format(selectedDate, 'd MMM', { locale: sv })}`);
      setPlannerOpen(false);
      refetch();
    } catch {
      toast.error('Kunde inte planera');
    }
  };

  const handleCreateSimilar = () => {
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
      toast.success(outfit.share_enabled ? 'Delning av' : 'Delning på');
      refetch();
    } catch {
      toast.error('Något gick fel');
    }
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Kopierad!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kunde inte kopiera');
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
      
      toast.success('Nedladdad!');
    } catch {
      toast.error('Kunde inte ladda ner');
    } finally {
      setIsDownloading(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <AppLayout hideNav>
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
          <div className="p-4 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex gap-1">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <Skeleton className="w-10 h-10 rounded-lg" />
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <OutfitSlotCardSkeleton />
          <OutfitSlotCardSkeleton />
          <OutfitSlotCardSkeleton />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!outfit) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
          <p className="text-lg font-medium">Hittades inte</p>
          <Button variant="link" onClick={() => navigate('/outfits')}>
            Tillbaka
          </Button>
        </div>
      </AppLayout>
    );
  }

  const plannedFor = (outfit as any).planned_for;
  const weather = (outfit as any).weather as { temp?: number; condition?: string } | null;

  return (
    <AppLayout hideNav>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="p-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleToggleSave}
              className="active:animate-press"
            >
              {outfit.saved ? (
                <BookmarkCheck className="w-5 h-5 text-primary" />
              ) : (
                <Bookmark className="w-5 h-5" />
              )}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShareSheetOpen(true)}
              className="active:animate-press"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-32">
        {/* Just Generated Badge */}
        {justGenerated && (
          <div className="flex items-center gap-2 text-primary animate-fade-in">
            <Sparkles className="w-5 h-5" />
            <span className="font-medium">Ny outfit skapad!</span>
          </div>
        )}

        {/* Stylist Summary Card */}
        <StylistSummary 
          occasion={outfit.occasion}
          styleVibe={outfit.style_vibe}
          weather={weather}
          explanation={outfit.explanation}
        />

        {/* Outfit Content for Screenshot */}
        <div ref={outfitRef} className="space-y-3 bg-background">
          {/* Slot Cards */}
          {outfit.outfit_items.map((item, index) => (
            <div 
              key={item.id} 
              className="animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <OutfitSlotCard
                slot={item.slot}
                garmentId={item.garment_id}
                garmentTitle={item.garment?.title}
                garmentColor={item.garment?.color_primary}
                garmentCategory={item.garment?.category}
                imagePath={item.garment?.image_path}
                onSwap={() => handleOpenSwap(item.slot, item.id, item.garment_id)}
              />
            </div>
          ))}
        </div>

        {/* Explanation Card */}
        {outfit.explanation && (
          <Card className="bg-primary/5 border-primary/20 animate-fade-in">
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
          <p className="font-medium text-sm">Betyg</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => handleRating(value)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors active:animate-press"
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
          <p className="font-medium text-sm">Feedback</p>
          <div className="flex flex-wrap gap-2">
            {feedbackOptions.map(({ id, label, icon: Icon }) => (
              <Chip
                key={id}
                selected={selectedFeedback.includes(id)}
                onClick={() => handleFeedbackToggle(id)}
                className="active:animate-chip-select"
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
            className="w-full active:animate-press"
            onClick={handleMarkWorn}
            disabled={markWorn.isPending || !!outfit.worn_at}
          >
            {markWorn.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            {outfit.worn_at ? 'Använd' : 'Markera använd'}
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Popover open={plannerOpen} onOpenChange={setPlannerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full active:animate-press">
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
                {/* Weather forecast for selected date */}
                {selectedDate && (
                  <div className="px-3 border-t">
                    <ForecastPreview 
                      date={selectedDate.toISOString().split('T')[0]}
                      originalTemp={weather?.temp}
                    />
                  </div>
                )}
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

            <Button 
              variant="outline" 
              onClick={handleCreateSimilar}
              className="active:animate-press"
            >
              <PartyPopper className="w-4 h-4 mr-2" />
              Liknande
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
        candidates={candidates}
        isLoading={isLoadingCandidates}
        onSelect={handleSwap}
        isSwapping={isSwapping}
      />

      {/* Share Sheet */}
      <Sheet open={shareSheetOpen} onOpenChange={setShareSheetOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>Dela</SheetTitle>
            <SheetDescription>
              Aktivera för publik länk
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-6 py-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="share-toggle" className="text-base font-medium">
                  Delning
                </Label>
                <p className="text-sm text-muted-foreground">
                  {outfit.share_enabled ? 'Publik länk aktiv' : 'Privat'}
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
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Länk</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 p-3 bg-secondary rounded-lg text-sm truncate">
                      {shareUrl}
                    </div>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={handleCopyShareLink}
                      className="active:animate-press"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 active:animate-press"
                    onClick={handleCopyShareLink}
                  >
                    <Link className="w-4 h-4 mr-2" />
                    {copied ? 'Kopierad!' : 'Kopiera'}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 active:animate-press"
                    onClick={handleDownloadImage}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Ladda ner
                  </Button>
                </div>
              </>
            )}

            {!outfit.share_enabled && (
              <div className="text-center py-4 text-muted-foreground">
                <Link2Off className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aktivera för länk</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
