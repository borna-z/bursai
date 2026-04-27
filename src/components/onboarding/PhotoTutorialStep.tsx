import { motion } from 'framer-motion';
import {
  ArrowRight,
  Camera,
  Check,
  Frame,
  Shirt,
  Sun,
  UserX,
  X,
  Layers,
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { PageIntro } from '@/components/ui/page-intro';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_CURVE } from '@/lib/motion';
import { safeT } from '@/lib/i18nFallback';

interface PhotoTutorialStepProps {
  onComplete: () => void;
}

interface Tip {
  icon: typeof Sun;
  labelKey: string;
  bodyKey: string;
  labelFallback: string;
  bodyFallback: string;
}

const TIPS: Tip[] = [
  {
    icon: Sun,
    labelKey: 'photoTutorial.bullet.lighting',
    labelFallback: 'Bright, even light',
    bodyKey: 'photoTutorial.bullet.lighting_body',
    bodyFallback: 'Daylight near a window works best. Avoid harsh shadows or moody side-light.',
  },
  {
    icon: Layers,
    labelKey: 'photoTutorial.bullet.surface',
    labelFallback: 'Plain background',
    bodyKey: 'photoTutorial.bullet.surface_body',
    bodyFallback: 'Lay the piece flat on a bed, floor, or wall in one solid colour.',
  },
  {
    icon: Frame,
    labelKey: 'photoTutorial.bullet.framing',
    labelFallback: 'Whole garment in frame',
    bodyKey: 'photoTutorial.bullet.framing_body',
    bodyFallback: 'Show the full piece edge to edge. Keep the camera straight overhead.',
  },
  {
    icon: UserX,
    labelKey: 'photoTutorial.bullet.isolation',
    labelFallback: 'No people in the shot',
    bodyKey: 'photoTutorial.bullet.isolation_body',
    bodyFallback: 'Hands, mirrors, and faces confuse the AI. Just the garment, please.',
  },
  {
    icon: Shirt,
    labelKey: 'photoTutorial.bullet.one_garment',
    labelFallback: 'One garment per photo',
    bodyKey: 'photoTutorial.bullet.one_garment_body',
    bodyFallback: 'Photograph each piece on its own so we can analyse it precisely.',
  },
];

interface ExampleProps {
  good: boolean;
  labelKey: string;
  fallback: string;
}

function Example({ good, labelKey, fallback }: ExampleProps) {
  const { t } = useLanguage();
  const Icon = good ? Check : X;
  return (
    <div
      className={
        good
          ? 'relative aspect-[3/4] overflow-hidden rounded-[1.1rem] border border-emerald-500/35 bg-emerald-500/[0.06]'
          : 'relative aspect-[3/4] overflow-hidden rounded-[1.1rem] border border-red-500/30 bg-red-500/[0.05]'
      }
    >
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center">
        <div
          className={
            good
              ? 'flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'flex h-9 w-9 items-center justify-center rounded-full bg-red-500/15 text-red-700 dark:text-red-300'
          }
        >
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-[0.74rem] font-medium leading-snug text-foreground/80">
          {safeT(t, labelKey, fallback)}
        </p>
      </div>
    </div>
  );
}

export function PhotoTutorialStep({ onComplete }: PhotoTutorialStepProps) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="page-shell !max-w-lg !px-6 !pb-28 !pt-[calc(var(--safe-area-top)+6rem)] page-cluster">
        <Card surface="editorial" className="p-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-background/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <Camera className="h-7 w-7 text-foreground/72" />
          </div>
          <div className="mt-5">
            <PageIntro
              center
              eyebrow={safeT(t, 'photoTutorial.eyebrow', 'How to scan')}
              title={safeT(t, 'photoTutorial.title', 'Take a great garment photo.')}
              description={safeT(
                t,
                'photoTutorial.subtitle',
                'A minute here saves hours later. Five quick rules and we’re off.',
              )}
            />
          </div>
        </Card>

        <Card surface="utility" className="p-5">
          <p className="label-editorial mb-4 tracking-[0.18em] text-muted-foreground">
            {safeT(t, 'photoTutorial.examples_label', 'At a glance')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Example
              good
              labelKey="photoTutorial.example.good"
              fallback="Flat, well-lit, full garment"
            />
            <Example
              good={false}
              labelKey="photoTutorial.example.bad"
              fallback="Dim, cluttered, or cropped"
            />
          </div>
        </Card>

        <Card surface="utility" className="p-5">
          <ul className="space-y-4">
            {TIPS.map((tip, index) => {
              const Icon = tip.icon;
              return (
                <motion.li
                  key={tip.labelKey}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.28, ease: EASE_CURVE }}
                  className="flex items-start gap-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] bg-secondary/70 text-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.92rem] font-medium text-foreground">
                      {safeT(t, tip.labelKey, tip.labelFallback)}
                    </p>
                    <p className="mt-1 text-[0.8rem] leading-5 text-muted-foreground">
                      {safeT(t, tip.bodyKey, tip.bodyFallback)}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </Card>

        <div className="action-bar-floating rounded-[1.6rem] p-3">
          <Button onClick={onComplete} size="lg" className="w-full">
            {safeT(t, 'photoTutorial.cta_label', 'I’m ready')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
