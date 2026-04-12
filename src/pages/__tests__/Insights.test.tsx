import type { PropsWithChildren } from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { InsightsDashboardViewModel } from '@/components/insights/useInsightsDashboardAdapter';

const dashboardAdapterMock = vi.fn<() => InsightsDashboardViewModel>();
const navigateMock = vi.fn();

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: PropsWithChildren) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => <section {...props}>{children}</section>,
    circle: (props: Record<string, unknown>) => <circle {...props} />,
    h1: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => <h1 {...props}>{children}</h1>,
    p: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => <p {...props}>{children}</p>,
  },
  useReducedMotion: () => true,
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PullToRefresh', () => ({
  PullToRefresh: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/skeletons', () => ({
  InsightsPageSkeleton: () => <div data-testid="insights-loading">loading</div>,
}));

vi.mock('@/components/layout/EmptyState', () => ({
  EmptyState: ({
    title,
    description,
    action,
    secondaryAction,
  }: {
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
    secondaryAction?: { label: string; onClick: () => void };
  }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <button onClick={action.onClick}>{action.label}</button> : null}
      {secondaryAction ? <button onClick={secondaryAction.onClick}>{secondaryAction.label}</button> : null}
    </div>
  ),
}));

vi.mock('@/components/insights/useInsightsDashboardAdapter', () => ({
  useInsightsDashboardAdapter: () => dashboardAdapterMock(),
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

import InsightsPage from '../Insights';

function baseViewModel(overrides: Partial<InsightsDashboardViewModel> = {}): InsightsDashboardViewModel {
  return {
    state: 'ready',
    isPremium: true,
    isRefreshing: false,
    generatedAtLabel: 'Apr 2, 10:30 AM',
    hero: {
      score: 82,
      eyebrow: 'Wardrobe intelligence',
      title: 'Wardrobe operating view.',
      summary: '4 pieces are dormant right now and ready for rotation.',
      metrics: [
        {
          label: 'Active 30d',
          value: '8/12',
          hint: 'Pieces in active rotation',
          rails: [{ label: 'Active', value: 8, max: 12 }],
        },
        {
          label: 'Usage rate',
          value: '67%',
          hint: 'Wardrobe touched in the last month',
          rails: [{ label: 'Usage', value: 67, max: 100 }],
        },
        {
          label: 'Looks / formulas',
          value: '9 / 2',
          hint: 'Saved looks and recurring formulas',
          rails: [
            { label: 'Looks', value: 9, max: 9 },
            { label: 'Formulas', value: 2, max: 9 },
          ],
        },
      ],
    },
    style: {
      ready: true,
      archetype: 'Minimalist',
      caption: '78% of your worn pieces stay in neutral tones.',
      formalityLabel: 'Balanced range',
      formalityValue: 'Moves across casual and elevated / 3.1 of 5',
      formalityCenter: 3.1,
      formalitySpread: 'moderate',
      signatureColors: [],
      formulas: [],
      patterns: [],
    },
    palette: {
      summary: 'Balanced palette with black leading.',
      dominantLabel: 'Balanced palette',
      warmCount: 2,
      coolCount: 3,
      neutralCount: 7,
      totalCount: 12,
      entries: [],
      bars: [
        { color: 'black', label: 'Black', count: 4, percentage: 33, swatch: '#171717' },
        { color: 'navy', label: 'Navy', count: 2, percentage: 17, swatch: '#223256' },
      ],
      locked: false,
    },
    behavior: {
      streak: 5,
      consistency: 61,
      repeats: [],
      staleOutfits: [],
      heatmapDays: Array.from({ length: 14 }, (_, index) => ({
        date: `2026-03-${String(index + 1).padStart(2, '0')}`,
        status: index % 3 === 0 ? 'planned' : index % 2 === 0 ? 'improvised' : 'none',
      })),
      locked: false,
    },
    health: {
      categoryBalance: [
        { name: 'tops', label: 'Tops', count: 5, percentage: 42 },
        { name: 'trousers', label: 'Trousers', count: 3, percentage: 25 },
      ],
      forgottenGems: [],
      topPerformers: [],
      usedCount: 8,
      unusedCount: 4,
      totalCount: 12,
      pressureLabel: 'Category concentration',
      pressureDetail: 'Tops holds 42% of the wardrobe.',
    },
    value: {
      hasSpendData: true,
      totalValue: '$1,850',
      avgCostPerWear: '$12.50',
      bestCostPerWear: {
        id: 'garment-best',
        title: 'Black Tee',
        imagePath: null,
        eyebrow: 'Best cost per wear',
        detail: '20 wears',
        meta: '$80',
        cpwLabel: '$4.00',
        cpwValue: 4,
      },
      worstCostPerWear: {
        id: 'garment-worst',
        title: 'Statement Coat',
        imagePath: null,
        eyebrow: 'Needs more rotation',
        detail: '2 wears',
        meta: '$600',
        cpwLabel: '$300.00',
        cpwValue: 300,
      },
      sustainabilityScore: 82,
      utilizationLabel: '67% active',
      efficiencyLabel: '7.4 average wears',
      utilizationRate: 67,
      avgWearCount: 7.4,
      locked: false,
    },
    actions: [],
    upgrade: {
      show: false,
      title: 'Unlock premium depth',
      detail: 'See richer palette, behavior, and value analysis.',
      cta: 'View premium',
    },
    ...overrides,
  };
}

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
    vi.clearAllMocks();
    dashboardAdapterMock.mockReturnValue(baseViewModel());
  });

  it('renders without crashing for ready state', () => {
    renderPage();
    // PageHeader renders the title from t('insights.yourStyleStory')
    expect(screen.getByText('insights.yourStyleStory')).toBeInTheDocument();
  });

  it('renders loading skeleton for loading state', () => {
    dashboardAdapterMock.mockReturnValue(baseViewModel({ state: 'loading' }));
    renderPage();
    expect(screen.getByTestId('insights-loading')).toBeInTheDocument();
  });

  it('renders empty state for empty state', () => {
    dashboardAdapterMock.mockReturnValue(baseViewModel({ state: 'empty' }));
    renderPage();
    expect(screen.getByText('Build your wardrobe first')).toBeInTheDocument();
  });

  it('renders error state for error state', () => {
    dashboardAdapterMock.mockReturnValue(baseViewModel({ state: 'error' }));
    renderPage();
    expect(screen.getByText('Insights could not refresh right now')).toBeInTheDocument();
  });

  it('renders no-wear-data state with charts visible', () => {
    dashboardAdapterMock.mockReturnValue(baseViewModel({ state: 'no-wear-data' }));
    renderPage();
    // no-wear-data shows the stats section (same as ready)
    expect(screen.getByText('insights.garments')).toBeInTheDocument();
    expect(screen.getByText('insights.outfits')).toBeInTheDocument();
    expect(screen.getByText('insights.wears')).toBeInTheDocument();
  });

  it('renders the hero stats with correct counts for ready state', () => {
    // baseViewModel has totalCount=12, metrics[2].rails[0].value=9 (outfitCount),
    // heatmapDays yields some wear count
    renderPage();
    // stat labels use translation keys (returned as-is by mock)
    expect(screen.getByText('insights.garments')).toBeInTheDocument();
    expect(screen.getByText('insights.outfits')).toBeInTheDocument();
    expect(screen.getByText('insights.wears')).toBeInTheDocument();
    // garment count = 12 from health.totalCount
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
  });

  it('shows the loading shell while the dashboard is still resolving', () => {
    dashboardAdapterMock.mockReturnValue(baseViewModel({ state: 'loading' }));
    renderPage();
    expect(screen.getByTestId('insights-loading')).toBeInTheDocument();
  });

  it('shows the empty wardrobe state', () => {
    dashboardAdapterMock.mockReturnValue(baseViewModel({ state: 'empty' }));
    renderPage();
    expect(screen.getByText('Build your wardrobe first')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add garments' })).toBeInTheDocument();
  });
});
