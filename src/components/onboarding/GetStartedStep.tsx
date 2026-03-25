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
          style={{
            fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
            fontSize: 20, textAlign: 'center', maxWidth: 240, marginBottom: 8,
          }}
          className={cn(dark ? 'text-white' : 'text-foreground')}
        >
          Your wardrobe is ready.
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
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                  padding: 16, border: 'none', background: '#EDE8DF',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, background: 'rgba(28,25,23,0.06)',
                }}>
                  <Icon style={{ width: 20, height: 20, color: '#1C1917' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 500, color: '#1C1917', margin: 0 }}>{action.title}</p>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(28,25,23,0.45)', margin: '2px 0 0' }}>{action.desc}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
