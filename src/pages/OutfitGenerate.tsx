import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, AlertCircle, Crown, Zap,
  Check, Thermometer,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { OutfitGenerationState } from '@/components/ui/OutfitGenerationState';
import { useOutfitGenerator } from '@/hooks/useOutfitGenerator';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { useWeather } from '@/hooks/useWeather';
import { useCalendarEvents } from '@/hooks/useCalendarSync';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageErrorBoundary } from '@/components/layout/PageErrorBoundary';

/* ── Occasions ── */
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

type Phase = 'picking' | 'generating' | 'error';
type GenerationMode = 'standard' | 'stylist';

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
  const { generateOutfit, isGenerating } = useOutfitGenerator();
  const { isUnlocked } = useWardrobeUnlocks();
  const { weather } = useWeather();
  const todayDate = new Date().toISOString().slice(0, 10);
  const { data: calendarEvents } = useCalendarEvents(todayDate);
  const { canCreateOutfit, remainingOutfits, isPremium } = useSubscription();

  const [phase, setPhase] = useState<Phase>('picking');
  const [selectedOccasion, setSelectedOccasion] = useState<string>('casual');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const prefersReduced = useReducedMotion();
  const [generationMode, setGenerationMode] = useState<GenerationMode>(isPremium ? 'stylist' : 'standard');
  const [lastError, setLastError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const contextSubtitle = useMemo(() => {
    const parts: string[] = [];
    const occ = OCCASIONS.find(o => o.key === selectedOccasion);
    if (occ) parts.push(occ.label);
    if (selectedStyles.length > 0) parts.push(selectedStyles.join(', '));
    if (weather?.temperature !== undefined) parts.push(`${weather.temperature}°C`);
    return parts.join(' · ');
  }, [selectedOccasion, selectedStyles, weather?.temperature]);

  const weatherAdvice = getWeatherAdvice(weather?.temperature, weather?.precipitation);

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
      const result = await generateOutfit({
        occasion: selectedOccasion,
        style: selectedStyles.length > 0 ? selectedStyles.join(', ') : null,
        locale,
        mode: generationMode,
        weather: {
          temperature: weather?.temperature,
          precipitation: weather?.precipitation ?? 'none',
          wind: weather?.wind ?? 'low',
        },
      });
      navigate(`/outfits/${result.id}`, {
        replace: true,
        state: {
          justGenerated: true,
          confidence_score: result.confidence_score,
          confidence_level: result.confidence_level,
          limitation_note: result.limitation_note,
          family_label: result.family_label,
          wardrobe_insights: result.wardrobe_insights,
          layer_order: result.layer_order,
          needs_base_layer: result.needs_base_layer,
          occasion_submode: result.occasion_submode,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setLastError(message);
      setPhase('error');
      toast.error('Generation failed', { description: message });
    }
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
              <Thermometer className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span>
                {weather.temperature}° in {weather.location}
                {weatherAdvice && <span className="text-foreground/70"> — {weatherAdvice}</span>}
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

        {/* ── Step 2: Occasion ── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="space-y-3 pb-10"
        >
          <p className="label-editorial">What's the occasion?</p>
          <div className="grid grid-cols-3 gap-2">
            {OCCASIONS.map(({ key, label }) => {
              const isSelected = selectedOccasion === key;
              return (
                <motion.button
                  key={key}
                  whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                  onClick={() => setSelectedOccasion(key)}
                  className={cn(
                    'h-[52px] flex items-center justify-center rounded-xl border transition-all',
                    "text-[14px] font-medium font-['DM_Sans']",
                    isSelected
                      ? 'bg-foreground text-background border-transparent'
                      : 'bg-card text-foreground border-border/20'
                  )}
                >
                  {label}
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        {/* ── Step 3: Style ── */}
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
                    "h-[44px] px-4 rounded-xl border transition-all",
                    "text-[14px] font-['DM_Sans']",
                    isSelected
                      ? 'bg-foreground text-background border-transparent'
                      : 'bg-card text-foreground border-border/20'
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
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-foreground text-background h-12 rounded-full w-full text-[15px] font-medium font-['DM_Sans']"
              size="lg"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Style me
            </Button>
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
