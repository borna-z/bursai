import { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { stripBrands } from '@/lib/stripBrands';
import { nativeShare } from '@/lib/nativeShare';
import { normalizeWeather } from '@/lib/outfitContext';
import { EASE_CURVE } from '@/lib/motion';
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
import { useOutfit, useUpdateOutfit, useMarkOutfitWorn, useUndoMarkWorn } from '@/hooks/useOutfits';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { useSwapGarment, type SwapCandidate, type SwapMode } from '@/hooks/useSwapGarment';
import { useWeather } from '@/hooks/useWeather';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOutfitFeedback, useSubmitPhotoFeedback } from '@/hooks/usePhotoFeedback';
import { useFeedbackSignals } from '@/hooks/useFeedbackSignals';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { RenderPendingOverlay } from '@/components/wardrobe/RenderPendingOverlay';
import { PageBreadcrumb } from '@/components/ui/PageBreadcrumb';

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

  const modeDescriptions: Record<string, string> = {
    safe: t('swap.mode_safe_desc') || 'Similar style, minimal risk',
    bold: t('swap.mode_bold_desc') || 'Push your boundaries',
    fresh: t('swap.mode_fresh_desc') || 'Least worn items first',
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[72vh]">
        <SheetHeader>
          <SheetTitle>{t('outfit.swap')} {slotLabel}</SheetTitle>
          <SheetDescription>{t('outfit.swap_description')}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {(['safe', 'bold', 'fresh'] as const).map((m) => (
              <Button
                key={m}
                type="button"
                variant={mode === m ? 'default' : 'outline'}
                size="sm"
                onClick={() => onModeChange(m)}
                className="rounded-[1.25rem]"
              >
                {m === 'safe' ? '🔒' : m === 'bold' ? '⚡' : '🌿'}{' '}
                {t(`swap.mode_${m}`) || m.charAt(0).toUpperCase() + m.slice(1)}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/50 text-center">
            {modeDescriptions[mode]}
          </p>
        </div>

        <div className="mt-4 pb-8 space-y-2 overflow-y-auto">
          {isLoading ? (
            <SwapLoadingState />
          ) : candidates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{t('outfit.no_alternatives')}</p>
              <p className="text-sm mt-1">{t('outfit.add_more')}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {candidates.map((candidate, idx) => (
                <button
                  key={candidate.garment.id}
                  onClick={() => onSelect(candidate.garment.id)}
                  disabled={isSwapping}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-[1.25rem] transition-all hover:bg-secondary/80 bg-secondary/40 active:scale-[0.99]",
                    idx === 0 && "ring-1 ring-primary/20 bg-primary/5",
                    isSwapping && "opacity-50"
                  )}
                >
                  <LazyImageSimple
                    imagePath={getPreferredGarmentImagePath(candidate.garment)}
                    alt={candidate.garment.title}
                    className="w-[60px] h-[60px] min-w-[60px] min-h-[60px] rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-sm truncate">{stripBrands(candidate.garment.title)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{candidate.garment.color_primary}</p>
                    {candidate.swap_reason && (
                      <p className="text-[11px] text-primary/70 mt-0.5 leading-snug line-clamp-1 italic">
                        {candidate.swap_reason}
                      </p>
                    )}
                  </div>
                  {idx === 0 && (
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">
                      {t('swap.best_match') || 'Best'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Garment Slot (editorial card) ─────────────── */

const LAYER_ROLE_LABELS: Record<string, string> = {
  base: 'Base Layer',
  mid: 'Mid Layer',
  outer: 'Outer Layer',
  standalone: '',
};

interface SlotRowProps {
  slot: string;
  garmentId: string;
  garmentTitle?: string;
  garmentColor?: string;
  imagePath?: string;
  renderStatus?: string | null;
  onSwap: () => void;
  t: (key: string) => string;
  layerRole?: string;
}

function SlotRow({ slot, garmentId, garmentTitle, garmentColor, imagePath, renderStatus, onSwap, t, layerRole }: SlotRowProps) {
  const navigate = useNavigate();
  // Use layering role label for top-area slots when available
  const isLayeredSlot = ['top', 'outerwear'].includes(slot);
  const roleLabel = isLayeredSlot && layerRole && LAYER_ROLE_LABELS[layerRole]
    ? LAYER_ROLE_LABELS[layerRole]
    : (t(`outfit.slot.${slot}`) || slot);

  const categorySlotLabel = t(`outfit.slot.${slot}`) || slot;

  return (
    <div className="flex items-center gap-4 py-4 border-b border-border/8 last:border-b-0 group">
      {/* Left-side category label */}
      <p className="font-['DM_Sans'] text-[11px] uppercase tracking-widest text-foreground/30 w-12 shrink-0 text-right leading-tight">
        {categorySlotLabel}
      </p>
      <div
        className="relative w-[68px] h-[84px] rounded-[1.1rem] overflow-hidden flex-shrink-0 cursor-pointer bg-muted/20 ring-1 ring-border/10"
        onClick={() => navigate(`/wardrobe/${garmentId}`)}
      >
        <LazyImageSimple
          imagePath={imagePath}
          alt={garmentTitle || slot}
          className="w-[68px] h-[84px] object-cover"
          fallbackIcon={<Shirt className="w-6 h-6 text-muted-foreground/20" />}
        />
        <RenderPendingOverlay renderStatus={renderStatus} variant="overlay" className="[&>span]:hidden" />
      </div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/wardrobe/${garmentId}`)}>
        <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] font-medium">
          {roleLabel}
        </p>
        <p className="font-semibold text-[15px] truncate mt-0.5 tracking-tight">{stripBrands(garmentTitle || '') || t('outfit.unknown')}</p>
        {garmentColor && <p className="text-[12px] text-muted-foreground/60 capitalize mt-0.5">{garmentColor}</p>}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onSwap(); }}
        className="p-2.5 rounded-[1.25rem] bg-muted/20 hover:bg-muted/40 transition-all active:scale-95 flex-shrink-0 opacity-60 group-hover:opacity-100"
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
  const { data: photoFeedback } = useOutfitFeedback(id);
  const submitFeedback = useSubmitPhotoFeedback();
  const { record: recordSignal } = useFeedbackSignals();
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
  const [activeTab, setActiveTab] = useState<'wear' | 'swap' | 'why'>('wear');
  const prefersReduced = useReducedMotion();
  const outfitRef = useRef<HTMLDivElement>(null);

  const justGenerated = (location.state as { justGenerated?: boolean })?.justGenerated;
  const genLimitationNote = (location.state as { limitation_note?: string | null })?.limitation_note;
  const genFamilyLabel = (location.state as { family_label?: string })?.family_label;
  const genWardrobeInsights = (location.state as { wardrobe_insights?: string[] })?.wardrobe_insights;
  const genLayerOrder = (location.state as { layer_order?: { slot: string; garment_id: string; layer_role: string }[] })?.layer_order;
  const genNeedsBaseLayer = (location.state as { needs_base_layer?: boolean })?.needs_base_layer;
  const genOutfitReasoning = (location.state as { outfit_reasoning?: { why_it_works?: string; occasion_fit?: string; weather_logic?: string | null; color_note?: string } })?.outfit_reasoning;
  const genOccasionSubmode = (location.state as { occasion_submode?: string | null })?.occasion_submode;
  const shareUrl = outfit ? `${window.location.origin}/share/${outfit.id}` : '';
  const outfitItems = Array.isArray(outfit?.outfit_items) ? outfit.outfit_items : [];

  // Build a layer role lookup from generation metadata
  const layerRoleMap = new Map<string, string>();
  if (genLayerOrder) {
    for (const entry of genLayerOrder) {
      layerRoleMap.set(entry.garment_id, entry.layer_role);
    }
  }

  // Sort outfit items by layer order when available
  const SLOT_SORT_ORDER: Record<string, number> = {
    base: 0, standalone: 1, mid: 2, outer: 3, top: 1, bottom: 4, dress: 1, shoes: 5, accessory: 6,
  };
  const sortedOutfitItems = [...outfitItems].sort((a, b) => {
    const aRole = layerRoleMap.get(a.garment_id) || a.slot;
    const bRole = layerRoleMap.get(b.garment_id) || b.slot;
    return (SLOT_SORT_ORDER[aRole] ?? 99) - (SLOT_SORT_ORDER[bRole] ?? 99);
  });

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
    const otherItems = outfitItems
      .filter((item) => item.id !== outfitItemId)
      .map((item) => ({
        slot: item.slot,
        garment_id: item.garment_id,
      }));

    const otherColors = outfitItems
      .filter((item) => item.id !== outfitItemId && item.garment?.color_primary)
      .map((item) => item.garment.color_primary.toLowerCase());

    const outfitWeather = outfit?.weather as Record<string, unknown> | undefined;
    const normalizedWeather = normalizeWeather(outfitWeather);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapMode]);

  const handleSwap = async (newGarmentId: string) => {
    try {
      await swapGarment({ outfitItemId: swapSheet.outfitItemId, newGarmentId });
      recordSignal({
        signal_type: 'swap_choice',
        outfit_id: outfit?.id,
        garment_id: newGarmentId,
        value: swapSheet.slot,
        metadata: { replaced: swapSheet.currentGarmentId, mode: swapMode },
      });
      toast.success(t('outfit.swapped'));
      setSwapSheet({ isOpen: false, slot: '', outfitItemId: '', currentGarmentId: '' });
      refetch();
    } catch {
      toast.error(t('outfit.swap_error'));
    }
  };

  const handleToggleSave = async () => {
    if (!outfit) return;
    hapticMedium();
    try {
      await updateOutfit.mutateAsync({ id: outfit.id, updates: { saved: !outfit.saved } });
      recordSignal({ signal_type: outfit.saved ? 'unsave' : 'save', outfit_id: outfit.id });
      toast.success(outfit.saved ? t('outfit.removed') : t('outfit.saved'));
    } catch {
      toast.error(t('common.something_wrong'));
    }
  };

  const handleRating = async (value: number) => {
    if (!outfit) return;
    hapticLight();
    setRating(value);
    try {
      await updateOutfit.mutateAsync({ id: outfit.id, updates: { rating: value } });
      recordSignal({ signal_type: 'rating', outfit_id: outfit.id, value: String(value) });
      toast.success(t('outfit.rating_saved'));
    } catch {
      toast.error(t('common.something_wrong'));
    }
  };

  const handleFeedbackToggle = async (feedbackId: string) => {
    if (!outfit) return;
    const isAdding = !selectedFeedback.includes(feedbackId);
    const newFeedback = isAdding
      ? [...selectedFeedback, feedbackId]
      : selectedFeedback.filter((f) => f !== feedbackId);
    setSelectedFeedback(newFeedback);
    try {
      await updateOutfit.mutateAsync({ id: outfit.id, updates: { feedback: newFeedback } as TablesUpdate<'outfits'> });
      if (isAdding) {
        recordSignal({ signal_type: 'quick_reaction', outfit_id: outfit.id, value: feedbackId });
      }
    } catch {
      setSelectedFeedback(selectedFeedback);
    }
  };

  const handleMarkWorn = async () => {
    if (!outfit) return;
    hapticSuccess();
    try {
      const garmentIds = outfitItems.map((item) => item.garment_id);
      const result = await markWorn.mutateAsync({ outfitId: outfit.id, garmentIds, occasion: outfit.occasion });
      recordSignal({ signal_type: 'wear_confirm', outfit_id: outfit.id, metadata: { garment_count: garmentIds.length } });
      toast.success(t('outfit.marked_worn'), {
        action: {
          label: t('outfit.undo'),
          onClick: async () => {
            try {
              await undoMarkWorn.mutateAsync(result);
              toast.success(t('outfit.undone'));
            } catch {
              toast.error(t('outfit.undo_error'));
            }
          },
        },
        duration: 10000,
      });
    } catch {
      toast.error(t('common.something_wrong'));
    }
  };

  const handleCreateSimilar = () => {
    navigate('/ai/generate', {
      state: {
        prefillOccasion: outfit?.occasion,
        prefillStyle: outfit?.style_vibe,
      },
    });
  };

  const handleToggleShareEnabled = async () => {
    if (!outfit) return;
    try {
      await updateOutfit.mutateAsync({ id: outfit.id, updates: { share_enabled: !outfit.share_enabled } });
      toast.success(outfit.share_enabled ? t('outfit.share_off') : t('outfit.share_on'));
      refetch();
    } catch {
      toast.error(t('common.something_wrong'));
    }
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
      const link = document.createElement('a');
      link.download = `outfit-${outfit.occasion}.png`;
      link.href = dataUrl;
      link.click();
      toast.success(t('outfit.downloaded'));
    } catch {
      toast.error(t('outfit.download_error'));
    } finally {
      setIsDownloading(false);
    }
  };

  

  if (isLoading) {
    
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 p-4 flex items-center justify-between">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex gap-2">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="w-10 h-10 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1 px-1">
          <Skeleton className="aspect-[3/4] rounded-[1.1rem]" />
          <Skeleton className="aspect-[3/4] rounded-[1.1rem]" />
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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="max-w-xs w-full text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-[1.25rem] bg-muted flex items-center justify-center">
            <Shirt className="w-7 h-7 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <p className="font-['Playfair_Display'] italic text-[1.2rem] leading-tight text-foreground text-foreground">{t('outfit.not_found')}</p>
            <p className="text-sm text-muted-foreground">{t('common.something_wrong')}</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/outfits')} className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Button>
        </div>
      </div>
    );
  }

  const normalizedOutfitWeather = normalizeWeather(outfit.weather as Record<string, unknown> | null);
  const displayOccasion = getOccasionLabel(outfit.occasion, t);
  const metaParts = [displayOccasion, outfit.style_vibe].filter(Boolean) as string[];
  if (normalizedOutfitWeather.temperature !== undefined) {
    metaParts.push(`${normalizedOutfitWeather.temperature}°C`);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Floating nav ── */}
      <div className="fixed top-0 left-0 right-0 z-20 p-4 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="h-11 w-11 rounded-full border border-border/30 bg-background/80 flex items-center justify-center active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleToggleSave}
            className="h-11 w-11 rounded-full border border-border/30 bg-background/80 flex items-center justify-center active:scale-95 transition-transform"
          >
            {outfit.saved ? <BookmarkCheck className="w-5 h-5 text-primary" /> : <Bookmark className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setShareSheetOpen(true)}
            className="h-11 w-11 rounded-full border border-border/30 bg-background/80 flex items-center justify-center active:scale-95 transition-transform"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Breadcrumb ── */}
      <div className="pt-14">
        <PageBreadcrumb items={[
          { label: 'Outfits', href: '/outfits' },
          { label: displayOccasion || 'Outfit' },
        ]} />
      </div>

      {/* ── Full-bleed image strip ── */}
      <div ref={outfitRef} className="flex w-full">
        {outfitItems.slice(0, 5).map((item) => (
          <div key={item.id} className="flex-1 aspect-square bg-card overflow-hidden">
            <LazyImageSimple
              imagePath={item.garment ? getPreferredGarmentImagePath(item.garment) : undefined}
              alt={item.garment?.title || item.slot}
              className="w-full h-full"
              fallbackIcon={<Shirt className="w-6 h-6 text-foreground/20" />}
            />
          </div>
        ))}
      </div>

      {/* ── Dark info block ── */}
      <div className="bg-foreground/[0.96] px-5 py-5">
        <p className="font-['DM_Sans'] text-[11px] font-medium uppercase tracking-[0.12em] text-background/[0.45] mb-2.5">
          {genOccasionSubmode || displayOccasion}
        </p>
        {outfit.explanation && (
          <p className="text-[13px] leading-6 text-background/86">
            {outfit.explanation}
          </p>
        )}
        {genWardrobeInsights && genWardrobeInsights.length > 0 && (
          <p className="font-['DM_Sans'] text-[12px] text-background/50 leading-[1.5]">
            {genWardrobeInsights.slice(0, 2).join(' / ')}
          </p>
        )}
      </div>

      {/* ── 3-Tab row ── */}
      <div className="px-5 py-4">
        <div className="surface-inset flex rounded-full border p-1">
          {(['wear', 'swap', 'why'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "h-12 flex-1 rounded-full px-3 py-2.5 font-['DM_Sans'] text-[12px] font-medium transition-colors",
                activeTab === tab
                  ? "bg-foreground text-background"
                  : "text-foreground/45"
              )}
            >
              {tab === 'wear' ? 'Wear' : tab === 'swap' ? 'Swap' : 'Why'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="px-5 pb-20">
        {activeTab === 'wear' && (
          <div className="flex flex-col gap-2.5">
            <Button
              onClick={handleMarkWorn}
              disabled={markWorn.isPending || !!outfit.worn_at}
              className={cn(
                "w-full h-14 rounded-full bg-foreground text-background font-['DM_Sans'] text-[15px] font-medium flex items-center justify-center gap-2",
                outfit.worn_at && "opacity-50 cursor-default"
              )}
            >
              {markWorn.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {outfit.worn_at ? t('outfit.worn') : t('outfit.mark_worn')}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => navigate('/plan', { state: { preselectedOutfitId: outfit.id } })}
                className="h-11 rounded-full border border-foreground/20 bg-transparent text-foreground font-['DM_Sans'] text-[13px] font-medium"
              >
                {t('outfit.plan') || 'Plan'}
              </Button>
              <Button
                variant="outline"
                onClick={handleToggleSave}
                className="h-11 rounded-full border border-foreground/20 bg-transparent text-foreground font-['DM_Sans'] text-[13px] font-medium flex items-center justify-center gap-2"
              >
                {outfit.saved
                  ? <><BookmarkCheck className="w-4 h-4" />{t('outfit.saved')}</>
                  : <><Bookmark className="w-4 h-4" />{t('outfit.save') || 'Save'}</>
                }
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="ghost"
                onClick={() => setShareSheetOpen(true)}
                className="h-11 rounded-full bg-card text-foreground font-['DM_Sans'] text-[13px] flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </Button>
              <Button
                variant="ghost"
                onClick={handleCreateSimilar}
                className="h-11 rounded-full bg-card text-foreground font-['DM_Sans'] text-[13px] flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Remake
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'swap' && (
          <div>
            {sortedOutfitItems.map((item) => (
              <SlotRow
                key={item.id}
                slot={item.slot}
                garmentId={item.garment_id}
                garmentTitle={stripBrands(item.garment?.title || '')}
                garmentColor={item.garment?.color_primary}
                imagePath={item.garment ? getPreferredGarmentImagePath(item.garment) : undefined}
                renderStatus={item.garment?.render_status}
                onSwap={() => handleOpenSwap(item.slot, item.id, item.garment_id)}
                t={t}
                layerRole={layerRoleMap.get(item.garment_id)}
              />
            ))}
          </div>
        )}

        {activeTab === 'why' && (
          <div className="flex flex-col gap-4">
            {outfit.explanation && (
              <p className="font-['Playfair_Display'] italic text-[16px] text-foreground leading-[1.6]">
                {outfit.explanation}
              </p>
            )}
            {genWardrobeInsights && genWardrobeInsights.length > 0 && (
              <p className="font-['DM_Sans'] text-[13px] text-foreground/[0.55] leading-[1.6]">
                {genWardrobeInsights.join(' / ')}
              </p>
            )}
            {genOutfitReasoning && (
              <div className="flex flex-col gap-3">
                {genOutfitReasoning.occasion_fit && (
                  <div>
                    <p className="font-['DM_Sans'] text-[10px] uppercase tracking-[0.1em] text-foreground/[0.35] mb-1">OCCASION</p>
                    <p className="font-['DM_Sans'] text-[13px] text-foreground/60">{genOutfitReasoning.occasion_fit}</p>
                  </div>
                )}
                {genOutfitReasoning.weather_logic && (
                  <div>
                    <p className="font-['DM_Sans'] text-[10px] uppercase tracking-[0.1em] text-foreground/[0.35] mb-1">WEATHER</p>
                    <p className="font-['DM_Sans'] text-[13px] text-foreground/60">{genOutfitReasoning.weather_logic}</p>
                  </div>
                )}
                {genOutfitReasoning.color_note && (
                  <div>
                    <p className="font-['DM_Sans'] text-[10px] uppercase tracking-[0.1em] text-foreground/[0.35] mb-1">COLOUR</p>
                    <p className="font-['DM_Sans'] text-[13px] text-foreground/60">{genOutfitReasoning.color_note}</p>
                  </div>
                )}
              </div>
            )}
            {genLimitationNote && (
              <p className="font-['DM_Sans'] italic text-[12px] text-foreground/40">
                Your stylist suggests: {genLimitationNote}
              </p>
            )}
          </div>
        )}
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
                    <div className="flex-1 p-3 bg-secondary rounded-[1.1rem] text-sm truncate">{shareUrl}</div>
                    <Button variant="outline" size="icon" onClick={handleCopyShareLink}>
                      {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-[1.25rem]" onClick={handleCopyShareLink}>
                    <Link className="w-4 h-4 mr-2" />{copied ? t('outfit.copied') : t('outfit.copy')}
                  </Button>
                  <Button variant="outline" className="flex-1 rounded-[1.25rem]" onClick={handleDownloadImage} disabled={isDownloading}>
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
