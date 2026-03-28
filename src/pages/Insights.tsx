import { useCallback } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  CalendarDays,
  Compass,
  Dna,
  Palette,
  Search,
  Shirt,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PullToRefresh } from '@/components/layout/PullToRefresh';
import { InsightsGapPreview } from '@/components/insights/InsightsGapPreview';
import { InsightsOverviewHero } from '@/components/insights/InsightsOverviewHero';
import { InsightsGarmentRail } from '@/components/insights/InsightsGarmentRail';
import { InsightsPalettePanel } from '@/components/insights/InsightsPalettePanel';
import { InsightsRelatedTools } from '@/components/insights/InsightsRelatedTools';
import { InsightsSection } from '@/components/insights/InsightsSection';
import { CategoryRadar } from '@/components/insights/CategoryRadar';
import { OutfitRepeatTracker } from '@/components/insights/OutfitRepeatTracker';
import { SpendingDashboard } from '@/components/insights/SpendingDashboard';
import { StyleDNACard } from '@/components/insights/StyleDNACard';
import { StyleReportCard } from '@/components/insights/StyleReportCard';
import { WardrobeHealthCard } from '@/components/insights/WardrobeHealthCard';
import { WearHeatmap } from '@/components/insights/WearHeatmap';
import { useInsightsDashboardAdapter } from '@/components/insights/useInsightsDashboardAdapter';
import { InsightsOnboardingEmpty } from '@/components/onboarding/OnboardingEmptyState';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { InsightsPageSkeleton } from '@/components/ui/skeletons';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const SECTION_LINKS = [
  { id: 'overview', label: 'Overview' },
  { id: 'dna', label: 'DNA' },
  { id: 'patterns', label: 'Wardrobe patterns' },
  { id: 'value', label: 'Value & gaps' },
  { id: 'tools', label: 'Related tools' },
] as const;

