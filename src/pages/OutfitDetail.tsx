import { useState, useEffect, useRef } from 'react';
import { hapticLight, hapticMedium, hapticSuccess, hapticHeavy } from '@/lib/haptics';
import { stripBrands } from '@/lib/stripBrands';
import { nativeShare } from '@/lib/nativeShare';
import { normalizeWeather } from '@/lib/outfitContext';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Star, Bookmark, BookmarkCheck, Check, RefreshCw, Share2, Loader2,
  Sparkles, Copy, Download, Link, Link2Off, Calendar, Thermometer, ThermometerSnowflake, Shirt, Briefcase,
  Heart, Frown, Palette, Meh, Camera,
} from 'lucide-react';
import { SwapLoadingState } from '@/components/ui/SwapLoadingState';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getOccasionLabel } from '@/lib/occasionLabel';
import { useOutfit, useUpdateOutfit, useMarkOutfitWorn, useUndoMarkWorn, type OutfitWeather } from '@/hooks/useOutfits';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { useSwapGarment, type SwapCandidate, type SwapMode } from '@/hooks/useSwapGarment';
import { useWeather } from '@/hooks/useWeather';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOutfitFeedback, useSubmitPhotoFeedback } from '@/hooks/usePhotoFeedback';

/* ── Swap Sheet ─────────────────────────────────────── */

interface SwapSheetProps {
  isOpen: boolean;
  onClose: () => void;
  slot: string;
  mode: SwapMode;
  onModeChange: (mode: SwapMode) => void;
  candidates: SwapCandidate[];
  isLoading: boolean;
  onSelect: (garmentId: string) => void;
  isSwapping: boolean;
  t: (key: string) => string;
}

