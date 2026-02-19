import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTheme, ACCENT_COLORS } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import drapeLogoSrc from '@/assets/drape-logo.png';

interface AccentColorStepProps {
  onComplete: () => void;
}

export function AccentColorStep({ onComplete }: AccentColorStepProps) {
  const { accentColor, setAccentColor } = useTheme();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with tinted logo preview */}
      <div className="pt-16 pb-8 px-6 flex flex-col items-center text-center">
        {/* Logo preview with accent tint */}
        <div className="relative mb-8">
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center transition-colors duration-500"
            style={{ backgroundColor: accentColor.hex + '12' }}
          >
            <div className="relative">
              <img
                src={drapeLogoSrc}
                alt="DRAPE"
                width={48}
                height={48}
                className="object-contain dark:invert transition-all duration-300"
              />
              {/* Accent tint overlay on logo */}
              <div
                className="absolute inset-0 mix-blend-color transition-colors duration-500"
                style={{ backgroundColor: accentColor.hex }}
              />
            </div>
          </div>
          {/* Floating accent dot */}
          <div
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-background transition-colors duration-300"
            style={{ backgroundColor: accentColor.hex }}
          />
        </div>

        <span
          className="text-2xl font-bold tracking-[0.12em] mb-2 transition-colors duration-500"
          style={{ fontFamily: "'Sora', sans-serif", color: accentColor.hex }}
        >
          DRAPE
        </span>

        <h1 className="text-xl font-bold mb-2 tracking-tight">
          {t('onboarding.accent.title')}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
          {t('onboarding.accent.subtitle')}
        </p>
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
          <Button className="w-full h-14 text-base font-medium" onClick={onComplete}>
            {t('onboarding.body.continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}
