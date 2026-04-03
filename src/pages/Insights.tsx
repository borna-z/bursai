import { useCallback } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { InsightsActionCenter } from '@/components/insights/InsightsActionCenter';
import { InsightsBehaviorSection } from '@/components/insights/InsightsBehaviorSection';
import { InsightsHeroSection } from '@/components/insights/InsightsHeroSection';
import { InsightsPalettePanel } from '@/components/insights/InsightsPalettePanel';
import { InsightsStatePanel } from '@/components/insights/InsightsStatePanel';
import { InsightsStyleIdentitySection } from '@/components/insights/InsightsStyleIdentitySection';
import { InsightsValueSection } from '@/components/insights/InsightsValueSection';
import { InsightsWardrobeHealthSection } from '@/components/insights/InsightsWardrobeHealthSection';
import {
  type InsightsActionItem,
  useInsightsDashboardAdapter,
} from '@/components/insights/useInsightsDashboardAdapter';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { AnimatedPage } from '@/components/ui/animated-page';
import { InsightsPageSkeleton } from '@/components/ui/skeletons';
import { useLanguage } from '@/contexts/LanguageContext';
import { buildGapsPath } from '@/components/gaps/gapRouteState';
import { hapticLight } from '@/lib/haptics';
import { buildStyleAroundState, buildStyleFlowSearch } from '@/lib/styleFlowState';

export default function InsightsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const viewModel = useInsightsDashboardAdapter();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['insights-dashboard'] });
  }, [queryClient]);

  const handleGarmentOpen = useCallback((garmentId: string) => {
    hapticLight();
    navigate(`/wardrobe/${garmentId}`);
  }, [navigate]);

  const handleOpenPricing = useCallback(() => {
    hapticLight();
    navigate('/pricing');
  }, [navigate]);

  const handleAction = useCallback((action: InsightsActionItem) => {
    hapticLight();

    switch (action.target.kind) {
      case 'style-garment':
        navigate(`/ai/chat${buildStyleFlowSearch(action.target.garmentId)}`, {
          state: buildStyleAroundState(action.target.garmentId),
        });
        return;
      case 'generate-garments':
        navigate(`/ai/generate${buildStyleFlowSearch(action.target.garmentIds)}`);
        return;
      case 'gaps':
        navigate(buildGapsPath({ autorun: action.target.autorun }));
        return;
      case 'outfit':
        navigate(`/outfits/${action.target.outfitId}`);
        return;
      case 'pricing':
        navigate('/pricing');
        return;
      default:
        return;
    }
  }, [navigate]);

  const title = t('insights.title') || 'Style Intelligence';
  const subtitle = t('insights.subtitle') || 'Your wardrobe, decoded';

  return (
    <AppLayout>
      <PageHeader
        title={title}
        subtitle={subtitle}
        titleClassName="text-[1.5rem] sm:text-[1.65rem]"
      />

      <PullToRefresh onRefresh={handleRefresh}>
        {viewModel.state === 'loading' ? (
          <InsightsPageSkeleton />
        ) : (
          <AnimatedPage className="page-shell page-cluster pb-24">
            {viewModel.state === 'empty' ? (
              <InsightsStatePanel
                kind="empty"
                onPrimary={() => navigate('/wardrobe/add')}
                onSecondary={() => navigate('/wardrobe')}
              />
            ) : null}

            {viewModel.state === 'no-wear-data' ? (
              <InsightsStatePanel
                kind="no-wear-data"
                onPrimary={() => navigate('/outfits')}
                onSecondary={() => navigate('/wardrobe')}
              />
            ) : null}

            {viewModel.state === 'error' ? (
              <InsightsStatePanel
                kind="error"
                onPrimary={() => { void handleRefresh(); }}
                onSecondary={() => navigate('/wardrobe')}
              />
            ) : null}

            {(viewModel.state === 'ready' || viewModel.state === 'no-wear-data') ? (
              <>
                <InsightsHeroSection
                  hero={viewModel.hero}
                  generatedAtLabel={viewModel.generatedAtLabel}
                  isRefreshing={viewModel.isRefreshing}
                  onOpenWardrobe={() => navigate('/wardrobe')}
                />

                <InsightsStyleIdentitySection style={viewModel.style} />

                <InsightsPalettePanel
                  palette={viewModel.palette}
                  upgrade={viewModel.upgrade}
                  onOpenPricing={handleOpenPricing}
                />

                <InsightsBehaviorSection
                  behavior={viewModel.behavior}
                  upgrade={viewModel.upgrade}
                  onOpenPricing={handleOpenPricing}
                />

                <InsightsWardrobeHealthSection
                  health={viewModel.health}
                  onOpenGarment={handleGarmentOpen}
                  onOpenGapScan={() => navigate(buildGapsPath({ autorun: true }))}
                />

                <InsightsValueSection
                  value={viewModel.value}
                  upgrade={viewModel.upgrade}
                  onOpenGarment={handleGarmentOpen}
                  onOpenPricing={handleOpenPricing}
                />

                <InsightsActionCenter actions={viewModel.actions} onAction={handleAction} />
              </>
            ) : null}
          </AnimatedPage>
        )}
      </PullToRefresh>
    </AppLayout>
  );
}
