import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/lib/offlineQueue', () => ({
  getQueueLength: vi.fn(() => 0),
  hydrateQueueSummary: vi.fn(async () => 0),
  replayQueue: vi.fn(async () => 0),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (k: string) => k, locale: 'en' })),
}));

import { getQueueLength, replayQueue } from '@/lib/offlineQueue';
import { toast } from 'sonner';

describe('useOfflineQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('tracks initial online state', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    const { useOfflineQueue } = await import('../useOfflineQueue');
    const { result } = renderHook(() => useOfflineQueue());
    expect(result.current.isOffline).toBe(false);
  });

  it('goes offline when offline event fires', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    const { useOfflineQueue } = await import('../useOfflineQueue');
    const { result } = renderHook(() => useOfflineQueue());

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOffline).toBe(true);
  });

  it('replays queue when coming back online', async () => {
    vi.mocked(getQueueLength).mockReturnValue(2);
    vi.mocked(replayQueue).mockResolvedValue(2);

    const { useOfflineQueue } = await import('../useOfflineQueue');
    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
      window.dispatchEvent(new Event('online'));
    });

    expect(replayQueue).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('offline.synced_changes');
  });

  it('tracks queue count via custom event', async () => {
    const { useOfflineQueue } = await import('../useOfflineQueue');
    const { result } = renderHook(() => useOfflineQueue());

    act(() => {
      window.dispatchEvent(new CustomEvent('offline-queue-change', { detail: { count: 3 } }));
    });

    await waitFor(() => {
      expect(result.current.queueCount).toBe(3);
    });
  });
});
