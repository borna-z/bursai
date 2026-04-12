import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const { mockIsMedianApp } = vi.hoisted(() => ({
  mockIsMedianApp: vi.fn(),
}));

vi.mock('@/lib/median', () => ({
  isMedianApp: (...args: unknown[]) => mockIsMedianApp(...args),
}));

import { useMedianStatusBar } from '../useMedianStatusBar';

const wrapperFor = (path: string) => ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
);

describe('useMedianStatusBar', () => {
  let originalMedian: Window['median'];
  let setSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalMedian = window.median;
    setSpy = vi.fn();
    window.median = { statusbar: { set: setSpy } };
    mockIsMedianApp.mockReturnValue(true);
  });

  afterEach(() => {
    window.median = originalMedian;
    vi.clearAllMocks();
  });

  it('does nothing when not running inside Median', () => {
    mockIsMedianApp.mockReturnValue(false);
    renderHook(() => useMedianStatusBar('light'), { wrapper: wrapperFor('/') });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('does nothing when median.statusbar.set is missing', () => {
    window.median = {};
    renderHook(() => useMedianStatusBar('light'), { wrapper: wrapperFor('/') });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('uses light style on a dark route regardless of theme', () => {
    renderHook(() => useMedianStatusBar('light'), { wrapper: wrapperFor('/welcome') });
    expect(setSpy).toHaveBeenCalledWith({ style: 'light' });
  });

  it('uses light style when resolved theme is dark on a non-dark route', () => {
    renderHook(() => useMedianStatusBar('dark'), { wrapper: wrapperFor('/home') });
    expect(setSpy).toHaveBeenCalledWith({ style: 'light' });
  });

  it('uses dark style when on a light route with light theme', () => {
    renderHook(() => useMedianStatusBar('light'), { wrapper: wrapperFor('/home') });
    expect(setSpy).toHaveBeenCalledWith({ style: 'dark' });
  });

  it('treats /onboarding and /auth as dark routes', () => {
    renderHook(() => useMedianStatusBar('light'), { wrapper: wrapperFor('/auth') });
    expect(setSpy).toHaveBeenCalledWith({ style: 'light' });
    setSpy.mockClear();
    renderHook(() => useMedianStatusBar('light'), { wrapper: wrapperFor('/onboarding') });
    expect(setSpy).toHaveBeenCalledWith({ style: 'light' });
  });
});
