import { useState } from 'react';
import { Palette, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Chip } from '@/components/ui/chip';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const COLORS = [
  'svart', 'vit', 'grå', 'marinblå', 'blå', 'röd', 'grön', 'beige', 'brun', 'rosa', 'gul', 'orange', 'lila'
];

const FIT_OPTIONS = ['loose', 'regular', 'slim'] as const;
const VIBE_OPTIONS = ['minimal', 'street', 'smart-casual', 'klassisk'] as const;

export interface StylePreferences {
  favoriteColors: string[];
  dislikedColors: string[];
  fitPreference: string;
  styleVibe: string;
  genderNeutral: boolean;
}

interface StylePreferencesStepProps {
  onComplete: (prefs: StylePreferences) => void;
  isSaving: boolean;
}

export function StylePreferencesStep({ onComplete, isSaving }: StylePreferencesStepProps) {
  const { t } = useLanguage();
  const [favoriteColors, setFavoriteColors] = useState<string[]>([]);
  const [dislikedColors, setDislikedColors] = useState<string[]>([]);
  const [fitPreference, setFitPreference] = useState('regular');
  const [styleVibe, setStyleVibe] = useState('smart-casual');
  const [genderNeutral, setGenderNeutral] = useState(false);

  const toggleColor = (list: string[], setList: (v: string[]) => void, color: string) => {
    setList(list.includes(color) ? list.filter(c => c !== color) : [...list, color]);
  };

  const handleContinue = () => {
    onComplete({ favoriteColors, dislikedColors, fitPreference, styleVibe, genderNeutral });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Gradient header */}
      <div className="bg-gradient-to-br from-accent/10 via-accent/5 to-background pt-16 pb-10 px-6 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-accent/15 flex items-center justify-center mb-6">
          <Palette className="w-10 h-10 text-accent" />
        </div>
        <h1 className="text-2xl font-bold mb-3 tracking-tight">{t('onboarding.style.title')}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">{t('onboarding.style.subtitle')}</p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32">

        <div className="space-y-6">
          {/* Favorite Colors */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('onboarding.style.favorite_colors')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map(color => (
                <Chip
                  key={color}
                  selected={favoriteColors.includes(color)}
                  onClick={() => toggleColor(favoriteColors, setFavoriteColors, color)}
                  className="capitalize text-xs"
                >
                  {color}
                </Chip>
              ))}
            </div>
          </div>

          {/* Disliked Colors */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('onboarding.style.disliked_colors')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map(color => (
                <Chip
                  key={color}
                  selected={dislikedColors.includes(color)}
                  onClick={() => toggleColor(dislikedColors, setDislikedColors, color)}
                  className="capitalize text-xs"
                >
                  {color}
                </Chip>
              ))}
            </div>
          </div>

          {/* Fit Preference */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('onboarding.style.fit')}</Label>
            <div className="flex gap-2">
              {FIT_OPTIONS.map(fit => (
                <button
                  key={fit}
                  onClick={() => setFitPreference(fit)}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all capitalize',
                    fitPreference === fit
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'bg-secondary/50 border-border text-foreground hover:bg-secondary'
                  )}
                >
                  {fit === 'loose' ? 'Loose' : fit === 'regular' ? 'Regular' : 'Slim'}
                </button>
              ))}
            </div>
          </div>

          {/* Style Vibe */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('onboarding.style.vibe')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {VIBE_OPTIONS.map(vibe => (
                <button
                  key={vibe}
                  onClick={() => setStyleVibe(vibe)}
                  className={cn(
                    'py-2.5 rounded-lg text-sm font-medium border transition-all capitalize',
                    styleVibe === vibe
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'bg-secondary/50 border-border text-foreground hover:bg-secondary'
                  )}
                >
                  {vibe === 'smart-casual' ? t('style.smart_casual') : vibe === 'klassisk' ? t('style.klassisk') : vibe === 'minimal' ? t('style.minimal') : t('style.street')}
                </button>
              ))}
            </div>
          </div>

          {/* Gender Neutral */}
          <div className="flex items-center justify-between py-2">
            <Label className="text-sm font-medium">{t('onboarding.style.gender_neutral')}</Label>
            <Switch checked={genderNeutral} onCheckedChange={setGenderNeutral} />
          </div>
        </div>
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] bg-background/80 backdrop-blur-sm border-t border-border">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handleContinue}
            disabled={isSaving}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-14 text-base"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <ArrowRight className="w-5 h-5 mr-2" />
            )}
            {t('onboarding.style.continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}
