import { useCallback } from 'react';

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

  return (
    <AppLayout>
      <PageHeader
        title={t('insights.title') || 'Style Intelligence'}
        subtitle={t('insights.subtitle') || 'Your wardrobe, decoded'}
        titleClassName="text-[1.65rem]"
      />
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="page-container space-y-4 pb-28">
          {/* Wardrobe Score Ring */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="surface-secondary flex flex-col items-center gap-4 p-6"
          >
            <p className="label-editorial text-muted-foreground/60">Wardrobe Score</p>
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
              <div className="rounded-[1rem] bg-background/55 p-3 text-center">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
                  Versatility
                </p>
                <p className="mt-1 text-[1.1rem] font-semibold tracking-[-0.04em] text-foreground">
                  {sustainability?.utilizationRate ?? Math.round(insights.usageRate)}%
                </p>
              </div>
              <div className="rounded-[1rem] bg-background/55 p-3 text-center">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
                  Balance
                </p>
                <p className="mt-1 text-[1.1rem] font-semibold tracking-[-0.04em] text-foreground">
                  {overview?.savedLooks ?? 0}
                </p>
              </div>
              <div className="rounded-[1rem] bg-background/55 p-3 text-center">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
                  Usage
                </p>
                <p className="mt-1 text-[1.1rem] font-semibold tracking-[-0.04em] text-foreground">
                  {insights.garmentsUsedLast30Days}/{insights.totalGarments}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Palette */}
          <InsightsPalettePanel
            bars={colorBreakdown.bars}
            entries={colorBreakdown.entries}
            total={colorBreakdown.total}
            colorTemperature={insights.colorTemperature}
            isPremium={isPremium}
          />

          {/* Most Loved & Forgotten */}
          <InsightsGarmentHighlights
            mostWorn={mostWorn}
            forgotten={forgotten}
            onSelectGarment={(id) => navigate(`/wardrobe/${id}`)}
          />

          {/* Value Tracker */}
          <InsightsValueTracker
            costPerWear={sustainability?.avgWearCount ? Number((100 / sustainability.avgWearCount).toFixed(2)) : undefined}
            sustainabilityScore={sustainability?.score}
            utilizationRate={sustainability?.utilizationRate}
            isPremium={isPremium}
          />

          {/* Style DNA */}
          <StyleDNACard dna={dna} />
        </AnimatedPage>
      </PullToRefresh>
    </AppLayout>
  );
}