function SwapSheet({
  isOpen,
  onClose,
  slot,
  mode,
  onModeChange,
  candidates,
  isLoading,
  onSelect,
  isSwapping,
  t,
}: SwapSheetProps) {
  const slotLabel = t(`outfit.slot.${slot}`) || slot;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[72vh]">
        <SheetHeader>
          <SheetTitle>{t('outfit.swap')} {slotLabel}</SheetTitle>
          <SheetDescription>Choose how different you want the replacement to feel.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant={mode === 'safe' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onModeChange('safe')}
          >
            Safe
          </Button>
          <Button
            type="button"
            variant={mode === 'bold' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onModeChange('bold')}
          >
            Bold
          </Button>
          <Button
            type="button"
            variant={mode === 'fresh' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onModeChange('fresh')}
          >
            Fresh
          </Button>
        </div>

        <div className="mt-4 pb-8 space-y-2">
          {isLoading ? (
            <SwapLoadingState />
          ) : candidates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{t('outfit.no_alternatives')}</p>
              <p className="text-sm mt-1">{t('outfit.add_more')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map((candidate) => (
                <button
                  key={candidate.garment.id}
                  onClick={() => onSelect(candidate.garment.id)}
                  disabled={isSwapping}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-secondary/80 bg-secondary/60 backdrop-blur-sm active:scale-[0.99]",
                    isSwapping && "opacity-50"
                  )}
                >
                  <LazyImageSimple
                    imagePath={candidate.garment.image_path}
                    alt={candidate.garment.title}
                    className="w-16 h-16 rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate">{stripBrands(candidate.garment.title)}</p>
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
        <p className="font-semibold text-sm truncate mt-0.5">{stripBrands(garmentTitle || '') || t('outfit.unknown')}</p>
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
  const { data: photoFeedback, isLoading: isLoadingFeedback } = useOutfitFeedback(id);
  const submitFeedback = useSubmitPhotoFeedback();
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const [rating, setRating] = useState<number | null>(null);
  const [swapMode, setSwapMode] = useState<SwapMode>('safe');
  const [swapSheet, setSwapSheet] = useState<{
    isOpen: boolean;
    slot: string;
    outfitItemId: string;
    currentGarmentId: string;
  }>({
    isOpen: false,
    slot: '',
    outfitItemId: '',
    currentGarmentId: '',
  });
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<string[]>([]);
  const [explExpanded, setExplExpanded] = useState(false);
  const outfitRef = useRef<HTMLDivElement>(null);

  const justGenerated = (location.state as { justGenerated?: boolean })?.justGenerated;
  const shareUrl = outfit ? `${window.location.origin}/share/${outfit.id}` : '';

  const feedbackOptions = [
    { id: 'loved_it', label: t('outfit.loved_it'), icon: Heart },
    { id: 'too_warm', label: t('outfit.too_warm'), icon: Thermometer },
    { id: 'too_cold', label: t('outfit.too_cold'), icon: ThermometerSnowflake },
    { id: 'too_formal', label: t('outfit.too_formal'), icon: Briefcase },
    { id: 'too_casual', label: t('outfit.too_casual'), icon: Shirt },
    { id: 'uncomfortable', label: t('outfit.uncomfortable'), icon: Frown },
    { id: 'bad_color', label: t('outfit.bad_color'), icon: Palette },
    { id: 'boring', label: t('outfit.boring'), icon: Meh },
  ];

  useEffect(() => {
    if (outfit?.rating) setRating(outfit.rating);
    if (outfit?.feedback) setSelectedFeedback(outfit.feedback);
  }, [outfit?.rating, outfit?.feedback]);

  const buildSwapRequestContext = (outfitItemId: string) => {
    const otherItems =
      outfit?.outfit_items
        .filter((item) => item.id !== outfitItemId)
        .map((item) => ({
          slot: item.slot,
          garment_id: item.garment_id,
        })) || [];

    const otherColors =
      outfit?.outfit_items
        .filter((item) => item.id !== outfitItemId && item.garment?.color_primary)
        .map((item) => item.garment!.color_primary.toLowerCase()) || [];

    const outfitWeather = outfit?.weather as Record<string, unknown> | undefined;
    const normalizedWeather = normalizeWeather(outfitWeather);

    // Merge with current live weather as fallback
    const mergedWeather = {
      temperature: normalizedWeather.temperature ?? currentWeather?.temperature,
      precipitation: normalizedWeather.precipitation !== 'none'
        ? normalizedWeather.precipitation
        : currentWeather?.precipitation || 'none',
      wind: normalizedWeather.wind !== 'low'
        ? normalizedWeather.wind
        : currentWeather?.wind || 'low',
    };

    return {
      otherItems,
      otherColors,
      occasion: outfit?.occasion || 'vardag',
      weather: mergedWeather,
    };
  };

  const handleOpenSwap = async (slot: string, outfitItemId: string, currentGarmentId: string) => {
    const ctx = buildSwapRequestContext(outfitItemId);

    setSwapSheet({
      isOpen: true,
      slot,
      outfitItemId,
      currentGarmentId,
    });

    await fetchCandidates(
      slot,
      currentGarmentId,
      ctx.otherColors,
      ctx.otherItems,
      ctx.occasion,
      ctx.weather,
      swapMode
    );
  };

  useEffect(() => {
    if (!swapSheet.isOpen || !swapSheet.currentGarmentId || !swapSheet.outfitItemId) return;

    const ctx = buildSwapRequestContext(swapSheet.outfitItemId);

    void fetchCandidates(
      swapSheet.slot,
      swapSheet.currentGarmentId,
      ctx.otherColors,
      ctx.otherItems,
      ctx.occasion,
      ctx.weather,
      swapMode
    );
  }, [swapMode]);

  const handleSwapModeChange = async (mode: SwapMode) => {
    setSwapMode(mode);
    if (!swapSheet.isOpen || !swapSheet.slot || !swapSheet.currentGarmentId) return;
    const ctx = buildSwapRequestContext(swapSheet.outfitItemId);
    await fetchCandidates(swapSheet.slot, swapSheet.currentGarmentId, ctx.otherColors, ctx.otherItems, ctx.occasion, ctx.weather, mode);
  };

  const handleSwap = async (newGarmentId: string) => {
    try {
      await swapGarment({ outfitItemId: swapSheet.outfitItemId, newGarmentId });
      toast.success(t('outfit.swapped'));
      setSwapSheet({ isOpen: false, slot: '', outfitItemId: '', currentGarmentId: '' }); refetch();
    } catch { toast.error(t('outfit.swap_error')); }
  };

  const handleToggleSave = async () => {
    if (!outfit) return;
    hapticMedium();
    try {
      await updateOutfit.mutateAsync({ id: outfit.id, updates: { saved: !outfit.saved } });
      toast.success(outfit.saved ? t('outfit.removed') : t('outfit.saved'));
    } catch { toast.error(t('common.something_wrong')); }
  };

  const handleRating = async (value: number) => {
    if (!outfit) return;
    hapticLight();
    setRating(value);
    try { await updateOutfit.mutateAsync({ id: outfit.id, updates: { rating: value } }); toast.success(t('outfit.rating_saved')); } catch { toast.error(t('common.something_wrong')); }
  };

  const handleFeedbackToggle = async (feedbackId: string) => {
    if (!outfit) return;
    const newFeedback = selectedFeedback.includes(feedbackId) ? selectedFeedback.filter(f => f !== feedbackId) : [...selectedFeedback, feedbackId];
    setSelectedFeedback(newFeedback);
    try { await updateOutfit.mutateAsync({ id: outfit.id, updates: { feedback: newFeedback } as TablesUpdate<'outfits'> }); } catch { setSelectedFeedback(selectedFeedback); }
  };

  const handleMarkWorn = async () => {
    if (!outfit) return;
    hapticSuccess();
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
    const shared = await nativeShare({
      title: 'BURS Outfit',
      text: outfit?.explanation || undefined,
      url: shareUrl,
    });
    if (shared) {
      setCopied(true);
      toast.success(t('outfit.copied'));
      setTimeout(() => setCopied(false), 2000);
    }
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

  const weather = outfit.weather as Record<string, unknown> | null;
  const normalizedOutfitWeather = normalizeWeather(weather);
  const displayOccasion = getOccasionLabel(outfit.occasion, t);

  // Build metadata pieces
  const metaParts = [displayOccasion, outfit.style_vibe].filter(Boolean);
  if (normalizedOutfitWeather.temperature !== undefined) metaParts.push(`${normalizedOutfitWeather.temperature}°C`);

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
      <div ref={outfitRef} className="relative sm:rounded-b-3xl overflow-hidden bg-muted/20">
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
      <div className="px-5 sm:px-6 pt-8 pb-40 space-y-10">
        {/* Title + meta */}
        <div>
          <h1 className="text-2xl font-semibold capitalize">{displayOccasion}</h1>
          <p className="text-[13px] text-muted-foreground/60 mt-1">
            {metaParts.join(' · ')}
          </p>
        </div>

        {/* AI explanation */}
        {outfit.explanation && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide font-medium">{t('outfit.why_works')}</p>
            </div>
            <p className={`text-sm text-muted-foreground leading-relaxed ${!explExpanded ? 'line-clamp-2' : ''}`}>{outfit.explanation}</p>
            {outfit.explanation.length > 120 && (
              <button onClick={() => setExplExpanded(v => !v)} className="text-xs text-primary/70 hover:text-primary transition-colors">
                {explExpanded ? t('common.less') : t('common.read_more')}
              </button>
            )}
          </div>
        )}

        {/* ── Style Score Breakdown ── */}
        {outfit.style_score && (() => {
          const score = outfit.style_score as Record<string, number | undefined>;
          const metrics = [
            { key: 'color_harmony', label: t('outfit.score.color') || 'Color Harmony', color: 'bg-primary' },
            { key: 'material_compatibility', label: t('outfit.score.material') || 'Material Match', color: 'bg-accent' },
            { key: 'formality', label: t('outfit.score.formality') || 'Formality Fit', color: 'bg-secondary-foreground/60' },
            { key: 'overall', label: t('outfit.score.overall') || 'Overall', color: 'bg-primary' },
          ].filter(m => typeof score[m.key] === 'number');

          if (metrics.length === 0) return null;

          return (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide font-medium">
                  {t('outfit.score.title') || 'Style Score'}
                </p>
              </div>
              <div className="space-y-3">
                {metrics.map(({ key, label, color }) => {
                  const val = (score[key] as number) ?? 0;
                  const pct = Math.round(val * 10); // assuming 0-10 scale
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-semibold">{val.toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-700", color)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Garment list ── */}
        <div>
          {outfit.outfit_items.map((item) => (
            <SlotRow
              key={item.id}
              slot={item.slot}
              garmentId={item.garment_id}
              garmentTitle={stripBrands(item.garment?.title || '')}
              garmentColor={item.garment?.color_primary}
              imagePath={item.garment?.image_path}
              onSwap={() => handleOpenSwap(item.slot, item.id, item.garment_id)}
              t={t}
            />
          ))}
        </div>

        {/* ── Photo Feedback (Mirror Check) — compact ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide font-medium">
                {t('outfit.photo_feedback')}
              </p>
            </div>
            {!photoFeedback && !submitFeedback.isPending && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-8 text-xs"
                onClick={() => selfieInputRef.current?.click()}
              >
                <Camera className="w-3 h-3 mr-1.5" />{t('outfit.photo_feedback_upload')}
              </Button>
            )}
          </div>

          <input
            ref={selfieInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !id) return;
              try {
                await submitFeedback.mutateAsync({ outfitId: id, selfieFile: file });
                toast.success(t('outfit.photo_feedback_success'));
              } catch {
                toast.error(t('outfit.photo_feedback_error'));
              }
              e.target.value = '';
            }}
          />

          {submitFeedback.isPending && (
            <div className="rounded-2xl bg-muted/20 p-6 flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t('outfit.photo_feedback_analyzing')}</p>
            </div>
          )}

          {photoFeedback && (
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden bg-muted/20">
                <LazyImageSimple
                  imagePath={photoFeedback.selfie_path}
                  alt="Your selfie"
                  className="w-full aspect-[3/4] object-cover"
                />
              </div>
              <div className="space-y-3">
                {[
                  { key: 'fit_score', label: t('outfit.photo_feedback_fit'), value: photoFeedback.fit_score },
                  { key: 'color_match_score', label: t('outfit.photo_feedback_color'), value: photoFeedback.color_match_score },
                  { key: 'overall_score', label: t('outfit.photo_feedback_overall'), value: photoFeedback.overall_score },
                ].filter(m => m.value != null).map(({ key, label, value }) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-semibold">{Number(value).toFixed(1)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${Math.round(Number(value) * 10)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {photoFeedback.commentary && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide font-medium">AI Feedback</p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{photoFeedback.commentary}</p>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs w-full"
                onClick={() => selfieInputRef.current?.click()}
                disabled={submitFeedback.isPending}
              >
                <Camera className="w-3 h-3 mr-1.5" />{t('outfit.photo_feedback_upload')}
              </Button>
            </div>
          )}

          {!photoFeedback && !submitFeedback.isPending && (
            <button
              onClick={() => selfieInputRef.current?.click()}
              className="w-full flex items-center gap-3 rounded-xl bg-muted/10 border border-border/20 px-4 py-3 hover:bg-muted/20 transition-colors"
            >
              <Camera className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
              <span className="text-xs text-muted-foreground/50">{t('outfit.photo_feedback_hint')}</span>
            </button>
          )}
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
                ? (id === 'loved_it' ? 'bg-pink-500/10 text-pink-500 border-pink-500/20'
                  : id === 'too_warm' ? 'bg-red-500/10 text-red-500 border-red-500/20'
                  : id === 'too_cold' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                  : id === 'too_formal' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  : id === 'too_casual' ? 'bg-green-500/10 text-green-600 border-green-500/20'
                  : id === 'uncomfortable' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                  : id === 'bad_color' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                  : id === 'boring' ? 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                  : '')
                : '';
              return (
                <Chip key={id} selected={isSelected} onClick={() => handleFeedbackToggle(id)} className={colorClass}>
                  <Icon className="w-3.5 h-3.5 mr-1" />{label}
                </Chip>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Sticky bottom action bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-background/60 backdrop-blur-2xl border-t border-border/15 safe-bottom">
        <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
          <Button
            className="flex-1 rounded-2xl h-12"
            onClick={handleMarkWorn}
            disabled={markWorn.isPending || !!outfit.worn_at}
          >
            {markWorn.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            {outfit.worn_at ? t('outfit.worn') : t('outfit.mark_worn')}
          </Button>
          <button
            onClick={() => navigate('/plan', { state: { preselectedOutfitId: outfit.id } })}
            className="w-12 h-12 rounded-2xl border border-border/20 flex items-center justify-center hover:bg-muted/40 transition-colors active:scale-95 shrink-0"
            aria-label={t('outfit.plan')}
          >
            <Calendar className="w-5 h-5 text-muted-foreground" />
          </button>
          <button
            onClick={handleCreateSimilar}
            className="w-12 h-12 rounded-2xl border border-border/20 flex items-center justify-center hover:bg-muted/40 transition-colors active:scale-95 shrink-0"
            aria-label={t('outfit.similar')}
          >
            <RefreshCw className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* ── Swap sheet ── */}
      <SwapSheet
        isOpen={swapSheet.isOpen}
        onClose={() => {
          setSwapSheet({ isOpen: false, slot: '', outfitItemId: '', currentGarmentId: '' });
          clearCandidates();
        }}
        slot={swapSheet.slot}
        mode={swapMode}
        onModeChange={setSwapMode}
        candidates={candidates}
        isLoading={isLoadingCandidates}
        onSelect={handleSwap}
        isSwapping={isSwapping}
        t={t}
      />

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
