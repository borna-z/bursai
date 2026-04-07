import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { AnimatedPage } from '@/components/ui/animated-page';
import { PRESETS } from '@/lib/motion';

import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
import { DiscoverStyleTools } from '@/components/discover/DiscoverStyleTools';
import { WardrobeGapSection } from '@/components/discover/WardrobeGapSection';

export default function DiscoverPage() {
  const { t } = useLanguage();

  return (
    <AppLayout>
      <AnimatedPage className="px-4 pb-24 pt-8 space-y-10 max-w-lg mx-auto">
        {/* ── Header ── */}
        <motion.div
          variants={PRESETS.HERO.variants}
          initial="initial"
          animate="animate"
          transition={PRESETS.HERO.transition}
          className="space-y-1"
        >
          <h1 className="font-display italic text-[1.4rem] text-foreground leading-tight">
            {t('discover.title')}
          </h1>
          <p className="text-[13px] text-muted-foreground/60">{t('discover.subtitle_new')}</p>
        </motion.div>

        {/* ── Style Tools ── */}
        <DiscoverStyleTools />

        {/* ── Wardrobe Gap Analysis ── */}
        <WardrobeGapSection />

        {/* ── Wardrobe Progress ── */}
        <section className="space-y-3">
          <h3 className="label-editorial">
            {t('discover.progress_heading') || 'Progress'}
          </h3>
          <WardrobeProgress />
        </section>
      </AnimatedPage>
    </AppLayout>
  );
}
