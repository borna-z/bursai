import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type React from 'react';

const loadStyleChatMessagesMock = vi.fn();
const persistStyleChatMessagesMock = vi.fn();
const deleteStyleChatHistoryMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const recordSignalMock = vi.fn();
const createOutfitMock = vi.fn();
const mockUser = { id: 'user-1' };

const translations: Record<string, string> = {
  'chat.welcome': 'Welcome back',
  'chat.clear_history': 'Clear history',
  'chat.history_cleared': 'Conversation history cleared',
  'chat.history_error': 'Could not clear history',
  'chat.mode_stylist': 'Stylist',
};
const languageContextValue = {
  locale: 'en',
  t: (key: string) => translations[key] ?? key,
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(),
      })),
    },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => languageContextValue,
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/PageErrorBoundary', () => ({
  PageErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/skeletons', () => ({
  ChatPageSkeleton: () => <div data-testid="chat-skeleton" />,
}));

vi.mock('@/components/ui/StylistReplyPlaceholder', () => ({
  StylistReplyPlaceholder: () => <div data-testid="stylist-placeholder" />,
}));

vi.mock('@/components/chat/ChatMessage', () => ({
  ChatMessage: ({ message }: { message: { content: string | { text: string }[] } }) => (
    <div>{typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}</div>
  ),
}));

vi.mock('@/components/chat/ChatWelcome', () => ({
  ChatWelcome: () => <div>Chat welcome</div>,
}));

vi.mock('@/components/chat/ChatInput', () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
}));

vi.mock('@/hooks/useGarmentsByIds', () => ({
  useGarmentsByIds: () => ({ data: [] }),
}));

vi.mock('@/hooks/useGarments', () => ({
  useGarmentCount: () => ({ data: 0 }),
}));

vi.mock('@/hooks/useStyleDNA', () => ({
  useStyleDNA: () => ({ data: null }),
}));

vi.mock('@/hooks/useOutfits', () => ({
  useCreateOutfit: () => ({ mutateAsync: createOutfitMock }),
}));

vi.mock('@/hooks/useFeedbackSignals', () => ({
  useFeedbackSignals: () => ({ record: recordSignalMock }),
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunctionStream: vi.fn(),
}));

vi.mock('@/lib/styleChatRequest', () => ({
  buildStyleChatRequest: vi.fn(() => ({ messages: [], conversationSummary: null })),
}));

vi.mock('@/lib/styleChatHistory', () => ({
  loadStyleChatMessages: (...args: unknown[]) => loadStyleChatMessagesMock(...args),
  persistStyleChatMessages: (...args: unknown[]) => persistStyleChatMessagesMock(...args),
  deleteStyleChatHistory: (...args: unknown[]) => deleteStyleChatHistoryMock(...args),
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

import AIChat from '../AIChat';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AIChat />
    </MemoryRouter>,
  );
}

describe('AIChat clear history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    loadStyleChatMessagesMock.mockResolvedValue([
      { role: 'user', content: 'Style these trousers' },
      { role: 'assistant', content: 'Saved assistant reply' },
    ]);
    deleteStyleChatHistoryMock.mockResolvedValue(undefined);
  });

  it('clears persisted history and resets to the welcome state after a successful delete', async () => {
    sessionStorage.setItem('burs_chat_history', JSON.stringify([{ role: 'assistant', content: 'Cached reply' }]));

    renderPage();

    await screen.findByText('Saved assistant reply');
    fireEvent.click(screen.getByRole('button', { name: /clear history/i }));

    await waitFor(() => {
      expect(deleteStyleChatHistoryMock).toHaveBeenCalledWith(expect.anything(), 'user-1');
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Conversation history cleared');
    });

    expect(sessionStorage.getItem('burs_chat_history')).toBeNull();
    expect(screen.queryByText('Saved assistant reply')).not.toBeInTheDocument();
    expect(screen.getByText('Chat welcome')).toBeInTheDocument();
  });

  it('keeps the current chat visible when clearing history fails', async () => {
    deleteStyleChatHistoryMock.mockRejectedValue(new Error('permission denied'));

    renderPage();

    await screen.findByText('Saved assistant reply');
    fireEvent.click(screen.getByRole('button', { name: /clear history/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Could not clear history');
    });

    expect(screen.getByText('Saved assistant reply')).toBeInTheDocument();
    expect(screen.queryByText('Chat welcome')).not.toBeInTheDocument();
  });

  it('prevents duplicate clear-history requests while the delete is in flight', async () => {
    const deferredDelete = createDeferred<void>();
    deleteStyleChatHistoryMock.mockReturnValue(deferredDelete.promise);

    renderPage();

    await screen.findByText('Saved assistant reply');
    const clearButton = screen.getByRole('button', { name: /clear history/i });

    fireEvent.click(clearButton);
    fireEvent.click(clearButton);

    expect(deleteStyleChatHistoryMock).toHaveBeenCalledTimes(1);
    expect(clearButton).toBeDisabled();

    deferredDelete.resolve();

    await waitFor(() => {
      expect(clearButton).not.toBeDisabled();
    });
  });
});
