import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const {
  navigateMock,
  useAuthMock,
  useGarmentCountMock,
  useGarmentsByIdsMock,
  useStyleDNAMock,
  createOutfitMutateAsync,
  toastErrorMock,
  toastSuccessMock,
  chatHistorySheetMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  useAuthMock: vi.fn(),
  useGarmentCountMock: vi.fn(),
  useGarmentsByIdsMock: vi.fn(),
  useStyleDNAMock: vi.fn(),
  createOutfitMutateAsync: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  chatHistorySheetMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: '/ai/chat', search: '', state: null }),
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('@/hooks/useGarments', () => ({
  useGarmentCount: () => useGarmentCountMock(),
}));

vi.mock('@/hooks/useGarmentsByIds', () => ({
  useGarmentsByIds: () => useGarmentsByIdsMock(),
}));

vi.mock('@/hooks/useStyleDNA', () => ({
  useStyleDNA: () => useStyleDNAMock(),
}));

vi.mock('@/hooks/useOutfits', () => ({
  useCreateOutfit: () => ({ mutateAsync: createOutfitMutateAsync, isPending: false }),
}));

// Lightweight, non-recursive supabase mock.
vi.mock('@/integrations/supabase/client', () => {
  const makeQuery = () => {
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = () => q;
    q.like = () => q;
    q.order = () => q;
    q.limit = () => Promise.resolve({ data: [], error: null });
    q.insert = () => Promise.resolve({ data: null, error: null });
    q.delete = () => {
      const d: Record<string, unknown> = {};
      d.eq = () => d;
      d.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
      return d;
    };
    return q;
  };
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
      },
      from: vi.fn(() => makeQuery()),
      storage: {
        from: () => ({
          upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example/blob' } }),
        }),
      },
    },
    getSupabaseFunctionUrl: (name: string) => `https://test/${name}`,
    createSupabaseRestHeaders: vi.fn().mockResolvedValue({}),
  };
});

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PageErrorBoundary', () => ({
  PageErrorBoundary: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/components/chat/ChatWelcome', () => ({
  ChatWelcome: () => <div data-testid="chat-welcome">welcome</div>,
}));

vi.mock('@/components/chat/ChatMessage', () => ({
  ChatMessage: () => <div data-testid="chat-message">msg</div>,
}));

vi.mock('@/components/chat/ChatInput', () => ({
  ChatInput: () => <div data-testid="chat-input">input</div>,
}));

vi.mock('@/components/chat/ChatHistorySheet', () => ({
  ChatHistorySheet: (props: { threads: Array<{ mode: string; title: string; preview: string }> }) => {
    chatHistorySheetMock(props);
    return <div data-testid="chat-history-sheet">history</div>;
  },
}));

vi.mock('@/components/ui/skeletons', () => ({
  ChatPageSkeleton: () => <div data-testid="chat-skeleton">loading</div>,
}));

vi.mock('@/components/ui/StylistReplyPlaceholder', () => ({
  StylistReplyPlaceholder: () => <div data-testid="stylist-placeholder">typing</div>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock('sonner', () => ({ toast: { error: toastErrorMock, success: toastSuccessMock } }));
vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import AIChat from '../AIChat';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ai/chat']}>
      <AIChat />
    </MemoryRouter>,
  );
}

describe('AIChat page', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    navigateMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
    chatHistorySheetMock.mockReset();
    createOutfitMutateAsync.mockReset();
    useAuthMock.mockReturnValue({ user: { id: 'u1' } });
    useGarmentCountMock.mockReturnValue({ data: 12 });
    useGarmentsByIdsMock.mockReturnValue({ data: [] });
    useStyleDNAMock.mockReturnValue({ data: { archetype: 'minimal' } });
    try { localStorage.clear(); } catch { /* ignore */ }
  });

  it('renders the chat skeleton on initial load', () => {
    renderPage();
    expect(screen.getByTestId('chat-skeleton')).toBeInTheDocument();
  });

  it('renders welcome state after messages have loaded', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('chat-welcome')).toBeInTheDocument());
  });

  it('renders the chat input below the welcome state', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('chat-welcome')).toBeInTheDocument());
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  it('renders the clear history menu action', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('chat-welcome')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /chat\.clear_history/i })).toBeInTheDocument();
  });

  it('resolves loading immediately when there is no user', async () => {
    useAuthMock.mockReturnValue({ user: null });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('chat-welcome')).toBeInTheDocument());
  });

  it('renders the stylist mode label in the top bar', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('chat.mode_stylist')).toBeInTheDocument());
  });

  it('keeps local in-progress chats visible in past chat history', async () => {
    localStorage.setItem(
      'burs_chat_history:stylist:local-draft',
      JSON.stringify([
        { role: 'assistant', content: 'chat.welcome' },
        { role: 'user', content: 'Find me a date night outfit' },
      ]),
    );
    localStorage.setItem(
      'burs_chat_thread_meta',
      JSON.stringify({ 'stylist:local-draft': '2026-04-15T10:00:00.000Z' }),
    );

    renderPage();

    await waitFor(() => {
      expect(chatHistorySheetMock).toHaveBeenLastCalledWith(expect.objectContaining({
        threads: expect.arrayContaining([
          expect.objectContaining({
            mode: 'stylist:local-draft',
            title: 'Find me a date night outfit',
          }),
        ]),
      }));
    });
  });
});
