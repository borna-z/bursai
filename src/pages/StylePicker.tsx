import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Minus, Footprints, Briefcase, Crown, Dumbbell, Heart,
  Flower2, GraduationCap, Flame, Coffee, Building2,
  PartyPopper, Disc3, Snowflake, Bike, AlertCircle, ArrowLeft,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnimatedPage } from '@/components/ui/animated-page';
import { OutfitGenerationState } from '@/components/ui/OutfitGenerationState';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWeather } from '@/hooks/useWeather';
import { useOutfitGenerator } from '@/hooks/useOutfitGenerator';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const LOOKS = [
  { key: 'minimal', icon: Minus },
  { key: 'street', icon: Footprints },
  { key: 'smart_casual', icon: Briefcase },
  { key: 'classic', icon: Crown },
  { key: 'sporty', icon: Dumbbell },
  { key: 'romantic', icon: Heart },
  { key: 'bohemian', icon: Flower2 },
  { key: 'preppy', icon: GraduationCap },
  { key: 'edgy', icon: Flame },
  { key: 'cozy', icon: Coffee },
  { key: 'business', icon: Building2 },
  { key: 'party', icon: PartyPopper },
  { key: 'retro', icon: Disc3 },
  { key: 'scandi', icon: Snowflake },
  { key: 'athleisure', icon: Bike },
] as const;

export default function StylePickerPage() {
  const { t } = useLanguage();
  const { weather } = useWeather();
  const { generateOutfit, isGenerating } = useOutfitGenerator();
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePick = async (key: string) => {
    if (isGenerating) return;
    setSelectedKey(key);
    setErrorMessage(null);
    try {
      const result = await generateOutfit({
        occasion: 'vardag',
        style: key,
        weather: {
          temperature: weather?.temperature,
          precipitation: weather?.precipitation ?? 'none',
          wind: weather?.wind ?? 'low',
        },
      });
      navigate(`/outfits/${result.id}`, { replace: true, state: { justGenerated: true } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.something_wrong');
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setSelectedKey(null);
    }
  };

  // Show centered generation state when generating
  if (isGenerating && selectedKey) {
    return (
      <AppLayout>
        <PageHeader title={t('style_picker.title')} showBack />
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
          <OutfitGenerationState
            subtitle={t(`style_picker.look_${selectedKey}`)}
            variant="full"
            className="max-w-sm w-full"
          />
        </div>
      </AppLayout>
    );
  }

  // Show error state with retry option
  if (errorMessage) {
    return (
      <AppLayout>
        <PageHeader title={t('style_picker.title')} showBack />
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-destructive/60" />
          <div className="space-y-1.5 max-w-xs">
            <p className="text-sm font-medium">{t('generate.error_title')}</p>
            <p className="text-xs text-muted-foreground">{errorMessage}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t('common.back')}
            </Button>
            <Button size="sm" onClick={() => setErrorMessage(null)}>
              {t('generate.retry')}
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title={t('style_picker.title')} showBack />
      <AnimatedPage className="max-w-lg mx-auto px-4 pb-8 pt-4">
        <div className="text-center space-y-1 mb-6">
          <p className="text-sm text-muted-foreground">{t('style_picker.subtitle')}</p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {LOOKS.map((look, i) => {
            const Icon = look.icon;
            return (
              <motion.div
                key={look.key}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.035 }}
              >
                <Card
                  className="cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.97]"
                  onClick={() => handlePick(look.key)}
                >
                  <CardContent className="p-3 flex flex-col items-center gap-1.5 text-center">
                    <div className="w-10 h-10 rounded-xl bg-foreground/[0.05] flex items-center justify-center">
                      <Icon className="w-5 h-5 text-foreground/70" />
                    </div>
                    <p className="text-xs font-semibold leading-tight">{t(`style_picker.look_${look.key}`)}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{t(`style_picker.look_${look.key}_desc`)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </AnimatedPage>
    </AppLayout>
  );
}