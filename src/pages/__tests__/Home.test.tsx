import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const navigateMock = vi.fn();
const useGarmentCountMock = vi.fn();
const useFlatGarmentsMock = vi.fn();
const useOutfitsMock = vi.fn();
const usePlannedOutfitsForDateMock = vi.fn();
const useInsightsMock = vi.fn();
const useStyleDnaMock = vi.fn();
const useWeatherMock = vi.fn();
const useCalendarEventsRangeMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: vi.fn(() => ({ theme: 'light', resolvedTheme: 'light', accentColor: 'blue', setTheme: vi.fn(), setAccentColor: vi.fn() })),
}));

vi.mock('@/contexts/SeedContext', () => ({
  useSeed: vi.fn(() => ({ seeding: false, progress: 0 })),
  useSeedMaybe: vi.fn(() => null),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'u1' },
    session: {},
    loading: false,
  })),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (k: string) => k, locale: 'en' })),
}));

vi.mock('@/contexts/LocationContext', () => ({
  useLocation: vi.fn(() => ({ effectiveCity: 'Stockholm' })),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: vi.fn(() => ({ data: { display_name: 'Test User', preferences: { onboarding: { completed: true } } }, isLoading: false })),
  useUpdateProfile: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

vi.mock('@/hooks/useGarments', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useGarments')>('@/hooks/useGarments');
  return {
    ...actual,
    useGarmentCount: () => useGarmentCountMock(),
    useFlatGarments: () => useFlatGarmentsMock(),
  };
});

vi.mock('@/hooks/useOutfits', () => ({
  useOutfits: () => useOutfitsMock(),
}));

vi.mock('@/hooks/usePlannedOutfits', () => ({
  usePlannedOutfitsForDate: () => usePlannedOutfitsForDateMock(),
}));

vi.mock('@/hooks/useInsights', () => ({
  useInsights: () => useInsightsMock(),
}));

vi.mock('@/hooks/useStyleDNA', () => ({
  useStyleDNA: () => useStyleDnaMock(),
}));

vi.mock('@/hooks/useWeather', () => ({
  useWeather: () => useWeatherMock(),
}));

vi.mock('@/hooks/useCalendarSync', () => ({
  useCalendarEventsRange: () => useCalendarEventsRangeMock(),
}));

vi.mock('@/hooks/useFirstRunCoach', () => ({
  useFirstRunCoach: () => ({ isActive: false, hasEnoughGarments: true }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PullToRefresh', () => ({
  PullToRefresh: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/weather/WeatherPill', () => ({
  WeatherPill: () => <div>Weather</div>,
}));

vi.mock('@/components/ui/OutfitComposition', () => ({
  OutfitComposition: () => <div data-testid="outfit-composition" />,
}));

vi.mock('@/components/ui/lazy-image', () => ({
  LazyImageSimple: ({ alt }: { alt: string }) => <div aria-label={alt}>image</div>,
}));

import HomePage from '../Home';

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderHome() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function buildUnusedGarment() {
  return {
    id: 'garment-1',
    title: 'Cream shirt',
    category: 'top',
    color_primary: 'cream',
    created_at: '2026-01-01T00:00:00.000Z',
    wear_count: 0,
    image_path: '/shirt.png',
    original_image_path: '/shirt.png',
    processed_image_path: null,
    rendered_image_path: null,
    image_processing_status: null,
    render_status: null,
  };
}

describe('Home page command center', () => {
  beforeEach(() => {
    navigateMock.mockReset();

    useGarmentCountMock.mockReturnValue({ data: 12, isLoading: false });
    useFlatGarmentsMock.mockReturnValue({ data: [], isLoading: false });
    useOutfitsMock.mockReturnValue({ data: [{ id: 'recent-1', outfit_items: [] }], isLoading: false });
    usePlannedOutfitsForDateMock.mockReturnValue({ data: [], isLoading: false });
    useInsightsMock.mockReturnValue({
      data: {
        unusedGarments: [buildUnusedGarment()],
      },
    });
    useStyleDnaMock.mockReturnValue({
      data: {
        archetype: 'Minimalist',
        outfitsAnalyzed: 8,
        signatureColors: [{ color: 'black', percentage: 40 }],
        uniformCombos: [{ combo: ['tee', 'trousers', 'sneakers'], count: 4 }],
        patterns: [{ label: 'Neutral palette', strength: 75, detail: 'Mostly neutral' }],
        formalityCenter: 2.8,
        formalitySpread: 'moderate',
      },
      isLoading: false,
    });
    useWeatherMock.mockReturnValue({
      weather: { temperature: 18, precipitation: 'none', condition: 'weather.condition.clear', location: 'Stockholm' },
      isLoading: false,
      error: null,
    });
    useCalendarEventsRangeMock.mockReturnValue({
      data: [{ id: 'event-1', title: 'Client review', date: new Date().toISOString().slice(0, 10), start_time: '09:00:00' }],
    });
  });

  it('surfaces the focused today flow, utility cards, and insights preview', () => {
    renderHome();

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toContain('Test');
    expect(screen.getByText('Style outfit')).toBeInTheDocument();
    expect(screen.getAllByText('Ask BURS').length).toBeGreaterThan(0);
    expect(screen.getByText('Travel capsule')).toBeInTheDocument();
    expect(screen.getAllByText('Open insights').length).toBeGreaterThan(0);
    expect(screen.getByText('Open unworn rotation')).toBeInTheDocument();
  });

  it('navigates to the promoted actions from home', () => {
    renderHome();

    fireEvent.click(screen.getByText('Style outfit'));
    fireEvent.click(screen.getByRole('button', { name: /Ask BURS/i }));
    fireEvent.click(screen.getByText('Travel capsule'));
    fireEvent.click(screen.getAllByText('Open insights')[0]);
    fireEvent.click(screen.getByText('Open unworn rotation'));

    expect(navigateMock).toHaveBeenCalledWith('/ai/generate');
    expect(
      navigateMock.mock.calls.some(([path]) =>
        path === '/ai/chat' || (typeof path === 'string' && path.startsWith('/ai/generate')),
      ),
    ).toBe(true);
    expect(navigateMock).toHaveBeenCalledWith('/ai/travel');
    expect(navigateMock).toHaveBeenCalledWith('/insights');
    expect(navigateMock).toHaveBeenCalledWith('/outfits/unused');
  });

  it('keeps wardrobe as the secondary path while the wardrobe is still small', () => {
    useGarmentCountMock.mockReturnValue({ data: 2, isLoading: false });

    renderHome();

    expect(screen.getByText('Add garment')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Open wardrobe'));
    expect(navigateMock).toHaveBeenCalledWith('/wardrobe');
  });
});
