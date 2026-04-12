import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const navigateMock = vi.fn();
const useInsightsMock = vi.fn();
const useWeatherMock = vi.fn();
const useAuthMock = vi.fn();
const invokeEdgeFunctionMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/hooks/useInsights', () => ({
  useInsights: () => useInsightsMock(),
}));

vi.mock('@/hooks/useWeather', () => ({
  useWeather: () => useWeatherMock(),
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: (...args: unknown[]) => invokeEdgeFunctionMock(...args),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: () => ({
        in: () => Promise.resolve({
          data: [
            { id: 'g1', title: 'Old coat', category: 'outerwear', color_primary: 'beige', image_url: null },
            { id: 'g2', title: 'Rare shirt', category: 'top', color_primary: 'white', image_url: null },
          ],
          error: null,
        }),
      }),
      insert: (rows: unknown) => {
        const payload = Array.isArray(rows) ? rows[0] : rows;
        if (payload && typeof payload === 'object' && 'user_id' in payload) {
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'outfit-new' }, error: null }),
            }),
          };
        }
        return Promise.resolve({ data: null, error: null });
      },
    })),
  },
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <div><h1>{title}</h1>{actions}</div>
  ),
}));

vi.mock('@/components/layout/EmptyState', () => ({
  EmptyState: ({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      {action ? <button onClick={action.onClick}>{action.label}</button> : null}
    </div>
  ),
}));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children, className }: PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/AILoadingOverlay', () => ({
  AILoadingOverlay: () => <div data-testid="ai-loading">loading</div>,
}));

vi.mock('@/components/ui/lazy-image', () => ({
  LazyImageSimple: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));
vi.mock('@/lib/occasionLabel', () => ({ getOccasionLabel: (x: string) => x }));
vi.mock('@/lib/garmentImage', () => ({ getPreferredGarmentImagePath: () => null }));
vi.mock('@/lib/stripBrands', () => ({ stripBrands: (s: string) => s }));

import UnusedOutfits from '../UnusedOutfits';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/insights/unused']}>
        <UnusedOutfits />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('UnusedOutfits page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    invokeEdgeFunctionMock.mockReset();
    useAuthMock.mockReturnValue({ user: { id: 'u1' } });
    useWeatherMock.mockReturnValue({ weather: { temperature: 15, precipitation: 'none', wind: 'low' } });
  });

  it('renders the editorial heading', () => {
    useInsightsMock.mockReturnValue({ data: { unusedGarments: [] } });
    renderPage();
    expect(screen.getByText(/Rediscover these looks/i)).toBeInTheDocument();
  });

  it('shows the AI loading card while generating outfits', async () => {
    useInsightsMock.mockReturnValue({ data: { unusedGarments: [{ id: 'g1' }] } });
    // Never resolve so the loading state stays visible
    invokeEdgeFunctionMock.mockImplementation(() => new Promise(() => {}));

    renderPage();
    expect(await screen.findByTestId('ai-loading')).toBeInTheDocument();
  });

  it('renders the error empty-state when no outfits come back', async () => {
    useInsightsMock.mockReturnValue({ data: { unusedGarments: [{ id: 'g1' }] } });
    invokeEdgeFunctionMock.mockResolvedValue({ data: { items: [] }, error: null });

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('does not call the edge function when there are no unused garments', () => {
    useInsightsMock.mockReturnValue({ data: { unusedGarments: [] } });
    renderPage();
    expect(invokeEdgeFunctionMock).not.toHaveBeenCalled();
  });
});
