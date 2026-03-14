import { motion } from 'framer-motion';
import { Shirt, Sparkles, MessageCircle, CheckCircle } from 'lucide-react';
import { EASE_CURVE } from '@/lib/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { useIsDark } from '@/hooks/useIsDark';

interface GetStartedStepProps {
  onAction: (path: string) => void;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: EASE_CURVE },
  }),
};

export function GetStartedStep({ onAction }: GetStartedStepProps) {
  const { t } = useLanguage();
  const dark = useIsDark();

  const actions = [
    { icon: Shirt, title: t('onboarding.getstarted.add_garment'), desc: t('onboarding.getstarted.add_garment_desc'), path: '/wardrobe/add' },
    { icon: Sparkles, title: t('onboarding.getstarted.generate_outfit'), desc: t('onboarding.getstarted.generate_outfit_desc'), path: '/' },
    { icon: MessageCircle, title: t('onboarding.getstarted.talk_stylist'), desc: t('onboarding.getstarted.talk_stylist_desc'), path: '/ai' },
  ];

  return (
    <div className={cn('min-h-screen flex flex-col items-center relative overflow-hidden', dark ? 'dark-landing' : 'bg-background text-foreground')}>
      {dark && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-[radial-gradient(ellipse,rgba(99,102,241,0.08)_0%,transparent_70%)] blur-3xl" />
        </div>
      )}

      <div className="relative z-10 w-full max-w-sm mx-auto px-6 pt-20 pb-12 flex flex-col items-center flex-1">
        <motion.div
          variants={fadeUp} initial="hidden" animate="show" custom={0}
          className={cn('w-16 h-16 flex items-center justify-center mb-6', dark ? 'rounded-2xl bg-emerald-500/15' : 'bg-muted')}
        >
          <CheckCircle className={cn('w-8 h-8', dark ? 'text-emerald-400' : 'text-foreground')} />
        </motion.div>

        <motion.h1
          variants={fadeUp} initial="hidden" animate="show" custom={1}
          className={cn('text-2xl font-bold tracking-tight mb-2', dark ? 'text-white' : 'text-foreground')}
        >
          {t('onboarding.getstarted.title')}
        </motion.h1>

        <motion.p
          variants={fadeUp} initial="hidden" animate="show" custom={2}
          className={cn('text-sm text-center mb-10 max-w-xs', dark ? 'text-white/40' : 'text-muted-foreground')}
        >
          {t('onboarding.getstarted.subtitle')}
        </motion.p>

        <div className="w-full space-y-3">
          {actions.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.path}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={3 + i}
                onClick={() => onAction(action.path)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 border transition-all text-left active:scale-[0.98]',
                  dark
                    ? 'rounded-2xl border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.1]'
                    : 'border-border bg-card hover:bg-muted'
                )}
              >
                <div className={cn(
                  'w-11 h-11 flex items-center justify-center flex-shrink-0',
                  dark ? 'rounded-xl bg-white/[0.06]' : 'bg-muted'
                )}>
                  <Icon className={cn('w-5 h-5', dark ? 'text-white/70' : 'text-foreground')} />
                </div>
                <div className="min-w-0">
                  <p className={cn('text-[15px] font-medium', dark ? 'text-white' : 'text-foreground')}>{action.title}</p>
                  <p className={cn('text-xs mt-0.5', dark ? 'text-white/35' : 'text-muted-foreground')}>{action.desc}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
