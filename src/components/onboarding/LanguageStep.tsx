import { Check } from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageIntro } from '@/components/ui/page-intro';
import { useLanguage } from '@/contexts/LanguageContext';
import { SUPPORTED_LOCALES } from '@/i18n/types';
import { EASE_CURVE } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface LanguageStepProps {
  onComplete: () => void;
}

export function LanguageStep({ onComplete }: LanguageStepProps) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="page-shell !max-w-lg !px-6 !pb-16 !pt-[calc(var(--safe-area-top)+6rem)] page-cluster">
        <Card surface="editorial" className="p-6">
          <PageIntro
            center
            eyebrow={t('onboarding.eyebrow_generic')}
            title={t('onboarding.language.title')}
            description={t('onboarding.language.subtitle')}
          />
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          {SUPPORTED_LOCALES.map((supportedLocale, index) => {
            const isSelected = locale === supportedLocale.code;

            return (
              <motion.button
                key={supportedLocale.code}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.28, ease: EASE_CURVE }}
                onClick={() => setLocale(supportedLocale.code)}
                className="text-left"
              >
                <Card
                  surface={isSelected ? 'editorial' : 'utility'}
                  className={cn(
                    'flex items-center gap-4 p-4 transition-transform duration-200',
                    isSelected ? 'border-foreground/20' : 'hover:-translate-y-0.5',
                  )}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-background/82 text-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    {supportedLocale.flag}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.95rem] font-medium text-foreground">{supportedLocale.name}</p>
                    <p className="mt-1 text-[0.75rem] uppercase tracking-[0.16em] text-muted-foreground">
                      {supportedLocale.code}
                    </p>
                  </div>
                  {isSelected ? <Check className="h-4 w-4 text-foreground" /> : null}
                </Card>
              </motion.button>
            );
          })}
        </div>

        <div className="action-bar-floating rounded-[1.6rem] p-3">
          <Button onClick={onComplete} size="lg" className="w-full">
            {t('onboarding.body.continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}
