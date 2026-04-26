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
import {
  ONBOARDING_EXEMPT_PATHS,
  isOnboardingExempt,
} from '@/components/auth/onboardingExempt';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

type RenderOpts = {
  initialPath?: string;
  protectedPath?: string;
};

const renderWithRouter = ({
  initialPath = '/protected',
  protectedPath = '/protected',
}: RenderOpts = {}) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          {/*
            Protected routes declared FIRST so that when a test sets
            protectedPath='/onboarding' (the exempt-path case), the protected
            route wins the path collision against the literal /onboarding
            redirect-target below. In React Router v6, when two routes have
            the same path, the first declaration wins.
          */}
          <Route
            path={protectedPath}
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route
            path={`${protectedPath}/*`}
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<div>Login Page</div>} />
          <Route path="/onboarding" element={<div>Onboarding Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const mockAuth = (user: unknown, loading = false) => {
  vi.mocked(useAuth).mockReturnValue({
    user: user as never,
    session: user ? ({} as never) : null,
    loading,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  });
};

const mockProfile = (data: unknown, isLoading = false) => {
  vi.mocked(useProfile).mockReturnValue({
    data: data as never,
    isLoading,
  } as never);
};

describe('ProtectedRoute — auth gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /auth when user is not logged in', () => {
    mockAuth(null);
    mockProfile(null);

    renderWithRouter();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('shows loading spinner while auth is loading', () => {
    mockAuth(null, true);
    mockProfile(null);

    const { container } = renderWithRouter();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows loading spinner while profile is loading', () => {
    mockAuth({ id: 'user-1' });
    mockProfile(null, true);

    const { container } = renderWithRouter();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});

describe('ProtectedRoute — onboarding gate (Wave 7 P44)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth({ id: 'user-1' });
  });

  it('renders children when onboarding_step is "completed"', () => {
    mockProfile({ onboarding_step: 'completed' });

    renderWithRouter();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /onboarding when onboarding_step is "not_started"', () => {
    mockProfile({ onboarding_step: 'not_started' });

    renderWithRouter();
    expect(screen.getByText('Onboarding Page')).toBeInTheDocument();
  });

  it('redirects to /onboarding when onboarding_step is mid-flow (e.g. "batch_capture")', () => {
    mockProfile({ onboarding_step: 'batch_capture' });

    renderWithRouter();
    expect(screen.getByText('Onboarding Page')).toBeInTheDocument();
  });

  it('falls back to legacy preferences.onboarding.completed=true when onboarding_step is undefined (pre-migration deploy window)', () => {
    // Frontend ships before `npx supabase db push --linked --yes` applies
    // the migration on the backend. During that window the column doesn't
    // exist on the profile row, so `step` is undefined. The gate must trust
    // the legacy flag for already-completed users — otherwise they'd
    // redirect-loop with the OLD Onboarding.tsx page.
    mockProfile({ preferences: { onboarding: { completed: true } } });

    renderWithRouter();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /onboarding when onboarding_step is undefined AND legacy flag is also incomplete', () => {
    // Pre-migration window, user has never finished onboarding under either
    // schema → must traverse onboarding flow.
    mockProfile({ preferences: { onboarding: { completed: false } } });

    renderWithRouter();
    expect(screen.getByText('Onboarding Page')).toBeInTheDocument();
  });

  it('redirects to /onboarding when onboarding_step is undefined AND profile has no preferences', () => {
    // Pre-migration window, brand-new user with empty preferences → redirect.
    mockProfile({ preferences: null });

    renderWithRouter();
    expect(screen.getByText('Onboarding Page')).toBeInTheDocument();
  });

  it('renders children at /onboarding even when step is not completed (path is exempt)', () => {
    mockProfile({ onboarding_step: 'quiz' });

    renderWithRouter({
      initialPath: '/onboarding',
      protectedPath: '/onboarding',
    });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children at /share/abc-123 (deep-link exempt) when onboarding incomplete', () => {
    mockProfile({ onboarding_step: 'not_started' });

    renderWithRouter({
      initialPath: '/share/abc-123',
      protectedPath: '/share',
    });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children at /billing/success when onboarding incomplete', () => {
    mockProfile({ onboarding_step: 'photo_tutorial' });

    renderWithRouter({
      initialPath: '/billing/success',
      protectedPath: '/billing',
    });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children at /u/borna (public profile) when onboarding incomplete', () => {
    mockProfile({ onboarding_step: 'not_started' });

    renderWithRouter({
      initialPath: '/u/borna',
      protectedPath: '/u',
    });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});

describe('isOnboardingExempt — pathname matcher', () => {
  it('matches each exempt path exactly', () => {
    for (const p of ONBOARDING_EXEMPT_PATHS) {
      expect(isOnboardingExempt(p)).toBe(true);
    }
  });

  it('matches sub-paths of each exempt path', () => {
    expect(isOnboardingExempt('/onboarding/quiz')).toBe(true);
    expect(isOnboardingExempt('/auth/callback')).toBe(true);
    expect(isOnboardingExempt('/billing/success')).toBe(true);
    expect(isOnboardingExempt('/share/abc-123')).toBe(true);
    expect(isOnboardingExempt('/u/borna')).toBe(true);
  });

  it('does not match prefix-collision paths', () => {
    // /uniform should NOT be exempt because of /u — startsWith('${p}/') is required.
    expect(isOnboardingExempt('/uniform')).toBe(false);
    // /authenticated should NOT match /auth.
    expect(isOnboardingExempt('/authenticated')).toBe(false);
    // /onboardingxyz should NOT match /onboarding.
    expect(isOnboardingExempt('/onboardingxyz')).toBe(false);
  });

  it('does not match unrelated protected routes', () => {
    expect(isOnboardingExempt('/wardrobe')).toBe(false);
    expect(isOnboardingExempt('/home')).toBe(false);
    expect(isOnboardingExempt('/outfits')).toBe(false);
    expect(isOnboardingExempt('/settings')).toBe(false);
    expect(isOnboardingExempt('/ai/chat')).toBe(false);
  });

  it('handles empty/root pathname', () => {
    expect(isOnboardingExempt('/')).toBe(false);
    expect(isOnboardingExempt('')).toBe(false);
  });
});
