import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock useProfile
vi.mock('@/hooks/useProfile', () => ({
  useProfile: vi.fn(),
}));

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithRouter = (initialPath = '/protected') => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/auth" element={<div>Login Page</div>} />
          <Route path="/onboarding" element={<div>Onboarding Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /auth when user is not logged in', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    vi.mocked(useProfile).mockReturnValue({
      data: null,
      isLoading: false,
    } as any);

    renderWithRouter();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('shows loading spinner while auth is loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: true,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    vi.mocked(useProfile).mockReturnValue({
      data: null,
      isLoading: false,
    } as any);

    const { container } = renderWithRouter();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders children when user is authenticated and onboarding is complete', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1' } as any,
      session: {} as any,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    vi.mocked(useProfile).mockReturnValue({
      data: { preferences: { onboarding: { completed: true } } },
      isLoading: false,
    } as any);

    renderWithRouter();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /onboarding when onboarding is not completed', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1' } as any,
      session: {} as any,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    vi.mocked(useProfile).mockReturnValue({
      data: { preferences: { onboarding: { completed: false } } },
      isLoading: false,
    } as any);

    renderWithRouter();
    expect(screen.getByText('Onboarding Page')).toBeInTheDocument();
  });
});
