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

vi.mock('@/integrations/lovable/index', () => ({
  lovable: { auth: { signInWithOAuth: vi.fn() } },
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
    expect(screen.getByText('auth.login')).toBeInTheDocument();
    expect(screen.getByText('auth.signup')).toBeInTheDocument();
  });

  it('renders email and password inputs', () => {
    renderAuth();
    expect(screen.getByPlaceholderText('auth.email_placeholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('auth.password_placeholder')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    renderAuth();
    expect(screen.getByRole('button', { name: 'auth.login' })).toBeInTheDocument();
  });
});
