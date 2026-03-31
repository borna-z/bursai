import { useCallback, useMemo } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { InsightsGarmentHighlights } from '@/components/insights/InsightsGarmentHighlights';
import { InsightsPalettePanel } from '@/components/insights/InsightsPalettePanel';
import { InsightsValueTracker } from '@/components/insights/InsightsValueTracker';
import { StyleDNACard } from '@/components/insights/StyleDNACard';
import { useInsightsDashboardAdapter } from '@/components/insights/useInsightsDashboardAdapter';
import { InsightsOnboardingEmpty } from '@/components/onboarding/OnboardingEmptyState';
import { AnimatedPage } from '@/components/ui/animated-page';
import { ScoreRing } from '@/components/ui/score-ring';
import { InsightsPageSkeleton } from '@/components/ui/skeletons';
import { useLanguage } from '@/contexts/LanguageContext';

export default function InsightsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const {
    overview,
    insights,
    dna,
    sustainability,
    isPremium,
    isLoading,
    colorBreakdown,
  } = useInsightsDashboardAdapter();

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['insights-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['category-balance'] }),
      queryClient.invalidateQueries({ queryKey: ['outfit-repeats'] }),
      queryClient.invalidateQueries({ queryKey: ['wear-heatmap'] }),
      queryClient.invalidateQueries({ queryKey: ['spending'] }),
    ]);
  }, [queryClient]);

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader title={t('insights.title') || 'Style Intelligence'} subtitle={t('insights.subtitle') || 'Your wardrobe, decoded'} />
        <InsightsPageSkeleton />
      </AppLayout>
    );
  }

  if (!insights || insights.totalGarments === 0) {
    return (
      <AppLayout>
        <PageHeader title={t('insights.title') || 'Style Intelligence'} subtitle={t('insights.subtitle') || 'Your wardrobe, decoded'} />
        <InsightsOnboardingEmpty />
      </AppLayout>
    );
  }

  const wardrobeScore = sustainability?.score ?? Math.round(insights.usageRate);
  const mostWorn = insights.topFiveWorn?.[0] ?? null;
  const forgotten = insights.unusedGarments?.[0] ?? null;
  const recommendations = useMemo(() => {
    const items: Array<{ title: string; body: string }> = [];

    if (forgotten) {
      items.push({
        title: t('insights.recommendation_forgotten_title'),
        body: t('insights.recommendation_forgotten_body').replace('{item}', forgotten.title || t('common.garment')),
      });
    }

    if (insights.usageRate < 60) {
      items.push({
        title: t('insights.recommendation_usage_title'),
        body: t('insights.recommendation_usage_body'),
      });
    }

    if (dna?.archetype) {
      items.push({
        title: t('insights.recommendation_dna_title').replace('{archetype}', dna.archetype),
        body: t('insights.recommendation_dna_body'),
      });
    }

    return items.slice(0, 3);
  }, [dna?.archetype, forgotten, insights.usageRate, t]);

  return (
    <AppLayout>
      <PageHeader
        title={t('insights.title') || 'Style Intelligence'}
        subtitle={t('insights.subtitle') || 'Your wardrobe, decoded'}
        titleClassName="text-[1.65rem]"
      />
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="page-shell page-cluster pb-28">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="surface-editorial premium-highlight flex flex-col items-center gap-4 p-6"
          >
            <div className="space-y-2 text-center">
              <p className="label-editorial text-muted-foreground/60">{t('insights.hero_label')}</p>
              <h2 className="text-[1.35rem] font-semibold tracking-[-0.05em] text-foreground">
                {t('insights.hero_title')}
              </h2>
            </div>
            <div className="relative">
              <ScoreRing value={wardrobeScore} size={132} strokeWidth={8} />
              <div className="absolute inset-0 flex rotate-0 flex-col items-center justify-center">
                <span className="text-[2rem] font-semibold tracking-[-0.06em] text-foreground">
                  {wardrobeScore}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/50">
                  / 100
                </span>
              </div>
            </div>
            <div className="grid w-full grid-cols-3 gap-2">
              <div className="premium-inline-stat text-center">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
                  {t('insights.metric_versatility')}
                </p>
                <p className="mt-1 text-[1.1rem] font-semibold tracking-[-0.04em] text-foreground">
                  {sustainability?.utilizationRate ?? Math.round(insights.usageRate)}%
                </p>
              </div>
              <div className="premium-inline-stat text-center">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
                  {t('insights.metric_balance')}
                </p>
                <p className="mt-1 text-[1.1rem] font-semibold tracking-[-0.04em] text-foreground">
                  {overview?.savedLooks ?? 0}
                </p>
              </div>
              <div className="premium-inline-stat text-center">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
                  {t('insights.metric_usage')}
                </p>
                <p className="mt-1 text-[1.1rem] font-semibold tracking-[-0.04em] text-foreground">
                  {insights.garmentsUsedLast30Days}/{insights.totalGarments}
                </p>
              </div>
            </div>
          </motion.div>

          {recommendations.length > 0 ? (
            <section className="surface-secondary rounded-[1.35rem] p-4">
              <div className="space-y-3">
                <p className="label-editorial text-muted-foreground/60">
                  {t('insights.recommended_next')}
                </p>
                <div className="grid gap-3">
                  {recommendations.map((recommendation) => (
                    <div key={recommendation.title} className="premium-inline-stat space-y-1.5">
                      <p className="text-[0.98rem] font-medium tracking-[-0.02em] text-foreground">
                        {recommendation.title}
                      </p>
                      <p className="text-[0.84rem] leading-6 text-muted-foreground">
                        {recommendation.body}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <InsightsPalettePanel
            bars={colorBreakdown.bars}
            entries={colorBreakdown.entries}
            total={colorBreakdown.total}
            colorTemperature={insights.colorTemperature}
            isPremium={isPremium}
          />

          <InsightsGarmentHighlights
            mostWorn={mostWorn}
            forgotten={forgotten}
            onSelectGarment={(id) => navigate(`/wardrobe/${id}`)}
          />

          <InsightsValueTracker
            costPerWear={sustainability?.avgWearCount ? Number((100 / sustainability.avgWearCount).toFixed(2)) : undefined}
            sustainabilityScore={sustainability?.score}
            utilizationRate={sustainability?.utilizationRate}
            isPremium={isPremium}
          />

          <StyleDNACard dna={dna} />
        </AnimatedPage>
      </PullToRefresh>
    </AppLayout>
  );
}
