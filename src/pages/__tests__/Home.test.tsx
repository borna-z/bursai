import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const navigateMock = vi.fn();
const useGarmentCountMock = vi.fn();
const useOutfitsMock = vi.fn();
const usePlannedOutfitsForDateMock = vi.fn();
const useWeatherMock = vi.fn();

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
    t: (k: string) => ({
      'home.shortcut_chat': 'Ask stylist',
      'home.shortcut_style': 'Style me',
      'home.shortcut_plan': 'Plan week',
      'home.shortcut_travel_capsule': 'Travel Capsule',
      'home.shortcut_discover': 'Discover',
      'home.shortcut_gaps': 'Wardrobe gaps',
      'home.quick_actions': 'Continue',
      'home.action_style_outfit': 'Style outfit',
      'home.action_add_garment': 'Add garment',
      'home.action_open_wardrobe': 'Open wardrobe',
      'home.action_open_plan': 'Open plan',
      'home.ai_review': 'Why this works',
      'home.weather_desc': 'Built around today\'s conditions.',
      'home.greeting_morning': 'Good morning',
      'home.greeting_afternoon': 'Good afternoon',
      'home.greeting_evening': 'Good evening',
      'home.settings_aria': 'Settings',
      'weather.condition.clear': 'Clear',
    }[k] ?? k),
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
  };
});

vi.mock('@/hooks/useOutfits', () => ({
  useOutfits: () => useOutfitsMock(),
}));

vi.mock('@/hooks/usePlannedOutfits', () => ({
  usePlannedOutfitsForDate: () => usePlannedOutfitsForDateMock(),
}));

vi.mock('@/hooks/useWeather', () => ({
  useWeather: () => useWeatherMock(),
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

vi.mock('@/components/home/HomeTodayLookCard', () => ({
  HomeTodayLookCard: ({ primaryLabel, secondaryLabel, onPrimaryAction, onSecondaryAction }: {
    primaryLabel: string; secondaryLabel: string;
    onPrimaryAction: () => void; onSecondaryAction: () => void;
    state: string; todayOutfit: unknown; garmentCount: number; weatherSummary: string | null;
  }) => (
    <div>
      <button onClick={onPrimaryAction}>{primaryLabel}</button>
      <button onClick={onSecondaryAction}>{secondaryLabel}</button>
    </div>
  ),
}));

vi.mock('@/components/home/HomeStatsStrip', () => ({
  HomeStatsStrip: ({ garmentCount, outfitCount, streakDays }: { garmentCount: number; outfitCount: number; streakDays: number }) => (
    <div data-testid="stats-strip">
      <span>{garmentCount} pieces</span>
      <span>{outfitCount} outfits</span>
      <span>{streakDays} streak</span>
    </div>
  ),
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

describe('Home page V4', () => {
  beforeEach(() => {
    navigateMock.mockReset();

    useGarmentCountMock.mockReturnValue({ data: 12, isLoading: false });
    useOutfitsMock.mockReturnValue({ data: [{ id: 'recent-1', outfit_items: [] }], isLoading: false });
    usePlannedOutfitsForDateMock.mockReturnValue({ data: [], isLoading: false });
    useWeatherMock.mockReturnValue({
      weather: { temperature: 18, precipitation: 'none', condition: 'weather.condition.clear', location: 'Stockholm' },
      isLoading: false,
      error: null,
    });
  });

  it('renders editorial greeting with user name and shortcuts', () => {
    renderHome();

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toContain('Test');

    expect(screen.getByText('Ask stylist')).toBeInTheDocument();
    expect(screen.getByText('Discover')).toBeInTheDocument();
    expect(screen.getByText('Travel Capsule')).toBeInTheDocument();
  });

  it('routes the travel capsule shortcut to the travel capsule planner', () => {
    renderHome();

    fireEvent.click(screen.getByText('Travel Capsule'));
    expect(navigateMock).toHaveBeenCalledWith('/plan/travel-capsule');
  });

  it('shows style outfit as primary action with enough garments', () => {
    renderHome();

    expect(screen.getByText('Style outfit')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Style outfit'));
    expect(navigateMock).toHaveBeenCalledWith('/ai/generate');
  });

  it('shows add garment action when wardrobe is small', () => {
    useGarmentCountMock.mockReturnValue({ data: 2, isLoading: false });

    renderHome();

    expect(screen.getByText('Add garment')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Open wardrobe'));
    expect(navigateMock).toHaveBeenCalledWith('/wardrobe');
  });
});
