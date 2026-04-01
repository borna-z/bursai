import type { PropsWithChildren } from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { InsightsDashboardViewModel } from '@/components/insights/useInsightsDashboardAdapter';

type Locale = 'en' | 'sv';

const translations: Record<Locale, Record<string, string>> = {
  en: {
    'insights.title': 'Style Intelligence',
    'insights.subtitle': 'Your wardrobe, decoded',
  },
  sv: {
    'insights.title': 'Stilintelligens',
    'insights.subtitle': 'Din garderob, avkodad',
  },
};

let currentLocale: Locale = 'en';

const dashboardAdapterMock = vi.fn<() => InsightsDashboardViewModel>();
const navigateMock = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => <section {...props}>{children}</section>,
    circle: (props: Record<string, unknown>) => <circle {...props} />,
  },
  useReducedMotion: () => true,
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    locale: currentLocale,
    t: (key: string) => translations[currentLocale][key] ?? key,
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

vi.mock('@/components/ui/lazy-image', () => ({
  LazyImageSimple: ({ alt }: { alt: string }) => <div data-testid="mock-image">{alt}</div>,
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
      title: 'A clearer read on how your wardrobe behaves.',
      summary: 'Minimalist energy is coming through, but 4 pieces are sitting dormant and ready for rotation.',
      metrics: [
        { label: 'Active 30d', value: '8/12', hint: 'Pieces in active rotation' },
        { label: 'Usage rate', value: '67%', hint: 'Wardrobe touched in the last month' },
        { label: 'Looks / formulas', value: '9 / 2', hint: 'Saved looks and recurring formulas' },
      ],
    },
    style: {
      ready: true,
      archetype: 'Minimalist',
      detail: 'Neutral palette dominates your recent wear and the core formulas are repeating clearly.',
      formalityLabel: 'Balanced range',
      formalityValue: 'Moves across casual and elevated · 3.1/5',
      signatureColors: [
        { color: 'black', label: 'Black', count: 4, percentage: 50, swatch: '#171717' },
        { color: 'navy', label: 'Navy', count: 2, percentage: 25, swatch: '#223256' },
      ],
      formulas: [
        { label: 'Shirt + Trousers + Loafers', count: 4 },
        { label: 'Knitwear + Jeans + Boots', count: 3 },
      ],
      patterns: [
        { label: 'Neutral palette', strength: 78, detail: '78% of recent wears stay in neutral tones.' },
      ],
    },
    palette: {
      summary: 'Balanced palette with black leading the mix.',
      dominantLabel: 'Balanced palette',
      warmCount: 2,
      coolCount: 3,
      neutralCount: 7,
      entries: [
        { color: 'black', label: 'Black', count: 4, percentage: 33, swatch: '#171717' },
        { color: 'navy', label: 'Navy', count: 2, percentage: 17, swatch: '#223256' },
      ],
      bars: [
        { color: 'black', label: 'Black', count: 4, percentage: 33, swatch: '#171717' },
        { color: 'navy', label: 'Navy', count: 2, percentage: 17, swatch: '#223256' },
      ],
      locked: false,
    },
    behavior: {
      streak: 5,
      consistency: 61,
      cadenceLabel: 'Consistent weekly wear',
      repeatLead: {
        id: 'outfit-1',
        occasion: 'Office look',
        wornCount: 3,
        lastWorn: '2026-03-27',
        daysSince: 6,
      },
      staleLead: {
        id: 'outfit-2',
        occasion: 'Dinner look',
        daysSince: 74,
      },
      repeats: [
        { id: 'outfit-1', occasion: 'Office look', wornCount: 3, lastWorn: '2026-03-27', daysSince: 6 },
      ],
      staleOutfits: [
        { id: 'outfit-2', occasion: 'Dinner look', daysSince: 74 },
      ],
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
      forgottenGems: [
        {
          id: 'garment-forgotten',
          title: 'Grey Blazer',
          imagePath: null,
          eyebrow: 'Forgotten gem',
          detail: 'Outerwear',
          meta: 'Last worn 2026-01-10',
        },
      ],
      topPerformers: [
        {
          id: 'garment-top',
          title: 'Black Tee',
          imagePath: null,
          eyebrow: 'Top performer',
          detail: '6 wears in 30d',
          meta: 'Tops',
        },
      ],
      usedCount: 8,
      unusedCount: 4,
      pressureLabel: 'Category concentration',
      pressureDetail: 'Tops make up 42% of the wardrobe, which may be crowding out balance.',
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
      },
      worstCostPerWear: {
        id: 'garment-worst',
        title: 'Statement Coat',
        imagePath: null,
        eyebrow: 'Needs more rotation',
        detail: '2 wears',
        meta: '$600',
        cpwLabel: '$300.00',
      },
      sustainabilityScore: 82,
      utilizationLabel: '67% active',
      efficiencyLabel: '7.4 average wears',
      locked: false,
    },
    actions: [
      {
        id: 'forgotten-piece',
        title: 'Style Grey Blazer',
        detail: 'Bring a dormant garment back into the rotation with a look built around it.',
        cta: 'Style forgotten piece',
        tone: 'warning',
        target: { kind: 'style-garment', garmentId: 'garment-forgotten' },
      },
      {
        id: 'gap-scan',
        title: 'Fill wardrobe gaps',
        detail: 'Run the gaps tool to identify the missing category or silhouette that would add the most lift.',
        cta: 'Open gap scan',
        tone: 'warning',
        target: { kind: 'gaps', autorun: true },
      },
    ],
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
    currentLocale = 'en';
    dashboardAdapterMock.mockReturnValue(baseViewModel());
  });

  it('renders the redesigned hero, style DNA, palette, behavior, wardrobe health, value, and action center', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Style Intelligence' })).toBeInTheDocument();
    expect(screen.getByText('A clearer read on how your wardrobe behaves.')).toBeInTheDocument();
    expect(screen.getByText('Minimalist')).toBeInTheDocument();
    expect(screen.getByText('Balanced palette')).toBeInTheDocument();
    expect(screen.getByText('Consistent weekly wear')).toBeInTheDocument();
    expect(screen.getByText('Category balance')).toBeInTheDocument();
    expect(screen.getByText('Total wardrobe value')).toBeInTheDocument();
    expect(screen.getByText('What to do next, based on the wardrobe you actually have.')).toBeInTheDocument();
  });

  it('shows the loading shell while the dashboard is still resolving', () => {
    dashboardAdapterMock.mockReturnValue(baseViewModel({ state: 'loading' }));

    renderPage();

    expect(screen.getByTestId('insights-loading')).toBeInTheDocument();
  });

  it('shows the empty wardrobe state and routes to add garments', () => {
    dashboardAdapterMock.mockReturnValue(baseViewModel({
      state: 'empty',
      hero: { ...baseViewModel().hero, summary: 'Add garments first.' },
    }));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Add garments' }));

    expect(screen.getByText('Build your wardrobe first')).toBeInTheDocument();
    expect(navigateMock).toHaveBeenCalledWith('/wardrobe/add');
  });

  it('shows the no-wear-data state separately from the empty state', () => {
    dashboardAdapterMock.mockReturnValue(baseViewModel({
      state: 'no-wear-data',
      behavior: {
        ...baseViewModel().behavior,
        streak: 0,
        consistency: 0,
      },
    }));

    renderPage();

    expect(screen.getByText('Your wardrobe is ready, but wear history is still quiet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open planner' })).toBeInTheDocument();
  });

  it('renders palette details and category balance from the adapter model', () => {
    renderPage();

    expect(screen.getByTestId('palette-section')).toBeInTheDocument();
    expect(screen.getAllByText('Black').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Navy').length).toBeGreaterThan(0);
    expect(screen.getByTestId('category-balance-section')).toBeInTheDocument();
    expect(screen.getAllByText('Tops').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Trousers').length).toBeGreaterThan(0);
  });

  it('renders the behavior section with the heatmap and repeat signals', () => {
    renderPage();

    expect(screen.getByTestId('behavior-heatmap')).toBeInTheDocument();
    expect(screen.getByText('Office look')).toBeInTheDocument();
    expect(screen.getByText('Dinner look')).toBeInTheDocument();
  });

  it('renders the value section with total value and best or worst cost-per-wear', () => {
    renderPage();

    expect(screen.getByText('$1,850')).toBeInTheDocument();
    expect(screen.getByText('$12.50')).toBeInTheDocument();
    expect(screen.getAllByText('Statement Coat').length).toBeGreaterThan(0);
  });

  it('routes the forgotten piece CTA into the styling flow', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Style forgotten piece' }));

    expect(navigateMock).toHaveBeenCalledWith(
      '/ai/chat?selectedGarmentId=garment-forgotten&garments=garment-forgotten',
      expect.objectContaining({
        state: expect.objectContaining({
          selectedGarmentId: 'garment-forgotten',
          prefillMessage: 'Style around this garment and build a complete look around it.',
        }),
      }),
    );
  });

  it('shows premium gating elegantly and routes to pricing from a locked section', () => {
    dashboardAdapterMock.mockReturnValue(baseViewModel({
      isPremium: false,
      palette: { ...baseViewModel().palette, locked: true },
      behavior: { ...baseViewModel().behavior, locked: true },
      value: { ...baseViewModel().value, locked: true },
      upgrade: {
        show: true,
        title: 'Unlock premium depth',
        detail: 'See richer palette, behavior, and value analysis.',
        cta: 'View premium',
      },
    }));

    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: 'View premium' })[0]);

    expect(screen.getAllByText('Premium depth').length).toBeGreaterThan(0);
    expect(navigateMock).toHaveBeenCalledWith('/pricing');
  });

  it('routes the gap action CTA into the gaps flow with autorun enabled', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Open gap scan' }));

    expect(navigateMock).toHaveBeenCalledWith('/gaps?autorun=1');
  });

  it('switches key page copy between English and Swedish', () => {
    const { rerender } = renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Style Intelligence' })).toBeInTheDocument();
    expect(screen.getByText('Your wardrobe, decoded')).toBeInTheDocument();

    currentLocale = 'sv';
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/insights']}>
          <InsightsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Stilintelligens' })).toBeInTheDocument();
    expect(screen.getByText('Din garderob, avkodad')).toBeInTheDocument();
  });
});
