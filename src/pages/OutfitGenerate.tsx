import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { useOutfitGenerator, type OutfitRequest } from '@/hooks/useOutfitGenerator';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

export default function OutfitGeneratePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { generateOutfit, isGenerating, error } = useOutfitGenerator();
  
  const state = location.state as OutfitRequest | null;
  
  useEffect(() => {
    if (!state?.occasion) {
      // No state, go back to home
      navigate('/', { replace: true });
      return;
    }
    
    // Start generation
    handleGenerate();
  }, []);
  
  const handleGenerate = async () => {
    if (!state) return;
    
    try {
      const outfit = await generateOutfit(state);
      
      // Navigate to result
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
  
  if (error) {
    return (
      <AppLayout>
        <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
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
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Sparkles className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <Loader2 className="w-24 h-24 absolute -top-2 -left-2 left-1/2 -translate-x-1/2 animate-spin text-primary/30" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{t('generate.creating')}</h2>
            <p className="text-muted-foreground">
              {t('generate.matching_for')} {state?.occasion || ''}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 justify-center text-sm text-muted-foreground">
            {state?.weather?.temperature !== undefined && (
              <span>{state.weather.temperature}°C</span>
            )}
            {state?.style && (
              <span className="capitalize">{state.style}</span>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
