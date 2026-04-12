import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardAdjust } from '../useKeyboardAdjust';

interface FakeViewport {
  height: number;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  _listeners: Record<string, Array<() => void>>;
}

function makeViewport(height: number): FakeViewport {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    height,
    addEventListener: vi.fn((evt: string, cb: () => void) => {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(cb);
    }),
    removeEventListener: vi.fn((evt: string, cb: () => void) => {
      listeners[evt] = (listeners[evt] || []).filter(f => f !== cb);
    }),
    _listeners: listeners,
  };
}

describe('useKeyboardAdjust', () => {
  let originalVV: typeof window.visualViewport;
  let originalInnerHeight: number;

  beforeEach(() => {
    originalVV = window.visualViewport;
    originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', { value: originalVV, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true, configurable: true });
    document.documentElement.style.removeProperty('--keyboard-offset');
  });

  it('does nothing when visualViewport is unavailable', () => {
    Object.defineProperty(window, 'visualViewport', { value: undefined, writable: true, configurable: true });
    expect(() => renderHook(() => useKeyboardAdjust())).not.toThrow();
    expect(document.documentElement.style.getPropertyValue('--keyboard-offset')).toBe('');
  });

  it('registers resize and scroll listeners on visualViewport', () => {
    const vv = makeViewport(800);
    Object.defineProperty(window, 'visualViewport', { value: vv, writable: true, configurable: true });
    renderHook(() => useKeyboardAdjust());
    expect(vv.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(vv.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('sets --keyboard-offset to keyboard height when keyboard is open', () => {
    const vv = makeViewport(500);
    Object.defineProperty(window, 'visualViewport', { value: vv, writable: true, configurable: true });
    renderHook(() => useKeyboardAdjust());
    act(() => {
      vv._listeners.resize?.forEach(cb => cb());
    });
    expect(document.documentElement.style.getPropertyValue('--keyboard-offset')).toBe('300px');
  });

  it('sets --keyboard-offset to 0 when delta is small (< 50px)', () => {
    const vv = makeViewport(770);
    Object.defineProperty(window, 'visualViewport', { value: vv, writable: true, configurable: true });
    renderHook(() => useKeyboardAdjust());
    act(() => {
      vv._listeners.resize?.forEach(cb => cb());
    });
    expect(document.documentElement.style.getPropertyValue('--keyboard-offset')).toBe('0px');
  });

  it('removes listeners and clears CSS var on unmount', () => {
    const vv = makeViewport(500);
    Object.defineProperty(window, 'visualViewport', { value: vv, writable: true, configurable: true });
    const { unmount } = renderHook(() => useKeyboardAdjust());
    unmount();
    expect(vv.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(vv.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(document.documentElement.style.getPropertyValue('--keyboard-offset')).toBe('');
  });
});
