import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, AlertCircle, CloudSun, Wind, Droplets, Zap, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { AppLayout } from '@/components/layout/AppLayout';
import { OutfitGenerationState } from '@/components/ui/OutfitGenerationState';
import { useOutfitGenerator } from '@/hooks/useOutfitGenerator';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { useWeather } from '@/hooks/useWeather';
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const OCCASIONS = [
  { key: 'casual', emoji: '👕', gradient: 'from-blue-500/10 to-cyan-500/10' },
  { key: 'work', emoji: '💼', gradient: 'from-amber-500/10 to-orange-500/10' },
  { key: 'party', emoji: '🎉', gradient: 'from-pink-500/10 to-rose-500/10' },
  { key: 'date', emoji: '❤️', gradient: 'from-red-500/10 to-pink-500/10' },
  { key: 'workout', emoji: '🏃', gradient: 'from-green-500/10 to-emerald-500/10' },
  { key: 'travel', emoji: '✈️', gradient: 'from-violet-500/10 to-purple-500/10' },
] as const;

const STYLE_GROUPS = [
  {
    label: 'Essentials',
    styles: ['Minimal', 'Smart Casual', 'Classic', 'Casual Chic', 'Relaxed'],
  },
  {
    label: 'Expressive',
    styles: ['Street', 'Edgy', 'Avant-Garde', 'Bohemian', 'Retro'],
  },
  {
    label: 'Refined',
    styles: ['Scandinavian', 'Preppy', 'Glamorous', 'Monochrome', 'Romantic'],
  },
  {
    label: 'Seasonal',
    styles: ['Layered', 'Coastal', 'Sporty'],
  },
] as const;

type Phase = 'picking' | 'generating' | 'error';
type GenerationMode = 'standard' | 'stylist';

export default function OutfitGeneratePage() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const { generateOutfit, isGenerating } = useOutfitGenerator();
  const { isUnlocked } = useWardrobeUnlocks();
  const { weather } = useWeather();
  const { canCreateOutfit, remainingOutfits, isPremium } = useSubscription();

  const [phase, setPhase] = useState<Phase>('picking');
  const [selectedOccasion, setSelectedOccasion] = useState<string>('casual');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [generationMode, setGenerationMode] = useState<GenerationMode>(isPremium ? 'stylist' : 'standard');
  const [lastError, setLastError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  // Gate: require enough garments
  if (!isUnlocked('outfit_gen')) {
    return (
      <AppLayout>
        <div className="p-4 max-w-sm mx-auto pt-16 space-y-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{t('unlock.outfit_gen')}</h2>
          <WardrobeProgress message={t('unlock.outfit_gen_message')} />
        </div>
      </AppLayout>
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
        style: selectedStyle,
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
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('generate.error_desc');
      setLastError(message);
      setPhase('error');
      toast.error(t('generate.error_toast'), { description: message });
    }
  };

  const subtitle = [selectedOccasion, selectedStyle].filter(Boolean).join(' · ') +
    (weather?.temperature !== undefined ? ` · ${weather.temperature}°C` : '');

  // --- GENERATING PHASE ---
  if (phase === 'generating') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
          <OutfitGenerationState
            subtitle={subtitle || undefined}
            variant="full"
            className="max-w-sm w-full"
          />
        </div>
      </AppLayout>
    );
  }

  // --- ERROR PHASE ---
  if (phase === 'error') {
    return (
      <AppLayout>
        <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
          <Card className="max-w-sm w-full">
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">{t('generate.error_title')}</h2>
              <p className="text-muted-foreground mb-4 text-sm">{lastError || t('generate.error_desc')}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPhase('picking')} className="flex-1">
                  {t('generate.back')}
                </Button>
                <Button onClick={handleGenerate} disabled={isGenerating} className="flex-1">
                  <Sparkles className="w-4 h-4 mr-2" />
                  {t('generate.retry')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // --- PICKING PHASE ---
  return (
    <AppLayout>
      <div className="page-container space-y-8 pb-32 animate-fade-in">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">
            {t('generate.title') || 'What to wear'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('generate.subtitle') || 'Pick a vibe and we\u2019ll style you'}
          </p>
        </div>

        {/* Weather context card */}
        {weather && (
          <div className="rounded-2xl bg-secondary/30 backdrop-blur-sm border border-border/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CloudSun className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {weather.temperature}°C
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {weather.location}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {weather.precipitation && weather.precipitation !== 'none' && (
                  <span className="flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5" />
                    {t(weather.precipitation) || weather.precipitation}
                  </span>
                )}
                {weather.wind && weather.wind !== 'low' && (
                  <span className="flex items-center gap-1">
                    <Wind className="w-3.5 h-3.5" />
                    {t(weather.wind) || weather.wind}
                  </span>
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/50 mt-2">
              {t('generate.weather_note') || 'Weather is factored into your outfit automatically'}
            </p>
          </div>
        )}

        {/* Occasion grid */}
        <section className="space-y-3">
          <h2 className="label-editorial">
            {t('generate.occasion') || 'Occasion'}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {OCCASIONS.map(({ key, emoji, gradient }) => {
              const isSelected = selectedOccasion === key;
              return (
                <motion.button
                  key={key}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setSelectedOccasion(key)}
                  className={cn(
                    'relative rounded-2xl p-4 text-center transition-all border',
                    'bg-gradient-to-br',
                    gradient,
                    isSelected
                      ? 'border-primary/40 shadow-[0_0_20px_hsl(var(--primary)/0.1)] ring-1 ring-primary/20'
                      : 'border-border/15 hover:border-border/30'
                  )}
                >
                  <span className="text-2xl block mb-1.5">{emoji}</span>
                  <span className={cn(
                    'text-xs font-semibold capitalize transition-colors',
                    isSelected ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {t(`occasion.${key}`) || key}
                  </span>
                  {isSelected && (
                    <motion.div
                      layoutId="occasion-indicator"
                      className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary shadow-sm"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Style groups */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="label-editorial">
              {t('generate.style') || 'Style'}
            </h2>
            {selectedStyle && (
              <button
                onClick={() => setSelectedStyle(null)}
                className="text-xs text-primary/70 hover:text-primary transition-colors"
              >
                {t('common.clear') || 'Clear'}
              </button>
            )}
          </div>
          
          {STYLE_GROUPS.map((group) => (
            <div key={group.label} className="space-y-2">
              <p className="text-[11px] text-muted-foreground/40 uppercase tracking-wider font-medium">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.styles.map((style) => (
                  <Chip
                    key={style}
                    selected={selectedStyle === style}
                    onClick={() => setSelectedStyle(selectedStyle === style ? null : style)}
                    size="md"
                  >
                    {style}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground/50">
            {t('generate.style_optional') || 'Optional — leave empty for a balanced look'}
          </p>
        </section>

        {/* Generate button */}
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent z-20">
          <div className="max-w-md mx-auto space-y-2">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full rounded-2xl h-13 text-base font-semibold shadow-lg shadow-primary/10"
              size="lg"
            >
              <Sparkles className="w-4.5 h-4.5 mr-2" />
              {t('generate.button') || 'Style me'}
            </Button>
            {!isPremium && remainingOutfits() < Infinity && (
              <p className="text-[11px] text-muted-foreground/50 text-center">
                <Zap className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                {remainingOutfits()} {t('paywall.outfits_remaining') || 'outfits remaining'}
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
  );
}
