import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'test@test.com' }, loading: false, signOut: vi.fn() }),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({
    data: { id: 'u1', display_name: 'Test User', preferences: { onboarding: { completed: true } } },
    isLoading: false,
  }),
  useUpdateProfile: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/useIsAdmin', () => ({
  useIsAdmin: () => false,
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, language: 'en', setLanguage: vi.fn() }),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', accentColor: 'blue', setAccentColor: vi.fn() }),
}));

vi.mock('@/hooks/useAvatarUrl', () => ({
  useAvatarUrl: () => null,
}));

vi.mock('@/contexts/SeedContext', () => ({
  useSeed: () => ({ isSeedMode: false, progress: 0 }),
  SeedProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ data: { plan: 'free' }, isLoading: false }),
}));

describe('Settings', () => {
  it('renders settings groups', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const SettingsPage = (await import('../Settings')).default;
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('settings.appearance')).toBeInTheDocument();
    expect(screen.getByText('settings.account')).toBeInTheDocument();
  });
});
