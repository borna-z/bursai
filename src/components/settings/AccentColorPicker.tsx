import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme, ACCENT_COLORS } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';

export function AccentColorPicker() {
  const { accentColor, setAccentColor } = useTheme();
  const { t } = useLanguage();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('onboarding.accent.subtitle')}</p>
      <div className="grid grid-cols-6 gap-3">
        {ACCENT_COLORS.map((color) => {
          const isSelected = accentColor.id === color.id;
          return (
            <button
              key={color.id}
              onClick={() => setAccentColor(color.id)}
              className={cn(
                'flex flex-col items-center gap-1.5 py-2 rounded-lg border transition-all',
                isSelected
                  ? 'border-foreground/30 bg-secondary/80 scale-105 shadow-sm'
                  : 'border-transparent hover:bg-secondary/40'
              )}
              aria-label={t(color.name)}
            >
              <div className="relative">
                <div
                  className="w-10 h-10 rounded-full transition-transform duration-200"
                  style={{ backgroundColor: color.hex }}
                />
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white drop-shadow-md" strokeWidth={3} />
                  </div>
                )}
              </div>
              <span className="text-[9px] font-medium text-muted-foreground leading-none">
                {t(color.name)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
