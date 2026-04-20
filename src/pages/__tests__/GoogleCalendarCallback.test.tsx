import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();
const searchParamsMock = vi.fn<[], [URLSearchParams]>();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useSearchParams: () => searchParamsMock(),
  };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (k: string) => ({
      'gcal.syncing': 'Syncing',
      'gcal.connecting': 'Connecting your calendar',
      'gcal.connected': 'Connected',
      'gcal.redirecting': 'Redirecting...',
      'gcal.denied': 'Access denied',
      'gcal.no_code': 'No authorization code',
      'gcal.error': 'Something went wrong',
      'gcal.something_wrong': 'Something went wrong',
      'gcal.back_settings': 'Back to settings',
    }[k] ?? k),
    locale: 'en',
  }),
}));

const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
  },
}));

vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/appUrl', () => ({ buildAppUrl: (p: string) => `https://app.test${p}` }));

import GoogleCalendarCallback from '../GoogleCalendarCallback';

function renderWithParams(params: string) {
  searchParamsMock.mockReturnValue([new URLSearchParams(params)]);
  return render(
    <MemoryRouter>
      <GoogleCalendarCallback />
    </MemoryRouter>,
  );
}

describe('GoogleCalendarCallback', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    invokeMock.mockReset();
    searchParamsMock.mockReset();
  });

  it('shows loading state while exchanging code', () => {
    // Make invoke hang forever
    invokeMock.mockReturnValue(new Promise(() => {}));
    renderWithParams('code=abc123&state=user.csrf');
    expect(screen.getByText('Connecting your calendar')).toBeInTheDocument();
    expect(screen.getByText('Syncing')).toBeInTheDocument();
  });

  it('shows error when search params contain error', async () => {
    renderWithParams('error=access_denied');
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Access denied')).toBeInTheDocument();
    });
  });

  it('shows error when no code param is present', async () => {
    renderWithParams('');
    await waitFor(() => {
      expect(screen.getByText('No authorization code')).toBeInTheDocument();
    });
  });

  it('shows error when state param is missing (CSRF protection)', async () => {
    renderWithParams('code=abc123');
    await waitFor(() => {
      // Page shows "Something went wrong" headline + same message (the
      // gcal.error fallback) when state is missing.
      expect(screen.getAllByText('Something went wrong').length).toBeGreaterThan(0);
    });
    // Edge function must NOT be invoked when state is missing.
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('passes state verbatim to the exchange_code edge function call', () => {
    invokeMock.mockReturnValue(new Promise(() => {}));
    renderWithParams('code=abc123&state=user-uuid.csrf-nonce');
    expect(invokeMock).toHaveBeenCalledWith('google_calendar_auth', {
      body: {
        action: 'exchange_code',
        code: 'abc123',
        redirect_uri: 'https://app.test/calendar/callback',
        state: 'user-uuid.csrf-nonce',
      },
    });
  });

  it('shows back to settings button on error', async () => {
    renderWithParams('error=denied');
    await waitFor(() => {
      expect(screen.getByText('Back to settings')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Back to settings'));
    expect(navigateMock).toHaveBeenCalledWith('/settings', { replace: true });
  });

  it('cleans up on unmount (cancelled flag prevents state updates)', async () => {
    // Invoke that resolves after unmount
    let resolveExchange: (v: unknown) => void;
    invokeMock.mockReturnValue(new Promise(r => { resolveExchange = r; }));

    const { unmount } = renderWithParams('code=abc123&state=user.csrf');
    unmount();

    // Resolve after unmount — should not throw
    resolveExchange!({ data: { success: true }, error: null });
  });
});
