import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null subscription when user is not logged in', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    expect(result.current.subscription).toBeUndefined();
    expect(result.current.plan).toBe('free');
    expect(result.current.isPremium).toBe(false);
  });

  it('returns free plan limits correctly', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', email: 'test@test.com' } as any,
      session: {} as any,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'sub-1',
            user_id: 'user-1',
            plan: 'free',
            garments_count: 5,
            outfits_used_month: 3,
            period_start: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });

    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    waitFor(() => {
      expect(result.current.plan).toBe('free');
      expect(result.current.isPremium).toBe(false);
      expect(result.current.canAddGarment()).toBe(true);
      expect(result.current.canCreateOutfit()).toBe(true);
      expect(result.current.remainingGarments()).toBe(5);
      expect(result.current.remainingOutfits()).toBe(7);
    });
  });

  it('has correct plan limits defined', () => {
    expect(PLAN_LIMITS.free.maxGarments).toBe(10);
    expect(PLAN_LIMITS.free.maxOutfitsPerMonth).toBe(10);
    expect(PLAN_LIMITS.premium.maxGarments).toBe(Infinity);
    expect(PLAN_LIMITS.premium.maxOutfitsPerMonth).toBe(Infinity);
  });

  it('premium users have unlimited access', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', email: 'test@test.com' } as any,
      session: {} as any,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'sub-1',
            user_id: 'user-1',
            plan: 'premium',
            garments_count: 100,
            outfits_used_month: 50,
            period_start: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });

    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    waitFor(() => {
      expect(result.current.isPremium).toBe(true);
      expect(result.current.canAddGarment()).toBe(true);
      expect(result.current.canCreateOutfit()).toBe(true);
      expect(result.current.remainingGarments()).toBe(Infinity);
      expect(result.current.remainingOutfits()).toBe(Infinity);
    });
  });

  it('free plan blocks when at garment limit', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', email: 'test@test.com' } as any,
      session: {} as any,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'sub-1',
            user_id: 'user-1',
            plan: 'free',
            garments_count: 10,
            outfits_used_month: 10,
            period_start: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });

    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(),
    });

    waitFor(() => {
      expect(result.current.canAddGarment()).toBe(false);
      expect(result.current.canCreateOutfit()).toBe(false);
      expect(result.current.remainingGarments()).toBe(0);
      expect(result.current.remainingOutfits()).toBe(0);
    });
  });
});
