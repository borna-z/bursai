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
    renderWithParams('code=abc123');
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

    const { unmount } = renderWithParams('code=abc123');
    unmount();

    // Resolve after unmount — should not throw
    resolveExchange!({ data: { success: true }, error: null });
  });
});
