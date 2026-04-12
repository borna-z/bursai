import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { useAuthMock, useLanguageMock, supabaseFromMock, toastMock, loggerWarnMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useLanguageMock: vi.fn(),
  supabaseFromMock: vi.fn(),
  toastMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: useAuthMock }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: useLanguageMock }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: supabaseFromMock },
}));
vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('@/lib/logger', () => ({
  logger: { warn: loggerWarnMock, error: vi.fn(), info: vi.fn() },
}));

import { useFeedbackSignals } from '../useFeedbackSignals';

function wrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useFeedbackSignals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } });
    useLanguageMock.mockReturnValue({ t: (k: string) => k });
  });

  it('does not call supabase when user is null', () => {
    useAuthMock.mockReturnValue({ user: null });
    const insertMock = vi.fn();
    supabaseFromMock.mockReturnValue({ insert: insertMock });

    const { result } = renderHook(() => useFeedbackSignals(), { wrapper: wrapper() });
    act(() => {
      result.current.record({ signal_type: 'save' });
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('inserts a feedback row on success', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    supabaseFromMock.mockReturnValue({ insert: insertMock });

    const { result } = renderHook(() => useFeedbackSignals(), { wrapper: wrapper() });
    act(() => {
      result.current.record({ signal_type: 'save', outfit_id: 'o1' });
    });
    await waitFor(() => expect(insertMock).toHaveBeenCalled());
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: 'user-1',
        signal_type: 'save',
        outfit_id: 'o1',
      }),
    ]);
  });

  it('shows toast on wear_confirm signal', async () => {
    supabaseFromMock.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) });
    const { result } = renderHook(() => useFeedbackSignals(), { wrapper: wrapper() });
    act(() => {
      result.current.record({ signal_type: 'wear_confirm' });
    });
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('feedback.wear_noted', expect.any(Object)));
  });

  it('logs warning when supabase insert returns error', async () => {
    supabaseFromMock.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { message: 'db down' } }),
    });
    const { result } = renderHook(() => useFeedbackSignals(), { wrapper: wrapper() });
    act(() => {
      result.current.record({ signal_type: 'ignore' });
    });
    await waitFor(() => expect(loggerWarnMock).toHaveBeenCalled());
  });
});
