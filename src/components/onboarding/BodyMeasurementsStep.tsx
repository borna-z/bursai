import { useState } from 'react';
import { Ruler, Weight, Lock, ChevronRight, Loader2, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface BodyMeasurementsStepProps {
  onComplete: (data: { height_cm: number | null; weight_kg: number | null }) => Promise<void>;
  onSkip: () => void;
  isSaving: boolean;
}

export function BodyMeasurementsStep({ onComplete, onSkip, isSaving }: BodyMeasurementsStepProps) {
  const { t } = useLanguage();
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [heightError, setHeightError] = useState('');

  const validateHeight = (val: string) => {
    const n = parseInt(val, 10);
    if (val && (isNaN(n) || n < 100 || n > 250)) {
      setHeightError(t('onboarding.body.height_error'));
      return false;
    }
    setHeightError('');
    return true;
  };

  const handleContinue = async () => {
    if (height && !validateHeight(height)) return;
    const heightNum = height ? parseInt(height, 10) : null;
    const weightNum = weight ? parseInt(weight, 10) : null;
    await onComplete({ height_cm: heightNum, weight_kg: weightNum });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top visual area */}
      <div className="bg-gradient-to-br from-accent/10 via-accent/5 to-background pt-16 pb-10 px-6 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-accent/15 flex items-center justify-center mb-6">
          <Brain className="w-10 h-10 text-accent" />
        </div>
        <h1 className="text-2xl font-bold mb-3 tracking-tight">{t('onboarding.body.title')}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
          {t('onboarding.body.subtitle')}
        </p>
      </div>

      {/* Form area */}
      <div className="flex-1 px-6 pt-8 pb-10 space-y-8">
        {/* Height input */}
        <div className="space-y-2">
          <Label htmlFor="height" className="flex items-center gap-2 text-sm font-medium">
            <Ruler className="w-4 h-4 text-accent" />
            {t('onboarding.body.height')}
          </Label>
          <div className="relative">
            <Input
              id="height"
              type="number"
              inputMode="numeric"
              placeholder="175"
              value={height}
              onChange={(e) => {
                setHeight(e.target.value);
                if (heightError) validateHeight(e.target.value);
              }}
              onBlur={() => validateHeight(height)}
              className={cn(
                'pr-12 h-14 text-lg',
                heightError && 'border-destructive focus-visible:ring-destructive'
              )}
              min={100}
              max={250}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
              cm
            </span>
          </div>
          {heightError && (
            <p className="text-xs text-destructive">{heightError}</p>
          )}
        </div>

        {/* Weight input */}
        <div className="space-y-2">
          <Label htmlFor="weight" className="flex items-center gap-2 text-sm font-medium">
            <Weight className="w-4 h-4 text-accent" />
            {t('onboarding.body.weight')}
            <span className="text-muted-foreground font-normal">{t('onboarding.body.weight_optional')}</span>
          </Label>
          <div className="relative">
            <Input
              id="weight"
              type="number"
              inputMode="numeric"
              placeholder="70"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="pr-12 h-14 text-lg"
              min={30}
              max={300}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
              kg
            </span>
          </div>
        </div>

        {/* Privacy note */}
        <div className="flex items-start gap-3 bg-secondary/60 rounded-xl p-4">
          <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('onboarding.body.privacy')}
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Button
            className="w-full h-14 text-base font-medium"
            onClick={handleContinue}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <ChevronRight className="w-5 h-5 mr-2" />
            )}
            {t('onboarding.body.continue')}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onSkip}
            disabled={isSaving}
          >
            {t('onboarding.body.skip')}
          </Button>
        </div>
      </div>
    </div>
  );
}
