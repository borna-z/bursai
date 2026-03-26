import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, AlertCircle, Crown, Zap,
  Check, Thermometer, Bookmark, CalendarDays, Shirt,
  Coffee, Briefcase, Wine, Heart, Dumbbell, Plane,
} from 'lucide-react';
import { motion, LayoutGroup, useReducedMotion, type Transition } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { StyleMeSubNav } from '@/components/ai/StyleMeSubNav';
import { OutfitGenerationState } from '@/components/ui/OutfitGenerationState';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useOutfitGenerator, type GeneratedOutfit } from '@/hooks/useOutfitGenerator';
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
        <h1 className="text-xl font-semibold text-foreground">Outfit generation is unavailable right now</h1>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    </div>
  );
}

export default function OutfitGeneratePage() {
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
  const [selectedOccasion, setSelectedOccasion] = useState<string>('casual');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const prefersReduced = useReducedMotion();
  const [generationMode, setGenerationMode] = useState<GenerationMode>(isPremium ? 'stylist' : 'standard');
  const [lastError, setLastError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [generatedResults, setGeneratedResults] = useState<GeneratedOutfit[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const updateOutfit = useUpdateOutfit();
  const markWorn = useMarkOutfitWorn();

  const contextSubtitle = useMemo(() => {
    const parts: string[] = [];
    const occ = OCCASIONS.find(o => o.key === selectedOccasion);
    if (occ) parts.push(occ.label);
    if (selectedStyles.length > 0) parts.push(selectedStyles.join(', '));
    if (weather?.temperature !== undefined) parts.push(`${weather.temperature}°C`);
    return parts.join(' · ');
  }, [selectedOccasion, selectedStyles, weather?.temperature]);

  const weatherAdvice = getWeatherAdvice(weather?.temperature, weather?.precipitation);

  const navigateToDetail = useCallback((outfit: GeneratedOutfit) => {
    navigate(`/outfits/${outfit.id}`, {
      replace: true,
      state: {
        justGenerated: true,
        confidence_score: outfit.confidence_score,
        confidence_level: outfit.confidence_level,
        limitation_note: outfit.limitation_note,
        family_label: outfit.family_label,
        wardrobe_insights: outfit.wardrobe_insights,
        layer_order: outfit.layer_order,
        needs_base_layer: outfit.needs_base_layer,
        occasion_submode: outfit.occasion_submode,
        outfit_reasoning: outfit.outfit_reasoning,
      },
    });
  }, [navigate]);

  // Gate: require enough garments
  if (!isUnlocked('outfit_gen')) {
    return (
      <PageErrorBoundary fallback={<OutfitGenerateFallback />}>
      <AppLayout>
        <div className="p-4 max-w-sm mx-auto pt-16 space-y-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{t('unlock.outfit_gen')}</h2>
          <WardrobeProgress message={t('unlock.outfit_gen_message')} />
        </div>
      </AppLayout>
      </PageErrorBoundary>
    );
  }

  const handleGenerate = async () => {
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
        mode: generationMode,
        exclude_garment_ids: excludeIds,
        weather: {
          temperature: weather?.temperature,
          precipitation: weather?.precipitation ?? 'none',
          wind: weather?.wind ?? 'low',
        },
      };
      const result = generationMode === 'stylist'
        ? await generateOutfitCandidates(request)
        : await generateOutfit(request);
      const results = Array.isArray(result) ? result : [result];
      setGeneratedResults(results);
      setPrimaryIndex(0);
      setExcludeIds(prev => [...new Set([...prev, ...(results.flatMap(r => r.items?.map(i => i.garment.id) ?? []))])]);
      setPhase('done');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setLastError(message);
      setPhase('error');
      toast.error('Generation failed', { description: message });
    }
  };

  const handleSaveOutfit = async (outfit: GeneratedOutfit) => {
    try {
      await updateOutfit.mutateAsync({ id: outfit.id, updates: { saved: true } });
      toast.success('Outfit saved');
    } catch {
      toast.error('Could not save outfit');
    }
  };

  const handlePlanOutfit = (outfit: GeneratedOutfit) => {
    navigate(`/outfits/${outfit.id}`, {
      state: { openPlanner: true },
    });
  };

  // ── GENERATING PHASE ──
  if (phase === 'generating') {
    return (
      <PageErrorBoundary fallback={<OutfitGenerateFallback />}>
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
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

  // ── DONE PHASE — Primary recommendation ──
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
      navigate(`/ai?outfit=${primary.id}`);
    };

    return (
      <PageErrorBoundary fallback={<OutfitGenerateFallback />}>
        <AppLayout>
          <div className="page-container pt-6 pb-36">
            <LayoutGroup>
              {/* ── Primary Card ── */}
              <motion.div
                key={`primary-${primary.id}`}
                layout={!prefersReduced}
                transition={prefersReduced ? { duration: 0 } : SPRING_LAYOUT}
                className="w-full"
              >
                {/* Outfit card — brand-matched design */}
                <div className="bg-[#EDE8DF] overflow-hidden">
                  <div className="grid grid-cols-2 gap-[1px]">
                    {primary.items.slice(0, 4).map((item, i) => (
                      <motion.div
                        key={item.garment.id}
                        initial={prefersReduced ? false : { opacity: 0, scale: 1.02 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.08, duration: 0.45 }}
                        onClick={() => navigate(`/wardrobe/${item.garment.id}`)}
                        style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden', background: '#F5F0E8' }}
                      >
                        <LazyImageSimple
                          imagePath={getPreferredGarmentImagePath(item.garment)}
                          alt={item.garment.title || item.slot}
                          className="w-full aspect-square object-cover"
                          fallbackIcon={<Shirt className="w-8 h-8 text-muted-foreground/15" />}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent p-2 pt-6">
                          <p className="text-[9px] text-white/70 uppercase tracking-[0.15em] font-medium">
                            {item.slot}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                    {effectiveMissing.slice(0, Math.max(0, 4 - primary.items.length)).map((slot, i) => (
                      <div key={`placeholder-${i}`} style={{
                        background: '#F5F0E8',
                        aspectRatio: '1',
                        border: '1.5px dashed rgba(28,25,23,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 8,
                      }}>
                        <span style={{
                          fontFamily: 'DM Sans, sans-serif',
                          fontSize: 11,
                          color: 'rgba(28,25,23,0.40)',
                          textAlign: 'center',
                          lineHeight: 1.4,
                        }}>
                          Add {slot}<br/>to complete
                        </span>
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, 4 - primary.items.length - effectiveMissing.length) }).map((_, i) => (
                      <div key={`empty-extra-${i}`} style={{ background: '#F5F0E8', aspectRatio: '1' }} />
                    ))}
                  </div>

                  {/* Card footer */}
                  <div className="px-3 pt-2.5 pb-3 space-y-1">
                    <p className="font-['DM_Sans'] text-[10px] uppercase tracking-[0.1em] text-[#1C1917]/50">
                      {OCCASIONS.find(o => o.key === selectedOccasion)?.label ?? selectedOccasion}
                    </p>
                    {calendarEvents?.[0]?.title && (
                      <span style={{
                        display: 'inline-block',
                        fontFamily: 'DM Sans, sans-serif',
                        fontSize: 10,
                        background: 'rgba(28,25,23,0.07)',
                        color: '#1C1917',
                        padding: '3px 8px',
                        marginTop: 4,
                      }}>
                        {calendarEvents[0].title}
                      </span>
                    )}
                    {reasoningText && (
                      <p className="font-['Playfair_Display'] italic text-[13px] text-[#1C1917]/70 leading-snug line-clamp-2">
                        {reasoningText}
                      </p>
                    )}
                    {weather && (
                      <p style={{
                        fontFamily: 'DM Sans, sans-serif',
                        fontSize: 10,
                        color: 'rgba(28,25,23,0.45)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginTop: 4,
                      }}>
                        Styled for {weather.temperature}°C{weather.precipitation && weather.precipitation !== 'none' ? ` · ${weather.precipitation}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── CTAs ── */}
                <div className="mt-5 space-y-3">
                  <Button
                    onClick={handleWearToday}
                    disabled={markWorn.isPending}
                    className="bg-foreground text-background h-12 rounded-full w-full text-[15px] font-medium font-['DM_Sans']"
                    size="lg"
                  >
                    {markWorn.isPending ? 'Logging…' : 'Wear today'}
                  </Button>

                  <Button
                    onClick={handleRefineInChat}
                    variant="outline"
                    className="h-12 rounded-full w-full text-[15px] font-medium font-['DM_Sans'] border-[#1C1917]/20"
                    size="lg"
                  >
                    Refine in chat
                  </Button>
                </div>

                {/* Secondary action row */}
                <div className="flex items-center justify-between mt-3 px-4">
                  <button
                    onClick={() => handleSaveOutfit(primary)}
                    className="flex items-center gap-1.5 text-[13px] font-['DM_Sans'] text-muted-foreground/60 active:opacity-70 transition-opacity"
                  >
                    <Bookmark className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={() => handlePlanOutfit(primary)}
                    className="flex items-center gap-1.5 text-[13px] font-['DM_Sans'] text-muted-foreground/60 active:opacity-70 transition-opacity"
                  >
                    <CalendarDays className="w-4 h-4" />
                    Plan
                  </button>
                </div>

                {/* Try another look */}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  style={{
                    width: '100%',
                    height: 44,
                    background: '#EDE8DF',
                    border: 'none',
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#1C1917',
                    cursor: isGenerating ? 'not-allowed' : 'pointer',
                    opacity: isGenerating ? 0.5 : 1,
                    marginTop: 8,
                  }}
                >
                  Try another look
                </button>
              </motion.div>

              {/* ── Alternate builder options ── */}
              {alternateResults.length > 0 && (
                <motion.div
                  layout={!prefersReduced}
                  transition={prefersReduced ? { duration: 0 } : SPRING_LAYOUT}
                  className="mt-6"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-['DM_Sans'] tracking-widest text-muted-foreground/40 uppercase">
                      STYLIST OPTIONS
                    </p>
                    <p className="text-[11px] text-muted-foreground/50">
                      {primaryIndex + 1} of {generatedResults.length}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {alternateResults.map((option) => {
                      const optionIndex = generatedResults.findIndex((result) => result.id === option.id);
                      return (
                        <button
                          key={option.id}
                          onClick={() => setPrimaryIndex(optionIndex)}
                          className="w-full rounded-2xl border border-border/20 bg-card/60 p-3 text-left active:opacity-80 transition-opacity"
                        >
                          <div className="flex gap-2">
                            {option.items.slice(0, 4).map((item) => (
                              <div
                                key={item.garment.id}
                                className="w-16 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-muted/20"
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
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[12px] font-medium text-foreground">
                                Option {optionIndex + 1}
                              </p>
                              <p className="text-[12px] font-['DM_Sans'] text-muted-foreground/50 mt-1">
                                {option.family_label ? `${option.family_label} · ` : ''}
                                {OCCASIONS.find(o => o.key === option.occasion)?.label ?? option.occasion}
                              </p>
                            </div>
                            <span className="text-[11px] text-muted-foreground/50">Tap to compare</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </LayoutGroup>

            {/* Generate another */}
            <div className="mt-8 text-center">
              <button
                onClick={() => setPhase('picking')}
                className="text-[13px] font-['DM_Sans'] text-muted-foreground/50 underline underline-offset-2"
              >
                Generate another
              </button>
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
        <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
          <Card className="max-w-sm w-full">
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
              <p className="text-muted-foreground mb-4 text-sm">{lastError || 'Please try again.'}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPhase('picking')} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleGenerate} disabled={isGenerating} className="flex-1">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
      </PageErrorBoundary>
    );
  }

  // ── PICKING PHASE ──
  return (
    <PageErrorBoundary fallback={<OutfitGenerateFallback />}>
    <AppLayout>
      <StyleMeSubNav />
      <div className="page-container pb-36 animate-fade-in">

        {/* ── Header + Weather ── */}
        <section className="pt-8 pb-6 space-y-2">
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">
            {getGreeting()}
          </h1>
          <p className="text-base text-muted-foreground">
            Let me style you today.
          </p>
          {weather && (
            <div className="pt-1.5">
              <span className="inline-flex items-center gap-1.5 font-['DM_Sans'] text-[11px] bg-[#EDE8DF] text-[#1C1917]/50 px-3 py-1.5 rounded-full">
                {weather.temperature}°C · {weather.condition || weather.location}
              </span>
            </div>
          )}
        </section>

        {/* ── Step 1: Mode ── */}
        <section className="space-y-3 pb-10">
          <p className="label-editorial">How should I style you?</p>
          <div className="grid grid-cols-2 gap-3">
            {/* Quick Look */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setGenerationMode('standard')}
              className={cn(
                'relative rounded-xl border p-4 text-left transition-all',
                generationMode === 'standard'
                  ? 'border-primary bg-primary/[0.04] ring-1 ring-primary/10'
                  : 'border-border/30 hover:border-border/50'
              )}
            >
              <Sparkles className={cn(
                'w-5 h-5 mb-3',
                generationMode === 'standard' ? 'text-foreground' : 'text-muted-foreground/40'
              )} />
              <p className="text-sm font-semibold text-foreground">Quick Look</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                Fast, balanced, everyday
              </p>
              {generationMode === 'standard' && (
                <motion.div
                  layoutId="mode-check"
                  className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <Check className="w-3 h-3 text-primary-foreground" />
                </motion.div>
              )}
            </motion.button>

            {/* Stylist Mode */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (!isPremium) { setShowPaywall(true); return; }
                setGenerationMode('stylist');
              }}
              className={cn(
                'relative rounded-xl border p-4 text-left transition-all',
                generationMode === 'stylist'
                  ? 'border-premium/40 bg-premium/[0.04] ring-1 ring-premium/10'
                  : 'border-border/30 hover:border-border/50'
              )}
            >
              <Crown className={cn(
                'w-5 h-5 mb-3',
                generationMode === 'stylist' ? 'text-premium' : 'text-muted-foreground/40'
              )} />
              <p className="text-sm font-semibold text-foreground">Stylist Mode</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                Deeper curation, editorial picks
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
        </section>

        {/* ── Step 2: Occasion — visual cards ── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="space-y-3 pb-10"
        >
          <p className="label-editorial">What's the occasion?</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {OCCASIONS.map(({ key, label }) => {
              const isSelected = selectedOccasion === key;
              const OccIcon = OCCASION_ICONS[key] || Sparkles;
              return (
                <motion.button
                  key={key}
                  whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                  onClick={() => setSelectedOccasion(key)}
                  className={cn(
                    'w-[72px] h-[64px] flex flex-col items-center justify-center gap-1.5 shrink-0 transition-all',
                    isSelected
                      ? 'bg-[#1C1917] text-white'
                      : 'bg-[#EDE8DF] text-[#1C1917] hover:bg-[#E8E3DA]'
                  )}
                >
                  <OccIcon className="w-5 h-5" strokeWidth={1.8} />
                  <span className="font-['DM_Sans'] text-[11px] leading-none">{label}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        {/* ── Step 3: Style — decisive chip redesign ── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
          className="pb-8 space-y-3"
        >
          <p className="text-[11px] tracking-widest text-muted-foreground/50 uppercase">STYLE</p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((style) => {
              const isSelected = selectedStyles.includes(style);
              return (
                <motion.button
                  key={style}
                  whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedStyles(selectedStyles.filter(s => s !== style));
                    } else if (selectedStyles.length >= 2) {
                      toast.error('Pick up to 2 styles');
                    } else {
                      setSelectedStyles([...selectedStyles, style]);
                    }
                  }}
                  className={cn(
                    "h-[44px] px-4 rounded-xl transition-all",
                    "text-[14px] font-['DM_Sans']",
                    isSelected
                      ? 'bg-[#1C1917] text-white border-transparent'
                      : 'bg-transparent border border-[#1C1917]/25 text-[#1C1917]/60'
                  )}
                >
                  {style}
                </motion.button>
              );
            })}
          </div>
        </motion.section>
      </div>

      {/* ── Sticky CTA ── */}
      <div className="fixed bottom-20 left-0 right-0 z-20">
        <div className="bg-background/80 backdrop-blur-2xl border-t border-border/15 px-4 pt-3 pb-4">
          <div className="max-w-md mx-auto space-y-2">
            {contextSubtitle && (
              <p className="text-[11px] text-muted-foreground/60 text-center tracking-wide">
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
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-foreground text-background h-12 rounded-full w-full text-[15px] font-medium font-['DM_Sans']"
                size="lg"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Style me
              </Button>
            </CoachMark>
            {!isPremium && remainingOutfits() < Infinity && (
              <p className="text-[11px] text-muted-foreground/50 text-center">
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
