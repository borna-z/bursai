import { CheckCircle, MessageCircle, Shirt, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

import { Card } from '@/components/ui/card';
import { PageIntro } from '@/components/ui/page-intro';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_CURVE } from '@/lib/motion';

interface GetStartedStepProps {
  onAction: (path: string) => void;
}

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
    <div className="min-h-screen bg-background text-foreground">
      <div className="page-shell !max-w-lg !px-6 !pb-16 !pt-24 page-cluster">
        <Card surface="editorial" className="p-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.45rem] bg-background/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <CheckCircle className="h-8 w-8 text-foreground/78" />
          </div>
          <div className="mt-5">
            <PageIntro
              center
              eyebrow="Ready"
              title="Your wardrobe is ready."
              description={t('onboarding.getstarted.subtitle')}
            />
          </div>
        </Card>

        <div className="space-y-3">
          {actions.map((action, index) => {
            const Icon = action.icon;

            return (
              <motion.button
                key={action.path}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06, duration: 0.28, ease: EASE_CURVE }}
                onClick={() => onAction(action.path)}
                className="w-full text-left"
              >
                <Card surface="utility" className="flex items-center gap-4 p-4 transition-transform duration-200 hover:-translate-y-0.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-secondary/70">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.92rem] font-medium text-foreground">{action.title}</p>
                    <p className="mt-1 text-[0.8rem] leading-5 text-muted-foreground">{action.desc}</p>
                  </div>
                </Card>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
