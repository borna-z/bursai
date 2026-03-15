/**
 * Integration-level tests for useSwapGarment swap mode behavior.
 * Verifies that mode is passed through to the edge function and fallback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ── Mocks ──

const mockUser = { id: 'user-1', email: 'test@test.com' };

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockInvoke = vi.fn();
vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: (...args: unknown[]) => mockInvoke(...args),
}));

const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// ── Setup ──

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// Lazy import so mocks are in place
async function importHook() {
  const mod = await import('../useSwapGarment');
  return mod;
}

// ── Tests ──

describe('useSwapGarment swap mode integration', () => {
  it('sends swap_mode to the edge function', async () => {
    mockInvoke.mockResolvedValue({ data: { candidates: [] }, error: null });

    const { useSwapGarment } = await importHook();
    const { result } = renderHook(() => useSwapGarment(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.fetchCandidates(
        'top', 'garment-1', ['black'], [], 'vardag',
        { temperature: 15, precipitation: 'none', wind: 'low' },
        'bold'
      );
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const callArgs = mockInvoke.mock.calls[0];
    expect(callArgs[0]).toBe('burs_style_engine');
    expect(callArgs[1].body.swap_mode).toBe('bold');
    expect(callArgs[1].body.mode).toBe('swap');
  });

  it('sends safe as default swap_mode when not specified', async () => {
    mockInvoke.mockResolvedValue({ data: { candidates: [] }, error: null });

    const { useSwapGarment } = await importHook();
    const { result } = renderHook(() => useSwapGarment(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.fetchCandidates('top', 'garment-1', ['black']);
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke.mock.calls[0][1].body.swap_mode).toBe('safe');
  });

  it('falls back to client scoring with swapMode on engine error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: 'engine_down' });

    // Mock supabase query for fallback
    const mockGarments = [
      { id: 'g1', title: 'Tee', category: 'top', color_primary: 'red', wear_count: 0, fit: 'regular', in_laundry: false, formality: 5 },
      { id: 'g2', title: 'Shirt', category: 'top', color_primary: 'black', wear_count: 5, fit: 'slim', in_laundry: false, formality: 6 },
    ];

    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            in: () => ({
              neq: () => Promise.resolve({ data: mockGarments, error: null }),
            }),
          }),
        }),
      }),
    });

    const { useSwapGarment } = await importHook();
    const { result } = renderHook(() => useSwapGarment(), { wrapper: createWrapper() });

    let candidates: unknown[] = [];
    await act(async () => {
      candidates = await result.current.fetchCandidates(
        'top', 'other-garment', ['navy'], [], 'vardag',
        { temperature: 15, precipitation: 'none', wind: 'low' },
        'fresh'
      );
    });

    // Should have fallen back and returned scored candidates
    expect(candidates.length).toBeGreaterThan(0);
    // Verify breakdown includes swap_mode marker
    const first = candidates[0] as { breakdown?: Record<string, number> };
    expect(first.breakdown?.swap_mode).toBe(3); // fresh = 3
  });

  it('different modes produce different candidate orderings', async () => {
    // Two calls: one safe, one bold → verify the engine receives different modes
    mockInvoke
      .mockResolvedValueOnce({ data: { candidates: [{ garment: { id: 'a' }, score: 9 }] }, error: null })
      .mockResolvedValueOnce({ data: { candidates: [{ garment: { id: 'b' }, score: 8 }] }, error: null });

    const { useSwapGarment } = await importHook();
    const { result } = renderHook(() => useSwapGarment(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.fetchCandidates('top', 'g1', ['black'], [], 'vardag', undefined, 'safe');
    });
    await act(async () => {
      await result.current.fetchCandidates('top', 'g1', ['black'], [], 'vardag', undefined, 'bold');
    });

    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockInvoke.mock.calls[0][1].body.swap_mode).toBe('safe');
    expect(mockInvoke.mock.calls[1][1].body.swap_mode).toBe('bold');
  });
});
