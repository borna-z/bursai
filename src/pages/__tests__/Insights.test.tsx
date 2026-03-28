import type { PropsWithChildren } from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

type Locale = 'en' | 'sv';

const translations: Record<Locale, Record<string, string>> = {
  en: {
    'insights.title': 'Insights',
  },
  sv: {
    'insights.title': 'Insikter',
  },
};

let currentLocale: Locale = 'en';

const dashboardAdapterMock = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    circle: (props: Record<string, unknown>) => <circle {...props} />,
    div: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    section: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
      <section {...props}>{children}</section>
    ),
  },
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    locale: currentLocale,
    t: (key: string) => translations[currentLocale][key] ?? key,
  }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PullToRefresh', () => ({
  PullToRefresh: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  ),
}));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/skeletons', () => ({
  InsightsPageSkeleton: () => <div data-testid="insights-loading">loading</div>,
}));

vi.mock('@/components/onboarding/OnboardingEmptyState', () => ({
  InsightsOnboardingEmpty: () => <div data-testid="insights-empty">empty</div>,
}));

vi.mock('@/components/insights/useInsightsDashboardAdapter', () => ({
  useInsightsDashboardAdapter: () => dashboardAdapterMock(),
}));

vi.mock('@/components/insights/InsightsOverviewHero', () => ({
  InsightsOverviewHero: ({
    dnaArchetype,
    savedLooks,
    plannedThisWeek,
  }: {
    dnaArchetype: string | null;
    savedLooks: number;
    plannedThisWeek: number;
  }) => (
    <section>
      <h2>Rotation, DNA, and value in one working view.</h2>
      {dnaArchetype ? <p>{dnaArchetype}</p> : null}
      <p>Saved looks: {savedLooks}</p>
      <p>Planned this week: {plannedThisWeek}</p>
    </section>
  ),
}));

vi.mock('@/components/insights/InsightsGapPreview', () => ({
  InsightsGapPreview: () => <section>Black loafers</section>,
}));

vi.mock('@/components/insights/InsightsGarmentRail', () => ({
  InsightsGarmentRail: ({
    title,
    garments,
  }: {
    title: string;
    garments: Array<{ title: string }>;
  }) => (
    <section>
      <h3>{title}</h3>
      {garments[0] ? <p>{garments[0].title}</p> : null}
    </section>
  ),
}));

vi.mock('@/components/insights/InsightsPalettePanel', () => ({
  InsightsPalettePanel: () => <section>Palette panel</section>,
}));

vi.mock('@/components/insights/InsightsRelatedTools', () => ({
  InsightsRelatedTools: ({
    tools,
  }: {
    tools: Array<{ title: string }>;
  }) => (
    <section>
      {tools.map((tool) => <p key={tool.title}>{tool.title}</p>)}
    </section>
  ),
}));