function SustainabilityPanel({
  score,
  utilizationRate,
  avgWearCount,
  underusedCount,
  isPremium,
}: {
  score?: number | null;
  utilizationRate?: number;
  avgWearCount?: number;
  underusedCount?: number;
  isPremium: boolean;
}) {
  if (score == null || utilizationRate == null || avgWearCount == null || underusedCount == null) {
    return null;
  }

  return (
    <div className={cn('surface-secondary relative space-y-4 p-4', !isPremium && 'overflow-hidden')}>
      <div className={cn('space-y-4', !isPremium && 'blur-sm select-none')}>
        <div className="space-y-1">
          <h3 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground">
            Sustainability
          </h3>
          <p className="text-[0.84rem] leading-5 text-muted-foreground">
            Utilization, repeat wear, and dormant volume across the wardrobe.
          </p>
        </div>

        <div className="flex items-end justify-between gap-4 rounded-[1rem] bg-background/55 px-4 py-4">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">
              Score
            </p>
            <p className="mt-1 text-[2.3rem] font-semibold tracking-[-0.06em] text-foreground">
              {score}
              <span className="ml-1 text-[1rem] text-muted-foreground/60">/100</span>
            </p>
          </div>
          <p className="max-w-[12rem] text-right text-[0.82rem] leading-5 text-muted-foreground">
            Higher scores mean more of the wardrobe is getting real wear.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-[1rem] bg-background/55 p-3">
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">
              Utilization
            </p>
            <p className="mt-1 text-[1.2rem] font-semibold tracking-[-0.04em] text-foreground">
              {utilizationRate}%
            </p>
          </div>
          <div className="rounded-[1rem] bg-background/55 p-3">
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">
              Avg wears
            </p>
            <p className="mt-1 text-[1.2rem] font-semibold tracking-[-0.04em] text-foreground">
              {avgWearCount}x
            </p>
          </div>
          <div className="rounded-[1rem] bg-background/55 p-3">
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">
              Underused
            </p>
            <p className="mt-1 text-[1.2rem] font-semibold tracking-[-0.04em] text-foreground">
              {underusedCount}
            </p>
          </div>
        </div>
      </div>

      {!isPremium ? (
        <div className="absolute inset-0 bg-background/15" />
      ) : null}
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
        <PageHeader title={t('insights.title')} subtitle="DNA dashboard" />
        <InsightsPageSkeleton />
      </AppLayout>
    );
  }

  if (!insights || insights.totalGarments === 0) {
    return (
      <AppLayout>
        <PageHeader title={t('insights.title')} subtitle="DNA dashboard" />
        <InsightsOnboardingEmpty />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={t('insights.title')}
        subtitle="App-wide rotation, DNA, and wardrobe leverage"
      />
      <PullToRefresh onRefresh={handleRefresh}>
        <AnimatedPage className="page-container space-y-10 pb-28">
          <InsightsOverviewHero
            usageRate={insights.usageRate}
            totalGarments={insights.totalGarments}
            activeCount={insights.garmentsUsedLast30Days}
            dormantCount={insights.unusedGarments.length}
            savedLooks={overview?.savedLooks ?? 0}
            plannedThisWeek={overview?.plannedThisWeek ?? 0}
            sustainabilityScore={sustainability?.score}
            dnaArchetype={dna?.archetype ?? null}
            onOpenWardrobe={() => navigate('/wardrobe')}
            onGenerateLook={() => navigate('/ai/generate')}
            onOpenUsed={() => navigate('/wardrobe/used')}
            onOpenUnused={() => navigate('/outfits/unused')}
            onOpenPlan={() => navigate('/plan')}
            onOpenOutfits={() => navigate('/outfits')}
          />

          <nav
            aria-label="Insights sections"
            className="scrollbar-hide -mx-5 overflow-x-auto px-5"
          >
            <div className="flex gap-2 pb-1">
              {SECTION_LINKS.map((section) => (
                <Button
                  key={section.id}
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-full border-border/40 bg-background/75 whitespace-nowrap"
                >
                  <a href={`#${section.id}`}>{section.label}</a>
                </Button>
              ))}
            </div>
          </nav>

          <InsightsSection
            id="overview"
            eyebrow="Overview"
            title="Rotation and wardrobe health"
            description="A quick read on what is active, what is stalling, and how the overall palette is behaving."
          >
            <div className="grid gap-4">
              {allGarments.length >= 5 ? (
                <WardrobeHealthCard
                  garments={allGarments}
                  usedGarments={insights.usedGarments}
                  unusedGarments={insights.unusedGarments}
                />
              ) : null}

              <InsightsPalettePanel
                bars={colorBreakdown.bars}
                entries={colorBreakdown.entries}
                total={colorBreakdown.total}
                colorTemperature={insights.colorTemperature}
                isPremium={isPremium}
              />
            </div>
          </InsightsSection>

          <InsightsSection
            id="dna"
            eyebrow="DNA"
            title="Personal signals and repeat formulas"
            description="Use the wardrobe history to see the archetype, palette bias, and formulas that actually recur."
          >
            <div className="grid gap-4">
              <StyleDNACard
                dna={dna}
                className="bg-card/75"
                emptyState={
                  <div className="space-y-3">
                    <p className="label-editorial text-muted-foreground/60">Style DNA</p>
                    <div className="space-y-2">
                      <h3 className="text-[1.2rem] font-semibold tracking-[-0.04em] text-foreground">
                        Your signature is still forming.
                      </h3>
                      <p className="text-[0.92rem] leading-6 text-muted-foreground">
                        Save and wear a few more complete looks, then the DNA layer will lock onto your archetype and repeat patterns.
                      </p>
                    </div>
                    <Button onClick={() => navigate('/ai/generate')} className="rounded-full px-4">
                      <Sparkles className="mr-2 size-4" />
                      Style me
                    </Button>
                  </div>
                }
              />

              <StyleReportCard isPremium={isPremium} />
            </div>
          </InsightsSection>

          <InsightsSection
            id="patterns"
            eyebrow="Wardrobe Patterns"
            title="What repeats, what fades, what still needs attention"
            description="Track the staples that carry daily wear, the pieces that have gone quiet, and the behavior of saved outfits over time."
          >
            <div className="grid gap-4">
              <div className="surface-secondary p-4">
                <InsightsGarmentRail
                  title="Most-worn garments"
                  subtitle="The pieces doing the most work over the last 30 days."
                  garments={insights.topFiveWorn}
                  actionLabel="Open worn pieces"
                  onAction={() => navigate('/wardrobe/used')}
                  onSelectGarment={(garmentId) => navigate(`/wardrobe/${garmentId}`)}
                  renderMeta={(garment) => `${garment.wearCountLast30}x in 30 days`}
                />
              </div>

              <div className="surface-secondary p-4">
                <InsightsGarmentRail
                  title="Forgotten garments"
                  subtitle="Pieces that can unlock variety if they come back into rotation."
                  garments={insights.unusedGarments.slice(0, 8)}
                  actionLabel="See dormant outfits"
                  onAction={() => navigate('/outfits/unused')}
                  onSelectGarment={(garmentId) => navigate(`/wardrobe/${garmentId}`)}
                  renderMeta={(garment) => garment.category || garment.color_primary || null}
                />
              </div>

              <CategoryRadar isPremium={isPremium} />

              <OutfitRepeatTracker isPremium={isPremium} />

              <WearHeatmap isPremium={isPremium} />
            </div>
          </InsightsSection>

          <InsightsSection
            id="value"
            eyebrow="Value & Gaps"
            title="Cost, sustainability, and missing leverage"
            description="See what the wardrobe is worth, which pieces are paying off, and where one smart addition would create more complete outfits."
          >
            <div className="grid gap-4">
              <SustainabilityPanel
                score={sustainability?.score}
                utilizationRate={sustainability?.utilizationRate}
                avgWearCount={sustainability?.avgWearCount}
                underusedCount={sustainability?.underusedCount}
                isPremium={isPremium}
              />

              <SpendingDashboard isPremium={isPremium} />

              <InsightsGapPreview />
            </div>
          </InsightsSection>

          <InsightsSection
            id="tools"
            eyebrow="Related Tools"
            title="Jump into the adjacent workflows"
            description="Use the dashboard as the operating layer, then move directly into generation, planning, or gap-filling work."
          >
            <InsightsRelatedTools
              tools={[
                {
                  title: 'Style me',
                  description: 'Generate a complete look from your wardrobe with the latest style logic.',
                  to: '/ai/generate',
                  icon: Wand2,
                  accentClassName: 'bg-accent/12 text-accent',
                },
                {
                  title: 'AI chat',
                  description: 'Refine a look, anchor around a garment, or ask for a sharper occasion fit.',
                  to: '/ai/chat',
                  icon: Sparkles,
                  accentClassName: 'bg-primary/8 text-foreground',
                },
                {
                  title: 'Plan outfits',
                  description: 'Move complete looks into the calendar and build repeatable outfit coverage.',
                  to: '/plan',
                  icon: CalendarDays,
                  accentClassName: 'bg-success/10 text-success',
                },
                {
                  title: 'Gap analysis',
                  description: 'Scan for the one addition that would unlock more valid combinations.',
                  to: '/gaps',
                  icon: Search,
                  accentClassName: 'bg-warning/12 text-warning',
                },
                {
                  title: 'Used pieces',
                  description: 'Inspect the garments carrying your rotation and spot over-reliance early.',
                  to: '/wardrobe/used',
                  icon: Shirt,
                  accentClassName: 'bg-background/80 text-foreground/75',
                },
                {
                  title: 'Unused outfits',
                  description: 'Turn dormant pieces into working outfits instead of letting them sit.',
                  to: '/outfits/unused',
                  icon: Compass,
                  accentClassName: 'bg-primary/8 text-foreground',
                },
              ]}
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <a href="#overview" className="surface-secondary flex items-center gap-3 p-4">
                <BarChart3 className="size-4 text-muted-foreground/55" />
                <div>
                  <p className="text-[0.82rem] font-medium text-foreground">Rotation summary</p>
                  <p className="text-[0.76rem] text-muted-foreground">Start with overview</p>
                </div>
              </a>
              <a href="#dna" className="surface-secondary flex items-center gap-3 p-4">
                <Dna className="size-4 text-muted-foreground/55" />
                <div>
                  <p className="text-[0.82rem] font-medium text-foreground">DNA evidence</p>
                  <p className="text-[0.76rem] text-muted-foreground">Archetype and formulas</p>
                </div>
              </a>
              <a href="#value" className="surface-secondary flex items-center gap-3 p-4">
                <Palette className="size-4 text-muted-foreground/55" />
                <div>
                  <p className="text-[0.82rem] font-medium text-foreground">Value layer</p>
                  <p className="text-[0.76rem] text-muted-foreground">Spend and gaps</p>
                </div>
              </a>
            </div>
          </InsightsSection>
        </AnimatedPage>
      </PullToRefresh>
    </AppLayout>
  );
}
