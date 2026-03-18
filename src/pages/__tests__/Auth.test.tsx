import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
  })),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (k: string) => k, locale: 'en' })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { signInWithOAuth: vi.fn() } },
}));


import AuthPage from '../Auth';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderAuth() {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/auth']}>
        <AuthPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Auth page smoke', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders login and signup tabs', () => {
    renderAuth();
    const loginElements = screen.getAllByText('auth.login');
    expect(loginElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('auth.signup')).toBeInTheDocument();
  });

  it('renders email input', () => {
    renderAuth();
    expect(screen.getByPlaceholderText('you@email.com')).toBeInTheDocument();
  });

  it('renders password input', () => {
    renderAuth();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });
});