vi.mock('@/components/insights/InsightsSection', () => ({
  InsightsSection: ({
    title,
    children,
  }: PropsWithChildren<{ title: string; id: string }>) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

vi.mock('@/components/insights/WardrobeHealthCard', () => ({
  WardrobeHealthCard: () => <section data-testid="wardrobe-health-card">Wardrobe health</section>,
}));

vi.mock('@/components/insights/StyleDNACard', () => ({
  StyleDNACard: ({ dna }: { dna?: { archetype?: string } | null }) => (
    <section>{dna?.archetype ?? 'No DNA'}</section>
  ),
}));

vi.mock('@/components/insights/StyleReportCard', () => ({
  StyleReportCard: () => <section>Style report</section>,
}));

vi.mock('@/components/insights/CategoryRadar', () => ({
  CategoryRadar: () => <section>Category radar</section>,
}));

vi.mock('@/components/insights/OutfitRepeatTracker', () => ({
  OutfitRepeatTracker: () => <section>Repeat tracker</section>,
}));

vi.mock('@/components/insights/WearHeatmap', () => ({
  WearHeatmap: () => <section>Wear heatmap</section>,
}));

vi.mock('@/components/insights/SpendingDashboard', () => ({
  SpendingDashboard: () => <section>Sustainability spend</section>,
}));

import InsightsPage from '../Insights';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/insights']}>
        <InsightsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Insights page', () => {
  beforeEach(() => {
    currentLocale = 'en';
    dashboardAdapterMock.mockReturnValue({
      overview: {
        savedLooks: 9,
        plannedThisWeek: 4,
      },
      insights: {
        usageRate: 74,
        totalGarments: 12,
        garmentsUsedLast30Days: 8,
        topFiveWorn: [{ id: 'top-1', title: 'Black Tee', color_primary: 'black', wearCountLast30: 6 }],
        unusedGarments: [{ id: 'unused-1', title: 'Blue Shirt', color_primary: 'blue' }],
        usedGarments: [{ id: 'used-1', title: 'Grey Trousers', color_primary: 'black', wearCountLast30: 4 }],
      },
      dna: {
        archetype: 'Minimalist',
        outfitsAnalyzed: 12,
        signatureColors: [
          { color: 'black', percentage: 50 },
          { color: 'blue', percentage: 25 },
        ],
        uniformCombos: [{ combo: ['tee', 'trousers', 'sneakers'], count: 4 }],
        patterns: [{ label: 'Neutral palette', strength: 78, detail: 'Mostly dark neutrals' }],
        formalityCenter: 2.8,
        formalitySpread: 'moderate',
      },
      sustainability: {
        score: 82,
        utilizationRate: 68,
        avgWearCount: 7,
        underusedCount: 2,
      },
      allGarments: [
        { id: 'used-1', title: 'Grey Trousers', color_primary: 'black' },
        { id: 'unused-1', title: 'Blue Shirt', color_primary: 'blue' },
        { id: 'g-3', title: 'Loafers', color_primary: 'black' },
        { id: 'g-4', title: 'Camel Coat', color_primary: 'brown' },
        { id: 'g-5', title: 'White Tee', color_primary: 'white' },
      ],
      colorBreakdown: {
        total: 2,
        entries: [['black', 1], ['blue', 1]],
        bars: [
          { color: 'black', count: 1, colorClass: 'bg-gray-900' },
          { color: 'blue', count: 1, colorClass: 'bg-blue-500' },
        ],
      },
      isPremium: true,
      isLoading: false,
      isRefreshing: false,
    });
  });

  it('renders the DNA dashboard sections with populated data', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Insights' })).toBeInTheDocument();
    expect(screen.getByText('App-wide rotation, DNA, and wardrobe leverage')).toBeInTheDocument();
    expect(screen.getByText('Rotation, DNA, and value in one working view.')).toBeInTheDocument();
    expect(screen.getAllByText('Minimalist').length).toBeGreaterThan(0);
    expect(screen.getByText('Saved looks: 9')).toBeInTheDocument();
    expect(screen.getByText('Planned this week: 4')).toBeInTheDocument();
    expect(screen.getByText('Wardrobe patterns')).toBeInTheDocument();
    expect(screen.getByText('Value & gaps')).toBeInTheDocument();
    expect(screen.getByText('Related tools')).toBeInTheDocument();
    expect(screen.getByText('Black loafers')).toBeInTheDocument();
    expect(screen.getByTestId('wardrobe-health-card')).toBeInTheDocument();
  });

  it('switches key page copy between English and Swedish', () => {
    const { rerender } = renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Insights' })).toBeInTheDocument();

    currentLocale = 'sv';
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/insights']}>
          <InsightsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Insikter' })).toBeInTheDocument();
    expect(screen.getByText('App-wide rotation, DNA, and wardrobe leverage')).toBeInTheDocument();
    expect(screen.getByText('Wardrobe patterns')).toBeInTheDocument();
  });
});
