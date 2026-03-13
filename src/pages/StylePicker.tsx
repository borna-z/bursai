import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Minus, Footprints, Briefcase, Crown, Dumbbell, Heart,
  Flower2, GraduationCap, Flame, Coffee, Building2,
  PartyPopper, Disc3, Snowflake, Bike,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnimatedPage } from '@/components/ui/animated-page';
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

  const handlePick = async (key: string) => {
    if (isGenerating) return;
    setSelectedKey(key);
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
      toast.error(err instanceof Error ? err.message : t('common.something_wrong'));
    } finally {
      setSelectedKey(null);
    }
  };

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
            const isActive = selectedKey === look.key && isGenerating;
            return (
              <motion.div
                key={look.key}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.035 }}
              >
                <Card
                  className={`cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.97] ${isActive ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => handlePick(look.key)}
                >
                  <CardContent className="p-3 flex flex-col items-center gap-1.5 text-center">
                    <div className="w-10 h-10 rounded-xl bg-foreground/[0.05] flex items-center justify-center">
                      <Icon className="w-5 h-5 text-foreground/70" />
                    </div>
                    <p className="text-xs font-semibold leading-tight">{t(`style_picker.look_${look.key}`)}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{t(`style_picker.look_${look.key}_desc`)}</p>
                    {isActive && (
                      <Badge variant="secondary" className="animate-pulse text-[10px] mt-0.5">
                        {t('ai.mood_generating')}
                      </Badge>
                    )}
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
