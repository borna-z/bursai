import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();
const useAuthMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => getSessionMock(),
    },
  },
}));

vi.mock('@/components/layout/PageSkeleton', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton">loading</div>,
}));

import Index from '../Index';

function renderIndex() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Index />
    </MemoryRouter>,
  );
}

describe('Index route dispatcher', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>;
  let originalLocation: Location;
  let replaceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigateMock.mockReset();
    useAuthMock.mockReset();
    getSessionMock.mockReset();

    matchMediaMock = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: matchMediaMock,
    });

    // Stub window.location.replace
    originalLocation = window.location;
    replaceMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, replace: replaceMock },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('renders the page skeleton while auth is loading and does not redirect', () => {
    useAuthMock.mockReturnValue({ user: null, loading: true });
    getSessionMock.mockResolvedValue({ data: { session: null } });

    const { getByTestId } = renderIndex();

    expect(getByTestId('page-skeleton')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('redirects authenticated users straight to /home', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1' }, loading: false });
    getSessionMock.mockResolvedValue({ data: { session: null } });

    renderIndex();

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/home', { replace: true });
    });
  });

  it('double-checks supabase session and redirects to /home when a stale session is found', async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'u2' } } } });

    renderIndex();

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/home', { replace: true });
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated PWA users to /auth', async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });
    getSessionMock.mockResolvedValue({ data: { session: null } });
    matchMediaMock.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    renderIndex();

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/auth', { replace: true });
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated browser users to the marketing site', async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });
    getSessionMock.mockResolvedValue({ data: { session: null } });

    renderIndex();

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('https://burs.me');
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('always renders the PageSkeleton while making its decision', () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });
    getSessionMock.mockResolvedValue({ data: { session: null } });

    const { getByTestId } = renderIndex();
    expect(getByTestId('page-skeleton')).toBeInTheDocument();
  });
});
