import { Globe, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/translations';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: EASE_CURVE } }),
};

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
      <div className="bg-gradient-to-br from-accent/10 via-accent/5 to-background pt-16 pb-10 px-6 flex flex-col items-center text-center">
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0} className="w-20 h-20 rounded-2xl bg-accent/15 flex items-center justify-center mb-6">
          <Globe className="w-10 h-10 text-accent" />
        </motion.div>
        <motion.h1 variants={fadeUp} initial="hidden" animate="show" custom={1} className="text-2xl font-bold mb-3 tracking-tight">
          {t('onboarding.language.title')}
        </motion.h1>
        <motion.p variants={fadeUp} initial="hidden" animate="show" custom={2} className="text-muted-foreground text-sm leading-relaxed max-w-xs">
          {t('onboarding.language.subtitle')}
        </motion.p>
      </div>

      {/* Language grid */}
      <div className="flex-1 px-6 pt-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          {SUPPORTED_LOCALES.map((loc, i) => {
            const isSelected = locale === loc.code;
            return (
              <motion.button
                key={loc.code}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={3 + i}
                onClick={() => handleSelect(loc.code)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left',
                  isSelected
                    ? 'border-accent bg-accent/5 ring-2 ring-accent/20'
                    : 'border-border hover:border-accent/30 hover:bg-secondary/50'
                )}
              >
                <span className="text-xl">{loc.flag}</span>
                <span className="flex-1 text-sm font-medium truncate">{loc.name}</span>
                {isSelected && (
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Continue */}
        <div className="mt-8 max-w-sm mx-auto">
          <Button className="w-full h-14 text-base font-medium bg-accent text-accent-foreground hover:bg-accent/90" onClick={onComplete}>
            {t('onboarding.body.continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}
