import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles, AlertCircle, Crown, Zap,
  Check, Bookmark, CalendarDays, Shirt,
  Coffee, Briefcase, Wine, Heart, Dumbbell, Plane, X,
  ChevronRight,
} from 'lucide-react';
import { motion, LayoutGroup, useReducedMotion, type Transition } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { OutfitGenerationState } from '@/components/ui/OutfitGenerationState';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { PageHeader } from '@/components/layout/PageHeader';
import { useOutfitGenerator, type GeneratedOutfit } from '@/hooks/useOutfitGenerator';
import { useGarmentsByIds } from '@/hooks/useGarmentsByIds';
import { useUpdateOutfit, useMarkOutfitWorn } from '@/hooks/useOutfits';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { useWeather } from '@/hooks/useWeather';
import { useCalendarEvents } from '@/hooks/useCalendarSync';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { PageErrorBoundary } from '@/components/layout/PageErrorBoundary';
import { CoachMark } from '@/components/coach/CoachMark';
import { useFirstRunCoach } from '@/hooks/useFirstRunCoach';
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
import { EASE_CURVE, STAGGER_DELAY, DURATIONS } from '@/lib/motion';

/* ── Occasions ── */
const OCCASION_ICONS: Record<string, React.ElementType> = {
  casual: Coffee,
  work: Briefcase,
  party: Wine,
  date: Heart,
  workout: Dumbbell,
  travel: Plane,
};

const OCCASIONS = [
  { key: 'casual', label: 'Casual' },
  { key: 'work', label: 'Work' },
  { key: 'party', label: 'Evening' },
  { key: 'date', label: 'Date' },
  { key: 'workout', label: 'Workout' },
  { key: 'travel', label: 'Travel' },
] as const;

/* ── Curated styles (single flat list) ── */
const STYLES = [
  'Minimal', 'Smart Casual', 'Street', 'Scandinavian',
  'Edgy', 'Bohemian', 'Preppy', 'Relaxed',
] as const;

type Phase = 'picking' | 'generating' | 'done' | 'error';
type GenerationMode = 'standard' | 'stylist';

const SPRING_LAYOUT: Transition = { type: 'spring', stiffness: 350, damping: 30 };

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

