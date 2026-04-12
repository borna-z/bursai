import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { navigateMock, useSubscriptionMock, useAuthMock, useOutfitMock, useWeatherMock, toastErrorMock, fetchMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  useSubscriptionMock: vi.fn(),
  useAuthMock: vi.fn(),
  useOutfitMock: vi.fn(),
  useWeatherMock: vi.fn(),
  toastErrorMock: vi.fn(),
  fetchMock: vi.fn(),
}));

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

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => useSubscriptionMock(),
}));

vi.mock('@/hooks/useOutfits', () => ({
  useOutfit: () => useOutfitMock(),
}));

vi.mock('@/hooks/useWeather', () => ({
  useWeather: () => useWeatherMock(),
}));

vi.mock('@/integrations/supabase/client', () => {
  const insertSelectSingle = vi.fn().mockResolvedValue({ data: { id: 'outfit-xyz' }, error: null });
  const insert = vi.fn(() => ({ select: () => ({ single: insertSelectSingle }) }));
  const insert2 = vi.fn().mockResolvedValue({ data: null, error: null });
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
      },
      from: vi.fn((table: string) => {
        if (table === 'outfits') return { insert };
        return { insert: insert2 };
      }),
    },
    createSupabaseRestHeaders: vi.fn().mockResolvedValue({ apikey: 'k', Authorization: 'Bearer tok' }),
    getSupabaseFunctionUrl: (name: string) => `https://test/${name}`,
  };
});

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children, className }: PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/OutfitPreviewCard', () => ({
  OutfitPreviewCard: () => <div data-testid="preview">preview</div>,
}));

vi.mock('@/components/PaywallModal', () => ({
  PaywallModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="paywall">paywall</div> : null,
}));

vi.mock('sonner', () => ({ toast: { error: toastErrorMock, success: vi.fn() } }));
vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/styleFlowState', () => ({
  buildStyleFlowSearch: () => '?ids=a',
}));

import MoodOutfitPage from '../MoodOutfit';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ai/mood']}>
      <MoodOutfitPage />
    </MemoryRouter>,
  );
}

function makeSseResponse(obj: Record<string, unknown>) {
  const encoder = new TextEncoder();
  const chunks = [
    `data: ${JSON.stringify(obj)}\n`,
    `data: [DONE]\n`,
  ];
  return {
    ok: true,
    body: {
      getReader: () => {
        let i = 0;
        return {
          read: () =>
            i < chunks.length
              ? Promise.resolve({ done: false, value: encoder.encode(chunks[i++]) })
              : Promise.resolve({ done: true, value: undefined }),
        };
      },
    },
  };
}

describe('MoodOutfit page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    toastErrorMock.mockReset();
    fetchMock.mockReset();
    useSubscriptionMock.mockReturnValue({ isPremium: true });
    useAuthMock.mockReturnValue({ user: { id: 'u1' } });
    useOutfitMock.mockReturnValue({ data: null });
    useWeatherMock.mockReturnValue({ weather: { temperature: 18, precipitation: 'none' } });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('renders the mood selection grid', () => {
    renderPage();
    expect(screen.getByText('How are you feeling?')).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(5);
  });

  it('shows the paywall when not premium and a mood is tapped', () => {
    useSubscriptionMock.mockReturnValue({ isPremium: false });
    renderPage();
    const firstMood = screen.getByText('ai.mood_confident');
    fireEvent.click(firstMood.closest('button')!);
    expect(screen.getByTestId('paywall')).toBeInTheDocument();
  });

  it('renders the generated outfit view after a successful response', async () => {
    fetchMock.mockResolvedValueOnce(
      makeSseResponse({ items: [{ garment_id: 'g1', slot: 'top' }], explanation: 'Balanced.' }),
    );

    renderPage();
    fireEvent.click(screen.getByText('ai.mood_confident').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText(/Your look is ready/i)).toBeInTheDocument();
    });
    expect(screen.getByTestId('preview')).toBeInTheDocument();
  });

  it('shows a toast when the stream returns an error field', async () => {
    fetchMock.mockResolvedValueOnce(makeSseResponse({ error: 'boom' }));
    renderPage();
    fireEvent.click(screen.getByText('ai.mood_confident').closest('button')!);
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
  });

  it('navigates to the outfit detail from the View outfit button', async () => {
    fetchMock.mockResolvedValueOnce(
      makeSseResponse({ items: [{ garment_id: 'g1', slot: 'top' }], explanation: 'Calm.' }),
    );

    renderPage();
    fireEvent.click(screen.getByText('ai.mood_confident').closest('button')!);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /view outfit/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /view outfit/i }));
    expect(navigateMock).toHaveBeenCalledWith('/outfits/outfit-xyz');
  });
});
