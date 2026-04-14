import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRefineMode } from '../useRefineMode';

describe('useRefineMode', () => {
  it('starts with refine mode off', () => {
    const { result } = renderHook(() => useRefineMode());
    expect(result.current.isRefining).toBe(false);
    expect(result.current.lockedSlots).toEqual([]);
    expect(result.current.outfitHistory).toEqual([]);
  });

  it('enters refine mode with garment IDs', () => {
    const { result } = renderHook(() => useRefineMode());
    act(() => {
      result.current.enterRefineMode(['g1', 'g2', 'g3'], 'A nice outfit');
    });
    expect(result.current.isRefining).toBe(true);
    expect(result.current.activeGarmentIds).toEqual(['g1', 'g2', 'g3']);
  });

  it('toggles lock on a slot', () => {
    const { result } = renderHook(() => useRefineMode());
    act(() => {
      result.current.enterRefineMode(['g1', 'g2'], 'test');
    });
    act(() => {
      result.current.toggleLock('g1');
    });
    expect(result.current.lockedSlots).toEqual(['g1']);
    act(() => {
      result.current.toggleLock('g1');
    });
    expect(result.current.lockedSlots).toEqual([]);
  });

  it('pushes outfit history on refinement and supports undo', () => {
    const { result } = renderHook(() => useRefineMode());
    act(() => {
      result.current.enterRefineMode(['g1', 'g2'], 'first');
    });
    act(() => {
      result.current.pushRefinement(['g1', 'g3'], 'swapped bottom');
    });
    expect(result.current.activeGarmentIds).toEqual(['g1', 'g3']);
    expect(result.current.outfitHistory).toHaveLength(1);

    act(() => {
      result.current.undo();
    });
    expect(result.current.activeGarmentIds).toEqual(['g1', 'g2']);
    expect(result.current.outfitHistory).toHaveLength(0);
  });

  it('caps history at 10 versions', () => {
    const { result } = renderHook(() => useRefineMode());
    act(() => {
      result.current.enterRefineMode(['g0'], 'start');
    });
    for (let i = 1; i <= 12; i++) {
      act(() => {
        result.current.pushRefinement([`g${i}`], `version ${i}`);
      });
    }
    expect(result.current.outfitHistory.length).toBeLessThanOrEqual(10);
  });

  it('exits refine mode and clears state', () => {
    const { result } = renderHook(() => useRefineMode());
    act(() => {
      result.current.enterRefineMode(['g1', 'g2'], 'test');
      result.current.toggleLock('g1');
    });
    act(() => {
      result.current.exitRefineMode();
    });
    expect(result.current.isRefining).toBe(false);
    expect(result.current.lockedSlots).toEqual([]);
    expect(result.current.outfitHistory).toEqual([]);
  });
});
