import { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { stripBrands } from '@/lib/stripBrands';
import { nativeShare } from '@/lib/nativeShare';
import { normalizeWeather } from '@/lib/outfitContext';
import { EASE_CURVE, DURATION_MEDIUM, DURATION_SLOW } from '@/lib/motion';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Bookmark, BookmarkCheck, Check,
  Copy, Download, Link, Link2Off, Thermometer, ThermometerSnowflake, Shirt, Briefcase,
  Heart, Frown, Palette, Meh, Loader2, Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { PageBreadcrumb } from '@/components/ui/PageBreadcrumb';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { SwapSheet, SlotRow } from '@/components/outfit/OutfitDetailSlots';
import { OutfitDetailActions } from '@/components/outfit/OutfitDetailActions';
import { PageHeader } from '@/components/layout/PageHeader';

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
    hapticLight();
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
        <PageHeader title={t('outfit.label')} showBack variant="overlay" />
        <div className="flex w-full">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="flex-1 aspect-square" />
          ))}
        </div>
        <div className="px-[var(--page-px)] pt-6 space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-36" />
          <div className="space-y-3 pt-4">
            <Skeleton className="h-20 w-full rounded-[1.25rem]" />
            <Skeleton className="h-20 w-full rounded-[1.25rem]" />
            <Skeleton className="h-20 w-full rounded-[1.25rem]" />
          </div>
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
            <p className="font-display italic text-[1.2rem] leading-tight text-foreground">{t('outfit.not_found')}</p>
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
      <PageHeader
        title={outfit.title || displayOccasion || t('outfit.label')}
        showBack
        variant="overlay"
        actions={(
          <>
            <button
              type="button"
              onClick={() => { hapticLight(); handleToggleSave(); }}
              className="h-11 w-11 rounded-full border border-white/30 bg-black/35 text-white backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform"
              aria-label={t('outfit.save')}
            >
              {outfit.saved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => { hapticLight(); setShareSheetOpen(true); }}
              className="h-11 w-11 rounded-full border border-white/30 bg-black/35 text-white backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform"
              aria-label={t('outfit.share')}
            >
              <Share2 className="w-5 h-5" />
            </button>
          </>
        )}
      />

      {/* ── Breadcrumb ── */}
      <div>
        <PageBreadcrumb items={[
          { label: t('outfits.title'), href: '/outfits' },
          { label: displayOccasion || t('outfit.label') },
        ]} />
      </div>

      {/* ── Full-bleed image strip ── */}
      <motion.div
        ref={outfitRef}
        initial={prefersReduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DURATION_SLOW, ease: EASE_CURVE }}
        className="flex w-full"
      >
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
      </motion.div>

      {/* ── V4 Editorial Title Block ── */}
      <motion.div
        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: DURATION_MEDIUM, ease: EASE_CURVE }}
        className="px-[var(--page-px)] pt-5 pb-4"
      >
        <p className="label-editorial text-muted-foreground/60 mb-1">
          {genOccasionSubmode || displayOccasion}
        </p>
        <h1 className="font-display italic text-[1.5rem] leading-tight text-foreground tracking-tight">
          {genFamilyLabel || outfit.title || displayOccasion}
        </h1>
        {outfit.explanation && (
          <p className="font-display italic text-[13px] text-foreground/55 leading-relaxed mt-2 line-clamp-3">
            {outfit.explanation}
          </p>
        )}
        {metaParts.length > 0 && (
          <p className="text-[11px] font-body text-muted-foreground/60 mt-2 tracking-wide">
            {metaParts.join(' · ')}
          </p>
        )}
      </motion.div>

      {/* ── 3-Tab row ── */}
      <div className="px-[var(--page-px)] pb-4">
        <div className="flex rounded-full border border-border/40 p-1">
          {(['wear', 'swap', 'why'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { hapticLight(); setActiveTab(tab); }}
              className={cn(
                "h-11 flex-1 rounded-full px-3 py-2 font-body text-[12px] font-medium transition-all",
                activeTab === tab
                  ? "bg-foreground text-background"
                  : "text-foreground/40"
              )}
            >
              {tab === 'wear' ? t('outfit.tab_wear') : tab === 'swap' ? t('outfit.tab_swap') : t('outfit.tab_why')}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="px-[var(--page-px)] pb-20">
        {activeTab === 'wear' && (
          <OutfitDetailActions
            outfit={outfit}
            onMarkWorn={handleMarkWorn}
            isMarkingWorn={markWorn.isPending}
            onToggleSave={handleToggleSave}
            onShare={() => setShareSheetOpen(true)}
            onCreateSimilar={handleCreateSimilar}
            rating={rating}
            onRating={handleRating}
          />
        )}

        {activeTab === 'swap' && (
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE }}
          >
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
          </motion.div>
        )}

        {activeTab === 'why' && (
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE }}
            className="flex flex-col gap-4"
          >
            {genOutfitReasoning?.why_it_works && (
              <p className="font-display italic text-[15px] text-foreground/70 leading-relaxed">
                "{genOutfitReasoning.why_it_works}"
              </p>
            )}
            {!genOutfitReasoning && outfit.explanation && (
              <p className="font-display italic text-[15px] text-foreground/70 leading-relaxed">
                "{outfit.explanation}"
              </p>
            )}
            {genWardrobeInsights && genWardrobeInsights.length > 0 && (
              <p className="font-body text-[12px] text-foreground/45 leading-relaxed">
                {genWardrobeInsights.join(' · ')}
              </p>
            )}
            {genOutfitReasoning && (
              <div className="flex flex-col gap-4 pt-2">
                {genOutfitReasoning.occasion_fit && (
                  <div>
                    <p className="label-editorial text-muted-foreground/35 mb-1">OCCASION</p>
                    <p className="font-body text-[13px] text-foreground/55 leading-relaxed">{genOutfitReasoning.occasion_fit}</p>
                  </div>
                )}
                {genOutfitReasoning.weather_logic && (
                  <div>
                    <p className="label-editorial text-muted-foreground/35 mb-1">WEATHER</p>
                    <p className="font-body text-[13px] text-foreground/55 leading-relaxed">{genOutfitReasoning.weather_logic}</p>
                  </div>
                )}
                {genOutfitReasoning.color_note && (
                  <div>
                    <p className="label-editorial text-muted-foreground/35 mb-1">COLOUR</p>
                    <p className="font-body text-[13px] text-foreground/55 leading-relaxed">{genOutfitReasoning.color_note}</p>
                  </div>
                )}
              </div>
            )}
            {genLimitationNote && (
              <p className="font-body italic text-[12px] text-foreground/35 pt-1">
                Your stylist suggests: {genLimitationNote}
              </p>
            )}
          </motion.div>
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
