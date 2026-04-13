import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { AnimatedPage } from '@/components/ui/animated-page';
import { PageHeader } from '@/components/layout/PageHeader';

import { WardrobeProgress } from '@/components/discover/WardrobeProgress';
import { DiscoverStyleTools } from '@/components/discover/DiscoverStyleTools';
import { WardrobeGapSection } from '@/components/discover/WardrobeGapSection';

export default function DiscoverPage() {
  const { t } = useLanguage();

  return (
    <AppLayout>
      <PageHeader
        title={t('discover.title')}
        subtitle={t('discover.subtitle_new')}
        showBack
      />
      <AnimatedPage className="px-[var(--page-px)] pb-24 pt-5 space-y-10 max-w-lg mx-auto">
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