/* ── Time-aware greeting ── */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
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
  const { canCreateOutfit, remainingOutfits, isPremium } = useSubscription();
  const coach = useFirstRunCoach();

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
          <div className="surface-editorial space-y-6 p-5">
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
        <div className="page-shell flex min-h-[60vh] flex-col items-center justify-center !pt-10">
          <OutfitGenerationState
            subtitle={contextSubtitle || undefined}
            variant="full"
            className="max-w-sm w-full"
            occasion={selectedOccasion}
            weatherTemp={weather?.temperature}
            weatherCondition={weather?.condition}
            eventTitle={calendarEvents?.[0]?.title ?? null}
          />
        </div>
      </AppLayout>
      </PageErrorBoundary>
    );
  }

  // ── DONE PHASE — V4 Editorial Result ──
  if (phase === 'done' && generatedResults.length > 0) {
    const primary = generatedResults[primaryIndex];
    const alternateResults = generatedResults.filter((_, index) => index !== primaryIndex);
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
            <LayoutGroup>
              {/* ── V4 Editorial Result Header ── */}
              <motion.div
                initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATIONS.SLOW, ease: EASE_CURVE }}
                className="mb-6"
              >
                <p className="label-editorial text-muted-foreground/50 mb-1">YOUR LOOK</p>
                <h1 className="font-display italic text-[1.6rem] leading-tight text-foreground tracking-tight">
                  The Daily Edit
                </h1>
                {contextSubtitle && (
                  <p className="text-[12px] font-body text-muted-foreground/50 mt-1.5">{contextSubtitle}</p>
                )}
              </motion.div>

              {/* ── Primary Outfit — Vertical garment list ── */}
              <motion.div
                key={`primary-${primary.id}`}
                layout={!prefersReduced}
                transition={prefersReduced ? { duration: 0 } : SPRING_LAYOUT}
                className="w-full space-y-3"
              >
                {primary.items.map((item, i) => (
                  <motion.div
                    key={item.garment.id}
                    initial={prefersReduced ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * STAGGER_DELAY * 2, duration: DURATIONS.MEDIUM, ease: EASE_CURVE }}
                    onClick={() => { hapticLight(); navigate(`/wardrobe/${item.garment.id}`); }}
                    className="surface-secondary rounded-[1.25rem] p-3 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <div className="w-16 h-20 rounded-[1rem] overflow-hidden flex-shrink-0 bg-muted/20">
                      <LazyImageSimple
                        imagePath={getPreferredGarmentImagePath(item.garment)}
                        alt={item.garment.title || item.slot}
                        className="w-full h-full object-cover"
                        fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/15" />}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-body uppercase tracking-[0.12em] text-muted-foreground/45 mb-0.5">
                        {item.slot}
                      </p>
                      <p className="text-[14px] font-medium text-foreground truncate">
                        {item.garment.title || item.slot}
                      </p>
                      {item.garment.colors?.[0] && (
                        <p className="text-[11px] font-body text-muted-foreground/50 mt-0.5 truncate">
                          {item.garment.colors[0]}{item.garment.material ? ` · ${item.garment.material}` : ''}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/25 flex-shrink-0" />
                  </motion.div>
                ))}

                {/* Missing slot placeholders */}
                {effectiveMissing.map((slot) => (
                  <div
                    key={`missing-${slot}`}
                    onClick={() => { hapticLight(); navigate(`/wardrobe?category=${slot === 'bottom' ? 'bottoms' : slot}`); }}
                    className="surface-secondary rounded-[1.25rem] p-3 flex items-center gap-4 cursor-pointer border border-dashed border-foreground/10"
                  >
                    <div className="w-16 h-20 rounded-[1rem] flex items-center justify-center bg-muted/10">
                      <Shirt className="w-5 h-5 text-muted-foreground/20" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] text-foreground/40">Add {slot} to complete</p>
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* ── Reasoning ── */}
              {reasoningText && (
                <motion.div
                  initial={prefersReduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25, duration: DURATIONS.SLOW, ease: EASE_CURVE }}
                  className="mt-5 px-1"
                >
                  <p className="font-display italic text-[13px] text-foreground/60 leading-relaxed">
                    "{reasoningText}"
                  </p>
                </motion.div>
              )}

              {/* ── Weather context ── */}
              {weather && (
                <div className="mt-3 px-1">
                  <p className="text-[10px] font-body uppercase tracking-[0.1em] text-muted-foreground/40">
                    Styled for {weather.temperature}°C{weather.precipitation && weather.precipitation !== 'none' ? ` · ${weather.precipitation}` : ''}
                  </p>
                </div>
              )}

              {/* ── V4 CTA row ── */}
              <motion.div
                initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: DURATIONS.MEDIUM, ease: EASE_CURVE }}
                className="mt-8 space-y-3"
              >
                <Button
                  onClick={() => { hapticLight(); handleWearToday(); }}
                  disabled={markWorn.isPending}
                  variant="editorial"
                  className="h-12 w-full rounded-full text-[15px] font-medium font-body"
                  size="lg"
                >
                  {markWorn.isPending ? 'Logging…' : 'Wear today'}
                </Button>

                <div className="flex gap-2">
                  <Button
                    onClick={() => { hapticLight(); handleSaveOutfit(primary); }}
                    variant="outline"
                    className="flex-1 h-11 rounded-full text-[13px] font-body border-border/40"
                  >
                    <Bookmark className="w-4 h-4 mr-1.5" />
                    Save
                  </Button>
                  <Button
                    onClick={() => { hapticLight(); handlePlanOutfit(primary); }}
                    variant="outline"
                    className="flex-1 h-11 rounded-full text-[13px] font-body border-border/40"
                  >
                    <CalendarDays className="w-4 h-4 mr-1.5" />
                    Plan
                  </Button>
                </div>

                <Button
                  onClick={() => { hapticLight(); handleRefineInChat(); }}
                  variant="ghost"
                  className="h-10 w-full text-[13px] font-body text-muted-foreground/50"
                >
                  Refine in chat
                </Button>
              </motion.div>

              {/* ── Try another ── */}
              <div className="mt-4">
                <Button
                  onClick={() => { hapticLight(); handleGenerate(); }}
                  disabled={isGenerating}
                  variant="outline"
                  className="h-11 w-full rounded-full border-border/40 bg-background/80 text-[13px] font-medium text-foreground"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Try another look
                </Button>
              </div>

              {/* ── Alternate stylist options ── */}
              {alternateResults.length > 0 && (
                <motion.div
                  initial={prefersReduced ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: DURATIONS.MEDIUM, ease: EASE_CURVE }}
                  layout={!prefersReduced}
                  className="mt-8"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="label-editorial text-muted-foreground/40">
                      STYLIST OPTIONS
                    </p>
                    <p className="text-[11px] text-muted-foreground/40 font-body">
                      {primaryIndex + 1} of {generatedResults.length}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {alternateResults.map((option) => {
                      const optionIndex = generatedResults.findIndex((result) => result.id === option.id);
                      return (
                        <motion.button
                          key={option.id}
                          whileTap={prefersReduced ? undefined : { scale: 0.98 }}
                          onClick={() => { hapticLight(); setPrimaryIndex(optionIndex); }}
                          className="w-full surface-secondary rounded-[1.25rem] p-3 text-left"
                        >
                          <div className="flex gap-2">
                            {option.items.slice(0, 4).map((item) => (
                              <div
                                key={item.garment.id}
                                className="w-14 h-[4.5rem] rounded-[1rem] overflow-hidden flex-shrink-0 bg-muted/20"
                              >
                                <LazyImageSimple
                                  imagePath={getPreferredGarmentImagePath(item.garment)}
                                  alt={item.garment.title || item.slot}
                                  className="w-full h-full object-cover"
                                  fallbackIcon={<Shirt className="w-4 h-4 text-muted-foreground/15" />}
                                />
                              </div>
                            ))}
                          </div>
                          <div className="mt-2.5 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[12px] font-medium text-foreground">
                                Option {optionIndex + 1}
                              </p>
                              <p className="text-[11px] font-body text-muted-foreground/45 mt-0.5">
                                {option.family_label ? `${option.family_label} · ` : ''}
                                {OCCASIONS.find(o => o.key === option.occasion)?.label ?? option.occasion}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/25" />
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </LayoutGroup>

            {/* Start over */}
            <div className="mt-8 text-center">
              <Button
                variant="ghost"
                onClick={() => { hapticLight(); setPhase('picking'); }}
                className="text-[13px] font-body text-muted-foreground/40"
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
            transition={{ duration: DURATIONS.MEDIUM, ease: EASE_CURVE }}
            className="surface-editorial rounded-[1.25rem] max-w-sm w-full p-6 text-center"
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
      <div className="page-shell pb-36">

        {/* ── Header ── */}
        <PageHeader
          title={t('outfit.generate_title') || 'Generate Outfit'}
          showBack
          titleClassName="font-display italic"
        />

        {/* ── Weather pill + style anchor ── */}
        <motion.section
          initial={prefersReduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATIONS.MEDIUM, ease: EASE_CURVE }}
          className="space-y-2.5 pb-6"
        >
          {weather && (
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 px-3 py-1.5 text-[11px] font-body text-foreground/55">
                {weather.temperature}°C · {t(weather.condition) || weather.location}
              </span>
              {weatherAdvice && (
                <p className="pt-1.5 text-[11px] text-muted-foreground/45 font-body">
                  {weatherAdvice}
                </p>
              )}
            </div>
          )}
          {preferredGarmentSummary && (
            <div className="pt-1.5">
              <div className="surface-secondary inline-flex max-w-full items-center gap-3 rounded-[1.25rem] px-3 py-2.5 text-left">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-primary">
                  <Shirt className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-body font-medium uppercase tracking-[0.18em] text-primary/60">Style anchor</p>
                  <p className="truncate text-[13px] font-medium text-foreground">{preferredGarmentSummary}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { hapticLight(); clearPreferredGarments(); }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/40 transition-colors hover:bg-background"
                  aria-label="Clear style anchor"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </motion.section>

        {/* ── Occasion selector — horizontal pills ── */}
        <motion.section
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: DURATIONS.MEDIUM, ease: EASE_CURVE }}
          className="space-y-3 pb-8"
        >
          <p className="label-editorial text-muted-foreground/50">SELECT OCCASION</p>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map(({ key, label }) => {
              const isSelected = selectedOccasion === key;
              const OccIcon = OCCASION_ICONS[key] || Sparkles;
              return (
                <motion.button
                  key={key}
                  whileTap={prefersReduced ? undefined : { scale: 0.96 }}
                  onClick={() => { hapticLight(); setSelectedOccasion(key); }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-body transition-all',
                    isSelected
                      ? 'bg-foreground text-background'
                      : 'border border-border/40 text-foreground/55 hover:border-foreground/20'
                  )}
                >
                  <OccIcon className="w-4 h-4" strokeWidth={1.8} />
                  {label}
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        {/* ── Mood & Aesthetic — pill chips ── */}
        <motion.section
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: DURATIONS.MEDIUM, ease: EASE_CURVE }}
          className="pb-8 space-y-3"
        >
          <p className="label-editorial text-muted-foreground/50">MOOD & AESTHETIC</p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((style) => {
              const isSelected = selectedStyles.includes(style);
              return (
                <motion.button
                  key={style}
                  whileTap={prefersReduced ? undefined : { scale: 0.96 }}
                  onClick={() => {
                    hapticLight();
                    if (isSelected) {
                      setSelectedStyles(selectedStyles.filter(s => s !== style));
                    } else if (selectedStyles.length >= 2) {
                      toast.error('Pick up to 2 styles');
                    } else {
                      setSelectedStyles([...selectedStyles, style]);
                    }
                  }}
                  className={cn(
                    'rounded-full px-4 py-2.5 text-[13px] font-body transition-all',
                    isSelected
                      ? 'bg-foreground text-background'
                      : 'border border-border/40 text-foreground/55 hover:border-foreground/20'
                  )}
                >
                  {style}
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        {/* ── Mode toggle — editorial cards ── */}
        <motion.section
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: DURATIONS.MEDIUM, ease: EASE_CURVE }}
          className="pb-6 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileTap={prefersReduced ? undefined : { scale: 0.97 }}
              onClick={() => { hapticLight(); setGenerationMode('standard'); }}
              className={cn(
                'surface-secondary rounded-[1.25rem] relative p-4 text-left transition-all',
                generationMode === 'standard' && 'ring-1 ring-foreground/10'
              )}
            >
              <Sparkles className={cn(
                'w-5 h-5 mb-3',
                generationMode === 'standard' ? 'text-foreground' : 'text-muted-foreground/30'
              )} />
              <p className="text-[13px] font-semibold text-foreground">Quick Look</p>
              <p className="text-[11px] text-muted-foreground/45 mt-0.5 leading-snug font-body">
                Fast, balanced, everyday
              </p>
              {generationMode === 'standard' && (
                <motion.div
                  layoutId="mode-check"
                  className="absolute top-3 right-3 w-5 h-5 rounded-full bg-foreground flex items-center justify-center"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <Check className="w-3 h-3 text-background" />
                </motion.div>
              )}
            </motion.button>

            <motion.button
              whileTap={prefersReduced ? undefined : { scale: 0.97 }}
              onClick={() => {
                hapticLight();
                if (!isPremium) { setShowPaywall(true); return; }
                setGenerationMode('stylist');
              }}
              className={cn(
                'surface-secondary rounded-[1.25rem] relative p-4 text-left transition-all',
                generationMode === 'stylist' && 'ring-1 ring-premium/14'
              )}
            >
              <Crown className={cn(
                'w-5 h-5 mb-3',
                generationMode === 'stylist' ? 'text-premium' : 'text-muted-foreground/30'
              )} />
              <p className="text-[13px] font-semibold text-foreground">Stylist Mode</p>
              <p className="text-[11px] text-muted-foreground/45 mt-0.5 leading-snug font-body">
                Deeper curation, editorial
              </p>
              {!isPremium && (
                <span className="absolute top-3 right-3 text-[9px] font-semibold text-premium uppercase tracking-wider">
                  Premium
                </span>
              )}
              {generationMode === 'stylist' && isPremium && (
                <motion.div
                  layoutId="mode-check"
                  className="absolute top-3 right-3 w-5 h-5 rounded-full bg-premium flex items-center justify-center"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <Check className="w-3 h-3 text-premium-foreground" />
                </motion.div>
              )}
            </motion.button>
          </div>
        </motion.section>
      </div>

      {/* ── Sticky CTA ── */}
      <div className="action-bar-floating bottom-safe-nav fixed left-0 right-0 z-20">
        <div className="px-4 pt-3 pb-4">
          <div className="max-w-md mx-auto space-y-2">
            {contextSubtitle && (
              <p className="text-[11px] text-muted-foreground/50 text-center tracking-wide font-body">
                {contextSubtitle}
              </p>
            )}
            <CoachMark
              step={3}
              currentStep={coach.currentStep}
              isCoachActive={coach.isStepActive(3)}
              title="Generate outfits in seconds"
              body="Pick the occasion, add a style if you want, and BURS will build a look from your wardrobe."
              ctaLabel="Plan next"
              onCta={() => {
                coach.advanceStep();
                navigate('/plan');
              }}
              onSkip={() => coach.completeTour()}
              position="top"
            >
              <Button
                onClick={() => { hapticLight(); handleGenerate(); }}
                disabled={isGenerating}
                variant="editorial"
                className="h-12 w-full rounded-full text-[15px] font-medium font-body"
                size="lg"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate
              </Button>
            </CoachMark>
            {!isPremium && remainingOutfits() < Infinity && (
              <p className="text-[11px] text-muted-foreground/40 text-center font-body">
                <Zap className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                {remainingOutfits()} outfits remaining
              </p>
            )}
          </div>
        </div>
      </div>

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason="outfits"
      />
    </AppLayout>
    </PageErrorBoundary>
  );
}
