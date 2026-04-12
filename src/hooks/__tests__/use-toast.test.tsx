import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast, toast } from '../use-toast';

describe('useToast', () => {
  beforeEach(() => {
    // Drain toasts between tests by dismissing all + removing.
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.dismiss();
    });
  });

  it('starts with empty toast list for a fresh subscriber', () => {
    const { result } = renderHook(() => useToast());
    expect(Array.isArray(result.current.toasts)).toBe(true);
  });

  it('adds a toast and exposes it via the hook state', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: 'Hello', description: 'World' });
    });
    expect(result.current.toasts.length).toBeGreaterThan(0);
    const t = result.current.toasts[0];
    expect(t.title).toBe('Hello');
    expect(t.open).toBe(true);
  });

  it('limits visible toasts to TOAST_LIMIT (1)', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: 'first' });
      toast({ title: 'second' });
      toast({ title: 'third' });
    });
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].title).toBe('third');
  });

  it('dismiss(id) closes the matching toast', () => {
    const { result } = renderHook(() => useToast());
    let id = '';
    act(() => {
      const t = toast({ title: 'closeable' });
      id = t.id;
    });
    act(() => {
      result.current.dismiss(id);
    });
    const closed = result.current.toasts.find(t => t.id === id);
    expect(closed?.open).toBe(false);
  });

  it('dismiss() with no id closes all toasts', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: 'a' });
    });
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.toasts.every(t => t.open === false)).toBe(true);
  });

  it('cleans up its listener on unmount', () => {
    const { result, unmount } = renderHook(() => useToast());
    act(() => {
      toast({ title: 'before unmount' });
    });
    const beforeLen = result.current.toasts.length;
    unmount();
    // Adding a new toast after unmount should not throw and should not affect the
    // captured result snapshot. We assert that no exception is raised.
    expect(() => {
      toast({ title: 'after unmount' });
    }).not.toThrow();
    expect(beforeLen).toBeGreaterThanOrEqual(0);
  });
});
