import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shirt, Sparkles } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/layout/EmptyState';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { PageHeader } from '@/components/layout/PageHeader';
import { useLanguage } from '@/contexts/LanguageContext';
import { useInsights } from '@/hooks/useInsights';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { hapticLight } from '@/lib/haptics';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import { buildStyleFlowSearch } from '@/lib/styleFlowState';

export default function UsedGarments() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: insights, isLoading } = useInsights();

  const usedGarments = insights?.usedGarments ?? [];

  return (
    <AppLayout>
      <PageHeader
        title={t('insights.used_garments_title')}
        eyebrow="Insights"
        showBack
        actions={usedGarments.length > 0 ? (
          <Button
            className="rounded-full"
            onClick={() => {
              hapticLight();
              navigate(`/ai/generate${buildStyleFlowSearch(usedGarments.map((garment) => garment.id))}`);
            }}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {t('insights.generate_from_used')}
          </Button>
        ) : undefined}
      />

      <AnimatedPage className="mx-auto flex max-w-md flex-col gap-5 px-[var(--page-px)] pb-24 pt-4">
        {isLoading ? (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="aspect-[3/4] rounded-[1.25rem] bg-muted/50 skeleton-shimmer" />
            ))}
          </section>
        ) : usedGarments.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_CURVE }}
          >
            <EmptyState
              icon={Shirt}
              title={t('insights.no_used_garments')}
              description={t('insights.no_used_garments_desc')}
              variant="editorial"
              compact
            />
          </motion.div>
        ) : (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: EASE_CURVE }}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            {usedGarments.map((garment, index) => (
              <motion.button
                key={garment.id}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * STAGGER_DELAY, duration: 0.35, ease: EASE_CURVE }}
                onClick={() => {
                  hapticLight();
                  navigate(`/wardrobe/${garment.id}`);
                }}
                className="text-left"
              >
                <Card className="h-full overflow-hidden rounded-[1.25rem] p-2">
                  <div className="relative overflow-hidden rounded-[1.1rem]">
                    <LazyImageSimple
                      imagePath={getPreferredGarmentImagePath(garment)}
                      alt={garment.title}
                      className="aspect-[3/4] w-full"
                      fallbackIcon={<Shirt className="h-5 w-5 text-muted-foreground/50" />}
                    />
                    <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-foreground px-2.5 py-1 text-[0.62rem] font-medium uppercase tracking-[0.18em] text-background">
                      {garment.wearCountLast30}x
                    </span>
                  </div>
                  <div className="px-1 pb-1 pt-3">
                    <p className="text-[0.84rem] font-medium leading-5 text-foreground">{garment.title}</p>
                    <p className="mt-1 text-[0.72rem] leading-5 text-muted-foreground/70">
                      Worn recently enough to lead another outfit.
                    </p>
                  </div>
                </Card>
              </motion.button>
            ))}
          </motion.section>
        )}
      </AnimatedPage>
    </AppLayout>
  );
}
