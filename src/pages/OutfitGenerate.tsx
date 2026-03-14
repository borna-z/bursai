import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, AlertCircle, Shirt, Palette, Wand2, Eye, CloudSun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { AILoadingOverlay } from '@/components/ui/AILoadingOverlay';
import { useOutfitGenerator, type OutfitRequest } from '@/hooks/useOutfitGenerator';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWardrobeUnlocks } from '@/hooks/useWardrobeUnlocks';
import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
import { toast } from 'sonner';

export default function OutfitGeneratePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { generateOutfit, isGenerating, error } = useOutfitGenerator();
  const { locale } = useLanguage();
  const { isUnlocked } = useWardrobeUnlocks();
  
  const state = location.state as OutfitRequest | null;
  
  const PHASES = [
    { icon: Shirt, label: t('generate.phase_analyzing'), duration: 800 },
    { icon: Palette, label: t('generate.phase_matching'), duration: 1200 },
    { icon: CloudSun, label: t('generate.phase_weather') || 'Checking weather...', duration: 1000 },
    { icon: Eye, label: t('generate.phase_styling') || 'Matching styles...', duration: 1200 },
    { icon: Wand2, label: t('generate.phase_creating'), duration: 0 },
  ];

  useEffect(() => {
    if (!isUnlocked('outfit_gen')) return;
    if (!state?.occasion) {
      navigate('/', { replace: true });
      return;
    }
    handleGenerate();
  }, []);
  
  const handleGenerate = async () => {
    if (!state) return;
    
    try {
      const outfit = await generateOutfit({ ...state, locale });
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

  // Gate: require enough garments (after all hooks)
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
  
  const subtitle = [state?.occasion, state?.style].filter(Boolean).join(' · ') +
    (state?.weather?.temperature !== undefined ? ` · ${state.weather.temperature}°C` : '');

  return (
    <AppLayout>
      <AILoadingOverlay
        variant="fullscreen"
        phases={PHASES}
        subtitle={subtitle || undefined}
      />
    </AppLayout>
  );
}
