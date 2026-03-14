import { Check, Heart, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useTheme, ACCENT_COLORS } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsDark } from '@/hooks/useIsDark';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: EASE_CURVE } }),
};

interface AccentColorStepProps {
  onComplete: () => void;
}

export function AccentColorStep({ onComplete }: AccentColorStepProps) {
  const { accentColor, setAccentColor } = useTheme();
  const { t } = useLanguage();
  const dark = useIsDark();

  return (
    <div className={cn('min-h-screen flex flex-col relative overflow-hidden', dark ? 'dark-landing' : 'bg-background text-foreground')}>
      {dark && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-[radial-gradient(ellipse,rgba(99,102,241,0.06)_0%,transparent_70%)] blur-3xl" />
        </div>
      )}

      <div className="relative z-10 pt-16 pb-6 px-6 flex flex-col items-center text-center">
        <motion.h1 variants={fadeUp} initial="hidden" animate="show" custom={0}
          className={cn('text-xl font-bold mb-2 tracking-tight', dark ? 'text-white' : 'text-foreground')}
        >
          {t('onboarding.accent.title')}
        </motion.h1>
        <motion.p variants={fadeUp} initial="hidden" animate="show" custom={1}
          className={cn('text-sm leading-relaxed max-w-xs mb-8', dark ? 'text-white/35' : 'text-muted-foreground')}
        >
          {t('onboarding.accent.subtitle')}
        </motion.p>

        {/* Live preview */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={2}
          className={cn(
            'w-full max-w-sm p-5 space-y-4 transition-all duration-300 border',
            dark ? 'rounded-2xl border-white/[0.06] bg-white/[0.03]' : 'border-border bg-card'
          )}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className={cn('px-4 py-2 text-sm font-medium text-white transition-colors duration-300', dark && 'rounded-xl')}
              style={{ backgroundColor: accentColor.hex }}
            >
              {t('onboarding.body.continue')}
            </button>
            <button
              className={cn('px-4 py-2 text-sm font-medium border-2 bg-transparent transition-colors duration-300', dark && 'rounded-xl')}
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
          </div>
        </motion.div>
      </div>

      {/* Color grid */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={3} className="relative z-10 flex-1 px-6 pb-10">
        <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto">
          {ACCENT_COLORS.map((color) => {
            const isSelected = accentColor.id === color.id;
            return (
              <button
                key={color.id}
                onClick={() => setAccentColor(color.id)}
                className={cn(
                  'flex flex-col items-center gap-2 py-3 border transition-all',
                  dark && 'rounded-xl',
                  isSelected
                    ? (dark ? 'border-white/20 bg-white/[0.06] scale-105' : 'border-foreground bg-muted scale-105')
                    : (dark ? 'border-transparent hover:bg-white/[0.04]' : 'border-transparent hover:bg-muted')
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
                <span className={cn('text-[10px] font-medium leading-none', dark ? 'text-white/35' : 'text-muted-foreground')}>
                  {color.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 max-w-sm mx-auto">
          <button
            className={cn(
              'w-full h-[52px] text-[15px] font-semibold text-white transition-colors duration-300 hover:opacity-90 active:scale-[0.98]',
              dark && 'rounded-xl'
            )}
            style={{ backgroundColor: accentColor.hex }}
            onClick={onComplete}
          >
            {t('onboarding.body.continue')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
