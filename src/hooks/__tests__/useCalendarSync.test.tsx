import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { mockInvoke, mockUseAuth, mockToast, mockBuildAppUrl } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockUseAuth: vi.fn(),
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  mockBuildAppUrl: vi.fn((p: string) => `https://app.test${p}`),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/appUrl', () => ({
  buildAppUrl: (...args: unknown[]) => mockBuildAppUrl(...(args as [string])),
}));

vi.mock('sonner', () => ({
  toast: mockToast,
}));

import { supabase } from '@/integrations/supabase/client';
import { useCalendarSync } from '../useCalendarSync';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

/** Simple fluent chain that supports .select().eq().eq().maybeSingle() and .single() */
function makeProfileChain(profileRow: Record<string, unknown> | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: profileRow, error: null }),
      }),
    }),
  };
}

function makeConnectionChain(connectionRow: Record<string, unknown> | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: connectionRow, error: null }),
        }),
      }),
    }),
  };
}

function wireSupabase({
  profile = null,
  connection = null,
}: {
  profile?: Record<string, unknown> | null;
  connection?: Record<string, unknown> | null;
} = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') return makeProfileChain(profile);
    if (table === 'calendar_connections') return makeConnectionChain(connection);
    if (table === 'calendar_events') {
      return {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    return makeProfileChain(null);
  });
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useCalendarSync', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    wireSupabase();
    // Replace window.location.href setter with a mock
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: 'https://app.test/' },
      writable: true,
    });
  });

  it('no-ops queries when user is null and exposes null state', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => useCalendarSync(), { wrapper });
    // Nothing should throw and defaults should hold
    expect(result.current.icsUrl).toBeNull();
    expect(result.current.lastSynced).toBeNull();
    expect(result.current.connectedProvider).toBeNull();
    expect(result.current.isSyncing).toBe(false);
  });

  it('reports ics provider when profile has an ics_url and no google connection', async () => {
    wireSupabase({
      profile: { ics_url: 'webcal://example.com/feed.ics', last_calendar_sync: '2024-01-01' },
      connection: null,
    });
    const { result } = renderHook(() => useCalendarSync(), { wrapper });
    await waitFor(() => expect(result.current.icsUrl).toBe('webcal://example.com/feed.ics'));
    expect(result.current.connectedProvider).toBe('ics');
    expect(result.current.lastSynced).toBe('2024-01-01');
  });

  it('reports google provider when a google calendar_connections row exists', async () => {
    wireSupabase({
      profile: { ics_url: null, last_calendar_sync: null },
      connection: { id: 'c1', provider: 'google', token_expires_at: null, created_at: '2024-01-01' },
    });
    const { result } = renderHook(() => useCalendarSync(), { wrapper });
    await waitFor(() => expect(result.current.connectedProvider).toBe('google'));
  });

  it('syncCalendar calls sync_ics edge function when only ICS is connected and shows a success toast', async () => {
    wireSupabase({
      profile: { ics_url: 'webcal://example.com/feed.ics', last_calendar_sync: null },
      connection: null,
    });
    mockInvoke.mockResolvedValueOnce({ data: { synced: 5 }, error: null });

    const { result } = renderHook(() => useCalendarSync(), { wrapper });
    await waitFor(() => expect(result.current.connectedProvider).toBe('ics'));

    await act(async () => {
      await result.current.syncCalendar();
    });

    expect(mockInvoke).toHaveBeenCalledWith('calendar', { body: { action: 'sync_ics' } });
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('syncCalendar calls sync_google edge function when a google connection exists', async () => {
    wireSupabase({
      profile: { ics_url: null, last_calendar_sync: null },
      connection: { id: 'c1', provider: 'google', token_expires_at: null, created_at: '2024-01-01' },
    });
    mockInvoke.mockResolvedValueOnce({ data: { synced: 3, syncWindowDays: 30 }, error: null });

    const { result } = renderHook(() => useCalendarSync(), { wrapper });
    await waitFor(() => expect(result.current.connectedProvider).toBe('google'));

    await act(async () => {
      await result.current.syncCalendar();
    });

    expect(mockInvoke).toHaveBeenCalledWith('calendar', { body: { action: 'sync_google' } });
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('google sync with synced=0 shows an info toast (no events found)', async () => {
    wireSupabase({
      profile: null,
      connection: { id: 'c1', provider: 'google', token_expires_at: null, created_at: '2024-01-01' },
    });
    mockInvoke.mockResolvedValueOnce({ data: { synced: 0, syncWindowDays: 30 }, error: null });

    const { result } = renderHook(() => useCalendarSync(), { wrapper });
    await waitFor(() => expect(result.current.connectedProvider).toBe('google'));

    await act(async () => {
      await result.current.syncCalendar();
    });

    expect(mockToast.info).toHaveBeenCalled();
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it('sync error path shows an error toast', async () => {
    wireSupabase({
      profile: { ics_url: 'webcal://example.com/feed.ics', last_calendar_sync: null },
      connection: null,
    });
    mockInvoke.mockResolvedValueOnce({ data: { error: 'boom' }, error: null });

    const { result } = renderHook(() => useCalendarSync(), { wrapper });
    await waitFor(() => expect(result.current.connectedProvider).toBe('ics'));

    await act(async () => {
      try {
        await result.current.syncCalendar();
      } catch {
        /* expected */
      }
    });

    expect(mockToast.error).toHaveBeenCalled();
  });

  it('connectGoogle asks the edge function for an auth url and redirects the browser', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { url: 'https://google.test/oauth' }, error: null });

    const { result } = renderHook(() => useCalendarSync(), { wrapper });

    await act(async () => {
      await result.current.connectGoogle();
    });

    expect(mockBuildAppUrl).toHaveBeenCalledWith('/calendar/callback');
    expect(mockInvoke).toHaveBeenCalledWith('google_calendar_auth', {
      body: { action: 'get_auth_url', redirect_uri: 'https://app.test/calendar/callback' },
    });
    expect(window.location.href).toBe('https://google.test/oauth');
  });

  it('connectGoogle shows an error toast when the edge function returns an error', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('fail') });

    const { result } = renderHook(() => useCalendarSync(), { wrapper });

    await act(async () => {
      await result.current.connectGoogle();
    });

    expect(mockToast.error).toHaveBeenCalled();
  });

  it('disconnectGoogle calls the edge function and toasts on success', async () => {
    wireSupabase({
      profile: null,
      connection: { id: 'c1', provider: 'google', token_expires_at: null, created_at: '2024-01-01' },
    });
    mockInvoke.mockResolvedValueOnce({ data: {}, error: null });

    const { result } = renderHook(() => useCalendarSync(), { wrapper });
    await waitFor(() => expect(result.current.connectedProvider).toBe('google'));

    await act(async () => {
      await result.current.disconnectGoogle();
    });

    expect(mockInvoke).toHaveBeenCalledWith('google_calendar_auth', {
      body: { action: 'disconnect' },
    });
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('removeIcsUrl deletes calendar_events and clears profile ics fields', async () => {
    const eventsDeleteEq = vi.fn().mockResolvedValue({ error: null });
    const eventsDelete = vi.fn().mockReturnValue({ eq: eventsDeleteEq });
    const profileUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const profileUpdate = vi.fn().mockReturnValue({ eq: profileUpdateEq });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ics_url: 'webcal://example.com/feed.ics', last_calendar_sync: null },
                error: null,
              }),
            }),
          }),
          update: profileUpdate,
        };
      }
      if (table === 'calendar_connections') return makeConnectionChain(null);
      if (table === 'calendar_events') return { delete: eventsDelete };
      return makeProfileChain(null);
    });

    const { result } = renderHook(() => useCalendarSync(), { wrapper });
    await waitFor(() => expect(result.current.icsUrl).toBe('webcal://example.com/feed.ics'));

    await act(async () => {
      await result.current.removeIcsUrl();
    });

    expect(profileUpdate).toHaveBeenCalledWith({ ics_url: null, last_calendar_sync: null });
    expect(eventsDelete).toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalled();
  });
});
