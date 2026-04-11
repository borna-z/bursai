import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { invokeEdgeFunctionMock, loggerErrorMock } = vi.hoisted(() => ({
  invokeEdgeFunctionMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  invokeEdgeFunction: invokeEdgeFunctionMock,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { useDuplicateDetection, DuplicateMatch } from '@/hooks/useDuplicateDetection';

const match: DuplicateMatch = {
  garment_id: 'g1',
  title: 'Blue Tee',
  image_path: 'p.png',
  confidence: 0.9,
  match_type: 'both',
  reasons: ['color', 'shape'],
};

describe('useDuplicateDetection', () => {
  beforeEach(() => {
    invokeEdgeFunctionMock.mockReset();
    loggerErrorMock.mockReset();
  });

  it('returns matches from edge function', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({ data: { duplicates: [match] }, error: null });
    const { result } = renderHook(() => useDuplicateDetection());

    let out: DuplicateMatch[] = [];
    await act(async () => {
      out = await result.current.checkDuplicates({ category: 'top' });
    });

    expect(out).toEqual([match]);
  });

  it('updates duplicates state to latest check', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({ data: { duplicates: [match] }, error: null });
    const { result } = renderHook(() => useDuplicateDetection());

    await act(async () => {
      await result.current.checkDuplicates({ category: 'top' });
    });

    expect(result.current.duplicates).toEqual([match]);
  });

  it('clearDuplicates resets to empty array', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({ data: { duplicates: [match] }, error: null });
    const { result } = renderHook(() => useDuplicateDetection());

    await act(async () => {
      await result.current.checkDuplicates({ category: 'top' });
    });
    expect(result.current.duplicates).toHaveLength(1);

    act(() => result.current.clearDuplicates());
    expect(result.current.duplicates).toEqual([]);
  });

  it('returns empty array when data is null', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useDuplicateDetection());

    let out: DuplicateMatch[] = [];
    await act(async () => {
      out = await result.current.checkDuplicates({ category: 'top' });
    });

    expect(out).toEqual([]);
  });

  it('returns empty array and logs on edge function error', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({ data: null, error: new Error('fail') });
    const { result } = renderHook(() => useDuplicateDetection());

    let out: DuplicateMatch[] = [];
    await act(async () => {
      out = await result.current.checkDuplicates({ category: 'top' });
    });

    expect(out).toEqual([]);
    expect(loggerErrorMock).toHaveBeenCalled();
  });

  it('returns empty array when invokeEdgeFunction throws', async () => {
    invokeEdgeFunctionMock.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useDuplicateDetection());

    let out: DuplicateMatch[] = [];
    await act(async () => {
      out = await result.current.checkDuplicates({ category: 'top' });
    });

    expect(out).toEqual([]);
    expect(loggerErrorMock).toHaveBeenCalled();
  });
});
