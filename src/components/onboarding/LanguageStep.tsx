import { Globe, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/translations';

interface LanguageStepProps {
  onComplete: () => void;
}

export function LanguageStep({ onComplete }: LanguageStepProps) {
  const { locale, setLocale, t } = useLanguage();

  const handleSelect = (code: Locale) => {
    setLocale(code);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-background pt-16 pb-10 px-6 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-primary/15 flex items-center justify-center mb-6">
          <Globe className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-3 tracking-tight">
          {t('onboarding.language.title')}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
          {t('onboarding.language.subtitle')}
        </p>
      </div>

      {/* Language grid */}
      <div className="flex-1 px-6 pt-6 pb-10">
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          {SUPPORTED_LOCALES.map((loc) => {
            const isSelected = locale === loc.code;
            return (
              <button
                key={loc.code}
                onClick={() => handleSelect(loc.code)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left',
                  isSelected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/30 hover:bg-secondary/50'
                )}
              >
                <span className="text-xl">{loc.flag}</span>
                <span className="flex-1 text-sm font-medium truncate">{loc.name}</span>
                {isSelected && (
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                )}
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
