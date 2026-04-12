import { useCallback, useMemo } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { CategoryDonut } from '@/components/insights/CategoryDonut';
import { ColorPaletteBar } from '@/components/insights/ColorPaletteBar';
import { CostPerWearCard } from '@/components/insights/CostPerWearCard';
import { InsightsHeroStats } from '@/components/insights/InsightsHeroStats';
import { InsightsStatePanel } from '@/components/insights/InsightsStatePanel';
import { WardrobeHealthRadar } from '@/components/insights/WardrobeHealthRadar';
import { WearFrequencyChart } from '@/components/insights/WearFrequencyChart';
import { useInsightsDashboardAdapter } from '@/components/insights/useInsightsDashboardAdapter';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { AnimatedPage } from '@/components/ui/animated-page';
import { InsightsPageSkeleton } from '@/components/ui/skeletons';
import { useLanguage } from '@/contexts/LanguageContext';

function parseCurrency(value: string): number {
  if (!value) return 0;
  const match = value.replace(',', '.').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

export default function InsightsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const vm = useInsightsDashboardAdapter();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['insights-dashboard'] });
  }, [queryClient]);

  const wearByDay = useMemo(() => {
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const counts = new Array(7).fill(0);
    for (const entry of vm.behavior.heatmapDays) {
      const dow = new Date(entry.date).getDay();
      const idx = dow === 0 ? 6 : dow - 1; // Monday = 0
      counts[idx] += entry.count;
    }
    return days.map((day, i) => ({ day, count: counts[i] }));
  }, [vm.behavior.heatmapDays]);

  const healthAxes = useMemo(() => [
    { label: 'Variety', value: Math.min(vm.health.categoryBalance.length * 15, 100) },
    { label: 'Color', value: Math.min(vm.palette.entries.length * 17, 100) },
    { label: 'Usage', value: vm.hero.metrics[1]?.rails[0]?.value ?? 0 },
    {
      label: 'Season',
      value:
        vm.health.totalCount > 0
          ? Math.min((vm.health.usedCount / vm.health.totalCount) * 100, 100)
          : 0,
    },
    { label: 'Value', value: vm.value.sustainabilityScore ?? 50 },
    { label: 'Fit', value: vm.behavior.consistency },
  ], [vm]);

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        {vm.state === 'loading' ? (
          <InsightsPageSkeleton />
        ) : (
          <AnimatedPage className="pb-24">
            <PageHeader
              eyebrow="INSIGHTS"
              title={t('insights.yourStyleStory') || 'Your Style Story'}
              sticky={false}
            />

            {vm.state === 'empty' ? (
              <InsightsStatePanel
                kind="empty"
                onPrimary={() => navigate('/wardrobe/add')}
                onSecondary={() => navigate('/wardrobe')}
              />
            ) : null}

            {vm.state === 'error' ? (
              <InsightsStatePanel
                kind="error"
                onPrimary={() => { void handleRefresh(); }}
                onSecondary={() => navigate('/wardrobe')}
              />
            ) : null}

            {(vm.state === 'ready' || vm.state === 'no-wear-data') ? (
              <>
                <InsightsHeroStats
                  garmentCount={vm.health.totalCount}
                  outfitCount={vm.hero.metrics[2]?.rails[0]?.value ?? 0}
                  wearCount={
                    vm.behavior.streak > 0
                      ? vm.behavior.heatmapDays.reduce((s, d) => s + d.count, 0)
                      : 0
                  }
                />

                <WearFrequencyChart data={wearByDay} />

                <ColorPaletteBar
                  segments={vm.palette.bars.map((e) => ({
                    color: e.swatch,
                    label: e.label,
                    percentage: e.percentage,
                  }))}
                />

                <div className="px-[var(--page-px)] pb-4 grid grid-cols-2 gap-[10px]">
                  <CategoryDonut
                    segments={vm.health.categoryBalance}
                    total={vm.health.totalCount}
                  />
                  <CostPerWearCard
                    bestValue={vm.value.bestCostPerWear?.cpwValue ?? 0}
                    average={parseCurrency(vm.value.avgCostPerWear)}
                    worst={vm.value.worstCostPerWear?.cpwValue ?? 0}
                  />
                </div>

                <WardrobeHealthRadar axes={healthAxes} />
              </>
            ) : null}
          </AnimatedPage>
        )}
      </PullToRefresh>
    </AppLayout>
  );
}
