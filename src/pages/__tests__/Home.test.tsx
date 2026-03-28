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
const useWardrobeUnlocksMock = vi.fn();
const useWardrobeGapAnalysisMock = vi.fn();

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
  useLanguage: vi.fn(() => ({
    t: (k: string, vars?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'home.gaps.title': 'Garment gaps',
        'home.gaps.panel_kicker': 'Wardrobe intelligence',
        'home.gaps.ready_title': 'Run the full gap scan.',
        'home.gaps.ready_desc': 'Run the full scan in one place so results, refreshes, and shopping follow-up stay together.',
        'home.gaps.run_scan': 'Run scan',
        'home.gaps.open_full_scan': 'Open full scan',
        'home.gaps.locked_kicker': '{count} to unlock',
        'home.gaps.locked_desc': 'Reach 10 pieces and BURS will show which additions unlock the most new outfits.',
        'home.gaps.complete_kicker': 'Balanced',
        'home.gaps.complete_title': 'No urgent gap right now.',
        'home.gaps.complete_desc': 'Your last scan came back balanced. Open the full scan to review it or rerun it after adding new pieces.',
        'home.gaps.run_fresh_scan': 'Run fresh scan',
        'common.progress': 'Progress',
        'common.add_garments': 'Add garments',
        'weather.condition.clear': 'Clear',
        'home.greeting_morning': 'Good morning',
        'home.greeting_afternoon': 'Good afternoon',
        'home.greeting_evening': 'Good evening',
        'nav.settings': 'Settings',
      };
      const template = translations[k] ?? k;
      return vars
        ? Object.entries(vars).reduce((value, [key, replacement]) => value.replace(`{${key}}`, replacement), template)
        : template;
    },
    locale: 'en',
  })),
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

vi.mock('@/hooks/useWardrobeUnlocks', () => ({
  useWardrobeUnlocks: () => useWardrobeUnlocksMock(),
}));

vi.mock('@/hooks/useAdvancedFeatures', () => ({
  useWardrobeGapAnalysis: () => useWardrobeGapAnalysisMock(),
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
    useWardrobeUnlocksMock.mockReturnValue({
      isUnlocked: () => true,
      garmentsNeeded: 0,
      currentCount: 12,
    });
    useWardrobeGapAnalysisMock.mockReturnValue({
      isPending: false,
      isError: false,
      mutateAsync: vi.fn(),
    });
  });

  it('surfaces style me, garment gaps, dna, and gaps intelligence entry points', () => {
    renderHome();

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toContain('Test');
    expect(screen.getByText('Style me')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Garment gaps/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Travel/i })).toBeInTheDocument();
    expect(screen.getByTestId('home-dna-populated')).toBeInTheDocument();
    expect(screen.getByText('Wardrobe intelligence')).toBeInTheDocument();
    expect(screen.getAllByText('Garment gaps')).toHaveLength(2);
  });

  it('navigates to the promoted actions from home', () => {
    renderHome();

    fireEvent.click(screen.getByText('Style me'));
    fireEvent.click(screen.getByRole('button', { name: /Garment gaps.*Find the next buy/i }));
    fireEvent.click(screen.getByRole('button', { name: /Travel.*Pack smarter/i }));
    fireEvent.click(screen.getByRole('button', { name: /Mood.*Dress the vibe/i }));
    fireEvent.click(screen.getByRole('button', { name: /Plan.*Week ahead/i }));
    fireEvent.click(screen.getByText('See all unworn'));

    expect(navigateMock).toHaveBeenCalledWith('/ai/generate');
    expect(navigateMock).toHaveBeenCalledWith('/gaps');
    expect(navigateMock).toHaveBeenCalledWith('/ai/travel');
    expect(navigateMock).toHaveBeenCalledWith('/ai/mood');
    expect(navigateMock).toHaveBeenCalledWith('/plan');
    expect(navigateMock).toHaveBeenCalledWith('/outfits/unused');
  });

  it('routes the dna and wear-next affordances into insights and anchored styling', () => {
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Open DNA' }));
    fireEvent.click(screen.getByRole('button', { name: 'Style around it' }));

    expect(navigateMock).toHaveBeenCalledWith('/insights');
    expect(navigateMock).toHaveBeenCalledWith('/ai/generate?garments=garment-1&selectedGarmentId=garment-1');
  });

  it('opens the planned outfit when today already has a saved look', () => {
    usePlannedOutfitsForDateMock.mockReturnValue({
      data: [
        {
          outfit: {
            id: 'today-look-1',
            explanation: 'Polished layers for the office.',
            outfit_items: [],
          },
        },
      ],
      isLoading: false,
    });

    renderHome();

    fireEvent.click(screen.getByRole('button', { name: "Today's look" }));

    expect(navigateMock).toHaveBeenCalledWith('/outfits/today-look-1');
  });

  it('keeps wardrobe as a visible secondary entry point when the wardrobe is still small', () => {
    useGarmentCountMock.mockReturnValue({ data: 2, isLoading: false });
    useWardrobeUnlocksMock.mockReturnValue({
      isUnlocked: () => false,
      garmentsNeeded: 8,
      currentCount: 2,
    });

    renderHome();

    fireEvent.click(screen.getByRole('button', { name: /^Wardrobe$/i }));
    expect(navigateMock).toHaveBeenCalledWith('/wardrobe');
  });
});
