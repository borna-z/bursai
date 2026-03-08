import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Star, Bookmark, BookmarkCheck, Check, RefreshCw, Share2, Loader2,
  Sparkles, Copy, Download, Link, Link2Off, Calendar, Thermometer, ThermometerSnowflake, Shirt, Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';

/* ── Swap Sheet ─────────────────────────────────────── */

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
                <button key={candidate.garment.id} onClick={() => onSelect(candidate.garment.id)} disabled={isSwapping} className={cn("w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-secondary/80 bg-secondary/60 backdrop-blur-sm active:scale-[0.99]", isSwapping && "opacity-50")}>
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

/* ── Garment Slot (inline, Apple-style) ─────────────── */

interface SlotRowProps {
  slot: string;
  garmentId: string;
  garmentTitle?: string;
  garmentColor?: string;
  imagePath?: string;
  onSwap: () => void;
  t: (key: string) => string;
}

function SlotRow({ slot, garmentId, garmentTitle, garmentColor, imagePath, onSwap, t }: SlotRowProps) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-4 py-4 border-b border-border/10 last:border-b-0">
      <div
        className="w-16 h-20 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer bg-muted/30"
        onClick={() => navigate(`/wardrobe/${garmentId}`)}
      >
        <LazyImageSimple
          imagePath={imagePath}
          alt={garmentTitle || slot}
          className="w-16 h-20 object-cover"
          fallbackIcon={<Shirt className="w-6 h-6 text-muted-foreground/30" />}
        />
      </div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/wardrobe/${garmentId}`)}>
        <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide font-medium">
          {t(`outfit.slot.${slot}`) || slot}
        </p>
        <p className="font-semibold text-sm truncate mt-0.5">{garmentTitle || t('outfit.unknown')}</p>
        {garmentColor && <p className="text-[13px] text-muted-foreground capitalize mt-0.5">{garmentColor}</p>}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onSwap(); }}
        className="p-2 rounded-full hover:bg-muted/60 transition-colors active:scale-95 flex-shrink-0"
        aria-label={t('outfit.swap_out')}
      >
        <RefreshCw className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────── */

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

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Floating header skeleton */}
        <div className="sticky top-0 z-10 p-4 flex items-center justify-between">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex gap-2"><Skeleton className="w-10 h-10 rounded-full" /><Skeleton className="w-10 h-10 rounded-full" /></div>
        </div>
        {/* Hero grid skeleton */}
        <div className="grid grid-cols-2 gap-1 px-1">
          <Skeleton className="aspect-[3/4] rounded-xl" />
          <Skeleton className="aspect-[3/4] rounded-xl" />
        </div>
        <div className="px-6 pt-8 space-y-4">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (!outfit) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-lg font-medium">{t('outfit.not_found')}</p>
        <Button variant="link" onClick={() => navigate('/outfits')}>{t('common.back')}</Button>
      </div>
    );
  }

  const weather = (outfit as any).weather as { temp?: number; condition?: string; precipitation?: 'none' | 'rain' | 'snow'; wind?: 'low' | 'medium' | 'high' } | null;
  const occasionLabel = t(`occasion.${outfit.occasion.toLowerCase()}`);
  const displayOccasion = occasionLabel.startsWith('occasion.') ? outfit.occasion : occasionLabel;

  // Build metadata pieces
  const metaParts = [displayOccasion, outfit.style_vibe].filter(Boolean);
  if (weather?.temp !== undefined) metaParts.push(`${weather.temp}°C`);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Floating header ── */}
      <div className="fixed top-0 left-0 right-0 z-20 p-4 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-background/40 backdrop-blur-xl flex items-center justify-center active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleToggleSave}
            className="w-10 h-10 rounded-full bg-background/40 backdrop-blur-xl flex items-center justify-center active:scale-95 transition-transform"
          >
            {outfit.saved ? <BookmarkCheck className="w-5 h-5 text-primary" /> : <Bookmark className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setShareSheetOpen(true)}
            className="w-10 h-10 rounded-full bg-background/40 backdrop-blur-xl flex items-center justify-center active:scale-95 transition-transform"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Hero: outfit image grid ── */}
      <div ref={outfitRef} className="relative rounded-b-3xl overflow-hidden bg-muted/20">
        <div className={cn(
          "grid gap-0.5",
          outfit.outfit_items.length <= 2 ? "grid-cols-2" :
          outfit.outfit_items.length === 3 ? "grid-cols-2" :
          "grid-cols-2"
        )}>
          {outfit.outfit_items.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "relative overflow-hidden bg-muted/30",
                // If 3 items, make the last one span full width
                outfit.outfit_items.length === 3 && index === 2 && "col-span-2",
                // If 1 item, span full
                outfit.outfit_items.length === 1 && "col-span-2",
              )}
            >
              <LazyImageSimple
                imagePath={item.garment?.image_path}
                alt={item.garment?.title || item.slot}
                className={cn(
                  "w-full object-cover",
                  outfit.outfit_items.length <= 2 ? "aspect-[3/4]" :
                  outfit.outfit_items.length === 3 && index === 2 ? "aspect-[2/1]" :
                  "aspect-square"
                )}
                fallbackIcon={<Shirt className="w-8 h-8 text-muted-foreground/20" />}
              />
              {/* Subtle slot label overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-2">
                <p className="text-[10px] text-white/80 uppercase tracking-wider font-medium">
                  {t(`outfit.slot.${item.slot}`) || item.slot}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Just generated badge */}
        {justGenerated && (
          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-background/60 backdrop-blur-xl rounded-full px-3 py-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium">{t('outfit.just_created')}</span>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="px-6 pt-8 pb-32 space-y-8">
        {/* Title + meta */}
        <div>
          <h1 className="text-2xl font-semibold capitalize">{displayOccasion}</h1>
          <p className="text-[13px] text-muted-foreground/60 mt-1">
            {metaParts.join(' · ')}
          </p>
        </div>

        {/* AI explanation */}
        {outfit.explanation && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide font-medium">{t('outfit.why_works')}</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{outfit.explanation}</p>
          </div>
        )}

        {/* ── Garment list ── */}
        <div>
          {outfit.outfit_items.map((item) => (
            <SlotRow
              key={item.id}
              slot={item.slot}
              garmentId={item.garment_id}
              garmentTitle={item.garment?.title}
              garmentColor={item.garment?.color_primary}
              imagePath={item.garment?.image_path}
              onSwap={() => handleOpenSwap(item.slot, item.id, item.garment_id)}
              t={t}
            />
          ))}
        </div>

        {/* ── Rating ── */}
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide font-medium">{t('outfit.rating')}</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} onClick={() => handleRating(value)} className="p-1 rounded-lg hover:bg-muted/40 transition-colors active:scale-95">
                <Star className={cn('w-7 h-7 transition-colors', (rating || 0) >= value ? 'fill-primary text-primary' : 'text-muted-foreground/20')} />
              </button>
            ))}
          </div>
        </div>

        {/* ── Feedback chips ── */}
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide font-medium">{t('outfit.feedback')}</p>
          <div className="flex flex-wrap gap-2">
            {feedbackOptions.map(({ id, label, icon: Icon }) => {
              const isSelected = selectedFeedback.includes(id);
              const colorClass = isSelected
                ? id === 'too_warm' ? 'bg-red-500/10 text-red-500 border-red-500/20'
                : id === 'too_cold' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                : id === 'too_formal' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                : id === 'too_casual' ? 'bg-green-500/10 text-green-600 border-green-500/20'
                : ''
                : '';
              return (
                <Chip key={id} selected={isSelected} onClick={() => handleFeedbackToggle(id)} className={colorClass}>
                  <Icon className="w-3.5 h-3.5 mr-1" />{label}
                </Chip>
              );
            })}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="space-y-3 pt-2">
          <Button
            className="w-full rounded-2xl h-12"
            onClick={handleMarkWorn}
            disabled={markWorn.isPending || !!outfit.worn_at}
          >
            {markWorn.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            {outfit.worn_at ? t('outfit.worn') : t('outfit.mark_worn')}
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="rounded-2xl h-12" onClick={() => navigate('/plan', { state: { preselectedOutfitId: outfit.id } })}>
              <Calendar className="w-4 h-4 mr-2" />{t('outfit.plan')}
            </Button>
            <Button variant="outline" className="rounded-2xl h-12" onClick={handleCreateSimilar}>
              <RefreshCw className="w-4 h-4 mr-2" />{t('outfit.similar')}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Swap sheet ── */}
      <SwapSheet isOpen={swapSheet.isOpen} onClose={() => { setSwapSheet({ isOpen: false, slot: '', outfitItemId: '' }); clearCandidates(); }} slot={swapSheet.slot} candidates={candidates} isLoading={isLoadingCandidates} onSelect={handleSwap} isSwapping={isSwapping} t={t} />

      {/* ── Share sheet ── */}
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
                    <div className="flex-1 p-3 bg-secondary rounded-xl text-sm truncate">{shareUrl}</div>
                    <Button variant="outline" size="icon" onClick={handleCopyShareLink}>
                      {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-2xl" onClick={handleCopyShareLink}>
                    <Link className="w-4 h-4 mr-2" />{copied ? t('outfit.copied') : t('outfit.copy')}
                  </Button>
                  <Button variant="outline" className="flex-1 rounded-2xl" onClick={handleDownloadImage} disabled={isDownloading}>
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
    </div>
  );
}
