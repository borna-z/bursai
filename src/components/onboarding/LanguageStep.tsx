import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/translations';
import bursLogoWhite from '@/assets/burs-logo-256-2.png';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4, ease: EASE_CURVE } }),
};

interface LanguageStepProps {
  onComplete: () => void;
}

export function LanguageStep({ onComplete }: LanguageStepProps) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div className="dark-landing min-h-screen flex flex-col relative overflow-hidden">
      {/* Aurora */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-[radial-gradient(ellipse,rgba(99,102,241,0.08)_0%,transparent_70%)] blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center pt-16 pb-8 px-6">
        <motion.img
          src={bursLogoWhite}
          alt="BURS"
          className="h-9 w-auto opacity-90 mb-8"
          variants={fadeUp} initial="hidden" animate="show" custom={0}
        />
        <motion.h1
          variants={fadeUp} initial="hidden" animate="show" custom={1}
          className="text-2xl font-bold text-white tracking-tight mb-2"
        >
          {t('onboarding.language.title')}
        </motion.h1>
        <motion.p
          variants={fadeUp} initial="hidden" animate="show" custom={2}
          className="text-white/35 text-sm"
        >
          {t('onboarding.language.subtitle')}
        </motion.p>
      </div>

      {/* Language grid */}
      <div className="relative z-10 flex-1 px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-2.5 max-w-sm mx-auto">
          {SUPPORTED_LOCALES.map((loc, i) => {
            const isSelected = locale === loc.code;
            return (
              <motion.button
                key={loc.code}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={3 + i}
                onClick={() => setLocale(loc.code)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left',
                  isSelected
                    ? 'border-white/20 bg-white/[0.08]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'
                )}
              >
                <span className="text-xl">{loc.flag}</span>
                <span className={cn(
                  'flex-1 text-sm font-medium truncate',
                  isSelected ? 'text-white' : 'text-white/60'
                )}>{loc.name}</span>
                {isSelected && (
                  <Check className="w-4 h-4 text-white/70 flex-shrink-0" />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Continue */}
        <div className="mt-8 max-w-sm mx-auto">
          <button
            className="w-full h-[52px] rounded-xl bg-white text-[#030305] text-[15px] font-semibold hover:bg-white/90 active:scale-[0.98] transition-all"
            onClick={onComplete}
          >
            {t('onboarding.body.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
