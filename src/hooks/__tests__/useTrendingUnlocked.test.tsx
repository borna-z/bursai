import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '@/integrations/supabase/client';
import { useTrendingUnlocked } from '../useTrendingUnlocked';

const SEEN_KEY = 'burs_trending_unlocked_seen';

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

function mockCount(count: number) {
  const select = vi.fn().mockResolvedValue({ count, error: null });
  vi.mocked(supabase.from).mockReturnValue({ select } as never);
}

describe('useTrendingUnlocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns 0 totalUsers and locked initially', () => {
    mockCount(0);
    const { result } = renderHook(() => useTrendingUnlocked(), { wrapper: createWrapper() });
    expect(result.current.totalUsers).toBe(0);
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.threshold).toBe(500);
  });

  it('reflects fetched user count and unlocks when threshold is met', async () => {
    mockCount(600);
    const { result } = renderHook(() => useTrendingUnlocked(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.totalUsers).toBe(600));
    expect(result.current.isUnlocked).toBe(true);
    expect(result.current.showNewBadge).toBe(true);
  });

  it('stays locked just below threshold', async () => {
    mockCount(499);
    const { result } = renderHook(() => useTrendingUnlocked(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.totalUsers).toBe(499));
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.showNewBadge).toBe(false);
  });

  it('hides the badge when seen flag is set in localStorage', async () => {
    localStorage.setItem(SEEN_KEY, 'true');
    mockCount(1000);
    const { result } = renderHook(() => useTrendingUnlocked(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.totalUsers).toBe(1000));
    expect(result.current.showNewBadge).toBe(false);
  });

  it('markSeen writes to localStorage', () => {
    mockCount(0);
    const { result } = renderHook(() => useTrendingUnlocked(), { wrapper: createWrapper() });
    act(() => {
      result.current.markSeen();
    });
    expect(localStorage.getItem(SEEN_KEY)).toBe('true');
  });
});
