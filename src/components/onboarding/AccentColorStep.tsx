import { Check, Heart, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTheme, ACCENT_COLORS } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface AccentColorStepProps {
  onComplete: () => void;
}

export function AccentColorStep({ onComplete }: AccentColorStepProps) {
  const { accentColor, setAccentColor } = useTheme();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="pt-16 pb-8 px-6 flex flex-col items-center text-center">
        <h1 className="text-xl font-bold mb-2 tracking-tight">
          {t('onboarding.accent.title')}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mb-8">
          {t('onboarding.accent.subtitle')}
        </p>

        {/* Live UI preview */}
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-4 transition-all duration-300">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors duration-300"
              style={{ backgroundColor: accentColor.hex }}
            >
              {t('onboarding.body.continue')}
            </button>
            <button
              className="px-4 py-2 rounded-lg text-sm font-medium border-2 bg-transparent transition-colors duration-300"
              style={{ borderColor: accentColor.hex, color: accentColor.hex }}
            >
              Outline
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white transition-colors duration-300"
              style={{ backgroundColor: accentColor.hex }}
            >
              <Heart className="w-3 h-3" /> Favorit
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-300"
              style={{ backgroundColor: accentColor.hex + '18', color: accentColor.hex }}
            >
              <Star className="w-3 h-3" /> Premium
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition-colors duration-300"
              style={{ borderColor: accentColor.hex + '40', color: accentColor.hex }}
            >
              Casual
            </span>
          </div>
        </div>
      </div>

      {/* Color grid */}
      <div className="flex-1 px-6 pb-10">
        <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto">
          {ACCENT_COLORS.map((color) => {
            const isSelected = accentColor.id === color.id;
            return (
              <button
                key={color.id}
                onClick={() => setAccentColor(color.id)}
                className={cn(
                  'flex flex-col items-center gap-2 py-3 rounded-xl border transition-all',
                  isSelected
                    ? 'border-foreground/30 bg-secondary/80 scale-105 shadow-sm'
                    : 'border-transparent hover:bg-secondary/40'
                )}
                aria-label={color.name}
              >
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-full transition-transform duration-200"
                    style={{ backgroundColor: color.hex }}
                  />
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="w-5 h-5 text-white drop-shadow-md" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-medium text-muted-foreground leading-none">
                  {color.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Continue */}
        <div className="mt-8 max-w-sm mx-auto">
          <Button
            className="w-full h-14 text-base font-medium text-white transition-colors duration-300"
            style={{ backgroundColor: accentColor.hex }}
            onClick={onComplete}
          >
            {t('onboarding.body.continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}
