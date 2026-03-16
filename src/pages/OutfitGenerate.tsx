import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, AlertCircle, CloudSun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { AppLayout } from '@/components/layout/AppLayout';
import { OutfitGenerationState } from '@/components/ui/OutfitGenerationState';
import { useOutfitGenerator } from '@/hooks/useOutfitGenerator';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { useWeather } from '@/hooks/useWeather';
import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const OCCASIONS = [
  { key: 'casual', emoji: '👕' },
  { key: 'work', emoji: '💼' },
  { key: 'party', emoji: '🎉' },
  { key: 'date', emoji: '❤️' },
  { key: 'workout', emoji: '🏃' },
  { key: 'travel', emoji: '✈️' },
] as const;

const STYLES = [
  'Minimal', 'Street', 'Smart Casual', 'Classic', 'Sporty', 'Romantic',
  'Bohemian', 'Preppy', 'Edgy', 'Retro', 'Scandinavian', 'Glamorous',
  'Casual Chic', 'Monochrome', 'Layered', 'Relaxed', 'Avant-Garde', 'Coastal',
] as const;

type Phase = 'picking' | 'generating' | 'error';

export default function OutfitGeneratePage() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const { generateOutfit, isGenerating } = useOutfitGenerator();
  const { isUnlocked } = useWardrobeUnlocks();
  const { weather } = useWeather();

  const [phase, setPhase] = useState<Phase>('picking');
  const [selectedOccasion, setSelectedOccasion] = useState<string>('casual');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

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
    setPhase('generating');
    setLastError(null);
    try {
      const result = await generateOutfit({
        occasion: selectedOccasion,
        style: selectedStyle,
        locale,
        weather: {
          temperature: weather?.temperature,
          precipitation: weather?.precipitation ?? 'none',
          wind: weather?.wind ?? 'low',
        },
      });
      navigate(`/outfits/${result.id}`, { replace: true, state: { justGenerated: true } });
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
      <div className="p-4 max-w-md mx-auto space-y-6 pb-32 animate-fade-in">
        {/* Header */}
        <div className="pt-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {t('generate.title') || 'What to wear'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('generate.subtitle') || 'Pick a vibe and we\u2019ll style you'}
          </p>
        </div>

        {/* Weather badge */}
        {weather && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CloudSun className="w-4 h-4" />
            <span>{weather.temperature}°C · {t(weather.condition) || weather.condition}</span>
            <span className="text-muted-foreground/50">· {weather.location}</span>
          </div>
        )}

        {/* Occasion */}
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
            {t('generate.occasion') || 'Occasion'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map(({ key, emoji }) => (
              <Chip
                key={key}
                selected={selectedOccasion === key}
                onClick={() => setSelectedOccasion(key)}
                size="lg"
              >
                <span>{emoji}</span>
                <span className="capitalize">{t(`occasion.${key}`) || key}</span>
              </Chip>
            ))}
          </div>
        </section>

        {/* Style grid */}
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
            {t('generate.style') || 'Style'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((style) => (
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
          <p className="text-xs text-muted-foreground/60">
            {t('generate.style_optional') || 'Optional — leave empty for a balanced look'}
          </p>
        </section>

        {/* Generate button */}
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full max-w-md mx-auto flex"
            size="lg"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {t('generate.button') || 'Generate outfit'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
