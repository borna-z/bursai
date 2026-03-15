import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGarmentCount } from '@/hooks/useGarments';
import { AppLayout } from '@/components/layout/AppLayout';
import { AnimatedPage } from '@/components/ui/animated-page';
import { PRESETS } from '@/lib/motion';

import { WardrobeProgress } from '@/components/discover/WardrobeProgress';

export default function DiscoverPage() {
  const { t } = useLanguage();

  return (
    <AppLayout>
      <AnimatedPage className="px-4 pb-24 pt-8 space-y-8 max-w-lg mx-auto">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_CURVE }}
          className="space-y-1"
        >
          <h1 className="text-xl font-semibold tracking-tight text-foreground" style={{ fontFamily: "'Sora', sans-serif" }}>
            {t('discover.title')}
          </h1>
          <p className="text-[12px] text-muted-foreground/60">{t('discover.subtitle_new')}</p>
        </motion.div>

        {/* ── Wardrobe Progress ── */}
        <WardrobeProgress />
      </AnimatedPage>
    </AppLayout>
  );
}
