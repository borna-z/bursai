import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useViewportShell } from '../useViewportShell';

interface FakeViewport {
  height: number;
  offsetTop: number;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

function makeVV(height = 700, offsetTop = 10): FakeViewport {
  return {
    height,
    offsetTop,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

describe('useViewportShell', () => {
  let originalVV: typeof window.visualViewport;
  let originalAdd: typeof window.addEventListener;
  let originalRemove: typeof window.removeEventListener;
  let addSpy: ReturnType<typeof vi.fn>;
  let removeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalVV = window.visualViewport;
    originalAdd = window.addEventListener;
    originalRemove = window.removeEventListener;
    addSpy = vi.fn();
    removeSpy = vi.fn();
    window.addEventListener = addSpy as unknown as typeof window.addEventListener;
    window.removeEventListener = removeSpy as unknown as typeof window.removeEventListener;
  });

  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', { value: originalVV, writable: true, configurable: true });
    window.addEventListener = originalAdd;
    window.removeEventListener = originalRemove;
    document.documentElement.style.removeProperty('--app-viewport-height');
    document.documentElement.style.removeProperty('--app-viewport-offset-top');
  });

  it('sets the viewport CSS vars on mount using visualViewport', () => {
    const vv = makeVV(600, 5);
    Object.defineProperty(window, 'visualViewport', { value: vv, writable: true, configurable: true });
    renderHook(() => useViewportShell());
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('600px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-offset-top')).toBe('5px');
  });

  it('falls back to window.innerHeight when visualViewport is undefined', () => {
    Object.defineProperty(window, 'visualViewport', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 999, writable: true, configurable: true });
    renderHook(() => useViewportShell());
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('999px');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-offset-top')).toBe('0px');
  });

  it('clamps negative offsetTop to 0', () => {
    const vv = makeVV(800, -50);
    Object.defineProperty(window, 'visualViewport', { value: vv, writable: true, configurable: true });
    renderHook(() => useViewportShell());
    expect(document.documentElement.style.getPropertyValue('--app-viewport-offset-top')).toBe('0px');
  });

  it('registers window resize and visualViewport listeners', () => {
    const vv = makeVV();
    Object.defineProperty(window, 'visualViewport', { value: vv, writable: true, configurable: true });
    renderHook(() => useViewportShell());
    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(vv.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(vv.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('cleans up listeners and CSS vars on unmount', () => {
    const vv = makeVV();
    Object.defineProperty(window, 'visualViewport', { value: vv, writable: true, configurable: true });
    const { unmount } = renderHook(() => useViewportShell());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(vv.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(vv.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-offset-top')).toBe('');
  });
});
