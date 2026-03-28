import { useCallback } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Bookmark, CalendarDays, Dna, RotateCw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { InsightsGapPreview } from '@/components/insights/InsightsGapPreview';
import { InsightsGarmentRail } from '@/components/insights/InsightsGarmentRail';
import { InsightsPalettePanel } from '@/components/insights/InsightsPalettePanel';
import { InsightsSection } from '@/components/insights/InsightsSection';
import { SpendingDashboard } from '@/components/insights/SpendingDashboard';
import { StyleDNACard } from '@/components/insights/StyleDNACard';
import { StyleReportCard } from '@/components/insights/StyleReportCard';
import { WardrobeHealthCard } from '@/components/insights/WardrobeHealthCard';
import { useInsightsDashboardAdapter } from '@/components/insights/useInsightsDashboardAdapter';
import { InsightsOnboardingEmpty } from '@/components/onboarding/OnboardingEmptyState';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { InsightsPageSkeleton } from '@/components/ui/skeletons';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const PAGE_SUBTITLE = 'Rotation, DNA, gaps, and value at a glance.';

function ValueSnapshot({
  score,
  utilizationRate,
  underusedCount,
  isPremium,
}: {
  score?: number | null;
  utilizationRate?: number;
  underusedCount?: number;
  isPremium: boolean;
}) {
  if (score == null || utilizationRate == null || underusedCount == null) {
    return null;
  }

  return (
    <div className={cn('surface-secondary grid gap-3 p-4 sm:grid-cols-3', !isPremium && 'overflow-hidden')}>
      <div className="rounded-[1rem] bg-background/55 p-3">
        <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">Value score</p>
        <p className="mt-1 text-[1.35rem] font-semibold tracking-[-0.04em] text-foreground">{score}/100</p>
      </div>
      <div className="rounded-[1rem] bg-background/55 p-3">
        <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">Utilization</p>
        <p className="mt-1 text-[1.35rem] font-semibold tracking-[-0.04em] text-foreground">{utilizationRate}%</p>
      </div>
      <div className="rounded-[1rem] bg-background/55 p-3">
        <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">Dormant</p>
        <p className="mt-1 text-[1.35rem] font-semibold tracking-[-0.04em] text-foreground">{underusedCount}</p>
      </div>
    </div>
  );
}

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
    allGarments,
    colorBreakdown,
  } = useInsightsDashboardAdapter();
  const pageTitle = t('insights.title');

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['insights-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['category-balance'] }),
      queryClient.invalidateQueries({ queryKey: ['spending'] }),
    ]);
  }, [queryClient]);

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader title={pageTitle} subtitle={PAGE_SUBTITLE} />
        <InsightsPageSkeleton />
      </AppLayout>
    );
  }

  if (!insights || insights.totalGarments === 0) {
    return (
      <AppLayout>
        <PageHeader title={pageTitle} subtitle={PAGE_SUBTITLE} />
        <InsightsOnboardingEmpty />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title={pageTitle} subtitle={PAGE_SUBTITLE} />
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="page-shell space-y-6">
          <section className="surface-hero rounded-[1.8rem] px-5 py-5">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="eyebrow-chip">Insights</span>
                    <span className="eyebrow-chip border-transparent bg-secondary/85 text-foreground/58">
                      {insights.totalGarments} pieces
                    </span>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-[1.45rem] font-semibold tracking-[-0.045em] text-foreground">
                      See what is active, what is missing, and what is worth repeating.
                    </h2>
                    <p className="max-w-[34ch] text-[0.92rem] leading-6 text-muted-foreground">
                      Rotation, DNA, gaps, and value in one working view, without the extra chrome.
                    </p>
                  </div>
                </div>

                <Button variant="quiet" className="rounded-full px-3 text-[0.8rem]" onClick={() => navigate('/wardrobe')}>
                  Wardrobe
                  <ArrowUpRight className="size-4" />
                </Button>
              </div>

              <div className="app-card-grid">
                <div className="surface-secondary rounded-[1.35rem] p-4">
                  <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">Rotation</p>
                  <p className="mt-1 text-[1.5rem] font-semibold tracking-[-0.04em] text-foreground">
                    {insights.usageRate}%
                  </p>
                  <p className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
                    {insights.garmentsUsedLast30Days} active pieces in the last 30 days
                  </p>
                </div>
                <div className="surface-secondary rounded-[1.35rem] p-4">
                  <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">DNA</p>
                  <p className="mt-1 text-[1.5rem] font-semibold tracking-[-0.04em] text-foreground">
                    {dna?.archetype ?? 'Building'}
                  </p>
                  <p className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
                    {overview?.savedLooks ?? 0} saved looks and {overview?.plannedThisWeek ?? 0} planned this week
                  </p>
                </div>
              </div>
            </div>
          </section>

          <InsightsSection
            id="rotation"
            eyebrow="Rotation"
            title="What is doing the real work"
            description="Start here to see what is active, what is quiet, and whether the wardrobe is earning its keep."
            action={(
              <Button variant="outline" className="rounded-full px-4" onClick={() => navigate('/wardrobe')}>
                <RotateCw className="mr-2 size-4" />
                Open wardrobe
              </Button>
            )}
          >
            <div className="grid gap-4">
              {allGarments.length >= 5 ? (
                <WardrobeHealthCard
                  garments={allGarments}
                  usedGarments={insights.usedGarments}
                  unusedGarments={insights.unusedGarments}
                />
              ) : null}

              <div className="surface-secondary p-4">
                <InsightsGarmentRail
                  title="Most-worn garments"
                  subtitle="The pieces carrying the last 30 days."
                  garments={insights.topFiveWorn}
                  actionLabel="Open worn pieces"
                  onAction={() => navigate('/wardrobe/used')}
                  onSelectGarment={(garmentId) => navigate(`/wardrobe/${garmentId}`)}
                  renderMeta={(garment) => `${garment.wearCountLast30}x in 30 days`}
                />
              </div>
            </div>
          </InsightsSection>

          <InsightsSection
            id="dna"
            eyebrow="DNA"
            title="The formulas BURS can trust"
            description="Your archetype, recurring palette bias, and the combinations that repeat often enough to matter."
            action={(
              <Button variant="outline" className="rounded-full px-4" onClick={() => navigate('/ai/generate')}>
                <Dna className="mr-2 size-4" />
                Generate look
              </Button>
            )}
          >
            <div className="grid gap-4">
              <StyleDNACard
                dna={dna}
                className="bg-card/75"
                emptyState={(
                  <div className="space-y-3">
                    <p className="label-editorial text-muted-foreground/60">DNA</p>
                    <div className="space-y-2">
                      <h3 className="text-[1.1rem] font-semibold tracking-[-0.04em] text-foreground">
                        Your signature is still forming.
                      </h3>
                      <p className="text-[0.92rem] leading-6 text-muted-foreground">
                        Save and wear a few more complete looks, then BURS will sharpen the archetype and repeat patterns here.
                      </p>
                    </div>
                  </div>
                )}
              />
              <StyleReportCard isPremium={isPremium} />
            </div>
          </InsightsSection>

          <InsightsSection
            id="gaps"
            eyebrow="Gaps"
            title="What would unlock more outfits"
            description="Look at missing categories and dormant pieces together before you decide to buy anything."
            action={(
              <Button variant="outline" className="rounded-full px-4" onClick={() => navigate('/gaps')}>
                <Search className="mr-2 size-4" />
                Open gaps
              </Button>
            )}
          >
            <div className="grid gap-4">
              <InsightsGapPreview />

              <div className="surface-secondary p-4">
                <InsightsGarmentRail
                  title="Dormant garments"
                  subtitle="Pieces that can unlock more variety if they come back into rotation."
                  garments={insights.unusedGarments.slice(0, 8)}
                  actionLabel="Open unworn outfits"
                  onAction={() => navigate('/outfits/unused')}
                  onSelectGarment={(garmentId) => navigate(`/wardrobe/${garmentId}`)}
                  renderMeta={(garment) => garment.category || garment.color_primary || null}
                />
              </div>
            </div>
          </InsightsSection>

          <InsightsSection
            id="value"
            eyebrow="Value"
            title="Value, palette, and future spend"
            description="Use these signals to decide what is worth repeating, repairing, or adding next."
            action={(
              <Button variant="outline" className="rounded-full px-4" onClick={() => navigate('/outfits')}>
                <Bookmark className="mr-2 size-4" />
                Open outfits
              </Button>
            )}
          >
            <div className="grid gap-4">
              <InsightsPalettePanel
                bars={colorBreakdown.bars}
                entries={colorBreakdown.entries}
                total={colorBreakdown.total}
                colorTemperature={insights.colorTemperature}
                isPremium={isPremium}
              />

              <ValueSnapshot
                score={sustainability?.score}
                utilizationRate={sustainability?.utilizationRate}
                underusedCount={sustainability?.underusedCount}
                isPremium={isPremium}
              />

              <SpendingDashboard isPremium={isPremium} />
            </div>
          </InsightsSection>

          <div className="surface-utility flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] px-4 py-4">
            <div className="space-y-1">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/60">Related actions</p>
              <p className="text-[0.9rem] text-muted-foreground">
                Plan next week, open used pieces, or chat with BURS when you need a fast answer.
              </p>
            </div>
            <div className="app-chip-row">
              <Button variant="quiet" className="rounded-full px-3 text-[0.8rem]" onClick={() => navigate('/plan')}>
                <CalendarDays className="mr-2 size-4" />
                Plan
              </Button>
              <Button variant="quiet" className="rounded-full px-3 text-[0.8rem]" onClick={() => navigate('/wardrobe/used')}>
                Used pieces
              </Button>
              <Button variant="quiet" className="rounded-full px-3 text-[0.8rem]" onClick={() => navigate('/ai/chat')}>
                Ask BURS
              </Button>
            </div>
          </div>
        </AnimatedPage>
      </PullToRefresh>
    </AppLayout>
  );
}
