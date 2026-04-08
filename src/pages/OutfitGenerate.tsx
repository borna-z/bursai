import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, AlertCircle } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { OutfitGenerationState } from '@/components/ui/OutfitGenerationState';
import { useOutfitGenerator, type GeneratedOutfit } from '@/hooks/useOutfitGenerator';
import { useGarmentsByIds } from '@/hooks/useGarmentsByIds';
import { useFlatGarments, type Garment } from '@/hooks/useGarments';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { useCachedSignedUrl } from '@/hooks/useSignedUrlCache';
import { useUpdateOutfit, useMarkOutfitWorn } from '@/hooks/useOutfits';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { useWeather } from '@/hooks/useWeather';
import { useCalendarEvents } from '@/hooks/useCalendarSync';
import { useSubscription } from '@/hooks/useSubscription';
import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
import { toast } from 'sonner';
import { PageErrorBoundary } from '@/components/layout/PageErrorBoundary';
import {
  COMPLETE_OUTFIT_RECOVERY_MESSAGE,
  PREFERRED_GARMENT_RECOVERY_MESSAGE,
  humanizeOutfitGenerationError,
} from '@/lib/outfitGenerationErrors';
import { validateCompleteOutfit } from '@/lib/outfitValidation';
import {
  buildStyleFlowSearch,
  extractStyleFlowGarmentIds,
  extractStyleFlowOccasion,
  extractStyleFlowStyles,
  resolveStyleFlowGarmentIds,
} from '@/lib/styleFlowState';
import { buildDayIntelligence } from '@/lib/dayIntelligence';
import { hapticLight } from '@/lib/haptics';
import { EASE_CURVE, DURATION_MEDIUM } from '@/lib/motion';
import { OutfitGenerateResult } from '@/components/outfit/OutfitGenerateResult';
import { OutfitGeneratePicker, OCCASIONS, STYLES, type GenerationMode } from '@/components/outfit/OutfitGeneratePicker';

type Phase = 'picking' | 'generating' | 'done' | 'error';

const THINKING_KEYS = [
  'generate.thinking_0',
  'generate.thinking_1',
  'generate.thinking_2',
  'generate.thinking_3',
  'generate.thinking_4',
] as const;

function useGeneratingMessage(t: (key: string) => string, active: boolean, prefersReduced: boolean) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active || prefersReduced) { setIndex(0); return; }
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % THINKING_KEYS.length);
    }, 2500);
    return () => clearInterval(id);
  }, [active, prefersReduced]);
  return t(THINKING_KEYS[index]);
}

function isGeneratedOutfitComplete(outfit: GeneratedOutfit): boolean {
  return validateCompleteOutfit(
    outfit.items.map((item) => ({ slot: item.slot, garment: item.garment })),
  ).isValid;
}

/* ── Weather styling advice ── */
function getWeatherAdvice(temp?: number, precipitation?: string): string {
  if (temp === undefined) return '';
  if (precipitation === 'rain') return 'Rain-ready fabrics';
  if (precipitation === 'snow') return 'Warm & layered';
  if (temp <= 5) return 'Bundle up';
  if (temp <= 12) return 'Layer up';
  if (temp <= 20) return 'Light layers';
  return 'Light & breathable';
}

function OutfitGenerateFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <h1 className="font-display italic text-[1.3rem] leading-tight text-foreground">Outfit generation is unavailable right now</h1>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    </div>
  );
}

