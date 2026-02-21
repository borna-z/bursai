import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, AlertCircle, Shirt, Palette, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { useOutfitGenerator, type OutfitRequest } from '@/hooks/useOutfitGenerator';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

const PHASES = [
  { icon: Shirt, label: 'Analyserar din garderob...', duration: 1200 },
  { icon: Palette, label: 'Matchar färger och stil...', duration: 2000 },
  { icon: Wand2, label: 'Skapar din outfit...', duration: 0 },
] as const;

export default function OutfitGeneratePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { generateOutfit, isGenerating, error } = useOutfitGenerator();
  const [phase, setPhase] = useState(0);
  const [phaseKey, setPhaseKey] = useState(0);
  
  const state = location.state as OutfitRequest | null;
  
  useEffect(() => {
    if (!state?.occasion) {
      navigate('/', { replace: true });
      return;
    }
    handleGenerate();
  }, []);

  // Phase progression
  useEffect(() => {
    if (!isGenerating && phase === 0) return;
    if (phase >= PHASES.length - 1) return;

    const timer = setTimeout(() => {
      setPhase((p) => p + 1);
      setPhaseKey((k) => k + 1);
    }, PHASES[phase].duration);

    return () => clearTimeout(timer);
  }, [phase, isGenerating]);
  
  const handleGenerate = async () => {
    if (!state) return;
    setPhase(0);
    setPhaseKey(0);
    
    try {
      const outfit = await generateOutfit(state);
      navigate(`/outfits/${outfit.id}`, { 
        replace: true,
        state: { justGenerated: true }
      });
    } catch (err) {
      console.error('Outfit generation failed:', err);
      toast.error(t('generate.error_toast'), {
        description: err instanceof Error ? err.message : t('generate.retry'),
      });
    }
  };

  const CurrentIcon = PHASES[phase]?.icon ?? Sparkles;
  const currentLabel = PHASES[phase]?.label ?? '';
  
  if (error) {
    return (
      <AppLayout>
        <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
          <Card className="max-w-sm w-full">
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">{t('generate.error_title')}</h2>
              <p className="text-muted-foreground mb-4">
                {error instanceof Error ? error.message : t('generate.error_desc')}
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/')}
                  className="flex-1"
                >
                  {t('generate.back')}
                </Button>
                <Button 
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex-1"
                >
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
  
  return (
    <AppLayout>
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-6">
          {/* Animated icon area */}
          <div className="relative w-28 h-28 mx-auto">
            {/* Pulsing background rings */}
            <div className="absolute inset-0 rounded-full bg-primary/5 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-2 rounded-full bg-primary/8 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.3s' }} />
            
            {/* Icon container */}
            <div
              key={phaseKey}
              className="relative w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center animate-scale-in"
            >
              <CurrentIcon
                className="w-12 h-12 text-primary transition-all duration-500"
                strokeWidth={1.5}
              />
            </div>

            {/* Orbiting dots */}
            <div className="absolute inset-0 animate-spin" style={{ animationDuration: '4s' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary/40" />
            </div>
            <div className="absolute inset-0 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary/25" />
            </div>
          </div>
          
          {/* Phase text */}
          <div key={`text-${phaseKey}`} className="space-y-2 animate-fade-in">
            <h2 className="text-xl font-semibold tracking-tight">{currentLabel}</h2>
            <p className="text-sm text-muted-foreground">
              {state?.occasion || ''}
              {state?.style ? ` · ${state.style}` : ''}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2">
            {PHASES.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i <= phase
                    ? 'w-6 bg-primary'
                    : 'w-1.5 bg-muted-foreground/20'
                }`}
              />
            ))}
          </div>
          
          {state?.weather?.temperature !== undefined && (
            <p className="text-xs text-muted-foreground/60">
              {state.weather.temperature}°C
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
