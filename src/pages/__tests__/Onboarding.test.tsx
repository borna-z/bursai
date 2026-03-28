import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false }),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ data: { id: 'u1', preferences: { onboarding: { completed: false } } }, isLoading: false }),
  useUpdateProfile: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => false }));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, language: 'en', setLanguage: vi.fn() }),
}));

vi.mock('@/contexts/ThemeContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/contexts/ThemeContext')>();
  return { ...actual, useTheme: () => ({ theme: 'light', accentColor: 'blue', setAccentColor: vi.fn() }) };
});

vi.mock('@/contexts/SeedContext', () => ({
  useSeed: () => ({ isSeedMode: false, progress: 0 }),
  SeedProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/onboarding/LanguageStep', () => ({
  LanguageStep: ({ onComplete }: { onComplete: () => void }) => (
    <button type="button" onClick={onComplete}>language-step</button>
  ),
}));

vi.mock('@/components/onboarding/QuickStyleQuiz', () => ({
  QuickStyleQuiz: () => <div>quick-style-quiz</div>,
}));

vi.mock('@/components/onboarding/QuickUploadStep', () => ({
  QuickUploadStep: () => <div>quick-upload-step</div>,
}));

vi.mock('@/components/onboarding/GetStartedStep', () => ({
  GetStartedStep: () => <div>get-started-step</div>,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('Onboarding', () => {
  it('renders without crashing', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const OnboardingPage = (await import('../Onboarding')).default;
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/onboarding']}>
          <OnboardingPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(document.body).toHaveTextContent('quick-style-quiz');
  });
});
