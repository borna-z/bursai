import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <button {...props}>{children}</button>,
    header: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <header {...props}>{children}</header>,
  },
  useReducedMotion: () => false,
}));

vi.mock('@/lib/motion', () => ({
  PRESETS: { TAB: { variants: { initial: {}, animate: {} }, transition: {} } },
}));

vi.mock('@/lib/dateLocale', () => ({
  getDateFnsLocale: vi.fn(() => undefined),
  formatLocalizedDate: vi.fn(() => 'formatted'),
}));
vi.mock('@/lib/occasionLabel', () => ({ getOccasionLabel: vi.fn(() => 'Work') }));
vi.mock('@/lib/humanize', () => ({ humanize: vi.fn((value: string) => value) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: vi.fn(() => ({ t: (k: string) => k, locale: 'en' })) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn(() => ({ user: { id: 'u1' }, loading: false })) }));
vi.mock('@/contexts/LocationContext', () => ({ useLocation: vi.fn(() => ({ effectiveCity: null })) }));
vi.mock('@/hooks/useForecast', () => ({ useForecast: vi.fn(() => ({ getForecastForDate: vi.fn(() => null) })) }));
vi.mock('@/hooks/useCalendarSync', () => ({
  useBackgroundSyncNotification: vi.fn(),
  useCalendarEvents: vi.fn(() => ({ data: [] })),
}));
vi.mock('@/hooks/useFirstRunCoach', () => ({
  useFirstRunCoach: vi.fn(() => ({ currentStep: 0, isStepActive: vi.fn(() => false), completeTour: vi.fn() })),
}));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: vi.fn(() => ({ canCreateOutfit: vi.fn(() => true) })) }));
vi.mock('@/hooks/useOutfitGenerator', () => ({ useOutfitGenerator: vi.fn(() => ({ generateOutfit: vi.fn(), isGenerating: false })) }));
vi.mock('@/hooks/useWeekGenerator', () => ({ useWeekGenerator: vi.fn(() => ({ generateWeek: vi.fn() })) }));
vi.mock('@/hooks/useOutfits', () => ({
  useMarkOutfitWorn: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useUndoMarkWorn: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));
vi.mock('@/hooks/useDaySummary', () => ({ useDaySummary: vi.fn(() => ({ data: null, isLoading: false })) }));
vi.mock('@/hooks/useGarments', () => ({ useFlatGarments: vi.fn(() => ({ data: [{ id: 'g1' }] })) }));
vi.mock('@/hooks/usePlannedOutfits', () => ({
  usePlannedOutfits: vi.fn(() => ({ data: [{ id: 'planned-1', date: '2026-03-22' }], isLoading: false })),
  usePlannedOutfitsForDate: vi.fn(() => ({
    data: [{
      id: 'planned-1',
      status: 'planned',
      outfit: {
        id: 'outfit-1',
        occasion: 'work',
        style_vibe: 'classic',
        explanation: 'A reliable office outfit.',
        outfit_items: [{
          id: 'item-1',
          slot: 'top',
          garment_id: 'g1',
          garment: { id: 'g1', title: 'White Shirt', image_path: '/shirt.jpg', processed_image_path: null },
        }],
      },
    }],
    isLoading: false,
  })),
  useUpsertPlannedOutfit: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeletePlannedOutfit: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useUpdatePlannedOutfitStatus: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

vi.mock('@/components/layout/AppLayout', () => ({ AppLayout: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
vi.mock('@/components/layout/PullToRefresh', () => ({ PullToRefresh: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
vi.mock('@/components/ui/animated-page', () => ({ AnimatedPage: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div> }));
vi.mock('@/components/ui/skeletons', () => ({ PlanPageSkeleton: () => <div>loading</div> }));
vi.mock('@/components/layout/EmptyState', () => ({ EmptyState: () => <div>empty</div> }));
vi.mock('@/components/plan/WeekOverview', () => ({ WeekOverview: () => <div>week overview</div> }));
vi.mock('@/components/plan/CalendarConnectBanner', () => ({ CalendarConnectBanner: () => null }));
vi.mock('@/components/plan/DaySummaryCard', () => ({ DaySummaryCard: () => null }));
vi.mock('@/components/plan/LaundryAlertBanner', () => ({ LaundryAlertBanner: () => null }));
vi.mock('@/components/plan/CalendarEventBadge', () => ({ CalendarEventsList: () => null }));
vi.mock('@/components/coach/CoachMark', () => ({ CoachMark: ({ children }: React.PropsWithChildren) => <>{children}</> }));
vi.mock('@/components/outfit/WeatherForecastBadge', () => ({ WeatherForecastBadge: () => <div>weather</div> }));
vi.mock('@/components/ui/lazy-image', () => ({
  LazyImageSimple: ({ alt, imagePath }: { alt?: string; imagePath?: string }) => <img alt={alt} data-image-path={imagePath} />,
}));
vi.mock('@/components/plan/QuickGenerateSheet', () => ({ QuickGenerateSheet: () => null }));
vi.mock('@/components/plan/SwapSheet', () => ({ SwapSheet: () => null }));
vi.mock('@/components/plan/QuickPlanSheet', () => ({ QuickPlanSheet: () => null }));
vi.mock('@/components/plan/PreselectDateSheet', () => ({ PreselectDateSheet: () => null }));

import PlanPage from '../Plan';

function renderPlanPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/plan']}>
        <PlanPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Plan page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a planned outfit without crashing', () => {
    renderPlanPage();

    expect(screen.getByText('A reliable office outfit.')).toBeInTheDocument();
    expect(screen.getByAltText('White Shirt')).toHaveAttribute('data-image-path', '/shirt.jpg');
  });
});
