import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
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

vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => false }));
vi.mock('@/hooks/useAvatarUrl', () => ({ useAvatarUrl: () => null }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ data: { plan: 'free' }, isLoading: false }) }));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, language: 'en', setLanguage: vi.fn() }),
}));

vi.mock('@/contexts/ThemeContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/contexts/ThemeContext')>();
  return { ...actual, useTheme: () => ({ theme: 'light', accentColor: 'blue', setAccentColor: vi.fn() }) };
});

vi.mock('@/contexts/SeedContext', () => ({
  useSeed: () => ({ isSeedMode: false, progress: 0 }),
  useSeedMaybe: () => null,
  SeedProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Settings', () => {
  it('renders without crashing and shows profile name', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const SettingsPage = (await import('../Settings')).default;
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.querySelector('main')).toBeTruthy();
    expect(container.textContent).toContain('Test User');
  });
});