export default function OutfitGeneratePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const { generateOutfit, generateOutfitCandidates, isGenerating } = useOutfitGenerator();
  const { isUnlocked } = useWardrobeUnlocks();
  const { weather } = useWeather();
  const todayDate = new Date().toISOString().slice(0, 10);
  const { data: calendarEvents } = useCalendarEvents(todayDate);
  const { canCreateOutfit, isPremium } = useSubscription();

  const [phase, setPhase] = useState<Phase>('picking');
  const [selectedOccasion, setSelectedOccasion] = useState<string>(() => {
    const prefilledOccasion = extractStyleFlowOccasion(location.state);
    return OCCASIONS.some((occasion) => occasion.key === prefilledOccasion) ? prefilledOccasion : 'casual';
  });
  const [selectedStyles, setSelectedStyles] = useState<string[]>(() => {
    const prefilledStyles = extractStyleFlowStyles(location.state);
    return prefilledStyles.filter((style): style is string => STYLES.includes(style as typeof STYLES[number])).slice(0, 2);
  });
  const prefersReduced = useReducedMotion();
  const generatingMessage = useGeneratingMessage(t, phase === 'generating', !!prefersReduced);
  const { data: allGarments } = useFlatGarments();
  const previewGarments = useMemo(
    () => (allGarments ?? []).slice(0, 4),
    [allGarments],
  );
  const [generationMode, setGenerationMode] = useState<GenerationMode>(isPremium ? 'stylist' : 'standard');
  const [lastError, setLastError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [generatedResults, setGeneratedResults] = useState<GeneratedOutfit[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const updateOutfit = useUpdateOutfit();
  const markWorn = useMarkOutfitWorn();
  const preferredGarmentIds = useMemo(
    () => resolveStyleFlowGarmentIds(location.search, location.state),
    [location.search, location.state],
  );
  const { data: preferredGarments } = useGarmentsByIds(preferredGarmentIds);

  useEffect(() => {
    if (!location.state) return;
    const stateGarmentIds = extractStyleFlowGarmentIds(location.state);
    const nextSearch = location.search || buildStyleFlowSearch(stateGarmentIds);
    navigate(`${location.pathname}${nextSearch}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  const preferredGarmentIdSet = useMemo(() => new Set(preferredGarmentIds), [preferredGarmentIds]);
  const preferredGarmentSummary = useMemo(() => {
    if (!preferredGarmentIds.length) return null;
    const firstGarment = preferredGarments?.[0];
    if (preferredGarmentIds.length === 1) {
      return firstGarment?.title || 'Selected garment';
    }
    return firstGarment?.title
      ? `${firstGarment.title} + ${preferredGarmentIds.length - 1} more`
      : `${preferredGarmentIds.length} selected pieces`;
  }, [preferredGarmentIds, preferredGarments]);
  const preferredGarmentKey = useMemo(() => preferredGarmentIds.join('|'), [preferredGarmentIds]);
  const selectedStyleKey = useMemo(() => selectedStyles.slice().sort().join('|'), [selectedStyles]);

  const contextSubtitle = useMemo(() => {
    const parts: string[] = [];
    if (preferredGarmentIds.length === 1) parts.push('Styled around your selected piece');
    if (preferredGarmentIds.length > 1) parts.push(`Built from ${preferredGarmentIds.length} selected pieces`);
    const occ = OCCASIONS.find(o => o.key === selectedOccasion);
    if (occ) parts.push(occ.label);
    if (selectedStyles.length > 0) parts.push(selectedStyles.join(', '));
    const weatherHint = getWeatherAdvice(weather?.temperature, weather?.precipitation);
    if (weatherHint) parts.push(weatherHint);
    if (weather?.temperature !== undefined) parts.push(`${weather.temperature}°C`);
    return parts.join(' · ');
  }, [preferredGarmentIds.length, selectedOccasion, selectedStyles, weather?.precipitation, weather?.temperature]);
  const weatherAdvice = getWeatherAdvice(weather?.temperature, weather?.precipitation);
  const dayContext = useMemo(() => {
    if (!calendarEvents?.length) return null;
    return buildDayIntelligence(calendarEvents, weather ?? undefined);
  }, [calendarEvents, weather]);
  const clearPreferredGarments = useCallback(() => {
    navigate(location.pathname, { replace: true });
  }, [location.pathname, navigate]);

  useEffect(() => {
    setExcludeIds([]);
  }, [generationMode, preferredGarmentKey, selectedOccasion, selectedStyleKey]);

  const handleGenerate = useCallback(async () => {
    if (!canCreateOutfit()) {
      setShowPaywall(true);
      return;
    }
    setPhase('generating');
    setLastError(null);
    try {
      const request = {
        occasion: selectedOccasion,
        style: selectedStyles.length > 0 ? selectedStyles.join(', ') : null,
        locale,
        eventTitle: calendarEvents?.[0]?.title ?? null,
        dayContext,
        mode: generationMode,
        exclude_garment_ids: excludeIds.filter((garmentId) => !preferredGarmentIdSet.has(garmentId)),
        prefer_garment_ids: preferredGarmentIds,
        weather: {
          temperature: weather?.temperature,
          precipitation: weather?.precipitation ?? 'none',
          wind: weather?.wind ?? 'low',
        },
      };
      const result = generationMode === 'stylist'
        ? await generateOutfitCandidates(request)
        : await generateOutfit(request);
      const results = (Array.isArray(result) ? result : [result]).filter(isGeneratedOutfitComplete);
      if (results.length === 0) {
        throw new Error(preferredGarmentIds.length > 0
          ? PREFERRED_GARMENT_RECOVERY_MESSAGE
          : COMPLETE_OUTFIT_RECOVERY_MESSAGE);
      }
      setGeneratedResults(results);
      setPrimaryIndex(0);
      setExcludeIds((prev) => [
        ...new Set([
          ...prev,
          ...results
            .flatMap((resultItem) => resultItem.items?.map((item) => item.garment.id) ?? [])
            .filter((garmentId) => !preferredGarmentIdSet.has(garmentId)),
        ]),
      ]);
      setPhase('done');
    } catch (err) {
      const message = humanizeOutfitGenerationError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
      setLastError(message);
      setPhase('error');
      toast.error('Generation failed', { description: message });
    }
  }, [
    calendarEvents,
    canCreateOutfit,
    excludeIds,
    generateOutfit,
    generateOutfitCandidates,
    generationMode,
    locale,
    dayContext,
    preferredGarmentIdSet,
    preferredGarmentIds,
    selectedOccasion,
    selectedStyles,
    weather?.precipitation,
    weather?.temperature,
    weather?.wind,
  ]);

  // Gate: require enough garments
  if (!isUnlocked('outfit_gen')) {
    return (
      <PageErrorBoundary fallback={<OutfitGenerateFallback />}>
      <AppLayout>
        <div className="page-shell !max-w-md !pt-16">
          <div className="space-y-6 p-5">
            <h2 className="font-display italic text-[1.2rem] leading-tight text-foreground tracking-tight">{t('unlock.outfit_gen')}</h2>
            <WardrobeProgress message={t('unlock.outfit_gen_message')} />
          </div>
        </div>
      </AppLayout>
      </PageErrorBoundary>
    );
  }

  const handleSaveOutfit = async (outfit: GeneratedOutfit) => {
    if (!isGeneratedOutfitComplete(outfit)) {
      toast.error('Could not save incomplete outfit');
      return;
    }
    try {
      await updateOutfit.mutateAsync({ id: outfit.id, updates: { saved: true } });
      toast.success('Outfit saved');
    } catch {
      toast.error('Could not save outfit');
    }
  };

  const handlePlanOutfit = (outfit: GeneratedOutfit) => {
    if (!isGeneratedOutfitComplete(outfit)) {
      toast.error('Could not plan incomplete outfit');
      return;
    }
    navigate(`/outfits/${outfit.id}`, {
      state: { openPlanner: true },
    });
  };

  // ── GENERATING PHASE ──
  if (phase === 'generating') {
    return (
      <PageErrorBoundary fallback={<OutfitGenerateFallback />}>
        <AppLayout>
          <div className="page-shell flex min-h-[60vh] flex-col items-center justify-center gap-8 !pt-10">
            {/* Pulsing garment thumbnails */}
            {previewGarments.length > 0 && (
              <div className="flex items-center justify-center gap-3">
                {previewGarments.map((g, i) => (
                  <GeneratingThumb key={g.id} garment={g} index={i} prefersReduced={!!prefersReduced} />
                ))}
              </div>
            )}

            {/* Animated generating message */}
            <div className="flex flex-col items-center gap-2 text-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={generatingMessage}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                  className="text-[0.95rem] font-medium text-foreground/70"
                >
                  {generatingMessage}
                </motion.p>
              </AnimatePresence>
              {contextSubtitle && (
                <p className="text-[0.8rem] text-muted-foreground/50 max-w-[18rem] leading-snug">
                  {contextSubtitle}
                </p>
              )}
            </div>
          </div>
        </AppLayout>
      </PageErrorBoundary>
    );
  }

  // ── DONE PHASE — V4 Editorial Result ──
  if (phase === 'done' && generatedResults.length > 0) {
    const primary = generatedResults[primaryIndex];
    const alternateResults = generatedResults
      .map((r, i) => ({ ...r, originalIndex: i }))
      .filter((_, index) => index !== primaryIndex);
    const reasoningText =
      primary.outfit_reasoning?.why_it_works ||
      (primary.explanation
        ? primary.explanation.length > 100
          ? `${primary.explanation.slice(0, 100)}…`
          : primary.explanation
        : '');

    const presentSlots = new Set(primary.items.map(i => i.slot));
    const expectedSlots = ['top', 'bottom', 'shoes'];
    const missingSlots = expectedSlots.filter(s => !presentSlots.has(s) && !presentSlots.has('dress'));
    const effectiveMissing = presentSlots.has('dress')
      ? expectedSlots.filter(s => s === 'shoes' && !presentSlots.has('shoes'))
      : missingSlots;

    const handleWearToday = async () => {
      if (!isGeneratedOutfitComplete(primary)) {
        toast.error('Could not wear incomplete outfit');
        return;
      }
      try {
        const garmentIds = primary.items.map((item) => item.garment.id);
        await markWorn.mutateAsync({
          outfitId: primary.id,
          garmentIds,
          occasion: primary.occasion,
        });
        toast.success('Outfit logged for today');
        navigate('/plan');
      } catch {
        toast.error('Could not log outfit');
      }
    };

    const handleRefineInChat = () => {
      const garmentIds = primary.items.map((item) => item.garment.id);
      navigate(`/ai/chat${buildStyleFlowSearch(garmentIds)}`, {
        state: {
          outfitId: primary.id,
          prefillMessage: 'Refine this outfit for me.',
          seedOutfitIds: garmentIds,
        },
      });
    };

    return (
      <PageErrorBoundary fallback={<OutfitGenerateFallback />}>
        <AppLayout>
          <div className="page-shell !pt-6 pb-36">
            <OutfitGenerateResult
              primary={primary}
              alternateResults={alternateResults}
              generatedResultsLength={generatedResults.length}
              primaryIndex={primaryIndex}
              onPrimaryIndexChange={setPrimaryIndex}
              reasoningText={reasoningText}
              effectiveMissing={effectiveMissing}
              contextSubtitle={contextSubtitle}
              weather={weather}
              prefersReduced={prefersReduced}
              isMarkingWorn={markWorn.isPending}
              isGenerating={isGenerating}
              onWearToday={handleWearToday}
              onSave={handleSaveOutfit}
              onPlan={handlePlanOutfit}
              onRefineInChat={handleRefineInChat}
              onRegenerate={handleGenerate}
              onStartOver={() => { hapticLight(); setPhase('picking'); }}
              onGarmentClick={(id) => navigate(`/wardrobe/${id}`)}
              onMissingSlotClick={(slot) => navigate(`/wardrobe?category=${slot === 'bottom' ? 'bottoms' : slot}`)}
            />

            {/* Start over */}
            <div className="mt-8 text-center">
              <Button
                variant="ghost"
                onClick={() => { hapticLight(); setPhase('picking'); }}
                className="text-[13px] font-body text-muted-foreground/60"
              >
                Start over
              </Button>
            </div>
          </div>
        </AppLayout>
      </PageErrorBoundary>
    );
  }

  // ── ERROR PHASE ──
  if (phase === 'error') {
    return (
      <PageErrorBoundary fallback={<OutfitGenerateFallback />}>
      <AppLayout>
        <div className="page-shell flex min-h-[60vh] flex-col items-center justify-center">
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE }}
            className="rounded-[1.25rem] max-w-sm w-full p-6 text-center"
          >
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-4 opacity-70" />
            <h2 className="font-display italic text-[1.2rem] leading-tight text-foreground mb-2">Something went wrong</h2>
            <p className="text-muted-foreground/60 mb-5 text-[13px] font-body leading-relaxed">{lastError || 'Please try again.'}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { hapticLight(); setPhase('picking'); }}
                className="flex-1 rounded-full"
              >
                Back
              </Button>
              <Button
                onClick={() => { hapticLight(); handleGenerate(); }}
                disabled={isGenerating}
                variant="editorial"
                className="flex-1 rounded-full"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </motion.div>
        </div>
      </AppLayout>
      </PageErrorBoundary>
    );
  }

  // ── PICKING PHASE — V4 Editorial ──
  return (
    <PageErrorBoundary fallback={<OutfitGenerateFallback />}>
    <AppLayout>
      <OutfitGeneratePicker
        selectedOccasion={selectedOccasion}
        onOccasionChange={setSelectedOccasion}
        selectedStyles={selectedStyles}
        onStylesChange={setSelectedStyles}
        generationMode={generationMode}
        onModeChange={setGenerationMode}
        weather={weather}
        weatherAdvice={weatherAdvice}
        preferredGarmentSummary={preferredGarmentSummary}
        onClearPreferred={clearPreferredGarments}
        contextSubtitle={contextSubtitle}
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
        showPaywall={showPaywall}
        onShowPaywall={setShowPaywall}
      />
    </AppLayout>
    </PageErrorBoundary>
  );
}

/* ── GeneratingThumb ─────────────────────────────────────── */

function GeneratingThumb({
  garment,
  index,
  prefersReduced,
}: {
  garment: Garment;
  index: number;
  prefersReduced: boolean;
}) {
  const imagePath = getPreferredGarmentImagePath(garment);
  const { signedUrl, setRef } = useCachedSignedUrl(imagePath);
  if (!signedUrl) return null;
  return (
    <motion.div
      ref={setRef}
      animate={prefersReduced ? {} : { opacity: [0.4, 0.85, 0.4] }}
      transition={{
        duration: 2.2,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: index * 0.35,
      }}
      className="h-16 w-16 rounded-[0.9rem] overflow-hidden shrink-0 border border-border/20"
    >
      <img
        src={signedUrl}
        alt=""
        className="h-full w-full object-cover"
        style={{ filter: 'blur(0.5px)' }}
      />
    </motion.div>
  );
}
