import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Star, Bookmark, BookmarkCheck, Check, RefreshCw, Share2, Loader2,
  Sparkles, Copy, Download, Link, Link2Off, Calendar, Thermometer, ThermometerSnowflake, Shirt, Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useOutfit, useUpdateOutfit, useMarkOutfitWorn, useUndoMarkWorn } from '@/hooks/useOutfits';
import { useSwapGarment, type SwapCandidate } from '@/hooks/useSwapGarment';
import { useWeather } from '@/hooks/useWeather';
import { AppLayout } from '@/components/layout/AppLayout';
import { StylistSummary } from '@/components/outfit/StylistSummary';
import { OutfitSlotCard, OutfitSlotCardSkeleton } from '@/components/outfit/OutfitSlotCard';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

interface SwapSheetProps {
  isOpen: boolean; onClose: () => void; slot: string;
  candidates: SwapCandidate[]; isLoading: boolean;
  onSelect: (garmentId: string) => void; isSwapping: boolean;
  t: (key: string) => string;
}

function SwapSheet({ isOpen, onClose, slot, candidates, isLoading, onSelect, isSwapping, t }: SwapSheetProps) {
  const slotLabel = t(`outfit.slot.${slot}`) || slot;
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[70vh]">
        <SheetHeader><SheetTitle>{t('outfit.swap')} {slotLabel}</SheetTitle></SheetHeader>
        <div className="mt-4 pb-8 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{t('outfit.no_alternatives')}</p>
              <p className="text-sm mt-1">{t('outfit.add_more')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map((candidate) => (
                <button key={candidate.garment.id} onClick={() => onSelect(candidate.garment.id)} disabled={isSwapping} className={cn("w-full flex items-center gap-3 p-3 rounded-lg transition-all hover:bg-secondary/80 bg-secondary/60 backdrop-blur-sm active:scale-[0.99]", isSwapping && "opacity-50")}>
                  <LazyImageSimple imagePath={candidate.garment.image_path} alt={candidate.garment.title} className="w-16 h-16 rounded-lg flex-shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate">{candidate.garment.title}</p>
                    <p className="text-sm text-muted-foreground capitalize">{candidate.garment.color_primary}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function OutfitDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { data: outfit, isLoading, refetch } = useOutfit(id);
  const { weather: currentWeather } = useWeather();
  const updateOutfit = useUpdateOutfit();
  const markWorn = useMarkOutfitWorn();
  const undoMarkWorn = useUndoMarkWorn();
  const { candidates, isLoadingCandidates, fetchCandidates, swapGarment, isSwapping, clearCandidates } = useSwapGarment();
  
  const [rating, setRating] = useState<number | null>(null);
  const [swapSheet, setSwapSheet] = useState<{ isOpen: boolean; slot: string; outfitItemId: string }>({ isOpen: false, slot: '', outfitItemId: '' });
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<string[]>([]);
  const outfitRef = useRef<HTMLDivElement>(null);
  
  const justGenerated = (location.state as { justGenerated?: boolean })?.justGenerated;
  const shareUrl = outfit ? `${window.location.origin}/share/${outfit.id}` : '';

  const feedbackOptions = [
    { id: 'too_warm', label: t('outfit.too_warm'), icon: Thermometer },
    { id: 'too_cold', label: t('outfit.too_cold'), icon: ThermometerSnowflake },
    { id: 'too_formal', label: t('outfit.too_formal'), icon: Briefcase },
    { id: 'too_casual', label: t('outfit.too_casual'), icon: Shirt },
  ];

  useEffect(() => {
    if (outfit?.rating) setRating(outfit.rating);
    if ((outfit as any)?.feedback) setSelectedFeedback((outfit as any).feedback);
  }, [outfit?.rating, (outfit as any)?.feedback]);

  const handleOpenSwap = async (slot: string, outfitItemId: string, currentGarmentId: string) => {
    const otherColors = outfit?.outfit_items.filter(item => item.id !== outfitItemId && item.garment?.color_primary).map(item => item.garment!.color_primary.toLowerCase()) || [];
    setSwapSheet({ isOpen: true, slot, outfitItemId });
    await fetchCandidates(slot, currentGarmentId, otherColors);
  };

  const handleSwap = async (newGarmentId: string) => {
    try {
      await swapGarment({ outfitItemId: swapSheet.outfitItemId, newGarmentId });
      toast.success(t('outfit.swapped'));
      setSwapSheet({ isOpen: false, slot: '', outfitItemId: '' }); refetch();
    } catch { toast.error(t('outfit.swap_error')); }
  };

  const handleToggleSave = async () => {
    if (!outfit) return;
    try {
      await updateOutfit.mutateAsync({ id: outfit.id, updates: { saved: !outfit.saved } });
      toast.success(outfit.saved ? t('outfit.removed') : t('outfit.saved'));
    } catch { toast.error(t('common.something_wrong')); }
  };

  const handleRating = async (value: number) => {
    if (!outfit) return;
    setRating(value);
    try { await updateOutfit.mutateAsync({ id: outfit.id, updates: { rating: value } }); toast.success(t('outfit.rating_saved')); } catch { toast.error(t('common.something_wrong')); }
  };

  const handleFeedbackToggle = async (feedbackId: string) => {
    if (!outfit) return;
    const newFeedback = selectedFeedback.includes(feedbackId) ? selectedFeedback.filter(f => f !== feedbackId) : [...selectedFeedback, feedbackId];
    setSelectedFeedback(newFeedback);
    try { await updateOutfit.mutateAsync({ id: outfit.id, updates: { feedback: newFeedback } as any }); } catch { setSelectedFeedback(selectedFeedback); }
  };

  const handleMarkWorn = async () => {
    if (!outfit) return;
    try {
      const garmentIds = outfit.outfit_items.map((item) => item.garment_id);
      const result = await markWorn.mutateAsync({ outfitId: outfit.id, garmentIds, occasion: outfit.occasion });
      toast.success(t('outfit.marked_worn'), {
        action: { label: t('outfit.undo'), onClick: async () => { try { await undoMarkWorn.mutateAsync(result); toast.success(t('outfit.undone')); } catch { toast.error(t('outfit.undo_error')); } } },
        duration: 10000,
      });
    } catch { toast.error(t('common.something_wrong')); }
  };

  const handleCreateSimilar = () => { navigate('/', { state: { prefillOccasion: outfit?.occasion, prefillStyle: outfit?.style_vibe } }); };

  const handleToggleShareEnabled = async () => {
    if (!outfit) return;
    try { await updateOutfit.mutateAsync({ id: outfit.id, updates: { share_enabled: !outfit.share_enabled } }); toast.success(outfit.share_enabled ? t('outfit.share_off') : t('outfit.share_on')); refetch(); } catch { toast.error(t('common.something_wrong')); }
  };

  const handleCopyShareLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); toast.success(t('outfit.copied')); setTimeout(() => setCopied(false), 2000); } catch { toast.error(t('outfit.copy_error')); }
  };

  const handleDownloadImage = async () => {
    if (!outfitRef.current || !outfit) return;
    setIsDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(outfitRef.current, { quality: 1.0, backgroundColor: '#ffffff', pixelRatio: 2 });
      const link = document.createElement('a'); link.download = `outfit-${outfit.occasion}.png`; link.href = dataUrl; link.click();
      toast.success(t('outfit.downloaded'));
    } catch { toast.error(t('outfit.download_error')); } finally { setIsDownloading(false); }
  };

  if (isLoading) {
    return (
      <AppLayout hideNav>
        <div className="sticky top-0 z-10 bg-background/70 backdrop-blur-lg border-b border-border/20">
          <div className="p-4 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
            <div className="flex gap-1"><Skeleton className="w-10 h-10 rounded-lg" /><Skeleton className="w-10 h-10 rounded-lg" /></div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" /><OutfitSlotCardSkeleton /><OutfitSlotCardSkeleton /><OutfitSlotCardSkeleton /><Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!outfit) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
          <p className="text-lg font-medium">{t('outfit.not_found')}</p>
          <Button variant="link" onClick={() => navigate('/outfits')}>{t('common.back')}</Button>
        </div>
      </AppLayout>
    );
  }

  const weather = (outfit as any).weather as { temp?: number; condition?: string; precipitation?: 'none' | 'rain' | 'snow'; wind?: 'low' | 'medium' | 'high' } | null;
  const outfitItemsForAnalysis = outfit.outfit_items.map(item => ({ slot: item.slot, garment: item.garment }));

  return (
    <AppLayout hideNav>
      <div className="sticky top-0 z-10 bg-background/70 backdrop-blur-lg border-b border-border/20">
        <div className="p-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={handleToggleSave}>
              {outfit.saved ? <BookmarkCheck className="w-5 h-5 text-primary" /> : <Bookmark className="w-5 h-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShareSheetOpen(true)}><Share2 className="w-5 h-5" /></Button>
          </div>
        </div>
      </div>

      <div className="p-4 pt-6 space-y-6 pb-32">
        {justGenerated && (
          <div className="flex items-center gap-2 text-primary animate-fade-in"><Sparkles className="w-5 h-5" /><span className="font-medium">{t('outfit.just_created')}</span></div>
        )}

        <StylistSummary occasion={outfit.occasion} styleVibe={outfit.style_vibe} weather={weather} currentWeather={currentWeather ? { temp: currentWeather.temperature, precipitation: currentWeather.precipitation, wind: currentWeather.wind } : null} explanation={outfit.explanation} outfitItems={outfitItemsForAnalysis} />

        <div ref={outfitRef} className="space-y-3 bg-background">
          {outfit.outfit_items.map((item, index) => (
            <div key={item.id} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
              <OutfitSlotCard slot={item.slot} garmentId={item.garment_id} garmentTitle={item.garment?.title} garmentColor={item.garment?.color_primary} garmentCategory={item.garment?.category} imagePath={item.garment?.image_path} onSwap={() => handleOpenSwap(item.slot, item.id, item.garment_id)} />
            </div>
          ))}
        </div>

        {outfit.explanation && (
          <Card className="bg-primary/5 border-primary/20 animate-fade-in">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />{t('outfit.why_works')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0"><p className="text-sm">{outfit.explanation}</p></CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <p className="font-medium text-sm">{t('outfit.rating')}</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} onClick={() => handleRating(value)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <Star className={cn('w-8 h-8 transition-colors', (rating || 0) >= value ? 'fill-primary text-primary' : 'text-muted-foreground/40')} />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-medium text-sm">{t('outfit.feedback')}</p>
          <div className="flex flex-wrap gap-2">
            {feedbackOptions.map(({ id, label, icon: Icon }) => (
              <Chip key={id} selected={selectedFeedback.includes(id)} onClick={() => handleFeedbackToggle(id)}>
                <Icon className="w-3.5 h-3.5 mr-1" />{label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Button className="w-full" onClick={handleMarkWorn} disabled={markWorn.isPending || !!outfit.worn_at}>
            {markWorn.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            {outfit.worn_at ? t('outfit.worn') : t('outfit.mark_worn')}
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => navigate('/plan', { state: { preselectedOutfitId: outfit.id } })} className="w-full">
              <Calendar className="w-4 h-4 mr-2" />{t('outfit.plan')}
            </Button>
            <Button variant="outline" onClick={handleCreateSimilar}>
              <RefreshCw className="w-4 h-4 mr-2" />{t('outfit.similar')}
            </Button>
          </div>
        </div>
      </div>

      <SwapSheet isOpen={swapSheet.isOpen} onClose={() => { setSwapSheet({ isOpen: false, slot: '', outfitItemId: '' }); clearCandidates(); }} slot={swapSheet.slot} candidates={candidates} isLoading={isLoadingCandidates} onSelect={handleSwap} isSwapping={isSwapping} t={t} />

      <Sheet open={shareSheetOpen} onOpenChange={setShareSheetOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>{t('outfit.share')}</SheetTitle>
            <SheetDescription>{t('outfit.enable_share')}</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 py-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="share-toggle" className="text-base font-medium">{t('outfit.sharing')}</Label>
                <p className="text-sm text-muted-foreground">{outfit.share_enabled ? t('outfit.share_active') : t('outfit.private')}</p>
              </div>
              <Switch id="share-toggle" checked={outfit.share_enabled ?? false} onCheckedChange={handleToggleShareEnabled} />
            </div>
            {outfit.share_enabled && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('outfit.link')}</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 p-3 bg-secondary rounded-lg text-sm truncate">{shareUrl}</div>
                    <Button variant="outline" size="icon" onClick={handleCopyShareLink}>
                      {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleCopyShareLink}>
                    <Link className="w-4 h-4 mr-2" />{copied ? t('outfit.copied') : t('outfit.copy')}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleDownloadImage} disabled={isDownloading}>
                    {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                    {t('outfit.download')}
                  </Button>
                </div>
              </>
            )}
            {!outfit.share_enabled && (
              <div className="text-center py-4 text-muted-foreground">
                <Link2Off className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('outfit.enable_link')}</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
