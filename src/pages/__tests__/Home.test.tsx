import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: vi.fn(() => ({ theme: 'light', accentColor: 'blue', setTheme: vi.fn(), setAccentColor: vi.fn() })),
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

vi.mock('@/hooks/useProfile', () => ({
  useProfile: vi.fn(() => ({ data: { display_name: 'Test User', preferences: { onboarding: { completed: true } } }, isLoading: false })),
  useUpdateProfile: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

vi.mock('@/hooks/useGarments', () => ({
  useGarmentCount: vi.fn(() => ({ data: 5 })),
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: vi.fn(() => ({ isPremium: false, plan: 'free' })),
}));

vi.mock('@/hooks/useWeather', () => ({
  useWeather: vi.fn(() => ({ data: null })),
}));

vi.mock('@/contexts/LocationContext', () => ({
  useLocation: vi.fn(() => ({ coords: null })),
}));

import HomePage from '../Home';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderHome() {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Home page smoke', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders greeting text', () => {
    renderHome();
    // Greeting uses translation keys like home.greeting_morning / afternoon / evening
    const greeting = screen.getByRole('heading', { level: 1 });
    expect(greeting).toBeInTheDocument();
    expect(greeting.textContent).toContain('Test');
  });

  it('renders quick actions', () => {
    renderHome();
    expect(screen.getByText('discover.tool_mood')).toBeInTheDocument();
  });
});
