import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { mockInvoke, mockUseAuth, mockIsMedianApp, mockLogger, mockSupabaseFrom } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockUseAuth: vi.fn(),
  mockIsMedianApp: vi.fn(() => false),
  mockLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  mockSupabaseFrom: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockSupabaseFrom(...args) },
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

vi.mock('@/lib/median', () => ({
  isMedianApp: (...args: unknown[]) => mockIsMedianApp(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import { usePushNotifications } from '../usePushNotifications';

// Minimal PushSubscription mock builder
function makeSubscription(overrides: Partial<{ endpoint: string; keys: { p256dh: string; auth: string } }> = {}) {
  const sub = {
    endpoint: overrides.endpoint ?? 'https://push.test/abc',
    unsubscribe: vi.fn().mockResolvedValue(true),
    toJSON: () => ({
      endpoint: overrides.endpoint ?? 'https://push.test/abc',
      keys: overrides.keys ?? { p256dh: 'p256dh-key', auth: 'auth-key' },
    }),
  };
  return sub;
}

describe('usePushNotifications', () => {
  let requestPermissionMock: ReturnType<typeof vi.fn>;
  let getSubscriptionMock: ReturnType<typeof vi.fn>;
  let subscribeMock: ReturnType<typeof vi.fn>;
  let getRegistrationMock: ReturnType<typeof vi.fn>;
  let registerMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    mockIsMedianApp.mockReturnValue(false);

    // Default supabase upsert/delete builder
    mockSupabaseFrom.mockImplementation(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }));

    // Notification global
    requestPermissionMock = vi.fn().mockResolvedValue('granted');
    const NotificationMock = vi.fn() as unknown as typeof Notification;
    (NotificationMock as unknown as { permission: NotificationPermission }).permission = 'default';
    (NotificationMock as unknown as { requestPermission: typeof Notification.requestPermission }).requestPermission = requestPermissionMock;
    (globalThis as unknown as { Notification: typeof Notification }).Notification = NotificationMock;

    // navigator.serviceWorker
    getSubscriptionMock = vi.fn().mockResolvedValue(null);
    subscribeMock = vi.fn().mockResolvedValue(makeSubscription());
    const registration = {
      pushManager: {
        getSubscription: getSubscriptionMock,
        subscribe: subscribeMock,
      },
    };
    getRegistrationMock = vi.fn().mockResolvedValue(registration);
    registerMock = vi.fn().mockResolvedValue(registration);

    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: getRegistrationMock,
        register: registerMock,
        ready: Promise.resolve(registration),
      },
    });

    // PushManager presence for support detection
    (globalThis as unknown as { PushManager: unknown }).PushManager = class {};
    // window.atob
    (globalThis as unknown as { atob: (s: string) => string }).atob = (s: string) =>
      Buffer.from(s, 'base64').toString('binary');
  });

  afterEach(() => {
    delete (globalThis as unknown as { PushManager?: unknown }).PushManager;
  });

  it('mirrors Notification.permission into initial state', () => {
    (globalThis.Notification as unknown as { permission: NotificationPermission }).permission = 'granted';
    const { result } = renderHook(() => usePushNotifications());
    expect(result.current.permission).toBe('granted');
  });

  it('marks itself supported when service worker + PushManager + Notification exist', async () => {
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.supported).toBe(true));
  });

  it('subscribe returns false and does not register when user is null', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.supported).toBe(true));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.subscribe();
    });
    expect(ok).toBe(false);
    expect(requestPermissionMock).not.toHaveBeenCalled();
  });

  it('subscribe aborts and returns false when permission is denied', async () => {
    requestPermissionMock.mockResolvedValueOnce('denied');
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.supported).toBe(true));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.subscribe();
    });

    expect(requestPermissionMock).toHaveBeenCalled();
    expect(subscribeMock).not.toHaveBeenCalled();
    expect(ok).toBe(false);
    expect(result.current.permission).toBe('denied');
    expect(result.current.isSubscribed).toBe(false);
  });

  it('subscribe happy path: requests permission, fetches vapid key, subscribes, persists to supabase', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { publicKey: 'BPublicKey' }, error: null });
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseFrom.mockImplementation(() => ({
      upsert: upsertMock,
      delete: vi.fn(),
    }));

    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.supported).toBe(true));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.subscribe();
    });

    expect(mockInvoke).toHaveBeenCalledWith('get_vapid_public_key');
    expect(subscribeMock).toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        endpoint: 'https://push.test/abc',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      }),
      expect.any(Object),
    );
    expect(ok).toBe(true);
    expect(result.current.isSubscribed).toBe(true);
  });

  it('subscribe returns false and logs when VAPID key is missing', async () => {
    mockInvoke.mockResolvedValueOnce({ data: {}, error: null });

    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.supported).toBe(true));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.subscribe();
    });

    expect(ok).toBe(false);
    expect(mockLogger.error).toHaveBeenCalled();
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it('unsubscribe removes the subscription and deletes the supabase row', async () => {
    const existing = makeSubscription();
    getSubscriptionMock.mockResolvedValue(existing);
    const deleteEq2 = vi.fn().mockResolvedValue({ error: null });
    const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 });
    const deleteFn = vi.fn().mockReturnValue({ eq: deleteEq1 });
    mockSupabaseFrom.mockImplementation(() => ({
      upsert: vi.fn(),
      delete: deleteFn,
    }));

    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.supported).toBe(true));

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(existing.unsubscribe).toHaveBeenCalled();
    expect(deleteFn).toHaveBeenCalled();
    expect(result.current.isSubscribed).toBe(false);
  });

  it('unsubscribe is a no-op when user is null', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.supported).toBe(true));

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(getRegistrationMock).not.toHaveBeenCalled();
  });

  it('in Median app: marks supported + subscribed and delegates subscribe to native bridge', async () => {
    mockIsMedianApp.mockReturnValue(true);
    const registerNative = vi.fn();
    (window as unknown as { median: unknown }).median = {
      onesignal: { register: registerNative },
    };

    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.supported).toBe(true));
    expect(result.current.isSubscribed).toBe(true);

    await act(async () => {
      await result.current.subscribe();
    });
    expect(registerNative).toHaveBeenCalled();
    // Should not touch the web push flow
    expect(subscribeMock).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();

    delete (window as unknown as { median?: unknown }).median;
  });
});
