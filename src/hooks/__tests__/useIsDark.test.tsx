import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { mockUseTheme } = vi.hoisted(() => ({
  mockUseTheme: vi.fn(),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: (...args: unknown[]) => mockUseTheme(...args),
}));

import { useIsDark } from '../useIsDark';

describe('useIsDark', () => {
  let originalMatchMedia: typeof window.matchMedia | undefined;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('returns true when theme is "dark"', () => {
    mockUseTheme.mockReturnValue({ theme: 'dark' });
    const { result } = renderHook(() => useIsDark());
    expect(result.current).toBe(true);
  });

  it('returns false when theme is "light"', () => {
    mockUseTheme.mockReturnValue({ theme: 'light' });
    const { result } = renderHook(() => useIsDark());
    expect(result.current).toBe(false);
  });

  it('falls back to matchMedia when theme is "system" and OS prefers dark', () => {
    mockUseTheme.mockReturnValue({ theme: 'system' });
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useIsDark());
    expect(result.current).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });

  it('falls back to matchMedia when theme is "system" and OS prefers light', () => {
    mockUseTheme.mockReturnValue({ theme: 'system' });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useIsDark());
    expect(result.current).toBe(false);
  });
});
