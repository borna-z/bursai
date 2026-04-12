import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const useAuthMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (k: string) => ({
      'admin.page_views': 'Page Views',
      'admin.leads': 'Leads',
      'admin.app_clicks': 'App Clicks',
      'admin.events': 'Events',
      'admin.search_email': 'Search by email',
      'admin.email': 'Email',
      'admin.source': 'Source',
      'admin.utm': 'UTM',
      'admin.date': 'Date',
      'admin.no_leads': 'No leads found',
    }[k] ?? k),
    locale: 'en',
  }),
}));

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <div data-testid="helmet">{children}</div>,
}));

vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));

const supabaseFromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => supabaseFromMock(...args),
  },
}));

import Admin from '../marketing/Admin';

function renderAdmin() {
  return render(
    <MemoryRouter>
      <Admin />
    </MemoryRouter>,
  );
}

/** Build a chainable mock for supabase .from().select().eq().eq().single() etc. */
function buildChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(resolvedValue);
  chain.order = vi.fn().mockResolvedValue(resolvedValue);
  return chain;
}

describe('Admin page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    supabaseFromMock.mockReset();
    useAuthMock.mockReturnValue({ user: { id: 'admin-1' }, loading: false });
  });

  it('shows loading state initially', () => {
    // Make supabase hang
    supabaseFromMock.mockReturnValue(buildChain({ data: null, error: null }));
    renderAdmin();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to /auth when no user is present', async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });
    supabaseFromMock.mockReturnValue(buildChain({ data: null, error: null }));
    renderAdmin();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/auth');
    });
  });

  it('renders KPI metrics and leads table after admin auth succeeds', async () => {
    const leads = [
      { id: '1', email: 'test@example.com', source: 'organic', utm_source: null, utm_medium: null, utm_content: null, utm_campaign: null, created_at: '2026-01-01T00:00:00Z' },
    ];

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === 'user_roles') {
        return buildChain({ data: { role: 'admin' }, error: null });
      }
      if (table === 'marketing_leads') {
        return buildChain({ data: leads, error: null });
      }
      if (table === 'marketing_events') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              { event_name: 'page_view' },
              { event_name: 'page_view' },
              { event_name: 'cta_open_app_click' },
            ],
            error: null,
          }),
        };
      }
      return buildChain({ data: null, error: null });
    });

    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });
    expect(screen.getByText('Page Views')).toBeInTheDocument();
    expect(screen.getByText('App Clicks')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('redirects to / when user is not admin', async () => {
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === 'user_roles') {
        return buildChain({ data: null, error: null });
      }
      return buildChain({ data: [], error: null });
    });
    renderAdmin();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/');
    });
  });
});
