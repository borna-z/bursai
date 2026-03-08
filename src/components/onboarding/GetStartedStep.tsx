import { motion } from 'framer-motion';
import { Shirt, Sparkles, MessageCircle, CheckCircle } from 'lucide-react';
import { EASE_CURVE } from '@/lib/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

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

  const actions = [
    {
      icon: Shirt,
      title: t('onboarding.getstarted.add_garment'),
      desc: t('onboarding.getstarted.add_garment_desc'),
      path: '/wardrobe/add',
    },
    {
      icon: Sparkles,
      title: t('onboarding.getstarted.generate_outfit'),
      desc: t('onboarding.getstarted.generate_outfit_desc'),
      path: '/',
    },
    {
      icon: MessageCircle,
      title: t('onboarding.getstarted.talk_stylist'),
      desc: t('onboarding.getstarted.talk_stylist_desc'),
      path: '/ai',
    },
  ];

  return (
    <div className="dark-landing min-h-screen flex flex-col items-center relative overflow-hidden">
      {/* Aurora */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-[radial-gradient(ellipse,rgba(99,102,241,0.08)_0%,transparent_70%)] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto px-6 pt-20 pb-12 flex flex-col items-center flex-1">
        {/* Celebration */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="show" custom={0}
          className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center mb-6"
        >
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </motion.div>

        <motion.h1
          variants={fadeUp} initial="hidden" animate="show" custom={1}
          className="text-2xl font-bold text-white tracking-tight mb-2"
        >
          {t('onboarding.getstarted.title')}
        </motion.h1>

        <motion.p
          variants={fadeUp} initial="hidden" animate="show" custom={2}
          className="text-white/40 text-sm text-center mb-10 max-w-xs"
        >
          {t('onboarding.getstarted.subtitle')}
        </motion.p>

        {/* Action cards */}
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
                  'w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left',
                  'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.1] active:scale-[0.98]'
                )}
              >
                <div className="w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-white/70" />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-white">{action.title}</p>
                  <p className="text-xs text-white/35 mt-0.5">{action.desc}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
