import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false }),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ data: { id: 'u1', preferences: { onboarding: { completed: false } } }, isLoading: false }),
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

vi.mock('@/contexts/SeedContext', () => ({
  useSeed: () => ({ isSeedMode: false, progress: 0 }),
  SeedProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Onboarding', () => {
  it('renders the onboarding page without crashing', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const OnboardingPage = (await import('../Onboarding')).default;
    expect(() =>
      render(
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={['/onboarding']}>
            <OnboardingPage />
          </MemoryRouter>
        </QueryClientProvider>
      )
    ).not.toThrow();
  });
});
