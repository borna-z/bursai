import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollReveal } from '../useScrollReveal';

interface FakeObserver {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  trigger: (isIntersecting: boolean) => void;
  threshold: number | number[] | undefined;
}

const observers: FakeObserver[] = [];

class MockIntersectionObserver implements IntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds: number[] = [];
  private cb: IntersectionObserverCallback;
  private fake: FakeObserver;

  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.cb = cb;
    this.fake = {
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
      trigger: (isIntersecting: boolean) => {
        cb(
          [{ isIntersecting } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      },
      threshold: options?.threshold as number,
    };
    observers.push(this.fake);
  }

  observe = (...args: unknown[]) => this.fake.observe(...args);
  disconnect = () => this.fake.disconnect();
  unobserve = (...args: unknown[]) => this.fake.unobserve(...args);
  takeRecords = () => [];
}

describe('useScrollReveal', () => {
  let originalIO: typeof IntersectionObserver;

  beforeEach(() => {
    originalIO = globalThis.IntersectionObserver;
    observers.length = 0;
    globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIO;
    observers.length = 0;
  });

  it('returns a callback ref function', () => {
    const { result } = renderHook(() => useScrollReveal());
    expect(typeof result.current).toBe('function');
  });

  it('does not create an observer when ref is set to null', () => {
    const { result } = renderHook(() => useScrollReveal());
    act(() => {
      result.current(null);
    });
    expect(observers.length).toBe(0);
  });

  it('creates an observer and observes the node when attached', () => {
    const { result } = renderHook(() => useScrollReveal());
    const node = document.createElement('div');
    act(() => {
      result.current(node);
    });
    expect(observers.length).toBe(1);
    expect(observers[0].observe).toHaveBeenCalledWith(node);
  });

  it('uses the provided threshold', () => {
    const { result } = renderHook(() => useScrollReveal(0.5));
    const node = document.createElement('div');
    act(() => {
      result.current(node);
    });
    expect(observers[0].threshold).toBe(0.5);
  });

  it('adds "visible" class on intersection and disconnects', () => {
    const { result } = renderHook(() => useScrollReveal());
    const node = document.createElement('div');
    act(() => {
      result.current(node);
    });
    act(() => {
      observers[0].trigger(true);
    });
    expect(node.classList.contains('visible')).toBe(true);
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it('disconnects the previous observer when ref is reassigned', () => {
    const { result } = renderHook(() => useScrollReveal());
    const node1 = document.createElement('div');
    const node2 = document.createElement('div');
    act(() => {
      result.current(node1);
    });
    act(() => {
      result.current(node2);
    });
    expect(observers[0].disconnect).toHaveBeenCalled();
    expect(observers.length).toBe(2);
    expect(observers[1].observe).toHaveBeenCalledWith(node2);
  });
});
